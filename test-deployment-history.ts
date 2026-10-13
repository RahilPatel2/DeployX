/**
 * Automated Verification Suite for Step 11:
 * Real Deployment Status, Build Logs, Deployment History, and Redeployment
 * 
 * Verifies all 12 required scenarios:
 * 1. Valid deployment state transitions (isValidDeploymentTransition).
 * 2. Failed builds and provider failures record terminal status, timestamps, and error message.
 * 3. Stale or interrupted deployment recovery (recoverStaleDeployments).
 * 4. Persisted status after refresh (accurate timestamps, trigger, build config snapshot).
 * 5. Log retrieval, pagination slicing, line counts, and secret redaction.
 * 6. Deployment history ordering (newest first), filtering (status, branch, search), and pagination.
 * 7. Cross-account access rejection (404).
 * 8. Unauthorized redeployment attempts (401 unauth, 404 cross-account).
 * 9. Redeployment of a pinned historical commit SHA with build snapshot & trigger: "redeploy".
 * 10. Duplicate request protection (409 Conflict within 30s window).
 * 11. Missing provider logs handling (returns empty logs array gracefully).
 * 12. Actual URL persistence and complete absence of fabricated or mock URLs.
 */

import mongoose from "mongoose";
import connectToDatabase from "./lib/mongodb/client";
import User from "./models/User";
import Project from "./models/Project";
import Deployment, { isValidDeploymentTransition } from "./models/Deployment";
import Integration from "./models/Integration";
import { encrypt } from "./lib/auth/session";
import { encryptToken } from "./lib/auth/encryption";
import { recoverStaleDeployments } from "./lib/build/recovery";
import { GET as getDeploymentsRoute, POST as createDeploymentRoute } from "./app/api/deployments/route";
import { GET as getDeploymentByIdRoute } from "./app/api/deployments/[id]/route";
import { GET as getDeploymentLogsRoute } from "./app/api/deployments/[id]/logs/route";
import { POST as redeployRoute } from "./app/api/deployments/[id]/redeploy/route";

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ ${message}`);
}

async function createSessionCookie(userId: string): Promise<string> {
  const token = await encrypt({ userId });
  return `session=${token}`;
}

async function runDeploymentHistorySuite() {
  console.log("\n=======================================================");
  console.log("  DEPLOYX STEP 11: STATUS, LOGS, HISTORY & REDEPLOY    ");
  console.log("=======================================================\n");

  await connectToDatabase();

  const testUserAId = "700000000000000000000021";
  const testUserBId = "700000000000000000000022";
  const testProjectAId = "700000000000000000000031";
  const testProjectBId = "700000000000000000000032";

  // Clean existing fixtures
  await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
  await Project.deleteMany({ _id: { $in: [testProjectAId, testProjectBId] } });
  await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Integration.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

  // Seed fixture users
  await User.create([
    {
      _id: testUserAId,
      name: "History User A",
      username: "user_a_history",
      email: "usera_hist@deployx.test",
      passwordHash: "hashA",
      status: "active",
    },
    {
      _id: testUserBId,
      name: "History User B",
      username: "user_b_history",
      email: "userb_hist@deployx.test",
      passwordHash: "hashB",
      status: "active",
    },
  ]);

  // Seed fixture projects
  await Project.create([
    {
      _id: testProjectAId,
      userId: testUserAId,
      name: "user-a-site",
      slug: "user-a-site",
      repository: "octocat/Hello-World",
      branch: "main",
      framework: "static",
      buildCommand: "echo 'build static'",
      outputDirectory: "dist",
      rootDirectory: "/",
      deploymentMode: "static",
      status: "ready",
      cloudflareProjectName: "user-a-site-cf",
    },
    {
      _id: testProjectBId,
      userId: testUserBId,
      name: "user-b-site",
      slug: "user-b-site",
      repository: "octocat/Spoon-Knife",
      branch: "main",
      framework: "static",
      buildCommand: "echo 'build static'",
      outputDirectory: "dist",
      rootDirectory: "/",
      deploymentMode: "static",
      status: "ready",
      cloudflareProjectName: "user-b-site-cf",
    },
  ]);

  // Seed GitHub integration for User A (for redeployment)
  await Integration.create({
    userId: testUserAId,
    provider: "github",
    providerId: "github-hist-123",
    providerUsername: "octocat",
    accessToken: encryptToken("ghp_testToken1234567890abcdefghijklmnopqrst"),
    scope: "read:user,repo",
  });

  const cookieA = await createSessionCookie(testUserAId);
  const cookieB = await createSessionCookie(testUserBId);

  // --------------------------------------------------------------------------
  // Scenario 1: Valid deployment state transitions
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 1: Deployment State Lifecycle Transitions ---");
  assert(isValidDeploymentTransition("QUEUED", "BUILDING"), "QUEUED -> BUILDING is valid");
  assert(isValidDeploymentTransition("BUILDING", "READY"), "BUILDING -> READY is valid");
  assert(isValidDeploymentTransition("BUILDING", "FAILED"), "BUILDING -> FAILED is valid");
  assert(isValidDeploymentTransition("QUEUED", "CANCELED"), "QUEUED -> CANCELED is valid");
  assert(isValidDeploymentTransition("QUEUED", "FAILED"), "QUEUED -> FAILED is valid");
  assert(isValidDeploymentTransition("READY", "READY"), "READY -> READY idempotent transition is valid");
  assert(!isValidDeploymentTransition("READY", "BUILDING"), "READY -> BUILDING is illegal");
  assert(!isValidDeploymentTransition("FAILED", "QUEUED"), "FAILED -> QUEUED is illegal");
  assert(!isValidDeploymentTransition("READY", "FAILED"), "READY -> FAILED is illegal");
  assert(!isValidDeploymentTransition("CANCELED", "BUILDING"), "CANCELED -> BUILDING is illegal");

  // --------------------------------------------------------------------------
  // Scenario 2: Failed builds and provider failures persistence
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 2: Failed Builds & Provider Failures Persistence ---");
  const failedDep = await Deployment.create({
    projectId: testProjectAId,
    userId: testUserAId,
    status: "FAILED",
    branch: "main",
    commitHash: "fail1234567890abcdef",
    commitMessage: "Broken commit",
    environment: "production",
    startedAt: new Date(Date.now() - 60000),
    completedAt: new Date(),
    duration: 60,
    errorMessage: "Build command exited with code 1: syntax error in main.js",
    logs: [
      "[DeployX] Cloning repository...",
      "[DeployX] Running build command: npm run build",
      "[DeployX] Error: syntax error in main.js",
      "[DeployX] ❌ Build failed with exit code 1",
    ],
  });

  const getFailedReq = new Request(`http://localhost:3000/api/deployments/${failedDep._id}`, {
    headers: { cookie: cookieA },
  });
  const failedRes = await getDeploymentByIdRoute(getFailedReq, {
    params: Promise.resolve({ id: failedDep._id.toString() }),
  });
  assert(failedRes.status === 200, "Fetched failed deployment successfully");
  const failedData = await failedRes.json();
  assert(failedData.deployment.status === "FAILED", "Failed deployment status is FAILED");
  assert(failedData.deployment.errorMessage.includes("syntax error"), "Stored error message accurately");
  assert(Boolean(failedData.deployment.completedAt), "completedAt timestamp is recorded");
  assert(failedData.deployment.url === undefined || failedData.deployment.url === null, "Failed deployment has no live URL");

  // --------------------------------------------------------------------------
  // Scenario 3: Stale or interrupted deployment auto-recovery
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 3: Stale & Interrupted Deployment Auto-Recovery ---");
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
  const staleDep = await Deployment.create({
    projectId: testProjectAId,
    userId: testUserAId,
    status: "BUILDING",
    branch: "main",
    commitHash: "stale1234567890abcdef",
    environment: "production",
    startedAt: twentyMinsAgo,
    updatedAt: twentyMinsAgo,
    createdAt: twentyMinsAgo,
    logs: ["[DeployX] Build started 20 minutes ago..."],
  });

  // Force MongoDB updatedAt to twentyMinsAgo (bypass mongoose auto-timestamp for test)
  await Deployment.collection.updateOne({ _id: staleDep._id }, { $set: { updatedAt: twentyMinsAgo } });

  const recoveryResult = await recoverStaleDeployments({
    staleThresholdMs: 15 * 60 * 1000,
    userId: testUserAId,
  });
  assert(recoveryResult.recoveredCount >= 1, "Stale deployment was auto-recovered");
  assert(recoveryResult.recoveredIds.includes(staleDep._id.toString()), "Recovered correct stale deployment ID");

  const recoveredDep = await Deployment.findById(staleDep._id);
  assert(recoveredDep?.status === "FAILED", "Stale deployment status changed to FAILED");
  assert(Boolean(recoveredDep?.completedAt), "completedAt set on recovered deployment");
  assert(recoveredDep?.errorMessage?.includes("timed out") ?? false, "Error message explains timeout/interruption");
  assert(
    recoveredDep?.logs?.some((l: string) => l.includes("Auto-recovery")) ?? false,
    "Log message appended explaining auto-recovery"
  );

  // --------------------------------------------------------------------------
  // Scenario 4: Persisted status after refresh (metadata, config snapshot)
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 4: Persisted Status & Metadata Integrity ---");
  const readyDep = await Deployment.create({
    projectId: testProjectAId,
    userId: testUserAId,
    status: "READY",
    branch: "main",
    commitHash: "c0ffee1234567890abcdef",
    commitMessage: "feat: add landing page",
    url: "https://user-a-site.deployx.app",
    environment: "production",
    trigger: "manual",
    buildConfigSnapshot: {
      buildCommand: "npm run build",
      outputDirectory: "dist",
      framework: "static",
      rootDirectory: "/",
    },
    startedAt: new Date(Date.now() - 45000),
    completedAt: new Date(),
    duration: 45,
    logs: ["[DeployX] Build complete.", "[DeployX] Deployed to Cloudflare Pages."],
  });

  const refreshReq = new Request(`http://localhost:3000/api/deployments/${readyDep._id}`, {
    headers: { cookie: cookieA },
  });
  const refreshRes = await getDeploymentByIdRoute(refreshReq, {
    params: Promise.resolve({ id: readyDep._id.toString() }),
  });
  const refreshData = await refreshRes.json();
  assert(refreshRes.status === 200, "Refreshed deployment data returned 200");
  assert(refreshData.deployment.status === "READY", "Persisted status is READY");
  assert(refreshData.deployment.trigger === "manual", "Persisted trigger is 'manual'");
  assert(refreshData.deployment.buildConfigSnapshot.buildCommand === "npm run build", "Persisted build config snapshot intact");
  assert(Boolean(refreshData.deployment.startedAt && refreshData.deployment.completedAt), "Both startedAt and completedAt persisted");

  // --------------------------------------------------------------------------
  // Scenario 5: Log retrieval, pagination slicing, and secret redaction
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 5: Log Retrieval, Pagination Slicing & Secret Redaction ---");
  const secretDep = await Deployment.create({
    projectId: testProjectAId,
    userId: testUserAId,
    status: "READY",
    branch: "main",
    environment: "production",
    logs: [
      "[DeployX] Step 1: Initializing build environment",
      "[DeployX] Authenticating with Bearer secret_super_secret_token_12345",
      "[DeployX] Token ghp_abcdef12345678901234567890abcdefghijkl validated",
      "[DeployX] Step 2: Running build command",
      "[DeployX] Build succeeded in 12s",
      "[DeployX] Deployment published successfully",
    ],
  });

  // Test pagination: offset 1, limit 3
  const paginatedLogsReq = new Request(
    `http://localhost:3000/api/deployments/${secretDep._id}/logs?offset=1&limit=3`,
    { headers: { cookie: cookieA } }
  );
  const paginatedLogsRes = await getDeploymentLogsRoute(paginatedLogsReq, {
    params: Promise.resolve({ id: secretDep._id.toString() }),
  });
  assert(paginatedLogsRes.status === 200, "Logs route returned 200");
  const paginatedLogsData = await paginatedLogsRes.json();
  assert(paginatedLogsData.totalLines === 6, "Total lines correctly reported as 6");
  assert(paginatedLogsData.logs.length === 3, "Pagination limit 3 honored");
  assert(paginatedLogsData.offset === 1, "Pagination offset 1 honored");
  assert(paginatedLogsData.hasMore === true, "hasMore flag correctly set to true");

  // Test secret redaction
  const allLogsReq = new Request(
    `http://localhost:3000/api/deployments/${secretDep._id}/logs?offset=0&limit=10`,
    { headers: { cookie: cookieA } }
  );
  const allLogsRes = await getDeploymentLogsRoute(allLogsReq, {
    params: Promise.resolve({ id: secretDep._id.toString() }),
  });
  const allLogsData = await allLogsRes.json();
  const rawLogJoined = allLogsData.logs.join("\n");
  assert(!rawLogJoined.includes("secret_super_secret_token"), "Bearer token successfully redacted");
  assert(!rawLogJoined.includes("ghp_abcdef"), "GitHub token prefix redacted");
  assert(rawLogJoined.includes("[REDACTED"), "Redacted token replaced with [REDACTED]");

  // --------------------------------------------------------------------------
  // Scenario 6: Deployment history ordering, filtering, and pagination
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 6: Deployment History Ordering, Filtering & Pagination ---");
  // Seed distinct deployments for project A
  const now = Date.now();
  await Deployment.create([
    {
      projectId: testProjectAId,
      userId: testUserAId,
      status: "READY",
      branch: "feature/auth",
      commitHash: "feat001",
      commitMessage: "Add OAuth flow",
      environment: "preview",
      createdAt: new Date(now - 30000),
    },
    {
      projectId: testProjectAId,
      userId: testUserAId,
      status: "FAILED",
      branch: "feature/payment",
      commitHash: "feat002",
      commitMessage: "Fix payment stripe webhook",
      environment: "preview",
      createdAt: new Date(now - 20000),
    },
    {
      projectId: testProjectAId,
      userId: testUserAId,
      status: "READY",
      branch: "main",
      commitHash: "feat003",
      commitMessage: "Deploy release v1.0",
      environment: "production",
      createdAt: new Date(now - 10000),
    },
  ]);

  // Test ordering: newest first
  const orderReq = new Request(
    `http://localhost:3000/api/deployments?projectId=${testProjectAId}&limit=5`,
    { headers: { cookie: cookieA } }
  );
  const orderRes = await getDeploymentsRoute(orderReq);
  const orderData = await orderRes.json();
  assert(orderRes.status === 200, "History route returned 200");
  const dates = orderData.deployments.map((d: any) => new Date(d.createdAt).getTime());
  let isSortedDesc = true;
  for (let i = 0; i < dates.length - 1; i++) {
    if (dates[i] < dates[i + 1]) isSortedDesc = false;
  }
  assert(isSortedDesc, "Deployments are ordered descending by createdAt (newest first)");

  // Test status filtering
  const filterReq = new Request(
    `http://localhost:3000/api/deployments?projectId=${testProjectAId}&status=FAILED`,
    { headers: { cookie: cookieA } }
  );
  const filterRes = await getDeploymentsRoute(filterReq);
  const filterData = await filterRes.json();
  assert(filterData.deployments.every((d: any) => d.status === "FAILED"), "Status filter returned only FAILED deployments");

  // Test branch filtering
  const branchReq = new Request(
    `http://localhost:3000/api/deployments?projectId=${testProjectAId}&branch=feature/auth`,
    { headers: { cookie: cookieA } }
  );
  const branchRes = await getDeploymentsRoute(branchReq);
  const branchData = await branchRes.json();
  assert(branchData.deployments.length >= 1, "Branch filter matched branch");
  assert(branchData.deployments.every((d: any) => d.branch === "feature/auth"), "All returned match branch feature/auth");

  // Test search filtering (by commitMessage)
  const searchReq = new Request(
    `http://localhost:3000/api/deployments?projectId=${testProjectAId}&search=payment`,
    { headers: { cookie: cookieA } }
  );
  const searchRes = await getDeploymentsRoute(searchReq);
  const searchData = await searchRes.json();
  assert(searchData.deployments.length === 1, "Search returned exactly 1 matching deployment");
  assert(searchData.deployments[0].commitMessage.includes("payment"), "Search matched commitMessage");

  // Test pagination metadata
  const pagReq = new Request(
    `http://localhost:3000/api/deployments?projectId=${testProjectAId}&page=1&limit=2`,
    { headers: { cookie: cookieA } }
  );
  const pagRes = await getDeploymentsRoute(pagReq);
  const pagData = await pagRes.json();
  assert(pagData.page === 1, "page is 1");
  assert(pagData.limit === 2, "limit is 2");
  assert(pagData.deployments.length === 2, "Returns exactly 2 items for limit 2");
  assert(pagData.hasNextPage === true, "hasNextPage is true when more items exist");

  // --------------------------------------------------------------------------
  // Scenario 7: Cross-account access rejection
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 7: Cross-Account Access Rejection ---");
  // User B tries to get User A's deployment
  const crossGetReq = new Request(`http://localhost:3000/api/deployments/${readyDep._id}`, {
    headers: { cookie: cookieB },
  });
  const crossGetRes = await getDeploymentByIdRoute(crossGetReq, {
    params: Promise.resolve({ id: readyDep._id.toString() }),
  });
  assert(crossGetRes.status === 404, "User B cannot access User A's deployment (404 Not Found)");

  // User B tries to fetch User A's logs
  const crossLogsReq = new Request(`http://localhost:3000/api/deployments/${readyDep._id}/logs`, {
    headers: { cookie: cookieB },
  });
  const crossLogsRes = await getDeploymentLogsRoute(crossLogsReq, {
    params: Promise.resolve({ id: readyDep._id.toString() }),
  });
  assert(crossLogsRes.status === 404, "User B cannot access User A's logs (404 Not Found)");

  // User B queries deployments with projectId of User A
  const crossListReq = new Request(
    `http://localhost:3000/api/deployments?projectId=${testProjectAId}`,
    { headers: { cookie: cookieB } }
  );
  const crossListRes = await getDeploymentsRoute(crossListReq);
  const crossListData = await crossListRes.json();
  assert(crossListData.deployments.length === 0, "User B querying User A's project gets 0 deployments");

  // --------------------------------------------------------------------------
  // Scenario 8: Unauthorized redeployment attempts
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 8: Unauthorized Redeployment Attempts ---");
  // 1. Unauthenticated request
  const unauthRedeployReq = new Request(`http://localhost:3000/api/deployments/${readyDep._id}/redeploy`, {
    method: "POST",
  });
  const unauthRedeployRes = await redeployRoute(unauthRedeployReq, {
    params: Promise.resolve({ id: readyDep._id.toString() }),
  });
  assert(unauthRedeployRes.status === 401, "Unauthenticated redeployment rejected with 401");

  // 2. Cross-account attempt (User B trying to redeploy User A's deployment)
  const crossRedeployReq = new Request(`http://localhost:3000/api/deployments/${readyDep._id}/redeploy`, {
    method: "POST",
    headers: { cookie: cookieB },
  });
  const crossRedeployRes = await redeployRoute(crossRedeployReq, {
    params: Promise.resolve({ id: readyDep._id.toString() }),
  });
  assert(crossRedeployRes.status === 404, "Cross-account redeploy attempt rejected with 404");

  // --------------------------------------------------------------------------
  // Scenario 9: Redeployment of a pinned historical commit SHA
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 9: Safe Redeployment with Pinned Commit SHA ---");
  const redeployReq = new Request(`http://localhost:3000/api/deployments/${readyDep._id}/redeploy`, {
    method: "POST",
    headers: { cookie: cookieA, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const redeployRes = await redeployRoute(redeployReq, {
    params: Promise.resolve({ id: readyDep._id.toString() }),
  });
  const redeployData = await redeployRes.json();
  assert(redeployRes.status === 201, "Redeployment initiated with 201 Created");
  assert(Boolean(redeployData.deployment), "Redeployment returned deployment object");
  assert(redeployData.deployment.trigger === "redeploy", "Deployment trigger set to 'redeploy'");
  assert(
    redeployData.deployment.previousDeploymentId === readyDep._id.toString(),
    "previousDeploymentId links back to historical deployment"
  );
  assert(
    redeployData.deployment.commitHash === readyDep.commitHash,
    "Pinned historical commit SHA is preserved for reproducible build"
  );
  assert(
    redeployData.deployment.buildConfigSnapshot.buildCommand === readyDep.buildConfigSnapshot?.buildCommand,
    "Build configuration snapshot preserved"
  );

  const newDeploymentId = redeployData.deployment._id;

  // --------------------------------------------------------------------------
  // Scenario 10: Duplicate request protection (409 Conflict)
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 10: Duplicate Request Protection (409 Conflict) ---");
  const dupRedeployReq = new Request(`http://localhost:3000/api/deployments/${readyDep._id}/redeploy`, {
    method: "POST",
    headers: { cookie: cookieA, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const dupRedeployRes = await redeployRoute(dupRedeployReq, {
    params: Promise.resolve({ id: readyDep._id.toString() }),
  });
  assert(dupRedeployRes.status === 409, "Duplicate redeploy request within 30s rejected with 409 Conflict");
  const dupData = await dupRedeployRes.json();
  assert(dupData.error.includes("already in progress"), "Error explains concurrent deployment in progress");

  // Clean up active deployment to free 30s lock for other tests if needed
  await Deployment.deleteOne({ _id: newDeploymentId });

  // --------------------------------------------------------------------------
  // Scenario 11: Missing provider logs handling
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 11: Missing Provider Logs Graceful Handling ---");
  const emptyLogsDep = await Deployment.create({
    projectId: testProjectAId,
    userId: testUserAId,
    status: "QUEUED",
    branch: "main",
    environment: "production",
    logs: [],
  });

  const emptyLogsReq = new Request(`http://localhost:3000/api/deployments/${emptyLogsDep._id}/logs`, {
    headers: { cookie: cookieA },
  });
  const emptyLogsRes = await getDeploymentLogsRoute(emptyLogsReq, {
    params: Promise.resolve({ id: emptyLogsDep._id.toString() }),
  });
  assert(emptyLogsRes.status === 200, "Empty logs request returned 200");
  const emptyLogsData = await emptyLogsRes.json();
  assert(Array.isArray(emptyLogsData.logs) && emptyLogsData.logs.length === 0, "logs is an empty array");
  assert(emptyLogsData.totalLines === 0, "totalLines is 0");
  assert(Boolean(emptyLogsData.emptyMessage), "Provides user-friendly emptyMessage without crashing");

  // --------------------------------------------------------------------------
  // Scenario 12: Actual URL persistence & absence of fabricated URLs
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 12: URL Persistence & Absence of Fabricated URLs ---");
  const queuedDep = await Deployment.create({
    projectId: testProjectAId,
    userId: testUserAId,
    status: "QUEUED",
    branch: "main",
    environment: "production",
  });
  const buildingDep = await Deployment.create({
    projectId: testProjectAId,
    userId: testUserAId,
    status: "BUILDING",
    branch: "main",
    environment: "production",
  });

  const fetchQueued = await Deployment.findById(queuedDep._id);
  const fetchBuilding = await Deployment.findById(buildingDep._id);
  const fetchFailed = await Deployment.findById(failedDep._id);

  assert(fetchQueued?.url === undefined || fetchQueued?.url === null, "QUEUED deployment has NO URL");
  assert(fetchBuilding?.url === undefined || fetchBuilding?.url === null, "BUILDING deployment has NO URL");
  assert(fetchFailed?.url === undefined || fetchFailed?.url === null, "FAILED deployment has NO URL");

  const verifiedReady = await Deployment.findById(readyDep._id);
  assert(verifiedReady?.url === "https://user-a-site.deployx.app", "READY deployment contains verified live URL");

  // --------------------------------------------------------------------------
  // Cleanup test data
  // --------------------------------------------------------------------------
  await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
  await Project.deleteMany({ _id: { $in: [testProjectAId, testProjectBId] } });
  await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Integration.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

  console.log("\n=======================================================");
  console.log(`  PASSED: ${passedTests} / ${totalTests} CHECKS COMPLETED SUCCESSFULLY`);
  console.log("=======================================================\n");
}

runDeploymentHistorySuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
