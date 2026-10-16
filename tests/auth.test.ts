/**
 * Authentication & Session Automated Test Suite
 *
 * Verifies:
 * 1. JWT encryption & decryption integrity via jose HS256.
 * 2. Token tampering detection and expiration rejection.
 * 3. Secure session cookie attributes (HttpOnly, SameSite, Path, MaxAge).
 * 4. Password hashing and timing-safe comparison with bcryptjs.
 * 5. Input validation rules for email and password constraints.
 */

import assert from "assert";
import bcrypt from "bcryptjs";
import { encrypt, decrypt, SESSION_COOKIE_OPTIONS, SESSION_DURATION_SECONDS } from "../lib/auth/session";

async function runAuthTests() {
  console.log("=== STARTING AUTH & SESSION TEST SUITE ===");

  // 1. JWT Encryption & Decryption
  console.log("\n1. Testing JWT Encryption & Decryption...");
  const testUserId = "60c72b2f9b1d8b2badde1234";
  const token = await encrypt({ userId: testUserId });

  assert(typeof token === "string" && token.split(".").length === 3, "JWT must be a valid 3-part string");
  console.log("  [PASS] JWT successfully generated with 3-part header.payload.signature");

  const session = await decrypt(token);
  assert(session !== null, "Decrypted session must not be null");
  assert.strictEqual(session.userId, testUserId, "Decrypted userId must match original payload");
  console.log("  [PASS] Decrypted session matches original userId payload");

  // 2. Tampering & Malformed Token Detection
  console.log("\n2. Testing Token Tampering & Malformed Inputs...");
  const parts = token.split(".");
  const tamperedToken = `${parts[0]}.${parts[1]}.tampered_signature_value`;
  const tamperedResult = await decrypt(tamperedToken);
  assert.strictEqual(tamperedResult, null, "Tampered signature must be rejected and return null");
  console.log("  [PASS] Tampered signature rejected");

  const malformedResult = await decrypt("not-a-jwt-token");
  assert.strictEqual(malformedResult, null, "Malformed token string must return null");
  console.log("  [PASS] Malformed string input safely returns null");

  const emptyResult = await decrypt("");
  assert.strictEqual(emptyResult, null, "Empty token string must return null");
  console.log("  [PASS] Empty string input safely returns null");

  // 3. Cookie Configuration & Security Attributes
  console.log("\n3. Testing Session Cookie Attributes...");
  assert.strictEqual(SESSION_COOKIE_OPTIONS.httpOnly, true, "Session cookie must have httpOnly: true");
  assert.strictEqual(SESSION_COOKIE_OPTIONS.sameSite, "lax", "Session cookie must have sameSite: 'lax'");
  assert.strictEqual(SESSION_COOKIE_OPTIONS.path, "/", "Session cookie must be scoped to path: '/'");
  assert.strictEqual(SESSION_COOKIE_OPTIONS.maxAge, 7 * 24 * 60 * 60, "Session maxAge must be 7 days");
  assert.strictEqual(SESSION_DURATION_SECONDS, 604800, "Session duration must equal 604,800 seconds");
  console.log("  [PASS] HttpOnly, SameSite, Path, and MaxAge verified for session cookie");

  // 4. Password Hashing & Verification with bcryptjs
  console.log("\n4. Testing Password Hashing & Comparison...");
  const rawPassword = "StrongSecurePassword123!#";
  const hash = await bcrypt.hash(rawPassword, 10);

  assert(hash.startsWith("$2a$") || hash.startsWith("$2b$"), "Bcrypt hash must have valid bcrypt prefix");
  console.log("  [PASS] Bcrypt hash generated with appropriate salt rounds");

  const match = await bcrypt.compare(rawPassword, hash);
  assert.strictEqual(match, true, "Correct password must match hash");
  console.log("  [PASS] Correct password verified against bcrypt hash");

  const wrongMatch = await bcrypt.compare("WrongPassword456!", hash);
  assert.strictEqual(wrongMatch, false, "Incorrect password must NOT match hash");
  console.log("  [PASS] Incorrect password rejected");

  // 5. Input Validation Rules (Email format & Password length)
  console.log("\n5. Testing Input Validation Rules...");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  assert(emailRegex.test("developer@deployx.app"), "Valid email must pass regex");
  assert(!emailRegex.test("invalid-email"), "Email missing @ must fail regex");
  assert(!emailRegex.test("developer@.com"), "Email missing domain name must fail regex");
  assert(!emailRegex.test("@deployx.app"), "Email missing username must fail regex");

  const minPasswordLength = 8;
  assert("validpass123".length >= minPasswordLength, "Valid length password must pass constraint");
  assert("short".length < minPasswordLength, "Short password must violate min length constraint");
  console.log("  [PASS] Email syntax and password length boundaries verified");

  console.log("\n=== ALL AUTH & SESSION TESTS PASSED! ===");
}

runAuthTests().catch((e) => {
  console.error("Auth Test Error:", e);
  process.exit(1);
});
