/**
 * Automated Verification Suite for Step 9: Cloudflare API Integration
 * Tests all 12 required scenarios with mocked Cloudflare responses,
 * token redaction, timeout handling, duplicate protection, and ownership checks.
 */

import connectToDatabase from "./lib/mongodb/client";
import User from "./models/User";
import Project from "./models/Project";
import Deployment from "./models/Deployment";
import {
  cfRequest,
  CloudflareError,
  CloudflareTimeoutError,
  redactSensitive,
} from "./lib/cloudflare/client";
import {
  verifyCloudflareConfiguration,
  evaluateDeploymentTarget,
  sanitizePagesProjectName,
  mapCloudflareStatus,
  CloudflareProvider,
} from "./lib/cloudflare/provider";
import { POST as createDeploymentRoute, GET as getDeploymentsRoute } from "./app/api/deployments/route";
import { GET as getDeploymentByIdRoute } from "./app/api/deployments/[id]/route";
import { GET as getCloudflareStatusRoute } from "./app/api/integrations/cloudflare/status/route";
import { encrypt } from "./lib/auth/session";

const originalFetch = global.fetch;

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

async function createMockSessionCookie(userId: string): Promise<string> {
  const token = await encrypt({ userId });
  return `session=${token}`;
}

async function runCloudflareTestSuite() {
  console.log("\n=======================================================");
  console.log("  DEPLOYX STEP 9: CLOUDFLARE API INTEGRATION SUITE     ");
  console.log("=======================================================\n");

  await connectToDatabase();

  // Test Fixture User IDs
  const testUserAId = "600000000000000000000001";
  const testUserBId = "600000000000000000000002";

  // Clean existing test records if any
  await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
  await Project.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

  await User.create([
    { _id: testUserAId, name: "CF User A", username: "cf_user_a", email: "user-a@cf-test.com", passwordHash: "dummy" },
    { _id: testUserBId, name: "CF User B", username: "cf_user_b", email: "user-b@cf-test.com", passwordHash: "dummy" },
  ]);

  try {
    // -------------------------------------------------------------
    // Test 1: Missing Cloudflare Environment Variables
    // -------------------------------------------------------------
    console.log("▶ [Test 1] Missing Cloudflare Environment Variables");
    const origToken = process.env.CLOUDFLARE_API_TOKEN;
    const origAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;

    const missingResult = await verifyCloudflareConfiguration();
    assert(missingResult.connected === false, "Returns connected: false when API token is missing");
    assert(missingResult.category === "MISSING_CONFIG", "Category is marked as MISSING_CONFIG");
    assert(missingResult.error?.includes("Missing") === true, "Error message explains missing credentials");

    // Restore environment
    process.env.CLOUDFLARE_API_TOKEN = origToken;
    process.env.CLOUDFLARE_ACCOUNT_ID = origAccount;

    // -------------------------------------------------------------
    // Test 2: Invalid Credentials Handling (401)
    // -------------------------------------------------------------
    console.log("\n▶ [Test 2] Invalid Credentials Handling (HTTP 401)");
    global.fetch = async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes("/user/tokens/verify")) {
        return new Response(
          JSON.stringify({
            success: false,
            errors: [{ code: 1000, message: "Invalid API Token" }],
          }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    const invalidCredsResult = await verifyCloudflareConfiguration();
    assert(invalidCredsResult.connected === false, "Verification reports connected: false on 401");
    assert(invalidCredsResult.tokenStatus === "expired", "Token status is marked as expired");
    assert(invalidCredsResult.category === "INVALID_CREDENTIALS", "Category is marked as INVALID_CREDENTIALS");

    // -------------------------------------------------------------
    // Test 3: Insufficient Token Permissions (HTTP 403)
    // -------------------------------------------------------------
    console.log("\n▶ [Test 3] Insufficient Token Permissions (HTTP 403)");
    global.fetch = async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes("/user/tokens/verify")) {
        return new Response(
          JSON.stringify({ success: true, result: { id: "tok-1", status: "active" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/accounts/") && !urlStr.includes("/pages")) {
        return new Response(
          JSON.stringify({ success: true, result: { id: "acc-1", name: "Test Team Account" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/pages/projects")) {
        return new Response(
          JSON.stringify({
            success: false,
            errors: [{ code: 10000, message: "Authentication error: Missing Cloudflare Pages permission" }],
          }),
          { status: 403, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    const forbiddenResult = await verifyCloudflareConfiguration();
    assert(forbiddenResult.connected === false, "Verification reports connected: false when Pages permission is missing");
    assert(forbiddenResult.permissions.pages === false, "Pages permission is detected as false");
    assert(forbiddenResult.category === "INSUFFICIENT_PERMISSIONS", "Category is marked as INSUFFICIENT_PERMISSIONS");

    // -------------------------------------------------------------
    // Test 4: Rate Limiting Handling (HTTP 429) & Safe Retries
    // -------------------------------------------------------------
    console.log("\n▶ [Test 4] Rate Limiting (429) & Exponential Retry");
    let attempts429 = 0;
    global.fetch = async (url: any) => {
      attempts429++;
      if (attempts429 === 1) {
        return new Response(
          JSON.stringify({ success: false, errors: [{ code: 10013, message: "Rate limit exceeded" }] }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "1" },
          }
        );
      }
      return new Response(
        JSON.stringify({ success: true, result: [{ id: "proj-1", name: "deployx-app" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };

    const rateLimitResponse = await cfRequest<any[]>("/accounts/{account_id}/pages/projects", {
      method: "GET",
      maxRetries: 2,
    });
    assert(rateLimitResponse.length === 1, "Successfully recovered from 429 rate limit");
    assert(attempts429 === 2, "Performed expected retry after receiving 429");

    // -------------------------------------------------------------
    // Test 5: Network Timeout Handling
    // -------------------------------------------------------------
    console.log("\n▶ [Test 5] Network Request Timeout Handling");
    global.fetch = async (_url: any, init?: any) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => resolve(new Response("ok")), 200);
        if (init?.signal) {
          if (init.signal.aborted) {
            clearTimeout(timer);
            const abortErr = new Error("This operation was aborted");
            abortErr.name = "AbortError";
            return reject(abortErr);
          }
          init.signal.addEventListener("abort", () => {
            clearTimeout(timer);
            const abortErr = new Error("This operation was aborted");
            abortErr.name = "AbortError";
            reject(abortErr);
          });
        }
      });
    };

    let timeoutThrown = false;
    try {
      await cfRequest("/test-timeout", {
        method: "GET",
        timeoutMs: 10,
        maxRetries: 0,
      });
    } catch (err: unknown) {
      if (err instanceof CloudflareTimeoutError) {
        timeoutThrown = true;
      }
    }
    assert(timeoutThrown, "CloudflareTimeoutError thrown on aborted request");

    // -------------------------------------------------------------
    // Test 6: Pages Project Discovery
    // -------------------------------------------------------------
    console.log("\n▶ [Test 6] Existing Pages Project Discovery");
    global.fetch = async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes("/pages/projects/my-existing-app")) {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: "cf-proj-123",
              name: "my-existing-app",
              subdomain: "my-existing-app.pages.dev",
              domains: [],
              production_branch: "main",
              created_on: new Date().toISOString(),
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, errors: [{ code: 8000007, message: "Project not found" }] }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    };

    const exists = await CloudflareProvider.projectExists("my-existing-app");
    const notExists = await CloudflareProvider.projectExists("non-existent-app");
    assert(exists === true, "projectExists returns true for existing Cloudflare Pages project");
    assert(notExists === false, "projectExists returns false for 404 response");

    // -------------------------------------------------------------
    // Test 7: Duplicate Project Creation Protection
    // -------------------------------------------------------------
    console.log("\n▶ [Test 7] Duplicate Project Creation Protection (Idempotent Resolution)");
    // createProject should safely return existing project without error
    const resolvedProject = await CloudflareProvider.createProject(
      "my-existing-app",
      "main",
      "test-owner/my-existing-app"
    );
    assert(resolvedProject.id === "cf-proj-123", "createProject idempotently returned existing project without duplicate creation");

    // -------------------------------------------------------------
    // Test 8: Unsupported Framework/Deployment Combinations
    // -------------------------------------------------------------
    console.log("\n▶ [Test 8] Unsupported Framework Combinations Rejection");
    const nextStatic = evaluateDeploymentTarget({
      framework: "Next.js (Static Export)",
      deploymentMode: "static",
    });
    assert(nextStatic.compatible === true, "Next.js static export is compatible with Cloudflare Pages");
    assert(nextStatic.target === "pages_static", "Target is 'pages_static'");

    const nextSsrUnadapted = evaluateDeploymentTarget({
      framework: "Next.js",
      deploymentMode: "ssr",
    });
    assert(nextSsrUnadapted.compatible === false, "Unadapted Next.js SSR is rejected");
    assert(nextSsrUnadapted.reason?.includes("output: export") === true, "Clear explanation given for Next.js SSR requirement");

    const pythonBackend = evaluateDeploymentTarget({
      framework: "Python",
      deploymentMode: "ssr",
    });
    assert(pythonBackend.compatible === false, "Python backend is rejected for Cloudflare edge deployment");

    // -------------------------------------------------------------
    // Test 9: Authentication & Project Ownership Checks
    // -------------------------------------------------------------
    console.log("\n▶ [Test 9] Authentication & Project Ownership Isolation");
    // Create Project owned by User A
    const projectA = await Project.create({
      name: "User A Project",
      slug: "user-a-app",
      userId: testUserAId,
      repository: "owner/user-a-repo",
      branch: "main",
      framework: "React (Vite)",
      buildCommand: "npm run build",
      outputDirectory: "dist",
      cloudflareProjectName: "user-a-app",
    });

    // 9A: Unauthenticated user attempt
    const unauthReq = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: projectA._id }),
    });
    const unauthRes = await createDeploymentRoute(unauthReq);
    assert(unauthRes.status === 401, "Unauthenticated deployment attempt blocked with HTTP 401");

    // 9B: User B trying to deploy User A's project (cross-tenant violation)
    const crossTenantReq = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: await createMockSessionCookie(testUserBId),
      },
      body: JSON.stringify({ projectId: projectA._id }),
    });
    const crossTenantRes = await createDeploymentRoute(crossTenantReq);
    assert(crossTenantRes.status === 404, "Cross-tenant deployment attempt blocked with HTTP 404 (Resource not found)");

    // -------------------------------------------------------------
    // Test 10: Safe Error Handling & Token Redaction
    // -------------------------------------------------------------
    console.log("\n▶ [Test 10] Safe Error Handling & Token Redaction");
    const secretToken = "cf_secret_token_abcdef123456";
    const sensitiveErrorMsg = `Failed request with Bearer ${secretToken} to account acc-1`;
    const redacted = redactSensitive(sensitiveErrorMsg, secretToken);
    assert(!redacted.includes(secretToken), "Secret token completely redacted from error string");
    assert(redacted.includes("[REDACTED_API_TOKEN]"), "Token replaced with [REDACTED_API_TOKEN]");

    // -------------------------------------------------------------
    // Test 11: Deployment Creation & Real URL Parsing
    // -------------------------------------------------------------
    console.log("\n▶ [Test 11] Deployment Status & Real URL Persistence");
    global.fetch = async (url: any) => {
      const urlStr = url.toString();
      if (urlStr.includes("/pages/projects/user-a-app/deployments")) {
        return new Response(
          JSON.stringify({
            success: true,
            result: {
              id: "cf-dep-999",
              short_id: "cf-dep",
              project_name: "user-a-app",
              environment: "Production",
              url: "https://cf-dep-999.user-a-app.pages.dev",
              created_on: new Date().toISOString(),
              latest_stage: { name: "deploy", status: "success" },
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    const validDeployReq = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: await createMockSessionCookie(testUserAId),
      },
      body: JSON.stringify({ projectId: projectA._id }),
    });
    const validDeployRes = await createDeploymentRoute(validDeployReq);
    assert(validDeployRes.status === 201, "Legitimate deployment started with HTTP 201");
    const deployData = await validDeployRes.json();
    assert(deployData.deployment.cloudflareDeploymentId === "cf-dep-999", "Saved real Cloudflare deployment ID");
    assert(deployData.deployment.url === "https://cf-dep-999.user-a-app.pages.dev", "Saved real assigned preview URL");
    assert(deployData.deployment.status === "READY", "Status correctly mapped to READY from Cloudflare 'success'");

    // -------------------------------------------------------------
    // Test 12: Preventing Duplicate Deployment Operations
    // -------------------------------------------------------------
    console.log("\n▶ [Test 12] Preventing Duplicate Concurrent Deployments");
    // Change deployment status back to QUEUED to simulate active pipeline
    await Deployment.updateOne({ _id: deployData.deployment._id }, { status: "QUEUED" });

    const duplicateDeployReq = new Request("http://localhost:3000/api/deployments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: await createMockSessionCookie(testUserAId),
      },
      body: JSON.stringify({ projectId: projectA._id }),
    });
    const duplicateDeployRes = await createDeploymentRoute(duplicateDeployReq);
    assert(duplicateDeployRes.status === 409, "Duplicate concurrent deployment rejected with HTTP 409");
    const dupJson = await duplicateDeployRes.json();
    assert(dupJson.error.includes("already in progress"), "Clear message informing user deployment is in progress");

    console.log("\n=======================================================");
    console.log(`  ALL ${totalTests}/${totalTests} TESTS PASSED SUCCESSFULLY!  `);
    console.log("=======================================================\n");

    // Cleanup test data
    await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
    await Project.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
    await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

    global.fetch = originalFetch;
    process.exit(0);
  } catch (error) {
    global.fetch = originalFetch;
    console.error("\n❌ Test Suite encountered a failure:\n", error);
    process.exit(1);
  }
}

runCloudflareTestSuite();
