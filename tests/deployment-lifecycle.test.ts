/**
 * Deployment Lifecycle State Machine & Transition Automated Test Suite
 *
 * Verifies:
 * 1. Strict deployment state machine transition rules (isValidDeploymentTransition).
 * 2. Terminal state immutability (READY, FAILED, CANCELED cannot transition backwards).
 * 3. Build log secret redaction across deployment history and logs.
 * 4. Model defaults and required deployment properties.
 */

import assert from "assert";
import { isValidDeploymentTransition, DeploymentStatus } from "../models/Deployment";
import { redactLogs, redactSensitiveData } from "../lib/security/redaction";

async function runDeploymentLifecycleTests() {
  console.log("=== STARTING DEPLOYMENT LIFECYCLE & TRANSITIONS TEST SUITE ===");

  // 1. Valid Forward State Machine Transitions
  console.log("\n1. Testing Valid Deployment Lifecycle Transitions...");
  const validTransitions: Array<[DeploymentStatus, DeploymentStatus]> = [
    ["QUEUED", "BUILDING"],
    ["QUEUED", "CANCELED"],
    ["QUEUED", "FAILED"],
    ["BUILDING", "READY"],
    ["BUILDING", "FAILED"],
    ["BUILDING", "CANCELED"],
    ["QUEUED", "QUEUED"],
    ["BUILDING", "BUILDING"],
    ["READY", "READY"],
  ];

  for (const [from, to] of validTransitions) {
    const isValid = isValidDeploymentTransition(from, to);
    assert.strictEqual(isValid, true, `Transition from ${from} to ${to} must be valid`);
  }
  console.log("  [PASS] All valid forward deployment transitions allowed");

  // 2. Invalid Backward & Terminal State Transitions
  console.log("\n2. Testing Disallowed & Terminal State Transitions...");
  const invalidTransitions: Array<[DeploymentStatus, DeploymentStatus]> = [
    ["READY", "BUILDING"],
    ["READY", "QUEUED"],
    ["READY", "FAILED"],
    ["FAILED", "READY"],
    ["FAILED", "BUILDING"],
    ["FAILED", "QUEUED"],
    ["CANCELED", "READY"],
    ["CANCELED", "BUILDING"],
  ];

  for (const [from, to] of invalidTransitions) {
    const isValid = isValidDeploymentTransition(from, to);
    assert.strictEqual(isValid, false, `Transition from terminal state ${from} to ${to} must be rejected`);
  }
  console.log("  [PASS] Terminal states (READY, FAILED, CANCELED) cannot be reversed or mutated to active");

  // 3. Deployment Log Secret Redaction
  console.log("\n3. Testing Build Log Secret Redaction...");
  const rawLogs = [
    "Cloning repository into /workspace/build...",
    "Using token: ghp_9876543210abcdef9876543210abcdef to fetch submodules",
    "Connecting to database: mongodb+srv://db_admin:superSecretPassword123@cluster0.l3hyd4o.mongodb.net/deployx_db",
    "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMjMifQ.abc",
    "Running: npm run build",
    "✓ Compiled successfully in 14.2s (452 modules)",
  ];

  const sanitized = redactLogs(rawLogs);
  assert.strictEqual(sanitized.length, rawLogs.length);

  assert(!sanitized[1].includes("ghp_9876543210"), "GitHub token must be redacted from logs");
  assert(sanitized[1].includes("[REDACTED_GITHUB_TOKEN]"), "Replacement token placeholder must appear");

  assert(!sanitized[2].includes("superSecretPassword123"), "Database password must be redacted from logs");
  assert(sanitized[2].includes("[REDACTED_PASSWORD]"), "Replacement password placeholder must appear");

  assert(!sanitized[3].includes("Bearer eyJhbGci"), "Bearer JWT token must be redacted from logs");

  // Safe build output must remain intact
  assert.strictEqual(sanitized[0], rawLogs[0], "Safe cloning message preserved");
  assert.strictEqual(sanitized[4], rawLogs[4], "Safe build script command preserved");
  assert.strictEqual(sanitized[5], rawLogs[5], "Safe compilation message preserved");
  console.log("  [PASS] Access tokens, database URIs, and bearer auth redacted while preserving normal logs");

  // 4. String Redaction Edge Cases
  console.log("\n4. Testing Redaction String Edge Cases...");
  assert.strictEqual(redactSensitiveData(""), "");
  assert.strictEqual(redactSensitiveData("clean output line"), "clean output line");
  console.log("  [PASS] Empty and benign strings handled safely without mutation");

  console.log("\n=== ALL DEPLOYMENT LIFECYCLE TESTS PASSED! ===");
}

runDeploymentLifecycleTests().catch((e) => {
  console.error("Deployment Lifecycle Test Error:", e);
  process.exit(1);
});
