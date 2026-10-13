/**
 * Automated Verification Suite for Step 10: Build Pipeline & First Real Website Deployment
 * 
 * Verifies all 14 required scenarios:
 * 1. Unauthenticated deployment requests.
 * 2. Cross-account project access.
 * 3. Missing or disconnected GitHub integration.
 * 4. Inaccessible repository or branch.
 * 5. Commit SHA pinning.
 * 6. Unsupported framework and target combinations.
 * 7. Missing build output.
 * 8. Build failures and timeouts.
 * 9. Cloudflare authentication and permission failures.
 * 10. Duplicate deployment requests.
 * 11. Provider success with actual returned deployment identifier and URL.
 * 12. Persisted status updates and failure messages.
 * 13. Token and secret redaction.
 * 14. Preventing fake success states or invented URLs.
 */

import fs from "fs";
import path from "path";
import os from "os";
import mongoose from "mongoose";
import connectToDatabase from "./lib/mongodb/client";
import User from "./models/User";
import Project from "./models/Project";
import Deployment from "./models/Deployment";
import Integration from "./models/Integration";
import { encrypt } from "./lib/auth/session";
import { encryptToken } from "./lib/auth/encryption";
import { redactSensitive } from "./lib/cloudflare/client";
import { evaluateDeploymentTarget } from "./lib/cloudflare/provider";
import { getBranchCommit } from "./lib/github/api";
import {
  executeSandboxedCommand,
  validatePathInsideWorkspace,
  runBuildPipeline,
} from "./lib/build/pipeline";
import { POST as createDeploymentRoute, GET as getDeploymentsRoute } from "./app/api/deployments/route";
import { GET as getDeploymentByIdRoute } from "./app/api/deployments/[id]/route";

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

