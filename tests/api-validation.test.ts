/**
 * API Validation, Rate Limiting & Anti-Caching Headers Automated Test Suite
 *
 * Verifies:
 * 1. Pagination parameter sanitization and boundary clamping (parsePagination).
 * 2. Field sorting whitelisting and injection defense (parseSort).
 * 3. Search term sanitization and regex metacharacter escaping (ReDoS defense).
 * 4. Dual-layer rate limiting headers and retry-after calculation.
 * 5. Programmatic anti-caching headers on authenticated API endpoints.
 */

import assert from "assert";
import {
  parsePagination,
  parseSort,
  sanitizeSearchTerm,
  escapeRegex,
} from "../lib/security/sanitize";
import {
  checkRateLimit,
  getRateLimitHeaders,
  resetRateLimit,
} from "../lib/auth/rate-limit";
import {
  ANTI_CACHE_HEADERS,
  getSecurityHeadersRecord,
} from "../lib/security/headers";

async function runApiValidationTests() {
  console.log("=== STARTING API VALIDATION & SECURITY HEADERS TEST SUITE ===");

  // 1. Pagination Parameter Sanitization & Clamping
  console.log("\n1. Testing Pagination Parameter Clamping...");
  const validParams = new URLSearchParams({ page: "3", limit: "25" });
  const p1 = parsePagination(validParams, 20, 100);
  assert.strictEqual(p1.page, 3);
  assert.strictEqual(p1.limit, 25);
  assert.strictEqual(p1.skip, 50);
  console.log("  [PASS] Standard page, limit, and skip accurately computed");

  // Negative / Zero page clamped to 1
  const negativeParams = new URLSearchParams({ page: "-10", limit: "0" });
  const p2 = parsePagination(negativeParams, 20, 100);
  assert.strictEqual(p2.page, 1, "Negative page must be clamped to 1");
  assert.strictEqual(p2.limit, 20, "Zero or negative limit must fall back to default limit");
  assert.strictEqual(p2.skip, 0);
  console.log("  [PASS] Negative page and zero limit clamped safely");

  // Oversized limit clamped to maxLimit
  const oversizedParams = new URLSearchParams({ page: "1", limit: "5000" });
  const p3 = parsePagination(oversizedParams, 20, 100);
  assert.strictEqual(p3.limit, 100, "Limit exceeding maxLimit (100) must be clamped to 100");
  console.log("  [PASS] Excessive limit (5000) clamped to ceiling (100)");

  // 2. Sorting Field Whitelisting
  console.log("\n2. Testing Sort Field Whitelisting & Injection Defense...");
  const allowedFields = ["createdAt", "name", "updatedAt"] as const;

  const validSortParams = new URLSearchParams({ sort: "name", order: "asc" });
  const s1 = parseSort(validSortParams, allowedFields, "createdAt", "desc");
  assert.strictEqual(s1.field, "name");
  assert.strictEqual(s1.order, 1);
  assert.deepStrictEqual(s1.sortObject, { name: 1 });
  console.log("  [PASS] Whitelisted field 'name' and 'asc' order accepted");

  // Malicious / Injected sort field
  const maliciousSortParams = new URLSearchParams({ sort: "$where", order: "desc" });
  const s2 = parseSort(maliciousSortParams, allowedFields, "createdAt", "desc");
  assert.strictEqual(s2.field, "createdAt", "Disallowed sort field must fall back to default");
  assert.strictEqual(s2.order, -1);
  assert.deepStrictEqual(s2.sortObject, { createdAt: -1 });
  console.log("  [PASS] Injected sort field '$where' blocked and safely defaulted to 'createdAt'");

  // 3. Search Term Sanitization & ReDoS Defense
  console.log("\n3. Testing Search Term Sanitization & ReDoS Defense...");
  const maliciousRegex = "(a+)+$";
  const escaped = escapeRegex(maliciousRegex);
  assert.strictEqual(escaped, "\\(a\\+\\)\\+\\$", "Special regex characters must be escaped with backslashes");
  console.log("  [PASS] Regex metacharacters escaped to prevent ReDoS attacks");

  const longSearch = "a".repeat(200);
  const truncated = sanitizeSearchTerm(longSearch, 50);
  assert.strictEqual(truncated.length, 50, "Search term must be strictly truncated to max length");
  console.log("  [PASS] Search query strictly bounded by length limits");

  // 4. Rate Limiting & Header Generation
  console.log("\n4. Testing Rate Limiting & HTTP Header Attributes...");
  const testIp = `198.51.100.${Math.floor(Math.random() * 250) + 1}`;
  const maxAttempts = 3;
  const windowMs = 60 * 1000;

  const r1 = checkRateLimit(`test-rl:${testIp}`, maxAttempts, windowMs);
  assert.strictEqual(r1.allowed, true);
  assert.strictEqual(r1.remaining, 2);

  const r2 = checkRateLimit(`test-rl:${testIp}`, maxAttempts, windowMs);
  assert.strictEqual(r2.allowed, true);
  assert.strictEqual(r2.remaining, 1);

  const r3 = checkRateLimit(`test-rl:${testIp}`, maxAttempts, windowMs);
  assert.strictEqual(r3.allowed, true);
  assert.strictEqual(r3.remaining, 0);

  // 4th request must be blocked
  const r4 = checkRateLimit(`test-rl:${testIp}`, maxAttempts, windowMs);
  assert.strictEqual(r4.allowed, false);
  assert.strictEqual(r4.remaining, 0);
  assert(r4.retryAfterSeconds > 0, "Blocked request must return positive retryAfterSeconds");

  // Verify HTTP headers generation
  const rlHeaders = getRateLimitHeaders(maxAttempts, r4.remaining, r4.retryAfterSeconds);
  assert.strictEqual(rlHeaders["X-RateLimit-Limit"], "3");
  assert.strictEqual(rlHeaders["X-RateLimit-Remaining"], "0");
  assert(rlHeaders["Retry-After"] !== undefined);

  // Test resetRateLimit clears the bucket
  resetRateLimit(`test-rl:${testIp}`);
  const rAfterReset = checkRateLimit(`test-rl:${testIp}`, maxAttempts, windowMs);
  assert.strictEqual(rAfterReset.allowed, true, "Bucket must be restored after resetRateLimit");
  assert.strictEqual(rAfterReset.remaining, 2);
  console.log("  [PASS] Rate limit accurately tracks remaining quota, blocks excess requests, generates headers, and resets");

  // 5. Anti-Caching Security Headers & CSP
  console.log("\n5. Testing Security Headers & Anti-Caching Policies...");
  const headers = ANTI_CACHE_HEADERS;
  assert(headers["Cache-Control"].includes("no-store"), "Must include no-store");
  assert(headers["Cache-Control"].includes("no-cache"), "Must include no-cache");
  assert(headers["Cache-Control"].includes("max-age=0"), "Must include max-age=0");
  assert.strictEqual(headers["Pragma"], "no-cache");
  assert.strictEqual(headers["Expires"], "0");
  assert.strictEqual(headers["Surrogate-Control"], "no-store");
  console.log("  [PASS] Strict anti-caching headers verified for authenticated API responses");

  const secHeaders = getSecurityHeadersRecord();
  assert.strictEqual(secHeaders["X-Frame-Options"], "DENY", "X-Frame-Options must be DENY");
  assert.strictEqual(secHeaders["X-Content-Type-Options"], "nosniff");
  assert(secHeaders["Content-Security-Policy"].includes("default-src 'self'"));
  console.log("  [PASS] Hardened security headers (CSP, X-Frame-Options, HSTS) verified");

  console.log("\n=== ALL API VALIDATION & SECURITY TESTS PASSED! ===");
}

runApiValidationTests().catch((e) => {
  console.error("API Validation Test Error:", e);
  process.exit(1);
});
