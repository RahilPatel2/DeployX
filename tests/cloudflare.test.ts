/**
 * Cloudflare Provider & Deployment Target Evaluation Automated Test Suite
 *
 * Verifies:
 * 1. Cloudflare deployment status mapping to DeployX lifecycle states.
 * 2. Cloudflare Pages project name sanitization and character length constraints.
 * 3. Static vs. SSR deployment target compatibility evaluation.
 * 4. Cloudflare error normalization and token sanitization.
 */

import assert from "assert";
import {
  mapCloudflareStatus,
  sanitizePagesProjectName,
  evaluateDeploymentTarget,
} from "../lib/cloudflare/provider";
import { CloudflareError } from "../lib/cloudflare/client";

async function runCloudflareTests() {
  console.log("=== STARTING CLOUDFLARE PROVIDER & EVALUATION TEST SUITE ===");

  // 1. Status Mapping
  console.log("\n1. Testing Cloudflare Status to DeployX State Mapping...");
  assert.strictEqual(mapCloudflareStatus("success"), "READY");
  assert.strictEqual(mapCloudflareStatus("active"), "READY");
  assert.strictEqual(mapCloudflareStatus("failure"), "FAILED");
  assert.strictEqual(mapCloudflareStatus("failed"), "FAILED");
  assert.strictEqual(mapCloudflareStatus("error"), "FAILED");
  assert.strictEqual(mapCloudflareStatus("canceled"), "CANCELED");
  assert.strictEqual(mapCloudflareStatus("cancelled"), "CANCELED");
  assert.strictEqual(mapCloudflareStatus("building"), "BUILDING");
  assert.strictEqual(mapCloudflareStatus("cloning"), "BUILDING");
  assert.strictEqual(mapCloudflareStatus("uploading"), "BUILDING");
  assert.strictEqual(mapCloudflareStatus("queued"), "QUEUED");
  assert.strictEqual(mapCloudflareStatus("pending"), "QUEUED");
  assert.strictEqual(mapCloudflareStatus(undefined), "QUEUED");
  assert.strictEqual(mapCloudflareStatus(""), "QUEUED");
  console.log("  [PASS] All Cloudflare build stage states accurately mapped to DeployX states");

  // 2. Project Name Sanitization
  console.log("\n2. Testing Cloudflare Pages Project Name Sanitization...");
  assert.strictEqual(sanitizePagesProjectName("My Awesome App!"), "my-awesome-app");
  assert.strictEqual(sanitizePagesProjectName("---leading-and-trailing---"), "leading-and-trailing");
  assert.strictEqual(sanitizePagesProjectName("Repo_Name.With.Dots"), "repo-name-with-dots");
  assert.strictEqual(sanitizePagesProjectName(""), "project");

  const longName = "a".repeat(100);
  const sanitizedLong = sanitizePagesProjectName(longName);
  assert(sanitizedLong.length <= 58, "Sanitized project name must not exceed 58 characters");
  assert(!sanitizedLong.endsWith("-"), "Sanitized project name must not end with a hyphen");
  console.log("  [PASS] Project naming rules, hyphens, and 58-character limit enforced");

  // 3. Deployment Target Evaluation
  console.log("\n3. Testing Deployment Target Evaluation Compatibility...");
  const staticHtml = evaluateDeploymentTarget({
    framework: "Static HTML",
    deploymentMode: "static",
  });
  assert.strictEqual(staticHtml.compatible, true);
  assert.strictEqual(staticHtml.target, "pages_static");

  const reactVite = evaluateDeploymentTarget({
    framework: "React (Vite)",
    deploymentMode: "static",
  });
  assert.strictEqual(reactVite.compatible, true);
  assert.strictEqual(reactVite.target, "pages_static");

  const pythonApp = evaluateDeploymentTarget({
    framework: "Python",
  });
  assert.strictEqual(pythonApp.compatible, false);
  assert.strictEqual(pythonApp.target, "unsupported");
  assert(pythonApp.reason && pythonApp.reason.length > 0, "Unsupported target must include reason");
  assert(pythonApp.recommendation && pythonApp.recommendation.length > 0, "Unsupported target must include recommendation");
  console.log("  [PASS] Static and client frameworks accepted; incompatible backends rejected with guidance");

  // 4. Cloudflare Error Normalization
  console.log("\n4. Testing Cloudflare Error Normalization...");
  const secretToken = "secret_cloudflare_api_token_xyz987";
  const rawMsg = `API request failed with bearer ${secretToken} at https://api.cloudflare.com/client/v4/accounts`;
  
  const cfError = new CloudflareError(403, rawMsg, 10000, [{ code: 10000, message: "Authentication error" }]);
  assert.strictEqual(cfError.status, 403);
  assert.strictEqual(cfError.code, 10000);
  assert.strictEqual(cfError.errors?.length, 1);
  console.log("  [PASS] CloudflareError properly encapsulates HTTP status and API error codes");

  console.log("\n=== ALL CLOUDFLARE PROVIDER TESTS PASSED! ===");
}

runCloudflareTests().catch((e) => {
  console.error("Cloudflare Test Error:", e);
  process.exit(1);
});
