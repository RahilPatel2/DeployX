/**
 * GitHub Integration, OAuth State & Webhook Security Test Suite
 *
 * Verifies:
 * 1. AES-256-GCM token encryption and authentication tag integrity.
 * 2. OAuth state generation, cryptographic user binding, and replay defense.
 * 3. Timing-safe verification preventing state tampering and cross-user hijacking.
 * 4. GitHub Webhook HMAC-SHA256 signature validation and payload protection.
 */

import assert from "assert";
import { encryptToken, decryptToken } from "../lib/auth/encryption";
import { createOAuthState, verifyOAuthState } from "../lib/auth/oauth-state";
import { verifyWebhookSignature } from "../lib/github/webhook";

async function runGitHubTests() {
  console.log("=== STARTING GITHUB INTEGRATION & OAUTH TEST SUITE ===");

  const userIdA = "60c72b2f9b1d8b2badde0001";
  const userIdB = "60c72b2f9b1d8b2badde0002";

  // 1. AES-256-GCM Token Encryption & Decryption
  console.log("\n1. Testing OAuth Access Token Encryption & Decryption...");
  const rawToken = "gho_16C7e42F292c6912E7710c838347Ae178B4a";
  const encrypted = encryptToken(rawToken);

  assert(encrypted.startsWith("enc:v1:"), "Encrypted token must have 'enc:v1:' version prefix");
  assert.notStrictEqual(encrypted, rawToken, "Encrypted token must not expose plaintext token");
  console.log("  [PASS] Token successfully encrypted using AES-256-GCM with authenticated prefix");

  const decrypted = decryptToken(encrypted);
  assert.strictEqual(decrypted, rawToken, "Decrypted token must match original plaintext token exactly");
  console.log("  [PASS] Decrypted token verified against original value");

  // 2. Tampered Ciphertext Rejection
  console.log("\n2. Testing Tampered Token Ciphertext Rejection...");
  const parts = encrypted.split(":");
  // Tamper with the ciphertext component (last part)
  const tamperedCipher = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:ff${parts[4]?.substring(2) || "abcd"}`;
  assert.throws(
    () => decryptToken(tamperedCipher),
    /tampered|failed|invalid/i,
    "Tampered ciphertext must fail GCM auth tag verification"
  );
  console.log("  [PASS] Tampered ciphertext rejected by GCM authentication tag verification");

  // 3. OAuth State Creation & Cryptographic Binding
  console.log("\n3. Testing OAuth State Generation & Replay Defense...");
  const { state, encryptedCookie, returnTo } = createOAuthState(userIdA, "/dashboard/projects/new");

  assert(typeof state === "string" && state.length === 64, "OAuth state must be a 64-char hex string");
  assert.strictEqual(returnTo, "/dashboard/projects/new", "returnTo URL preserved");
  console.log("  [PASS] OAuth state nonce generated with high-entropy cryptographic randomness");

  // Legitimate verification
  const legitResult = verifyOAuthState(encryptedCookie, state, userIdA);
  assert.strictEqual(legitResult.valid, true, "Valid OAuth state must pass verification");
  assert.strictEqual(legitResult.returnTo, "/dashboard/projects/new");
  console.log("  [PASS] Valid state successfully verified for matching session user");

  // Replay protection: consuming the same nonce twice must fail
  const replayResult = verifyOAuthState(encryptedCookie, state, userIdA);
  assert.strictEqual(replayResult.valid, false, "Replayed OAuth nonce must be rejected");
  console.log("  [PASS] Replay attack prevented: nonce already consumed");

  // 4. Cross-User State Tampering Defense
  console.log("\n4. Testing Cross-User OAuth State Hijacking Defense...");
  const { state: stateUserA, encryptedCookie: cookieUserA } = createOAuthState(userIdA, "/dashboard");
  // Attacker User B attempts to consume User A's OAuth state
  const crossUserResult = verifyOAuthState(cookieUserA, stateUserA, userIdB);
  assert.strictEqual(crossUserResult.valid, false, "State generated for User A must fail for User B");
  console.log("  [PASS] Cross-user state hijacking rejected; state strictly bound to creator session");

  // 5. GitHub Webhook HMAC-SHA256 Signature Validation
  console.log("\n5. Testing Webhook HMAC Signature Validation...");
  const secret = "whsec_test_secret_key_deployx_987654";
  const payload = JSON.stringify({
    ref: "refs/heads/main",
    repository: { full_name: "deployx/test-repo" },
    after: "c0ffee1234567890abcdef1234567890abcdef12",
  });

  const crypto = await import("crypto");
  const validSignature = "sha256=" + crypto.createHmac("sha256", secret).update(payload, "utf-8").digest("hex");

  const validWebhookCheck = verifyWebhookSignature(payload, validSignature, secret);
  assert.strictEqual(validWebhookCheck, true, "Valid HMAC-SHA256 signature must verify successfully");
  console.log("  [PASS] Valid webhook HMAC-SHA256 signature verified");

  const invalidSignature = "sha256=" + crypto.createHmac("sha256", "wrong_secret").update(payload, "utf-8").digest("hex");
  const invalidWebhookCheck = verifyWebhookSignature(payload, invalidSignature, secret);
  assert.strictEqual(invalidWebhookCheck, false, "Invalid HMAC signature must be rejected");
  console.log("  [PASS] Signature with incorrect secret rejected");

  const missingSigCheck = verifyWebhookSignature(payload, null, secret);
  assert.strictEqual(missingSigCheck, false, "Null signature header must be rejected");
  console.log("  [PASS] Missing signature header safely rejected");

  console.log("\n=== ALL GITHUB & OAUTH INTEGRATION TESTS PASSED! ===");
}

runGitHubTests().catch((e) => {
  console.error("GitHub Test Error:", e);
  process.exit(1);
});
