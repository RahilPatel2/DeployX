import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import connectToDatabase from "./lib/mongodb/client";
import User from "./models/User";
import Project from "./models/Project";
import Deployment from "./models/Deployment";
import Activity from "./models/Activity";
import Integration from "./models/Integration";
import { encryptToken } from "./lib/auth/encryption";
import { encrypt, requireAuth } from "./lib/auth/session";
import { getSafeRedirectUrl } from "./lib/auth/redirect";
import { GET as getProjectsHandler, POST as postProjectsHandler } from "./app/api/projects/route";
import { GET as getProjectByIdHandler, DELETE as deleteProjectByIdHandler, PATCH as patchProjectByIdHandler } from "./app/api/projects/[id]/route";
import { GET as getDeploymentsHandler, POST as postDeploymentsHandler } from "./app/api/deployments/route";
import { GET as getDeploymentByIdHandler } from "./app/api/deployments/[id]/route";
import { GET as getDeploymentLogsHandler } from "./app/api/deployments/[id]/logs/route";
import { GET as getActivityHandler } from "./app/api/activity/route";
import { GET as getDomainsHandler, POST as postDomainsHandler } from "./app/api/domains/route";
import { GET as getNotificationsHandler, PUT as putNotificationsHandler } from "./app/api/notifications/route";
import { GET as getGithubStatusHandler } from "./app/api/integrations/github/status/route";
import { PUT as updateProfileHandler } from "./app/api/auth/profile/route";

