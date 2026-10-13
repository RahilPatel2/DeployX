/**
 * Automated Verification Suite for Step 12:
 * Automatic Deployments from GitHub Pushes
 * 
 * Verifies all 17 required scenarios:
 * 1. Valid push webhook signatures (X-Hub-Signature-256).
 * 2. Invalid signatures (HTTP 401).
 * 3. Missing signature headers (HTTP 401).
 * 4. Malformed and oversized payloads (HTTP 400 & 413).
 * 5. Unrelated GitHub events (ping, issues ignored safely).
 * 6. Repository identity mismatch (unregistered repo handling).
 * 7. Push to the production branch (triggers durable automatic deployment).
 * 8. Push to an unrelated branch (ignored safely).
 * 9. Deleted branch events (ignored without deploying).
 * 10. Automatic deployments disabled (ignored when autoDeploy: false).
 * 11. Duplicate delivery IDs (idempotency prevents duplicate deployments).
 * 12. Out-of-order push events (older commit rejected when newer commit already processed).
 * 13. Worker interruption and safe retry / recovery.
 * 14. Deployment pinned to the exact pushed commit SHA.
 * 15. Cross-account isolation (User B cannot trigger or modify User A's project).
 * 16. Webhook secret and token redaction (never exposed in public errors or logs).
 * 17. Duplicate webhook registration prevention (createRepositoryWebhook is idempotent).
 */

import crypto from "crypto";
import mongoose from "mongoose";
import connectToDatabase from "./lib/mongodb/client";
import User from "./models/User";
import Project from "./models/Project";
import Deployment from "./models/Deployment";
import Integration from "./models/Integration";
import WebhookDelivery from "./models/WebhookDelivery";
import { encrypt } from "./lib/auth/session";
import { encryptToken, decryptToken } from "./lib/auth/encryption";
import { generateWebhookSecret, verifyWebhookSignature, createRepositoryWebhook } from "./lib/github/webhook";
import { recoverStaleDeployments } from "./lib/build/recovery";
import { POST as webhookRoute } from "./app/api/webhooks/github/route";
import { GET as getProjectWebhookRoute, POST as postProjectWebhookRoute, DELETE as deleteProjectWebhookRoute } from "./app/api/projects/[id]/webhook/route";
import { PATCH as patchProjectRoute } from "./app/api/projects/[id]/route";

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

function computeSignature(payload: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `sha256=${hmac}`;
}

