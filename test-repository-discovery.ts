import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import connectToDatabase from "./lib/mongodb/client";
import User from "./models/User";
import Integration from "./models/Integration";
import Project from "./models/Project";
import Activity from "./models/Activity";
import { encryptToken } from "./lib/auth/encryption";
import { encrypt as createSessionToken } from "./lib/auth/session";

import { GET as reposHandler } from "./app/api/integrations/github/repos/route";
import { GET as branchesHandler } from "./app/api/integrations/github/branches/route";
import { POST as createProjectHandler } from "./app/api/projects/route";

async function runRepositoryDiscoveryTestSuite() {
  console.log("=== STEP 7: REPOSITORY DISCOVERY & BRANCH SELECTION TEST SUITE ===\n");

  await connectToDatabase();

  const timestamp = Date.now();
  const userA_Email = `repo_user_a_${timestamp}@deployx.test`;
  const userB_Email = `repo_user_b_${timestamp}@deployx.test`;

  let userA: any = null;
  let userB: any = null;
  let sessionA = "";
  let sessionB = "";
  let integrationA: any = null;

  const originalFetch = global.fetch;

  try {
    // 0. Setup test user fixtures
    console.log("[Setup] Creating isolated test users (User A & User B)...");
    userA = await User.create({
      name: "Repo Test User A",
      username: `repo_a_${timestamp}`,
      email: userA_Email,
      passwordHash: "dummy_hash",
      status: "active",
    });

    userB = await User.create({
      name: "Repo Test User B",
      username: `repo_b_${timestamp}`,
      email: userB_Email,
      passwordHash: "dummy_hash",
      status: "active",
    });

    sessionA = await createSessionToken({ userId: userA._id.toString() });
    sessionB = await createSessionToken({ userId: userB._id.toString() });
    console.log(`✓ Created User A (${userA._id}) and User B (${userB._id})\n`);

    // TEST 1: Disconnected GitHub account handling
    console.log("[TEST 1] Testing Disconnected GitHub Account Responses...");
    const unconnReposReq = new Request("http://localhost:3000/api/integrations/github/repos", {
      headers: { cookie: `session=${sessionA}` },
    });
    const unconnReposRes = await reposHandler(unconnReposReq);
    if (unconnReposRes.status !== 404) {
      throw new Error(`Expected 404 when GitHub is disconnected, got ${unconnReposRes.status}`);
    }

    const unconnBranchesReq = new Request("http://localhost:3000/api/integrations/github/branches?repo=test/repo", {
      headers: { cookie: `session=${sessionA}` },
    });
    const unconnBranchesRes = await branchesHandler(unconnBranchesReq);
    if (unconnBranchesRes.status !== 404) {
      throw new Error(`Expected 404 for branches when disconnected, got ${unconnBranchesRes.status}`);
    }

    const unconnProjectReq = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { cookie: `session=${sessionA}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Unconnected Proj", repository: "test/repo" }),
    });
    const unconnProjectRes = await createProjectHandler(unconnProjectReq);
    if (unconnProjectRes.status !== 400) {
      throw new Error(`Expected 400 when creating project without connected GitHub, got ${unconnProjectRes.status}`);
    }
    console.log("✓ Disconnected GitHub states cleanly handled across repos, branches, and project creation.\n");

    // Connect User A with mock integration
    const mockGhId = 554433221;
    const mockGhLogin = `deployx-user-${timestamp}`;
    const mockToken = `gho_mock_access_token_${timestamp}`;
    const encryptedToken = encryptToken(mockToken);

    integrationA = await Integration.create({
      userId: userA._id,
      provider: "github",
      providerAccountId: String(mockGhId),
      accessToken: encryptedToken,
      metadata: {
        username: mockGhLogin,
        name: "DeployX Developer",
        avatarUrl: "https://avatars.githubusercontent.com/u/554433221?v=4",
        scopes: ["read:user", "repo"],
      },
    });

    // Mock GitHub API responses
    global.fetch = async (input: any, init?: any) => {
      const urlStr = typeof input === "string" ? input : input.url;

      // 1. User repositories endpoint
      if (urlStr.includes("api.github.com/user/repos")) {
        const url = new URL(urlStr);
        const visibility = url.searchParams.get("visibility");

        const allMockRepos = [
          {
            id: 1001,
            full_name: `${mockGhLogin}/web-dashboard`,
            name: "web-dashboard",
            description: "Modern Next.js web dashboard with analytics",
            private: false,
            visibility: "public",
            html_url: `https://github.com/${mockGhLogin}/web-dashboard`,
            language: "TypeScript",
            default_branch: "main",
            updated_at: new Date().toISOString(),
            permissions: { admin: true, push: true, pull: true },
            owner: { login: mockGhLogin, avatar_url: "https://github.com/avatar.png" },
          },
          {
            id: 1002,
            full_name: `${mockGhLogin}/private-api`,
            name: "private-api",
            description: "Confidential backend microservice",
            private: true,
            visibility: "private",
            html_url: `https://github.com/${mockGhLogin}/private-api`,
            language: "Node.js",
            default_branch: "master",
            updated_at: new Date(Date.now() - 3600000).toISOString(),
            permissions: { admin: false, push: true, pull: true },
            owner: { login: mockGhLogin, avatar_url: "https://github.com/avatar.png" },
          },
        ];

        let filtered = allMockRepos;
        if (visibility === "public") filtered = allMockRepos.filter((r) => !r.private);
        if (visibility === "private") filtered = allMockRepos.filter((r) => r.private);

        return new Response(JSON.stringify(filtered), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            link: '<https://api.github.com/user/repos?page=2>; rel="next"',
          },
        });
      }

      // 2. Specific repository metadata endpoint
      if (urlStr.includes(`api.github.com/repos/${mockGhLogin}/web-dashboard`) && !urlStr.includes("/branches")) {
        return new Response(
          JSON.stringify({
            id: 1001,
            full_name: `${mockGhLogin}/web-dashboard`,
            name: "web-dashboard",
            private: false,
            default_branch: "main",
            owner: { login: mockGhLogin },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 3. Branches endpoint for web-dashboard
      if (urlStr.includes(`api.github.com/repos/${mockGhLogin}/web-dashboard/branches`)) {
        if (urlStr.endsWith("/branches/main")) {
          return new Response(JSON.stringify({ name: "main", commit: { sha: "abc111" } }), { status: 200 });
        }
        if (urlStr.endsWith("/branches/staging")) {
          return new Response(JSON.stringify({ name: "staging", commit: { sha: "abc222" } }), { status: 200 });
        }
        if (urlStr.endsWith("/branches/non-existent-branch")) {
          return new Response(JSON.stringify({ message: "Branch not found" }), { status: 404 });
        }

        // List branches
        return new Response(
          JSON.stringify([
            { name: "staging", commit: { sha: "abc222" }, protected: false },
            { name: "main", commit: { sha: "abc111" }, protected: true },
            { name: "feature-auth", commit: { sha: "abc333" }, protected: false },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 4. Empty repository simulation
      if (urlStr.includes("api.github.com/repos/test/empty-repo")) {
        if (urlStr.includes("/branches")) {
          return new Response(JSON.stringify({ message: "Git Repository is empty." }), { status: 409 });
        }
        return new Response(
          JSON.stringify({ id: 9999, full_name: "test/empty-repo", name: "empty-repo", default_branch: "main" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      // 5. Inaccessible repository simulation
      if (urlStr.includes("api.github.com/repos/other-user/forbidden-repo")) {
        return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      }

      return originalFetch(input, init);
    };

    // TEST 2: Successful real repository listing & token confidentiality
    console.log("[TEST 2] Real Repository Listing & Token Confidentiality...");
    const reposReq = new Request("http://localhost:3000/api/integrations/github/repos", {
      headers: { cookie: `session=${sessionA}` },
    });
    const reposRes = await reposHandler(reposReq);
    if (!reposRes.ok) throw new Error(`Repos fetch failed: ${reposRes.status}`);

    const reposJson = await reposRes.json();
    if (!reposJson.repos || reposJson.repos.length !== 2) {
      throw new Error(`Expected 2 repositories, got ${reposJson.repos?.length}`);
    }

    const firstRepo = reposJson.repos[0];
    if (firstRepo.name !== "web-dashboard" || firstRepo.visibility !== "public" || firstRepo.language !== "TypeScript") {
      throw new Error(`Unexpected repo properties: ${JSON.stringify(firstRepo)}`);
    }

    // Check token confidentiality
    const jsonString = JSON.stringify(reposJson);
    if (jsonString.includes(mockToken) || jsonString.includes("accessToken") || jsonString.includes("clientSecret")) {
      throw new Error("SECURITY FAILURE: Raw access token or secret exposed in repository list response!");
    }
    console.log("✓ Real repositories returned with metadata, visibility labels, and 0 exposed tokens.\n");

    // TEST 3: Repository search filtering & pagination metadata
    console.log("[TEST 3] Repository Search Filter & Pagination Metadata...");
    const searchReq = new Request("http://localhost:3000/api/integrations/github/repos?search=dashboard", {
      headers: { cookie: `session=${sessionA}` },
    });
    const searchRes = await reposHandler(searchReq);
    const searchJson = await searchRes.json();

    if (searchJson.repos.length !== 1 || searchJson.repos[0].name !== "web-dashboard") {
      throw new Error(`Search filter failed. Expected 1 match, got: ${JSON.stringify(searchJson.repos)}`);
    }
    if (typeof searchJson.hasMore !== "boolean" || searchJson.page !== 1) {
      throw new Error("Missing pagination metadata in response");
    }
    console.log("✓ Repository search filter and pagination metadata verified.\n");

    // TEST 4: Fetch real branches & identify default branch
    console.log("[TEST 4] Fetching Real Branches & Default Branch Identification...");
    const branchesReq = new Request(`http://localhost:3000/api/integrations/github/branches?repo=${mockGhLogin}/web-dashboard`, {
      headers: { cookie: `session=${sessionA}` },
    });
    const branchesRes = await branchesHandler(branchesReq);
    if (!branchesRes.ok) throw new Error(`Branches fetch failed: ${branchesRes.status}`);

    const branchesJson = await branchesRes.json();
    if (branchesJson.defaultBranch !== "main") {
      throw new Error(`Expected defaultBranch 'main', got: ${branchesJson.defaultBranch}`);
    }
    if (!branchesJson.branches || branchesJson.branches.length !== 3) {
      throw new Error(`Expected 3 branches, got ${branchesJson.branches?.length}`);
    }
    // Verify default branch is sorted to the top
    if (branchesJson.branches[0].name !== "main" || !branchesJson.branches[0].isDefault) {
      throw new Error("Default branch was not sorted to top of branches list!");
    }
    console.log("✓ Real branches fetched, default branch identified ('main'), and sorted to top.\n");

    // TEST 5: Empty repository handling (409 Conflict from GitHub)
    console.log("[TEST 5] Empty Repository Handling...");
    const emptyRepoReq = new Request("http://localhost:3000/api/integrations/github/branches?repo=test/empty-repo", {
      headers: { cookie: `session=${sessionA}` },
    });
    const emptyRepoRes = await branchesHandler(emptyRepoReq);
    const emptyJson = await emptyRepoRes.json();
    if (!emptyJson.isEmpty || emptyJson.branches.length !== 0) {
      throw new Error(`Expected isEmpty: true for empty repository, got: ${JSON.stringify(emptyJson)}`);
    }
    console.log("✓ Empty repositories gracefully handled with isEmpty flag.\n");

    // TEST 6: Server-side validation rejects inaccessible repository
    console.log("[TEST 6] Server-side Revalidation of Repository Access...");
    const forbiddenProjectReq = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { cookie: `session=${sessionA}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Forbidden App",
        repository: "other-user/forbidden-repo",
        branch: "main",
      }),
    });
    const forbiddenProjectRes = await createProjectHandler(forbiddenProjectReq);
    if (forbiddenProjectRes.status !== 400) {
      throw new Error(`Expected 400 when user tries to import inaccessible repository, got ${forbiddenProjectRes.status}`);
    }
    console.log("✓ Inaccessible or unauthorized repositories strictly rejected by server-side revalidation.\n");

    // TEST 7: Server-side validation rejects non-existent branch
    console.log("[TEST 7] Server-side Revalidation of Branch Existence...");
    const badBranchReq = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { cookie: `session=${sessionA}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Web Dashboard App",
        repository: `${mockGhLogin}/web-dashboard`,
        branch: "non-existent-branch",
      }),
    });
    const badBranchRes = await createProjectHandler(badBranchReq);
    if (badBranchRes.status !== 400) {
      throw new Error(`Expected 400 when specifying non-existent branch, got ${badBranchRes.status}`);
    }
    const badBranchJson = await badBranchRes.json();
    if (!badBranchJson.error.includes("does not exist")) {
      throw new Error(`Unexpected error message for bad branch: ${badBranchJson.error}`);
    }
    console.log("✓ Fake or non-existent branches strictly rejected by server-side verification.\n");

    // TEST 8: Successful project creation with verified repo & branch metadata
    console.log("[TEST 8] Successful Project Creation with Stable Metadata...");
    const validProjectReq = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { cookie: `session=${sessionA}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "My Official Dashboard",
        repository: `${mockGhLogin}/web-dashboard`,
        branch: "staging",
        framework: "Next.js",
        buildCommand: "npm run build",
        outputDirectory: ".next",
        installCommand: "npm install",
      }),
    });
    const validProjectRes = await createProjectHandler(validProjectReq);
    if (validProjectRes.status !== 201) {
      const errText = await validProjectRes.text();
      throw new Error(`Project creation failed with status ${validProjectRes.status}: ${errText}`);
    }

    const projectJson = await validProjectRes.json();
    const createdProject = projectJson.project;

    if (createdProject.repository !== `${mockGhLogin}/web-dashboard`) {
      throw new Error(`Unexpected repository: ${createdProject.repository}`);
    }
    if (createdProject.branch !== "staging") {
      throw new Error(`Expected branch 'staging', got: ${createdProject.branch}`);
    }
    if (createdProject.repositoryId !== 1001) {
      throw new Error(`Expected repositoryId 1001, got: ${createdProject.repositoryId}`);
    }
    if (createdProject.repositoryVisibility !== "public") {
      throw new Error(`Expected repositoryVisibility 'public', got: ${createdProject.repositoryVisibility}`);
    }
    if (createdProject.productionUrl !== undefined) {
      throw new Error("SECURITY/TRUTH VIOLATION: productionUrl was prematurely assigned before deployment!");
    }

    // Verify Project saved in DB
    const dbProject = await Project.findById(createdProject._id);
    if (!dbProject || dbProject.userId.toString() !== userA._id.toString()) {
      throw new Error("Project was not saved with correct authenticated owner ID!");
    }
    console.log("✓ Project successfully saved with verified repository ID, owner, branch, and no premature production URL.\n");

    // TEST 9: Duplicate project prevention for same repository under same account
    console.log("[TEST 9] Duplicate Project Prevention for Same Repository...");
    const dupProjectReq = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { cookie: `session=${sessionA}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Second Dashboard",
        repository: `${mockGhLogin}/web-dashboard`,
        branch: "main",
      }),
    });
    const dupProjectRes = await createProjectHandler(dupProjectReq);
    if (dupProjectRes.status !== 409) {
      throw new Error(`Expected 409 conflict for duplicate repository project, got ${dupProjectRes.status}`);
    }
    const dupJson = await dupProjectRes.json();
    if (!dupJson.existingProjectId) {
      throw new Error("Expected existingProjectId in duplicate conflict response");
    }
    console.log("✓ Duplicate project for same repository blocked with HTTP 409 and existingProjectId returned.\n");

    // TEST 10: Multi-tenant isolation (User B cannot see or import User A's repositories)
    console.log("[TEST 10] Multi-Tenant Isolation & Ownership Boundaries...");
    const userB_ReposReq = new Request("http://localhost:3000/api/integrations/github/repos", {
      headers: { cookie: `session=${sessionB}` },
    });
    const userB_ReposRes = await reposHandler(userB_ReposReq);
    if (userB_ReposRes.status !== 404) {
      throw new Error("Cross-tenant leak: User B was able to fetch repositories without their own GitHub integration!");
    }
    console.log("✓ Cross-tenant boundaries strictly enforced. User B cannot access User A's repository discovery.\n");

    console.log("=== ALL REPOSITORY DISCOVERY & BRANCH SELECTION TESTS PASSED (10/10) ===\n");
  } finally {
    global.fetch = originalFetch;

    // Cleanup test fixtures
    console.log("[Cleanup] Removing test users, projects, and integrations...");
    if (userA?._id) {
      await Project.deleteMany({ userId: userA._id });
      await Integration.deleteMany({ userId: userA._id });
      await Activity.deleteMany({ userId: userA._id });
      await User.findByIdAndDelete(userA._id);
    }
    if (userB?._id) {
      await Project.deleteMany({ userId: userB._id });
      await Integration.deleteMany({ userId: userB._id });
      await Activity.deleteMany({ userId: userB._id });
      await User.findByIdAndDelete(userB._id);
    }
    console.log("✓ Test fixtures cleanly removed. Real data untouched.\n");
  }
}

runRepositoryDiscoveryTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test suite failed:", err);
    process.exit(1);
  });