async function runSecurityIsolationTests() {
  console.log("=== STEP 5: ROUTE PROTECTION & USER ISOLATION TEST SUITE ===\n");

  await connectToDatabase();

  const timestamp = Date.now();
  const userA_Email = `user_a_${timestamp}@deployx.test`;
  const userB_Email = `user_b_${timestamp}@deployx.test`;

  let userA: any = null;
  let userB: any = null;
  let tokenA = "";
  let tokenB = "";
  let projectA: any = null;
  let deploymentA: any = null;

  try {
    // 0. Setup test user fixtures
    console.log("[Setup] Creating isolated test users (User A & User B)...");
    userA = await User.create({
      name: "Security User A",
      username: `user_a_${timestamp}`,
      email: userA_Email,
      passwordHash: "dummy_hash_for_test",
      status: "active",
    });

    userB = await User.create({
      name: "Security User B",
      username: `user_b_${timestamp}`,
      email: userB_Email,
      passwordHash: "dummy_hash_for_test",
      status: "active",
    });

    tokenA = await encrypt({ userId: userA._id.toString() });
    tokenB = await encrypt({ userId: userB._id.toString() });

    console.log(`✓ Created User A (${userA._id}) and User B (${userB._id})\n`);

    // TEST 1: Unauthenticated Requests Rejection
    console.log("[TEST 1] Unauthenticated Backend API Protection...");
    const unauthReq = new Request("http://localhost:3000/api/projects");
    const unauthProjects = await getProjectsHandler(unauthReq);
    if (unauthProjects.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /api/projects, got ${unauthProjects.status}`);
    }

    const unauthDeployments = await getDeploymentsHandler(new Request("http://localhost:3000/api/deployments"));
    if (unauthDeployments.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /api/deployments, got ${unauthDeployments.status}`);
    }

    const unauthActivity = await getActivityHandler(new Request("http://localhost:3000/api/activity"));
    if (unauthActivity.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /api/activity, got ${unauthActivity.status}`);
    }

    const unauthDomains = await getDomainsHandler(new Request("http://localhost:3000/api/domains"));
    if (unauthDomains.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /api/domains, got ${unauthDomains.status}`);
    }

    const unauthNotifications = await getNotificationsHandler(new Request("http://localhost:3000/api/notifications"));
    if (unauthNotifications.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated /api/notifications, got ${unauthNotifications.status}`);
    }

    let requireAuthFailed = false;
    try {
      await requireAuth();
    } catch {
      requireAuthFailed = true;
    }
    if (!requireAuthFailed) {
      throw new Error("Expected requireAuth() without session to throw Unauthorized");
    }
    console.log("✓ All backend operations strictly reject unauthenticated requests with HTTP 401.\n");

    // TEST 2: User A creates resources
    console.log("[TEST 2] Resource Creation for User A...");
    projectA = await Project.create({
      name: "Project A",
      slug: `proj-a-${timestamp}`,
      userId: userA._id,
      repository: "userA/repoA",
      branch: "main",
      buildCommand: "npm run build",
      outputDirectory: ".next",
      installCommand: "npm install",
      cloudflareProjectName: `cf-proj-a-${timestamp}`,
      productionUrl: `cf-proj-a-${timestamp}.pages.dev`,
    });

    deploymentA = await Deployment.create({
      projectId: projectA._id,
      userId: userA._id,
      cloudflareDeploymentId: `cf-deploy-${timestamp}`,
      status: "READY",
      branch: "main",
      url: `https://cf-proj-a-${timestamp}.pages.dev`,
      environment: "Production",
      logs: ["Build completed successfully"],
    });
    console.log(`✓ Project A (${projectA._id}) and Deployment A (${deploymentA._id}) created for User A.\n`);

    // TEST 3: User B attempts to access User A's project
    console.log("[TEST 3] User B cannot read User A's project...");
    const userB_getProjectReq = new Request(`http://localhost:3000/api/projects/${projectA._id}`, {
      headers: { cookie: `session=${tokenB}` },
    });
    const userB_getProjectRes = await getProjectByIdHandler(userB_getProjectReq, {
      params: Promise.resolve({ id: projectA._id.toString() }),
    });
    if (userB_getProjectRes.status !== 404) {
      throw new Error(`Expected 404 when User B reads User A's project, got ${userB_getProjectRes.status}`);
    }
    console.log("✓ User B cannot read User A's project (Safe 404 returned without leaking existence).\n");

    // TEST 4: User B attempts to modify or delete User A's project
    console.log("[TEST 4] User B cannot modify or delete User A's project...");
    const userB_deleteProjectReq = new Request(`http://localhost:3000/api/projects/${projectA._id}`, {
      headers: { cookie: `session=${tokenB}` },
    });
    const userB_deleteProjectRes = await deleteProjectByIdHandler(userB_deleteProjectReq, {
      params: Promise.resolve({ id: projectA._id.toString() }),
    });
    if (userB_deleteProjectRes.status !== 404) {
      throw new Error(`Expected 404 when User B deletes User A's project, got ${userB_deleteProjectRes.status}`);
    }

    const userB_patchProjectReq = new Request(`http://localhost:3000/api/projects/${projectA._id}`, {
      method: "PATCH",
      headers: { cookie: `session=${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Hacked Project Name" }),
    });
    const userB_patchProjectRes = await patchProjectByIdHandler(userB_patchProjectReq, {
      params: Promise.resolve({ id: projectA._id.toString() }),
    });
    if (userB_patchProjectRes.status !== 404) {
      throw new Error(`Expected 404 when User B updates User A's project, got ${userB_patchProjectRes.status}`);
    }

    // Verify Project A is unchanged in DB
    const checkProjectA = await Project.findById(projectA._id);
    if (!checkProjectA || checkProjectA.name !== "Project A") {
      throw new Error("Project A was modified or deleted by unauthorized User B!");
    }
    console.log("✓ User B cannot modify or delete User A's project.\n");

    // TEST 5: User B cannot view or redeploy User A's deployment
    console.log("[TEST 5] User B cannot access User A's deployment or logs...");
    const userB_getDeploymentReq = new Request(`http://localhost:3000/api/deployments/${deploymentA._id}`, {
      headers: { cookie: `session=${tokenB}` },
    });
    const userB_getDeploymentRes = await getDeploymentByIdHandler(userB_getDeploymentReq, {
      params: Promise.resolve({ id: deploymentA._id.toString() }),
    });
    if (userB_getDeploymentRes.status !== 404) {
      throw new Error(`Expected 404 when User B views User A's deployment, got ${userB_getDeploymentRes.status}`);
    }

    const userB_getLogsReq = new Request(`http://localhost:3000/api/deployments/${deploymentA._id}/logs`, {
      headers: { cookie: `session=${tokenB}` },
    });
    const userB_getLogsRes = await getDeploymentLogsHandler(userB_getLogsReq, {
      params: Promise.resolve({ id: deploymentA._id.toString() }),
    });
    if (userB_getLogsRes.status !== 404) {
      throw new Error(`Expected 404 when User B views User A's logs, got ${userB_getLogsRes.status}`);
    }
    console.log("✓ User B cannot view User A's deployment or logs (Safe 404 returned).\n");

    // TEST 6: Nested deployment trigger ownership verification
    console.log("[TEST 6] User B cannot trigger a deployment for User A's project...");
    const userB_deployReq = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: { cookie: `session=${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: projectA._id.toString() }),
    });
    const userB_deployRes = await postDeploymentsHandler(userB_deployReq);
    if (userB_deployRes.status !== 404) {
      throw new Error(`Expected 404 when User B attempts to deploy User A's project, got ${userB_deployRes.status}`);
    }
    console.log("✓ Deployment initiation strictly verifies parent project ownership (HTTP 404 returned).\n");

    // TEST 7: Query filtering with foreign projectId returns empty set
    console.log("[TEST 7] Listing deployments with foreign projectId returns empty list...");
    const userB_listDeploymentsReq = new Request(`http://localhost:3000/api/deployments?projectId=${projectA._id}`, {
      headers: { cookie: `session=${tokenB}` },
    });
    const userB_listDeploymentsRes = await getDeploymentsHandler(userB_listDeploymentsReq);
    const userB_deploymentsJson = await userB_listDeploymentsRes.json();
    if (userB_deploymentsJson.deployments.length !== 0) {
      throw new Error("User B was able to see User A's deployments by specifying projectId parameter!");
    }
    console.log("✓ Querying deployments with another user's projectId returns empty array.\n");

    // TEST 8: Forged userId in payload is ignored
    console.log("[TEST 8] Forged userId and ownerId fields are ignored on the server...");
    await Integration.create({
      userId: userB._id,
      provider: "github",
      providerId: `gh-b-${timestamp}`,
      providerUsername: "userb",
      accessToken: encryptToken("ghp_fakeTokenForSecurityIsolationTest123"),
      scope: "read:user,repo",
    });
    const forgeReq = new Request("http://localhost:3000/api/projects", {
      method: "POST",
      headers: { cookie: `session=${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Forged Project",
        repository: "userB/forged",
        userId: userA._id.toString(), // Attacker attempts to forge User A's ID
        ownerId: userA._id.toString(),
      }),
    });
    const origFetch = global.fetch;
    global.fetch = (async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("api.github.com/repos/")) {
        return new Response(JSON.stringify({ id: 98765, name: "forged", full_name: "userB/forged", default_branch: "main", private: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return origFetch(input, init);
    }) as any;

    let forgeRes: any;
    try {
      forgeRes = await postProjectsHandler(forgeReq);
    } finally {
      global.fetch = origFetch;
    }

    if (forgeRes.status !== 200 && forgeRes.status !== 201) {
      const err = await forgeRes.text();
      throw new Error(`Expected 201 for project creation, got ${forgeRes.status}: ${err}`);
    }
    const forgeJson = await forgeRes.json();
    if (forgeJson.project.userId.toString() !== userB._id.toString()) {
      throw new Error(`Security breach: project was assigned forged userId ${forgeJson.project.userId} instead of session user ${userB._id}!`);
    }
    // Clean up forged project
    await Project.findByIdAndDelete(forgeJson.project._id);
    console.log("✓ Server derives ownership strictly from validated session; forged IDs in payload are discarded.\n");

    // TEST 9: Privilege elevation prevention
    console.log("[TEST 9] User cannot elevate role or status via profile update...");
    const elevateReq = new Request("http://localhost:3000/api/auth/profile", {
      method: "PUT",
      headers: { cookie: `session=${tokenB}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Elevated User",
        role: "admin",
        isAdmin: true,
        status: "superadmin",
      }),
    });
    await updateProfileHandler(elevateReq);
    const reloadedUserB = await User.findById(userB._id).lean();
    if ((reloadedUserB as any).role || (reloadedUserB as any).isAdmin || (reloadedUserB as any).status === "superadmin") {
      throw new Error("Security breach: user was able to inject administrative roles via profile update!");
    }
    console.log("✓ Unauthorized role and permission fields are discarded; users cannot self-elevate.\n");

    // TEST 10: Open Redirect Protection
    console.log("[TEST 10] Open redirect prevention with getSafeRedirectUrl...");
    const testCases = [
      { input: "https://evil.com", expected: "/dashboard" },
      { input: "http://evil.com/phish", expected: "/dashboard" },
      { input: "//evil.com", expected: "/dashboard" },
      { input: "/\\evil.com", expected: "/dashboard" },
      { input: "javascript:alert(1)", expected: "/dashboard" },
      { input: "data:text/html,evil", expected: "/dashboard" },
      { input: "", expected: "/dashboard" },
      { input: null, expected: "/dashboard" },
      { input: "/dashboard/projects", expected: "/dashboard/projects" },
      { input: "/dashboard/deployments/123", expected: "/dashboard/deployments/123" },
      { input: "/settings/profile", expected: "/settings/profile" },
    ];

    for (const tc of testCases) {
      const result = getSafeRedirectUrl(tc.input);
      if (result !== tc.expected) {
        throw new Error(`getSafeRedirectUrl failed for input "${tc.input}": expected "${tc.expected}", got "${result}"`);
      }
    }
    console.log("✓ Open redirects are completely blocked; only relative paths on the same origin are permitted.\n");

    console.log("=== ALL ROUTE PROTECTION & USER ISOLATION TESTS PASSED (10/10) ===");
  } finally {
    // Cleanup fixtures
    console.log("\n[Cleanup] Removing isolated test fixtures...");
    if (projectA) {
      await Project.findByIdAndDelete(projectA._id);
      await Deployment.deleteMany({ projectId: projectA._id });
    }
    if (userA) await User.findByIdAndDelete(userA._id);
    if (userB) await User.findByIdAndDelete(userB._id);
    await Integration.deleteMany({ userId: { $in: [userA?._id, userB?._id].filter(Boolean) } });
    await Activity.deleteMany({ userId: { $in: [userA?._id, userB?._id].filter(Boolean) } });
    console.log("✓ Cleaned up test fixtures cleanly. Real data untouched.");
  }
}

runSecurityIsolationTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("TEST FAILED:", err);
    process.exit(1);
  });
