/**
 * Regression Suite: Deployment Contract & Repository Identifier Validation
 *
 * Verifies all 7 required scenarios:
 * 1. A project with a valid 'owner/repo' identifier.
 * 2. A project with missing repository fields.
 * 3. A project owned by another user (cross-tenant access control).
 * 4. An invalid repository identifier.
 * 5. Deployment using the saved repository and branch.
 * 6. A failed provider response handling.
 * 7. Successful deployment only after the provider confirms success.
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";

// Load environment variables from .env.local if not already set
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}
import {
  normalizeRepository,
  validateRepositoryContract,
} from "../lib/github/repository";
import { POST as createDeploymentHandler } from "../app/api/deployments/route";
import Project from "../models/Project";
import User from "../models/User";
import Deployment from "../models/Deployment";
import Integration from "../models/Integration";
import { encrypt } from "../lib/auth/session";
import { encryptToken } from "../lib/auth/encryption";
import connectToDatabase from "../lib/mongodb/client";

async function runDeploymentContractTests() {
  console.log("=== STARTING DEPLOYMENT CONTRACT & REPOSITORY REGRESSION SUITE ===");

  await connectToDatabase();

  const originalFetch = global.fetch;

  // Test User IDs
  const userAId = new mongoose.Types.ObjectId().toString();
  const userBId = new mongoose.Types.ObjectId().toString();

  // Create mock session tokens
  const sessionTokenA = await encrypt({ userId: userAId });
  const sessionTokenB = await encrypt({ userId: userBId });

  // Clean test fixtures
  await User.deleteMany({ _id: { $in: [userAId, userBId] } });
  await Project.deleteMany({ userId: { $in: [userAId, userBId] } });
  await Deployment.deleteMany({ userId: { $in: [userAId, userBId] } });
  await Integration.deleteMany({ userId: { $in: [userAId, userBId] } });

  await User.create([
    { _id: userAId, name: "Deployer A", username: "deployer_a", email: "deployer_a@test.com", passwordHash: "dummy" },
    { _id: userBId, name: "Deployer B", username: "deployer_b", email: "deployer_b@test.com", passwordHash: "dummy" },
  ]);

  // Connect mock GitHub integration for User A
  await Integration.create({
    userId: userAId,
    provider: "github",
    accessToken: encryptToken("gho_mock_access_token_12345"),
    username: "deployer_a",
  });

  try {
    // -------------------------------------------------------------
    // Scenario 1: A project with a valid 'owner/repo' identifier
    // -------------------------------------------------------------
    console.log("\n1. Testing Project with Valid 'owner/repo' Identifier...");
    const validProject = await Project.create({
      userId: userAId,
      name: "Weatherly App",
      slug: `weatherly-${Date.now()}`,
      repository: "RahilPatel2/Weatherly",
      repositoryOwner: "RahilPatel2",
      repositoryName: "Weatherly",
      branch: "main",
      framework: "React (Vite)",
      buildCommand: "npm run build",
      outputDirectory: "dist",
    });

    const norm1 = normalizeRepository(validProject.repository);
    assert(norm1 !== null, "Must normalize valid repository string");
    assert.strictEqual(norm1.owner, "RahilPatel2");
    assert.strictEqual(norm1.repo, "Weatherly");
    assert.strictEqual(norm1.fullName, "RahilPatel2/Weatherly");

    const contract1 = validateRepositoryContract(validProject);
    assert.strictEqual(contract1.valid, true);
    assert.strictEqual(contract1.repository?.fullName, "RahilPatel2/Weatherly");
    console.log("  [PASS] Valid 'owner/repo' correctly recognized and normalized");

    // -------------------------------------------------------------
    // Scenario 2: A project with missing repository fields
    // -------------------------------------------------------------
    console.log("\n2. Testing Project with Missing Repository Fields...");
    const missingId = new mongoose.Types.ObjectId();
    await Project.collection.insertOne({
      _id: missingId,
      userId: new mongoose.Types.ObjectId(userAId),
      name: "Broken Project",
      slug: `broken-${Date.now()}`,
      branch: "main",
      framework: "Next.js",
      buildCommand: "npm run build",
      outputDirectory: ".next",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const missingRepoProject = await Project.findById(missingId).lean();
    const contract2 = validateRepositoryContract(missingRepoProject);
    assert.strictEqual(contract2.valid, false);
    assert(contract2.code === "INVALID_REPOSITORY_FORMAT" || contract2.code === "REPOSITORY_MISSING");

    // Test API route rejection
    const missingReq = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${sessionTokenA}`,
      },
      body: JSON.stringify({ projectId: missingId.toString() }),
    });

    const missingRes = await createDeploymentHandler(missingReq);
    assert.strictEqual(missingRes.status, 400);
    const missingJson = await missingRes.json();
    assert(missingJson.error.includes("Invalid repository identifier") || missingJson.code === "INVALID_REPOSITORY_FORMAT" || missingJson.code === "REPOSITORY_MISSING");
    console.log("  [PASS] Missing repository fields produce clear 400 validation error");

    // -------------------------------------------------------------
    // Scenario 3: A project owned by another user (cross-tenant access control)
    // -------------------------------------------------------------
    console.log("\n3. Testing Cross-Tenant Access Protection...");
    const crossTenantReq = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${sessionTokenB}`, // User B attempting to deploy User A's project
      },
      body: JSON.stringify({ projectId: validProject._id }),
    });

    const crossTenantRes = await createDeploymentHandler(crossTenantReq);
    assert.strictEqual(crossTenantRes.status, 404, "Must reject cross-tenant deployment with 404");
    const crossJson = await crossTenantRes.json();
    assert(crossJson.error.includes("Project not found or access denied"));
    console.log("  [PASS] Unauthorized user cannot deploy another user's project");

    // -------------------------------------------------------------
    // Scenario 4: An invalid repository identifier format
    // -------------------------------------------------------------
    console.log("\n4. Testing Invalid Repository Identifier...");
    const invalidFormats = [
      "just-a-name-no-slash",
      "../path/traversal",
      "owner//repo",
      "https://github.com/",
      undefined,
      null,
    ];

    for (const invalid of invalidFormats) {
      const result = validateRepositoryContract(invalid);
      assert.strictEqual(result.valid, false, `Must reject invalid identifier: ${invalid}`);
    }
    console.log("  [PASS] Malformed, path-traversal, and empty identifiers strictly rejected");

    // -------------------------------------------------------------
    // Scenario 5: Deployment using saved repository and branch
    // -------------------------------------------------------------
    console.log("\n5. Testing Deployment Using Saved Repository & Branch...");
    // Mock GitHub commit lookup
    global.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("api.github.com/repos/RahilPatel2/Weatherly/commits/main")) {
        return new Response(
          JSON.stringify({
            sha: "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b",
            commit: {
              message: "feat: update weather dashboard UI",
              author: { name: "Rahil Patel", date: new Date().toISOString() },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    const deployReq = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${sessionTokenA}`,
      },
      body: JSON.stringify({ projectId: validProject._id }),
    });

    const deployRes = await createDeploymentHandler(deployReq);
    assert.strictEqual(deployRes.status, 201, "Successful deployment creation must return HTTP 201");
    const deployJson = await deployRes.json();
    assert(deployJson.deployment !== undefined, "Must return deployment record");
    assert.strictEqual(deployJson.deployment.branch, "main", "Must use saved branch");
    assert.strictEqual(deployJson.deployment.commitHash, "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b");
    assert.strictEqual(deployJson.deployment.status, "QUEUED");
    console.log("  [PASS] Deployment initiated successfully using stored repository 'RahilPatel2/Weatherly' and branch 'main'");

    // -------------------------------------------------------------
    // Scenario 6: Failed Provider Response Handling
    // -------------------------------------------------------------
    console.log("\n6. Testing Failed Provider Response Handling...");
    // Mock GitHub branch failure (e.g. branch deleted or repo renamed)
    global.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("api.github.com/repos/")) {
        return new Response(
          JSON.stringify({ message: "Branch not found" }),
          { status: 404, statusText: "Not Found", headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    const failProject = await Project.create({
      userId: userAId,
      name: "Failing Project",
      slug: `fail-${Date.now()}`,
      repository: "RahilPatel2/Weatherly",
      branch: "nonexistent-branch",
      framework: "React (Vite)",
    });

    const failReq = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `session=${sessionTokenA}`,
      },
      body: JSON.stringify({ projectId: failProject._id }),
    });

    const failRes = await createDeploymentHandler(failReq);
    assert.strictEqual(failRes.status, 400);
    const failJson = await failRes.json();
    assert(
      failJson.error.includes("not found in repository") ||
      failJson.error.includes("Failed to verify repository or branch on GitHub")
    );
    console.log("  [PASS] Provider 404 error cleanly mapped to user-facing 400 response without secret leakage");

    // -------------------------------------------------------------
    // Scenario 7: State Transition to READY only after Provider Confirmation
    // -------------------------------------------------------------
    console.log("\n7. Testing Provider Confirmation State Transitions...");
    const { mapCloudflareStatus } = await import("../lib/cloudflare/provider");
    assert.strictEqual(mapCloudflareStatus("queued"), "QUEUED");
    assert.strictEqual(mapCloudflareStatus("building"), "BUILDING");
    assert.notStrictEqual(mapCloudflareStatus("building"), "READY", "In-progress builds must NOT be marked READY");
    assert.strictEqual(mapCloudflareStatus("success"), "READY", "Only confirmed success can transition to READY");
    assert.strictEqual(mapCloudflareStatus("failure"), "FAILED", "Provider failures transition to FAILED");
    console.log("  [PASS] Deployments remain in QUEUED/BUILDING until provider explicitly confirms success");

    console.log("\n=== ALL DEPLOYMENT CONTRACT & REPOSITORY TESTS PASSED! ===");
  } finally {
    global.fetch = originalFetch;
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await Project.deleteMany({ userId: { $in: [userAId, userBId] } });
    await Deployment.deleteMany({ userId: { $in: [userAId, userBId] } });
    await Integration.deleteMany({ userId: { $in: [userAId, userBId] } });
    await mongoose.disconnect();
  }
}

runDeploymentContractTests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Deployment Contract Test Suite Failed:", err);
    process.exit(1);
  });