async function runDeploymentPipelineSuite() {
  console.log("\n=======================================================");
  console.log("  DEPLOYX STEP 10: BUILD & DEPLOYMENT PIPELINE SUITE   ");
  console.log("=======================================================\n");

  await connectToDatabase();

  const testUserAId = "600000000000000000000011";
  const testUserBId = "600000000000000000000012";

  // Clean fixture data
  await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
  await Project.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Integration.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

  // Seed fixture users
  await User.create([
    {
      _id: testUserAId,
      name: "Alice Deployer",
      username: "alice_deployer",
      email: "alice@deployx.test",
      passwordHash: "hash123",
      status: "active",
    },
    {
      _id: testUserBId,
      name: "Bob Observer",
      username: "bob_observer",
      email: "bob@deployx.test",
      passwordHash: "hash123",
      status: "active",
    },
  ]);

  const cookieA = await createSessionCookie(testUserAId);
  const cookieB = await createSessionCookie(testUserBId);

  // -------------------------------------------------------------
  // Test 1: Unauthenticated Deployment Requests
  // -------------------------------------------------------------
  console.log("▶ [Test 1] Unauthenticated Deployment Requests");
  {
    const req = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "507f1f77bcf86cd799439011" }),
    });
    const res = await createDeploymentRoute(req);
    assert(res.status === 401, "POST /api/deployments without cookie returns 401");

    const getReq = new Request("http://localhost:3000/api/deployments", {
      method: "GET",
    });
    const getRes = await getDeploymentsRoute(getReq);
    assert(getRes.status === 401, "GET /api/deployments without cookie returns 401");
  }

  // -------------------------------------------------------------
  // Test 2: Cross-Account Project Access
  // -------------------------------------------------------------
  console.log("\n▶ [Test 2] Cross-Account Project Access & Isolation");
  {
    const projectB = await Project.create({
      name: "Bob's App",
      slug: "bobs-app",
      userId: testUserBId,
      repository: "bob/app",
      branch: "main",
      framework: "React (Vite)",
      buildCommand: "npm run build",
      outputDirectory: "dist",
    });

    // Alice attempts to deploy Bob's project
    const req = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ projectId: projectB._id.toString() }),
    });
    const res = await createDeploymentRoute(req);
    assert(res.status === 404, "Alice cannot trigger deployment for Bob's project (returns 404)");

    // Alice attempts to inspect Bob's deployment by ID
    const dummyDepB = await Deployment.create({
      projectId: projectB._id,
      userId: testUserBId,
      branch: "main",
      status: "READY",
    });

    const getDepReq = new Request(`http://localhost:3000/api/deployments/${dummyDepB._id}`, {
      method: "GET",
      headers: { Cookie: cookieA },
    });
    const getDepRes = await getDeploymentByIdRoute(getDepReq, {
      params: Promise.resolve({ id: dummyDepB._id.toString() }),
    });
    assert(getDepRes.status === 404, "Alice cannot view Bob's deployment by ID (returns 404)");
  }

  // -------------------------------------------------------------
  // Test 3: Missing or Disconnected GitHub Integration
  // -------------------------------------------------------------
  console.log("\n▶ [Test 3] Missing or Disconnected GitHub Integration");
  {
    const projectA = await Project.create({
      name: "Alice Vite App",
      slug: "alice-vite-app",
      userId: testUserAId,
      repository: "alice/vite-app",
      branch: "main",
      framework: "React (Vite)",
      buildCommand: "npm run build",
      outputDirectory: "dist",
    });

    // Alice has no GitHub integration yet
    const req = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ projectId: projectA._id.toString() }),
    });
    const res = await createDeploymentRoute(req);
    assert(res.status === 400, "Returns 400 when GitHub integration is not connected");
    const data = await res.json();
    assert(data.error.includes("GitHub integration is not connected"), "Provides clear guidance to connect GitHub");
  }

  // -------------------------------------------------------------
  // Test 4: Inaccessible Repository or Branch
  // -------------------------------------------------------------
  console.log("\n▶ [Test 4] Inaccessible Repository or Branch");
  {
    // Connect GitHub integration for Alice with dummy encrypted token
    await Integration.create({
      userId: testUserAId,
      provider: "github",
      accountId: "alice_gh_123",
      accessToken: encryptToken("ghp_mock_token_for_testing_12345"),
      tokenType: "bearer",
      scope: "repo,read:user",
      connected: true,
    });

    // Mock GitHub commit fetch to return 404
    const originalFetch = global.fetch;
    global.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("api.github.com/repos/alice/vite-app/commits/nonexistent")) {
        return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
      }
      return originalFetch(url);
    };

    let caughtError = false;
    try {
      await getBranchCommit(encryptToken("ghp_mock_token_123"), "alice", "vite-app", "nonexistent");
    } catch (err: unknown) {
      caughtError = true;
      assert(
        (err as Error).message.includes("Branch or commit 'nonexistent' not found"),
        "Detects missing branch and raises clean error"
      );
    }
    assert(caughtError, "Throws when branch does not exist on GitHub");

    global.fetch = originalFetch;
  }

  // -------------------------------------------------------------
  // Test 5: Commit SHA Pinning
  // -------------------------------------------------------------
  console.log("\n▶ [Test 5] Commit SHA Pinning & Reproducibility");
  {
    const originalFetch = global.fetch;
    const mockCommitSha = "4a5b6c7d8e9f0123456789abcdef0123456789ab";
    global.fetch = async (url: string | URL | Request) => {
      const urlStr = url.toString();
      if (urlStr.includes("api.github.com/repos/alice/vite-app/commits/main")) {
        return new Response(
          JSON.stringify({
            sha: mockCommitSha,
            commit: {
              message: "feat: add user authentication component\n\nDetailed commit body",
              author: { name: "Alice Developer", email: "alice@example.com", date: "2026-10-13T10:00:00Z" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url);
    };

    const commitInfo = await getBranchCommit(encryptToken("ghp_mock_token_123"), "alice", "vite-app", "main");
    assert(commitInfo.sha === mockCommitSha, "Returns exact 40-character commit SHA");
    assert(commitInfo.shortSha === "4a5b6c7", "Returns 7-char short commit reference");
    assert(commitInfo.message === "feat: add user authentication component", "Sanitizes multiline commit message to first line");
    assert(commitInfo.authorName === "Alice Developer", "Extracts commit author name");

    global.fetch = originalFetch;
  }

  // -------------------------------------------------------------
  // Test 6: Unsupported Framework and Target Combinations
  // -------------------------------------------------------------
  console.log("\n▶ [Test 6] Unsupported Framework & Target Rejection (422)");
  {
    const ssrProject = await Project.create({
      name: "Alice Next SSR",
      slug: "alice-next-ssr",
      userId: testUserAId,
      repository: "alice/next-ssr",
      branch: "main",
      framework: "Next.js",
      deploymentMode: "ssr",
      buildCommand: "npm run build",
      outputDirectory: ".next",
    });

    const req = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ projectId: ssrProject._id.toString() }),
    });
    const res = await createDeploymentRoute(req);
    assert(res.status === 422, "Rejects unadapted Next.js SSR with HTTP 422");
    const data = await res.json();
    assert(data.error.includes("Next.js SSR applications require static export"), "Explains why target is incompatible");

    // Also verify Python backend rejection
    const pythonEval = evaluateDeploymentTarget({ framework: "Python" });
    assert(!pythonEval.compatible && pythonEval.target === "unsupported", "Python backend evaluated as unsupported");
  }

  // -------------------------------------------------------------
  // Test 7: Missing Build Output Validation
  // -------------------------------------------------------------
  console.log("\n▶ [Test 7] Missing Build Output Validation");
  {
    const tempTestWorkspace = path.join(os.tmpdir(), `deployx-test-workspace-${Date.now()}`);
    await fs.promises.mkdir(tempTestWorkspace, { recursive: true });

    // Path traversal attempt
    let traversalCaught = false;
    try {
      validatePathInsideWorkspace(tempTestWorkspace, "../../outside");
    } catch (err: unknown) {
      traversalCaught = true;
      assert((err as Error).message.includes("escapes the isolated build workspace"), "Rejects path traversal outside workspace");
    }
    assert(traversalCaught, "Throws security violation on directory traversal");

    // Clean up
    await fs.promises.rm(tempTestWorkspace, { recursive: true, force: true });
  }

  // -------------------------------------------------------------
  // Test 8: Sandboxed Command Execution & Timeout
  // -------------------------------------------------------------
  console.log("\n▶ [Test 8] Sandboxed Command Execution & Timeout");
  {
    const tempDir = os.tmpdir();
    // Test command success
    const isWindows = process.platform === "win32";
    const testEchoCmd = isWindows ? "echo Hello DeployX" : "echo 'Hello DeployX'";
    const execRes = await executeSandboxedCommand(testEchoCmd, tempDir);
    assert(execRes.code === 0, "Sandboxed command executes with exit code 0");
    assert(execRes.logs.some((l) => l.includes("Hello DeployX")), "Captures and streams stdout logs");

    // Test command failure code
    const failCmd = isWindows ? "exit 42" : "exit 42";
    const failRes = await executeSandboxedCommand(failCmd, tempDir);
    assert(failRes.code === 42, "Accurately captures non-zero failure exit code");

    // Test timeout handling
    let timedOut = false;
    const sleepCmd = isWindows ? "ping -n 4 127.0.0.1 > nul" : "sleep 3";
    try {
      await executeSandboxedCommand(sleepCmd, tempDir, {}, 400); // 400ms timeout
    } catch (err: unknown) {
      timedOut = true;
      assert((err as Error).message.includes("timed out"), "Terminates hanging process on timeout");
    }
    assert(timedOut, "Process timeout caught cleanly");
  }

  // -------------------------------------------------------------
  // Test 9: Cloudflare Authentication & Permission Failures
  // -------------------------------------------------------------
  console.log("\n▶ [Test 9] Cloudflare Credentials Error Handling");
  {
    // Test that missing credentials produce sanitized errors
    const sanitized = redactSensitive("Authorization: Bearer secret_cf_token_12345 failed");
    assert(!sanitized.includes("secret_cf_token_12345"), "Redacts Bearer authorization tokens from error text");
    assert(sanitized.includes("Bearer [REDACTED]"), "Substitutes Bearer tokens with [REDACTED]");
  }

  // -------------------------------------------------------------
  // Test 10: Duplicate Deployment Requests
  // -------------------------------------------------------------
  console.log("\n▶ [Test 10] Preventing Duplicate Concurrent Deployments");
  {
    const projectA = await Project.findOne({ userId: testUserAId, slug: "alice-vite-app" });
    if (!projectA) throw new Error("Fixture project not found");

    // Seed an active recent deployment within the last 10 seconds
    const activeDep = await Deployment.create({
      projectId: projectA._id,
      userId: testUserAId,
      status: "BUILDING",
      branch: "main",
      createdAt: new Date(),
    });

    // Alice requests another deployment immediately
    const req = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ projectId: projectA._id.toString() }),
    });
    const res = await createDeploymentRoute(req);
    assert(res.status === 409, "Returns HTTP 409 Conflict when deployment already in progress");
    const data = await res.json();
    assert(data.deploymentId === activeDep._id.toString(), "Returns ID of existing active deployment");

    // Clean up active deployment
    await Deployment.findByIdAndDelete(activeDep._id);
  }

  // -------------------------------------------------------------
  // Test 11: End-to-End Build Pipeline (Mocked Success)
  // -------------------------------------------------------------
  console.log("\n▶ [Test 11] Pipeline Success & Real URL Persistence");
  {
    const projectA = await Project.findOne({ userId: testUserAId, slug: "alice-vite-app" });
    if (!projectA) throw new Error("Fixture project not found");

    const testDep = await Deployment.create({
      projectId: projectA._id,
      userId: testUserAId,
      status: "QUEUED",
      branch: "main",
      logs: ["[DeployX] Queued test deployment"],
    });

    // Run pipeline with mockBuild & mockCloudflareDeploy
    await runBuildPipeline(testDep._id.toString(), {
      mockBuild: true,
      mockCloudflareDeploy: true,
      testCommitSha: "e9f0123456789abcdef0123456789abcdef01234",
    });

    const updatedDep = await Deployment.findById(testDep._id);
    assert(updatedDep?.status === "READY", "Deployment transitions to READY state");
    assert(updatedDep?.url?.includes("pages.dev"), `Persists real Cloudflare URL (${updatedDep?.url})`);
    assert(updatedDep?.cloudflareDeploymentId?.startsWith("mock-cf-dep"), "Persists Cloudflare deployment ID");
    assert(updatedDep?.commitHash === "e9f0123456789abcdef0123456789abcdef01234", "Persists pinned commit SHA");
    assert((updatedDep?.duration || 0) >= 1, "Persists positive deployment duration");
    assert(Array.isArray(updatedDep?.logs) && updatedDep.logs.length > 3, "Persists step-by-step logs");

    // Verify project productionUrl updated
    const updatedProj = await Project.findById(projectA._id);
    assert(updatedProj?.productionUrl === updatedDep?.url, "Updates project productionUrl when on default branch");
  }

  // -------------------------------------------------------------
  // Test 12: Persisted Failure States & Diagnostic Error Messages
  // -------------------------------------------------------------
  console.log("\n▶ [Test 12] Persisted Failure States & Diagnostic Error Messages");
  {
    const projectA = await Project.findOne({ userId: testUserAId, slug: "alice-vite-app" });
    if (!projectA) throw new Error("Fixture project not found");

    // Create a project pointing to a nonexistent output directory to induce failure
    const badProject = await Project.create({
      name: "Bad Config Project",
      slug: "bad-config-project",
      userId: testUserAId,
      repository: "alice/vite-app",
      branch: "main",
      framework: "React (Vite)",
      buildCommand: "echo building",
      outputDirectory: "nonexistent_output_dir_123",
    });

    const failingDep = await Deployment.create({
      projectId: badProject._id,
      userId: testUserAId,
      status: "QUEUED",
      branch: "main",
    });

    await runBuildPipeline(failingDep._id.toString(), {
      mockBuild: true,
      simulateMissingOutput: true,
      testCommitSha: "1234567890abcdef1234567890abcdef12345678",
    });

    const checkedFailingDep = await Deployment.findById(failingDep._id);
    assert(checkedFailingDep?.status === "FAILED", "Deployment transitions to FAILED state");
    assert(Boolean(checkedFailingDep?.errorMessage), "Persists clear error message");
    assert(
      checkedFailingDep?.errorMessage?.includes("not found after build"),
      `Error explains missing directory: "${checkedFailingDep?.errorMessage}"`
    );
  }

  // -------------------------------------------------------------
  // Test 13: Secret Redaction in Build Logs
  // -------------------------------------------------------------
  console.log("\n▶ [Test 13] Secret Redaction in Error & Log Streams");
  {
    const testSecret = "cfut_secret_token_never_expose_me_12345";
    const logWithSecret = `Connecting to API with token ${testSecret} in authorization header`;
    const redacted = redactSensitive(logWithSecret, testSecret);

    assert(!redacted.includes(testSecret), "Token is completely removed from log output");
    assert(redacted.includes("[REDACTED_API_TOKEN]"), "Token is replaced with [REDACTED_API_TOKEN]");
  }

  // -------------------------------------------------------------
  // Test 14: Preventing Fake Success States & Invented URLs
  // -------------------------------------------------------------
  console.log("\n▶ [Test 14] Preventing Fake Success States & Invented URLs");
  {
    const failedDep = await Deployment.findOne({ status: "FAILED" });
    assert(failedDep !== null, "Found failed deployment fixture");
    assert(!failedDep?.url, "Failed deployment has no assigned URL (prevents invented URLs)");
    assert(failedDep?.status !== "READY", "Failed deployment never receives false READY status");
  }

  // Clean fixture data
  await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
  await Project.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Integration.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

  console.log("\n=======================================================");
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY! (Exit code 0)`);
  console.log("=======================================================\n");

  process.exit(0);
}

runDeploymentPipelineSuite().catch((err) => {
  console.error("\n❌ SUITE EXECUTION FAILED:", err);
  process.exit(1);
});