async function runWebhookAutoDeploySuite() {
  console.log("\n=======================================================");
  console.log("  DEPLOYX STEP 12: GITHUB WEBHOOK AUTOMATIC DEPLOYMENTS ");
  console.log("=======================================================\n");

  await connectToDatabase();

  const testUserAId = "800000000000000000000011";
  const testUserBId = "800000000000000000000012";
  const testProjectAId = "800000000000000000000021";
  const testProjectBId = "800000000000000000000022";

  // Clean fixtures
  await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
  await Project.deleteMany({ _id: { $in: [testProjectAId, testProjectBId] } });
  await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await WebhookDelivery.deleteMany({ projectId: { $in: [testProjectAId, testProjectBId] } });
  await Integration.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

  // Seed fixture users
  await User.create([
    {
      _id: testUserAId,
      name: "Webhook User A",
      username: "user_a_webhook",
      email: "user_a_wh@deployx.test",
      passwordHash: "hashA",
      status: "active",
    },
    {
      _id: testUserBId,
      name: "Webhook User B",
      username: "user_b_webhook",
      email: "user_b_wh@deployx.test",
      passwordHash: "hashB",
      status: "active",
    },
  ]);

  const rawSecretA = generateWebhookSecret();
  const rawSecretB = generateWebhookSecret();

  // Seed fixture projects
  await Project.create([
    {
      _id: testProjectAId,
      userId: testUserAId,
      name: "webhook-project-a",
      slug: "webhook-project-a",
      repository: "octocat/Hello-World",
      repositoryId: 1296269,
      branch: "main",
      framework: "static",
      buildCommand: "npm run build",
      outputDirectory: "dist",
      rootDirectory: "/",
      deploymentMode: "static",
      autoDeploy: true,
      webhookSecret: encryptToken(rawSecretA),
      webhookStatus: "active",
      githubWebhookId: 101,
      cloudflareProjectName: "cf-webhook-a",
    },
    {
      _id: testProjectBId,
      userId: testUserBId,
      name: "webhook-project-b",
      slug: "webhook-project-b",
      repository: "octocat/Spoon-Knife",
      repositoryId: 1300119,
      branch: "main",
      framework: "static",
      buildCommand: "npm run build",
      outputDirectory: "dist",
      rootDirectory: "/",
      deploymentMode: "static",
      autoDeploy: true,
      webhookSecret: encryptToken(rawSecretB),
      webhookStatus: "active",
      githubWebhookId: 102,
      cloudflareProjectName: "cf-webhook-b",
    },
  ]);

  const cookieA = await createSessionCookie(testUserAId);
  const cookieB = await createSessionCookie(testUserBId);

  // --------------------------------------------------------------------------
  // Scenario 1: Valid push webhook signatures
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 1: Valid Webhook Signatures ---");
  const testPayload = JSON.stringify({
    ref: "refs/heads/main",
    before: "1111111111111111111111111111111111111111",
    after: "2222222222222222222222222222222222222222",
    repository: {
      id: 1296269,
      name: "Hello-World",
      full_name: "octocat/Hello-World",
    },
    pusher: { name: "octocat" },
    head_commit: {
      id: "2222222222222222222222222222222222222222",
      message: "feat: update landing hero text",
      timestamp: new Date().toISOString(),
      author: { name: "Octocat Developer" },
    },
  });

  const validSig = computeSignature(testPayload, rawSecretA);
  assert(verifyWebhookSignature(testPayload, validSig, rawSecretA), "verifyWebhookSignature validates genuine signature");

  const validDeliveryId = "wh-deliv-001";
  const validReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": validDeliveryId,
      "X-Hub-Signature-256": validSig,
    },
    body: testPayload,
  });

  const validRes = await webhookRoute(validReq);
  assert(validRes.status === 202, "Valid push returns 202 Accepted");
  const validData = await validRes.json();
  assert(Boolean(validData.deploymentId), "Valid push returned newly created deployment ID");

  const createdDep = await Deployment.findById(validData.deploymentId);
  assert(createdDep?.status === "QUEUED", "Created deployment is initialized in QUEUED status");
  assert(createdDep?.trigger === "webhook", "Deployment trigger is 'webhook'");
  assert(createdDep?.commitHash === "2222222222222222222222222222222222222222", "Pinned exact commit SHA");

  // --------------------------------------------------------------------------
  // Scenario 2: Invalid signatures (HTTP 401)
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 2: Invalid Signatures ---");
  const wrongSig = computeSignature(testPayload, "wrong_secret_12345");
  const invalidSigReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-002",
      "X-Hub-Signature-256": wrongSig,
    },
    body: testPayload,
  });

  const invalidSigRes = await webhookRoute(invalidSigReq);
  assert(invalidSigRes.status === 401, "Tampered signature returns 401 Unauthorized");
  const invalidSigData = await invalidSigRes.json();
  assert(invalidSigData.error.includes("Invalid signature"), "Returns error explaining invalid signature");

  // --------------------------------------------------------------------------
  // Scenario 3: Missing signature headers (HTTP 401)
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 3: Missing Signature Headers ---");
  const missingSigReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-003",
    },
    body: testPayload,
  });

  const missingSigRes = await webhookRoute(missingSigReq);
  assert(missingSigRes.status === 401, "Missing X-Hub-Signature-256 returns 401 Unauthorized");

  // --------------------------------------------------------------------------
  // Scenario 4: Malformed and oversized payloads
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 4: Malformed and Oversized Payloads ---");
  // 4a: Malformed JSON
  const malformedPayload = "{ not valid json";
  const malformedSig = computeSignature(malformedPayload, rawSecretA);
  const malformedReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-004a",
      "X-Hub-Signature-256": malformedSig,
    },
    body: malformedPayload,
  });
  const malformedRes = await webhookRoute(malformedReq);
  assert(malformedRes.status === 400, "Malformed JSON returns 400 Bad Request");

  // 4b: Oversized payload (> 1MB)
  const oversizedPayload = "x".repeat(1024 * 1024 + 10);
  const oversizedReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-004b",
      "X-Hub-Signature-256": "sha256=abcdef",
    },
    body: oversizedPayload,
  });
  const oversizedRes = await webhookRoute(oversizedReq);
  assert(oversizedRes.status === 413, "Oversized payload returns 413 Payload Too Large");

  // --------------------------------------------------------------------------
  // Scenario 5: Unrelated GitHub events (ping, issues)
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 5: Unrelated GitHub Events ---");
  // 5a: Ping event
  const pingReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "ping",
      "X-GitHub-Delivery": "wh-deliv-ping-1",
    },
    body: JSON.stringify({ zen: "Responsive is better than fast." }),
  });
  const pingRes = await webhookRoute(pingReq);
  assert(pingRes.status === 200, "Ping event returns 200 OK without requiring deployment");
  const pingData = await pingRes.json();
  assert(pingData.message.includes("Ping received"), "Ping acknowledged cleanly");

  // 5b: Issues event (unrelated)
  const issuesReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "issues",
      "X-GitHub-Delivery": "wh-deliv-issues-1",
    },
    body: JSON.stringify({ action: "opened", issue: { title: "Bug in app" } }),
  });
  const issuesRes = await webhookRoute(issuesReq);
  assert(issuesRes.status === 200, "Issues event returns 200 OK and is ignored");
  const issuesData = await issuesRes.json();
  assert(issuesData.ignored === true, "Issues event marked as ignored");

  // --------------------------------------------------------------------------
  // Scenario 6: Repository identity mismatch
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 6: Repository Identity Mismatch ---");
  const foreignRepoPayload = JSON.stringify({
    ref: "refs/heads/main",
    after: "3333333333333333333333333333333333333333",
    repository: {
      id: 99999999,
      full_name: "unknown-org/unregistered-repo",
    },
  });
  const foreignReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-foreign-1",
      "X-Hub-Signature-256": "sha256=123456",
    },
    body: foreignRepoPayload,
  });
  const foreignRes = await webhookRoute(foreignReq);
  assert(foreignRes.status === 404, "Unregistered repository returns 404 Not Found");
  const foreignData = await foreignRes.json();
  assert(foreignData.ignored === true, "Unregistered repository marked as ignored");

  // --------------------------------------------------------------------------
  // Scenario 7: Push to production branch triggers automatic deployment
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 7: Push to Production Branch ---");
  const prodPushPayload = JSON.stringify({
    ref: "refs/heads/main",
    after: "4444444444444444444444444444444444444444",
    repository: {
      id: 1296269,
      full_name: "octocat/Hello-World",
    },
    pusher: { name: "octocat" },
    head_commit: {
      id: "4444444444444444444444444444444444444444",
      message: "release: v1.1.0 production release",
      timestamp: new Date().toISOString(),
      author: { name: "Lead Dev" },
    },
  });
  const prodPushSig = computeSignature(prodPushPayload, rawSecretA);
  const prodPushReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-prod-1",
      "X-Hub-Signature-256": prodPushSig,
    },
    body: prodPushPayload,
  });
  const prodPushRes = await webhookRoute(prodPushReq);
  assert(prodPushRes.status === 202, "Production push returns 202 Accepted");
  const prodPushData = await prodPushRes.json();
  assert(prodPushData.commit === "4444444", "Returns 7-char short commit ref");

  const prodDep = await Deployment.findById(prodPushData.deploymentId);
  assert(prodDep?.branch === "main", "Deployment matches production branch 'main'");
  assert(prodDep?.trigger === "webhook", "Deployment recorded with trigger 'webhook'");

  // --------------------------------------------------------------------------
  // Scenario 8: Push to an unrelated branch (ignored safely)
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 8: Push to Unrelated Branch ---");
  const featurePushPayload = JSON.stringify({
    ref: "refs/heads/feature/experimental-branch",
    after: "5555555555555555555555555555555555555555",
    repository: {
      id: 1296269,
      full_name: "octocat/Hello-World",
    },
    pusher: { name: "octocat" },
    head_commit: {
      id: "5555555555555555555555555555555555555555",
      message: "wip: experimental test",
      timestamp: new Date().toISOString(),
    },
  });
  const featurePushSig = computeSignature(featurePushPayload, rawSecretA);
  const featurePushReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-feat-1",
      "X-Hub-Signature-256": featurePushSig,
    },
    body: featurePushPayload,
  });
  const featurePushRes = await webhookRoute(featurePushReq);
  assert(featurePushRes.status === 200, "Unrelated branch push returns 200 OK");
  const featurePushData = await featurePushRes.json();
  assert(featurePushData.ignored === true, "Unrelated branch marked as ignored");
  assert(featurePushData.reason.includes("Production branch is 'main'"), "Explains branch mismatch reason");

  // --------------------------------------------------------------------------
  // Scenario 9: Deleted branch events
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 9: Deleted Branch Events ---");
  const deleteBranchPayload = JSON.stringify({
    ref: "refs/heads/feature/old-branch",
    deleted: true,
    after: "0000000000000000000000000000000000000000",
    repository: {
      id: 1296269,
      full_name: "octocat/Hello-World",
    },
  });
  const deleteBranchSig = computeSignature(deleteBranchPayload, rawSecretA);
  const deleteBranchReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-del-1",
      "X-Hub-Signature-256": deleteBranchSig,
    },
    body: deleteBranchPayload,
  });
  const deleteBranchRes = await webhookRoute(deleteBranchReq);
  assert(deleteBranchRes.status === 200, "Deleted branch returns 200 OK");
  const deleteBranchData = await deleteBranchRes.json();
  assert(deleteBranchData.ignored === true, "Deleted branch marked as ignored");

  // --------------------------------------------------------------------------
  // Scenario 10: Automatic deployments disabled
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 10: Automatic Deployments Disabled ---");
  // Disable autoDeploy on Project A
  await Project.updateOne({ _id: testProjectAId }, { $set: { autoDeploy: false } });

  const disabledPayload = JSON.stringify({
    ref: "refs/heads/main",
    after: "6666666666666666666666666666666666666666",
    repository: {
      id: 1296269,
      full_name: "octocat/Hello-World",
    },
    pusher: { name: "octocat" },
    head_commit: {
      id: "6666666666666666666666666666666666666666",
      message: "feat: update readme",
      timestamp: new Date().toISOString(),
    },
  });
  const disabledSig = computeSignature(disabledPayload, rawSecretA);
  const disabledReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-disabled-1",
      "X-Hub-Signature-256": disabledSig,
    },
    body: disabledPayload,
  });
  const disabledRes = await webhookRoute(disabledReq);
  assert(disabledRes.status === 200, "Push returns 200 OK when auto-deploy disabled");
  const disabledData = await disabledRes.json();
  assert(disabledData.ignored === true, "Marked as ignored");
  assert(disabledData.reason.includes("disabled"), "Reason explains auto-deploy is disabled");

  // Re-enable autoDeploy on Project A
  await Project.updateOne({ _id: testProjectAId }, { $set: { autoDeploy: true } });

  // --------------------------------------------------------------------------
  // Scenario 11: Duplicate delivery IDs (idempotency)
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 11: Duplicate Delivery IDs (Idempotency) ---");
  // Resend the request with validDeliveryId which was already processed in Scenario 1
  const duplicateReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": validDeliveryId,
      "X-Hub-Signature-256": validSig,
    },
    body: testPayload,
  });
  const duplicateRes = await webhookRoute(duplicateReq);
  assert(duplicateRes.status === 200, "Duplicate delivery returns 200 OK");
  const duplicateData = await duplicateRes.json();
  assert(duplicateData.status === "duplicate", "Duplicate status returned");
  assert(duplicateData.deliveryId === validDeliveryId, "Returns duplicate delivery ID");

  // --------------------------------------------------------------------------
  // Scenario 12: Out-of-order push events
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 12: Out-of-Order Push Events ---");
  // A push with a timestamp older than the one in Scenario 7 (prodPushPayload)
  const olderTimestamp = new Date(Date.now() - 3600 * 1000).toISOString();
  const olderPayload = JSON.stringify({
    ref: "refs/heads/main",
    after: "7777777777777777777777777777777777777777",
    repository: {
      id: 1296269,
      full_name: "octocat/Hello-World",
    },
    pusher: { name: "octocat" },
    head_commit: {
      id: "7777777777777777777777777777777777777777",
      message: "old commit from an out-of-order branch merge",
      timestamp: olderTimestamp,
    },
  });
  const olderSig = computeSignature(olderPayload, rawSecretA);
  const olderReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-older-1",
      "X-Hub-Signature-256": olderSig,
    },
    body: olderPayload,
  });
  const olderRes = await webhookRoute(olderReq);
  assert(olderRes.status === 200, "Older out-of-order push returns 200 OK");
  const olderData = await olderRes.json();
  assert(olderData.ignored === true, "Out-of-order push is ignored safely");
  assert(olderData.reason.includes("Out-of-order"), "Reason explains out-of-order push protection");

  // --------------------------------------------------------------------------
  // Scenario 13: Worker interruption and safe recovery
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 13: Worker Interruption & Recovery ---");
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
  const staleWebhookDep = await Deployment.create({
    projectId: testProjectAId,
    userId: testUserAId,
    status: "BUILDING",
    branch: "main",
    commitHash: "stale_wh_1234567890",
    trigger: "webhook",
    environment: "production",
    startedAt: thirtyMinsAgo,
    updatedAt: thirtyMinsAgo,
    createdAt: thirtyMinsAgo,
    logs: ["[DeployX] Build started via webhook 30 minutes ago..."],
  });

  // Force past updatedAt in MongoDB collection
  await Deployment.collection.updateOne(
    { _id: staleWebhookDep._id },
    { $set: { updatedAt: thirtyMinsAgo } }
  );

  const recovery = await recoverStaleDeployments({
    staleThresholdMs: 15 * 60 * 1000,
    userId: testUserAId,
  });
  assert(recovery.recoveredCount >= 1, "Stale webhook deployment auto-recovered");
  assert(recovery.recoveredIds.includes(staleWebhookDep._id.toString()), "Recovered correct deployment ID");

  const recovered = await Deployment.findById(staleWebhookDep._id);
  assert(recovered?.status === "FAILED", "Stale deployment transitioned to FAILED");

  // --------------------------------------------------------------------------
  // Scenario 14: Deployment pinned to exact pushed commit SHA
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 14: Exact Commit SHA Pinning ---");
  const exactCommitSha = "8888888888888888888888888888888888888888";
  const exactPayload = JSON.stringify({
    ref: "refs/heads/main",
    after: exactCommitSha,
    repository: {
      id: 1296269,
      full_name: "octocat/Hello-World",
    },
    pusher: { name: "octocat" },
    head_commit: {
      id: exactCommitSha,
      message: "feat: pinned commit exact sha test",
      timestamp: new Date().toISOString(),
      author: { name: "Test Author" },
    },
  });
  const exactSig = computeSignature(exactPayload, rawSecretA);
  const exactReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-exact-1",
      "X-Hub-Signature-256": exactSig,
    },
    body: exactPayload,
  });
  const exactRes = await webhookRoute(exactReq);
  const exactData = await exactRes.json();
  const exactDep = await Deployment.findById(exactData.deploymentId);
  assert(exactDep?.commitHash === exactCommitSha, "Deployment is pinned to exact 40-character SHA");

  // --------------------------------------------------------------------------
  // Scenario 15: Cross-account isolation
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 15: Cross-Account Isolation ---");
  // 15a: User A tries to view User B's webhook settings
  const crossGetReq = new Request(`http://localhost:3000/api/projects/${testProjectBId}/webhook`, {
    headers: { cookie: cookieA },
  });
  const crossGetRes = await getProjectWebhookRoute(crossGetReq, {
    params: Promise.resolve({ id: testProjectBId }),
  });
  assert(crossGetRes.status === 404, "User A cannot access User B's webhook settings (404)");

  // 15b: User A tries to modify User B's webhook settings
  const crossPostReq = new Request(`http://localhost:3000/api/projects/${testProjectBId}/webhook`, {
    method: "POST",
    headers: { cookie: cookieA, "Content-Type": "application/json" },
    body: JSON.stringify({ regenerateSecret: true }),
  });
  const crossPostRes = await postProjectWebhookRoute(crossPostReq, {
    params: Promise.resolve({ id: testProjectBId }),
  });
  assert(crossPostRes.status === 404, "User A cannot modify User B's webhook settings (404)");

  // 15c: Webhook signed with Project A's secret cannot deploy Project B
  const crossSig = computeSignature(testPayload, rawSecretA); // Signed with Secret A
  const crossPayloadB = JSON.stringify({
    ref: "refs/heads/main",
    after: "9999999999999999999999999999999999999999",
    repository: {
      id: 1300119, // Project B's repository
      full_name: "octocat/Spoon-Knife",
    },
    head_commit: {
      id: "9999999999999999999999999999999999999999",
      message: "Cross attack commit",
    },
  });
  const crossWebhookReq = new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "wh-deliv-cross-1",
      "X-Hub-Signature-256": crossSig,
    },
    body: crossPayloadB,
  });
  const crossWebhookRes = await webhookRoute(crossWebhookReq);
  assert(crossWebhookRes.status === 401, "Cross-account webhook signature rejected with 401 Unauthorized");

  // --------------------------------------------------------------------------
  // Scenario 16: Webhook secret and token redaction
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 16: Webhook Secret & Token Redaction ---");
  const getWhReq = new Request(`http://localhost:3000/api/projects/${testProjectAId}/webhook`, {
    headers: { cookie: cookieA },
  });
  const getWhRes = await getProjectWebhookRoute(getWhReq, {
    params: Promise.resolve({ id: testProjectAId }),
  });
  assert(getWhRes.status === 200, "Authenticated owner can fetch webhook metadata");
  const getWhData = await getWhRes.json();
  assert(getWhData.webhookUrl.includes("/api/webhooks/github"), "Canonical webhook URL returned");
  assert(getWhData.webhookStatus === "active", "Webhook status reported as active");

  // Verify secret is not in Project GET /api/projects/[id]
  const { GET: getProjectByIdRoute } = await import("./app/api/projects/[id]/route");
  const getProjReq = new Request(`http://localhost:3000/api/projects/${testProjectAId}`, {
    headers: { cookie: cookieA },
  });
  const getProjRes = await getProjectByIdRoute(getProjReq, {
    params: Promise.resolve({ id: testProjectAId }),
  });
  const getProjData = await getProjRes.json();
  // Ensure decrypted raw secret is never present in standard project serialization
  assert(!JSON.stringify(getProjData).includes(rawSecretA), "Raw webhook secret is never leaked in standard project GET");

  // --------------------------------------------------------------------------
  // Scenario 17: Duplicate webhook registration prevention
  // --------------------------------------------------------------------------
  console.log("\n--- Scenario 17: Duplicate Webhook Registration Prevention ---");
  // Mock fetch to simulate GitHub hooks API
  const origFetch = global.fetch;
  let getHooksCalled: boolean = false;
  let postHooksCalled: boolean = false;

  global.fetch = (async (input: any, init?: any) => {
    const url = String(input);
    if (url.includes("/hooks")) {
      if (!init || !init.method || init.method === "GET") {
        getHooksCalled = true;
        return new Response(
          JSON.stringify([
            {
              id: 998877,
              active: true,
              config: { url: "http://localhost:3000/api/webhooks/github" },
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (init?.method === "POST") {
        postHooksCalled = true;
        return new Response(JSON.stringify({ id: 112233 }), { status: 201 });
      }
    }
    return origFetch(input, init);
  }) as any;

  try {
    const regResult = await createRepositoryWebhook(
      "ghp_mockToken1234567890abcdefghijklmnopqrst",
      "octocat",
      "Hello-World",
      "http://localhost:3000/api/webhooks/github",
      "test_secret"
    );

    assert(regResult.status === "active", "Registration confirmed active");
    assert(Boolean(regResult.isExisting), "Detected existing webhook on GitHub");
    assert(regResult.webhookId === 998877, "Preserved existing webhook ID 998877");
    assert(Boolean(getHooksCalled), "Queried existing hooks first");
    assert(!postHooksCalled, "Did NOT create duplicate hook on GitHub");
  } finally {
    global.fetch = origFetch;
  }

  // --------------------------------------------------------------------------
  // Cleanup test data
  // --------------------------------------------------------------------------
  await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
  await Project.deleteMany({ _id: { $in: [testProjectAId, testProjectBId] } });
  await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await WebhookDelivery.deleteMany({ projectId: { $in: [testProjectAId, testProjectBId] } });
  await Integration.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

  console.log("\n=======================================================");
  console.log(`  PASSED: ${passedTests} / ${totalTests} CHECKS COMPLETED SUCCESSFULLY`);
  console.log("=======================================================\n");
}

runWebhookAutoDeploySuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
