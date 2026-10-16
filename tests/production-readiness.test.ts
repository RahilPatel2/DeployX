/**
 * Automated Production Readiness & Configuration Test Suite
 * 
 * Verifies:
 * 1. Production environment variable validation and secret hygiene.
 * 2. Canonical URL derivation and reverse-proxy HTTPS protocol detection.
 * 3. Production session cookie flags and insecure default secret rejection.
 * 4. GitHub OAuth canonical callback URL matching and redirect safety.
 * 5. Cloudflare configuration format validation and server-only assertions.
 * 6. Health check endpoint structure, service status, and anti-caching headers.
 */

import assert from "assert";
import { validateProductionEnv } from "../lib/env";
import { getCanonicalAppUrl, isHttpsRequest } from "../lib/network/canonical";
import {
  SESSION_COOKIE_OPTIONS,
  isProductionSecure,
  getSessionSecretKey,
} from "../lib/auth/session";
import {
  getGitHubCallbackUrl,
  getGitHubOAuthConfig,
  isSafeOAuthRedirect,
} from "../lib/github/oauth-config";
import { getCloudflareConfig } from "../lib/cloudflare/client";
import { GET as healthCheckGet } from "../app/api/health/route";

async function runProductionReadinessTests() {
  console.log("=== STARTING PRODUCTION READINESS & CONFIGURATION TEST SUITE ===");

  // 1. Environment Variable Validation
  console.log("\n1. Testing Production Environment Variable Validator...");

  // Insecure / missing configuration test
  const invalidEnv: Record<string, string> = {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "http://deployx.com/", // Trailing slash + HTTP in prod
    JWT_SECRET: "default_development_secret_key", // Insecure default
    MONGODB_URI: "postgres://invalid-db", // Invalid scheme
    GITHUB_CLIENT_ID: "REPLACE_WITH_CLIENT_ID",
    GITHUB_CLIENT_SECRET: "REPLACE_WITH_CLIENT_SECRET",
    CLOUDFLARE_ACCOUNT_ID: "not-a-hex-account-id-too-short",
    CLOUDFLARE_API_TOKEN: "REPLACE_WITH_TOKEN",
  };

  const invalidResult = validateProductionEnv(invalidEnv);
  assert.strictEqual(invalidResult.valid, false, "Must reject invalid production environment");
  assert(invalidResult.errors.some((e) => e.includes("trailing slash")), "Must flag trailing slash in app URL");
  assert(invalidResult.errors.some((e) => e.includes("Insecure default JWT_SECRET")), "Must flag insecure default JWT secret in prod");
  assert(invalidResult.errors.some((e) => e.includes("mongodb://")), "Must flag invalid MongoDB scheme");
  assert(invalidResult.errors.some((e) => e.includes("CLOUDFLARE_ACCOUNT_ID")), "Must flag invalid Cloudflare account ID");
  console.log("  [PASS] Invalid environment detected and all insecure configurations rejected");

  // Valid production environment test
  const validEnv: Record<string, string> = {
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: "https://deployx.example.com",
    JWT_SECRET: "a".repeat(64),
    MONGODB_URI: "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority",
    MONGODB_DB: "deployx_db",
    GITHUB_CLIENT_ID: "Ov23testclientid",
    GITHUB_CLIENT_SECRET: "0123456789abcdef0123456789abcdef01234567",
    CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
    CLOUDFLARE_API_TOKEN: "cf-token-valid-length-more-than-twenty-characters",
  };

  const validResult = validateProductionEnv(validEnv);
  assert.strictEqual(validResult.valid, true, `Must pass valid config: ${validResult.errors.join(", ")}`);
  assert.strictEqual(validResult.errors.length, 0);
  console.log("  [PASS] Complete production environment validated with zero errors");

  // 2. Canonical URL & Reverse Proxy HTTPS Detection
  console.log("\n2. Testing Canonical URL & Reverse-Proxy Protocol Detection...");

  // Simulate incoming HTTP request behind HTTPS edge proxy (x-forwarded-proto)
  const proxyReq = new Request("http://internal-container:3000/some-path", {
    headers: {
      "x-forwarded-proto": "https",
      "x-forwarded-host": "deployx.domain.com",
    },
  });
  assert.strictEqual(isHttpsRequest(proxyReq), true, "Must recognize HTTPS from x-forwarded-proto");
  console.log("  [PASS] HTTPS accurately inferred from x-forwarded-proto header");

  // Direct HTTPS URL
  const directHttpsReq = new Request("https://deployx.domain.com/dashboard");
  assert.strictEqual(isHttpsRequest(directHttpsReq), true, "Must recognize direct HTTPS protocol");
  console.log("  [PASS] Direct HTTPS protocol recognized");

  // Canonical base URL resolution without trailing slash
  const origAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://app.deployx.io/";
  const canonical = getCanonicalAppUrl();
  assert.strictEqual(canonical, "https://app.deployx.io", "Must strip trailing slashes from canonical URL");
  console.log("  [PASS] Canonical application URL normalized with trailing slashes stripped");
  process.env.NEXT_PUBLIC_APP_URL = origAppUrl;

  // 3. Production Session Cookie Security
  console.log("\n3. Testing Session Cookie Attributes & Production Hardening...");
  assert.strictEqual(SESSION_COOKIE_OPTIONS.httpOnly, true, "Session cookie must be HttpOnly");
  assert.strictEqual(SESSION_COOKIE_OPTIONS.sameSite, "lax", "Session cookie must use SameSite=Lax");
  assert.strictEqual(SESSION_COOKIE_OPTIONS.path, "/", "Session cookie must be scoped to root path");

  // In production, insecure default secrets must throw
  const envMap = process.env as Record<string, string | undefined>;
  const origNodeEnv = envMap.NODE_ENV;
  const origJwtSecret = envMap.JWT_SECRET;
  envMap.NODE_ENV = "production";
  envMap.JWT_SECRET = "default_development_secret_key";
  assert.throws(
    () => getSessionSecretKey(),
    /Insecure JWT_SECRET in production/,
    "Must throw when default secret is used in production"
  );
  console.log("  [PASS] Insecure default JWT secret rejected in production runtime");
  envMap.NODE_ENV = origNodeEnv;
  envMap.JWT_SECRET = origJwtSecret;

  // 4. GitHub OAuth Canonical Callback URL & Redirect Safety
  console.log("\n4. Testing GitHub OAuth Canonical Callback URL & Redirect Defense...");
  const callbackUrl = getGitHubCallbackUrl("https://deployx.com");
  assert(callbackUrl.endsWith("/api/integrations/github/callback"), "Must end with standard callback path");

  // Open redirect defense
  assert.strictEqual(isSafeOAuthRedirect("/dashboard/projects"), true, "Internal path must be accepted");
  assert.strictEqual(isSafeOAuthRedirect("https://attacker.com"), false, "Absolute URL must be rejected");
  assert.strictEqual(isSafeOAuthRedirect("//attacker.com"), false, "Protocol-relative URL must be rejected");
  assert.strictEqual(isSafeOAuthRedirect("/\\attacker.com"), false, "Backslash evasive path must be rejected");
  console.log("  [PASS] GitHub OAuth redirect target strictly constrained against open redirect vectors");

  // 5. Cloudflare Provider Configuration Validation
  console.log("\n5. Testing Cloudflare Provider Validation...");
  const origCfAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  const origCfToken = process.env.CLOUDFLARE_API_TOKEN;

  // Invalid account ID format
  process.env.CLOUDFLARE_ACCOUNT_ID = "short_id";
  process.env.CLOUDFLARE_API_TOKEN = "valid_length_token_1234567890";
  assert.throws(
    () => getCloudflareConfig(),
    /Invalid CLOUDFLARE_ACCOUNT_ID format/,
    "Must throw on malformed account ID"
  );
  console.log("  [PASS] Cloudflare provider strictly validates 32-character hex account IDs");

  process.env.CLOUDFLARE_ACCOUNT_ID = origCfAccount;
  process.env.CLOUDFLARE_API_TOKEN = origCfToken;

  // 6. Health Check Endpoint Verification
  console.log("\n6. Testing Health Check & Liveness Endpoint Structure...");
  const healthRes = await healthCheckGet();
  assert(healthRes.status === 200 || healthRes.status === 503, "Health check must return 200 or 503");

  const healthData = await healthRes.json();
  assert(healthData.status === "ok" || healthData.status === "degraded", "Status must be 'ok' or 'degraded'");
  assert(typeof healthData.timestamp === "string", "Must include ISO timestamp");
  assert(typeof healthData.uptime === "number", "Must include uptime in seconds");
  assert.strictEqual(healthData.version, "0.1.0");
  assert(healthData.services !== undefined, "Must include services status map");

  // Anti-cache header verification
  const cacheControl = healthRes.headers.get("Cache-Control");
  assert(cacheControl && cacheControl.includes("no-store"), "Health check must send no-store");
  console.log("  [PASS] Health check endpoint verified: safe structure, service metrics, and anti-caching headers");

  console.log("\n=== ALL PRODUCTION READINESS & CONFIGURATION TESTS PASSED! ===");
}

runProductionReadinessTests().catch((err) => {
  console.error("Production Readiness Test Suite Failed:", err);
  process.exit(1);
});
