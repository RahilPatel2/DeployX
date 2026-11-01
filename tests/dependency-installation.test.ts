/**
 * Regression Test Suite: Dependency Installation, Manifest Validation & Lockfile Safety
 *
 * Verifies:
 * 1. Detection of malformed JSON manifests.
 * 2. Missing package files and directory traversal prevention.
 * 3. Validation of non-string dependency version specifications.
 * 4. Detection of corrupted lockfiles (the 'must provide string spec' bug) and safe strategy selection.
 * 5. Clean lockfile detection promoting 'npm ci'.
 * 6. Nested monorepo / application directory discovery.
 * 7. Token and credential redaction from execution error logs.
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import os from "os";
import {
  validatePackageManifest,
  inspectLockfile,
  determineInstallStrategy,
  resolveProjectWorkingDir,
  extractNpmDiagnosticSummary,
} from "../lib/build/dependency-resolver";

async function runDependencyInstallationTests() {
  console.log("=== STARTING DEPENDENCY INSTALLATION & MANIFEST REGRESSION SUITE ===\n");

  const tempBase = path.join(os.tmpdir(), `deployx-dep-test-${Date.now()}`);
  await fs.promises.mkdir(tempBase, { recursive: true });

  try {
    // -------------------------------------------------------------
    // Scenario 1: Malformed JSON in package.json
    // -------------------------------------------------------------
    console.log("1. Testing Malformed JSON in package.json...");
    const malformedDir = path.join(tempBase, "malformed-json");
    await fs.promises.mkdir(malformedDir, { recursive: true });
    const malformedPkgPath = path.join(malformedDir, "package.json");
    await fs.promises.writeFile(malformedPkgPath, '{ "name": "broken", "dependencies": {'); // truncated JSON

    const malformedResult = validatePackageManifest(malformedPkgPath);
    assert.strictEqual(malformedResult.valid, false);
    assert(malformedResult.error?.includes("Invalid JSON"));
    console.log("  [PASS] Malformed JSON syntax safely caught with descriptive error");

    // -------------------------------------------------------------
    // Scenario 2: Non-string dependency specification in package.json
    // -------------------------------------------------------------
    console.log("\n2. Testing Non-string Dependency Specification...");
    const badSpecDir = path.join(tempBase, "bad-spec");
    await fs.promises.mkdir(badSpecDir, { recursive: true });
    const badSpecPkgPath = path.join(badSpecDir, "package.json");
    await fs.promises.writeFile(
      badSpecPkgPath,
      JSON.stringify({
        name: "test-app",
        dependencies: {
          react: 18, // number instead of string
        },
      })
    );

    const badSpecResult = validatePackageManifest(badSpecPkgPath);
    assert.strictEqual(badSpecResult.valid, false);
    assert(badSpecResult.error?.includes("Invalid version specification for dependency 'react'"));
    console.log("  [PASS] Non-string dependency spec rejected before spawning process");

    // -------------------------------------------------------------
    // Scenario 3: Missing package.json handling
    // -------------------------------------------------------------
    console.log("\n3. Testing Missing package.json Handling...");
    const emptyDir = path.join(tempBase, "empty-dir");
    await fs.promises.mkdir(emptyDir, { recursive: true });
    const missingRes = validatePackageManifest(path.join(emptyDir, "package.json"));
    assert.strictEqual(missingRes.valid, false);
    assert(missingRes.error?.includes("not found"));
    console.log("  [PASS] Missing package.json returns structured error");

    // -------------------------------------------------------------
    // Scenario 4: Corrupted package-lock.json with nested objects ('must provide string spec')
    // -------------------------------------------------------------
    console.log("\n4. Testing Corrupted Lockfile Detection ('must provide string spec')...");
    const corruptLockDir = path.join(tempBase, "corrupt-lock");
    await fs.promises.mkdir(corruptLockDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(corruptLockDir, "package.json"),
      JSON.stringify({
        name: "weatherlyy",
        dependencies: { react: "^18.3.1", vite: "^6.3.1" },
      })
    );

    // Corrupted lockfile structure mirroring the actual Weatherlyy bug
    const corruptLockData = {
      name: "weatherlyy",
      lockfileVersion: 3,
      packages: {
        "": {
          dependencies: { react: "^18.3.1", vite: "^6.3.1" },
        },
        "node_modules/vite": {
          version: "6.3.1",
          dependencies: {
            rollup: "^4.34.9",
            bin: { vite: "bin/vite.js" }, // Corrupt object spec!
            dependencies: { esbuild: "^0.25.0" }, // Nested object!
          },
        },
      },
    };
    await fs.promises.writeFile(
      path.join(corruptLockDir, "package-lock.json"),
      JSON.stringify(corruptLockData)
    );

    const lockInspection = inspectLockfile(corruptLockDir);
    assert.strictEqual(lockInspection.exists, true);
    assert.strictEqual(lockInspection.valid, false);
    assert.strictEqual(lockInspection.isCorrupted, true);
    assert(lockInspection.reason?.includes("must provide string spec") || lockInspection.reason?.includes("non-string spec"));
    console.log("  [PASS] Corrupted lockfile detected with exact root cause reason");

    const strategy = determineInstallStrategy({
      workingDir: corruptLockDir,
      lockfileResult: lockInspection,
    });
    assert.strictEqual(strategy.command, "npm install --include=dev --no-package-lock --no-audit --no-fund");
    assert(strategy.warning !== undefined);
    console.log("  [PASS] Safe installation strategy 'npm install --include=dev --no-package-lock --no-audit --no-fund' selected to bypass corrupted lockfile");

    // -------------------------------------------------------------
    // Scenario 5: Clean, valid package-lock.json promotes 'npm ci'
    // -------------------------------------------------------------
    console.log("\n5. Testing Clean Lockfile Promotes 'npm ci'...");
    const cleanLockDir = path.join(tempBase, "clean-lock");
    await fs.promises.mkdir(cleanLockDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(cleanLockDir, "package.json"),
      JSON.stringify({ name: "clean-app", dependencies: { react: "^18.3.1" } })
    );
    await fs.promises.writeFile(
      path.join(cleanLockDir, "package-lock.json"),
      JSON.stringify({
        name: "clean-app",
        lockfileVersion: 3,
        packages: {
          "": { dependencies: { react: "^18.3.1" } },
          "node_modules/react": { version: "18.3.1" },
        },
      })
    );

    const cleanInspection = inspectLockfile(cleanLockDir);
    assert.strictEqual(cleanInspection.valid, true);
    assert.strictEqual(cleanInspection.isCorrupted, false);

    const cleanStrategy = determineInstallStrategy({
      workingDir: cleanLockDir,
      lockfileResult: cleanInspection,
    });
    assert.strictEqual(cleanStrategy.command, "npm ci --include=dev --no-audit --no-fund");
    console.log("  [PASS] Clean package-lock.json properly promotes 'npm ci --include=dev' for fast, reproducible builds");

    // -------------------------------------------------------------
    // Scenario 6: Nested Application / Monorepo Discovery
    // -------------------------------------------------------------
    console.log("\n6. Testing Nested Monorepo / Application Discovery...");
    const monoDir = path.join(tempBase, "monorepo-app");
    const nestedClientDir = path.join(monoDir, "client");
    await fs.promises.mkdir(nestedClientDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(nestedClientDir, "package.json"),
      JSON.stringify({ name: "client-frontend", dependencies: { react: "^18.3.1" } })
    );

    const workingDirRes = await resolveProjectWorkingDir(monoDir);
    assert.strictEqual(workingDirRes.hasPackageJson, true);
    assert.strictEqual(workingDirRes.detectedNested, true);
    assert.strictEqual(path.resolve(workingDirRes.workingDir), path.resolve(nestedClientDir));
    console.log("  [PASS] Nested application package.json automatically discovered in 'client/'");

    // -------------------------------------------------------------
    // Scenario 7: Path Traversal Prevention on Working Directory
    // -------------------------------------------------------------
    console.log("\n7. Testing Path Traversal Security...");
    let caughtSecurityError = false;
    try {
      await resolveProjectWorkingDir(tempBase, "../../etc/passwd");
    } catch {
      caughtSecurityError = true;
    }
    assert.strictEqual(caughtSecurityError, true, "Must prevent directory escape");
    console.log("  [PASS] Working directory traversal securely rejected");

    // -------------------------------------------------------------
    // Scenario 8: Redaction of Secrets in npm Diagnostic Logs
    // -------------------------------------------------------------
    console.log("\n8. Testing Credential Redaction in Diagnostic Summaries...");
    const sampleStderr = `npm error 404 Not Found - GET https://user:ghp_SuperSecretToken1234567890@npm.pkg.github.com/my-pkg\nnpm error must provide string spec`;
    const summary = extractNpmDiagnosticSummary(sampleStderr, "", []);
    assert(!summary.includes("ghp_SuperSecretToken1234567890"), "Must not leak GitHub tokens in error summary");
    assert(summary.includes("must provide string spec"), "Must retain actionable error text");
    console.log("  [PASS] Secrets redacted while preserving actionable diagnostic lines");

    // -------------------------------------------------------------
    // Scenario 9: Guarantee build-time devDependencies via --include=dev
    // -------------------------------------------------------------
    console.log("\n9. Testing Inclusion of Build-time devDependencies...");
    assert(cleanStrategy.command.includes("--include=dev"), "npm ci must include --include=dev");
    assert(strategy.command.includes("--include=dev"), "npm install must include --include=dev");
    console.log("  [PASS] Installation strategies explicitly enforce --include=dev for compilers and PostCSS plugins");

    // -------------------------------------------------------------
    // Scenario 10: Pre-build PostCSS & Tailwind v4 Dependency Validation
    // -------------------------------------------------------------
    console.log("\n10. Testing Pre-build PostCSS & Tailwind v4 Validation...");
    const { validatePostCssDependencies } = await import("../lib/build/dependency-resolver");

    const postCssTestDir = path.join(tempBase, "postcss-test");
    await fs.promises.mkdir(postCssTestDir, { recursive: true });
    await fs.promises.writeFile(
      path.join(postCssTestDir, "postcss.config.mjs"),
      "export default { plugins: { '@tailwindcss/postcss': {} } };"
    );

    // Initial check: @tailwindcss/postcss not installed in node_modules yet
    const missingPostCssCheck = validatePostCssDependencies(postCssTestDir);
    assert.strictEqual(missingPostCssCheck.hasPostCssConfig, true);
    assert.strictEqual(missingPostCssCheck.isMissing, true);
    assert(missingPostCssCheck.error?.includes("@tailwindcss/postcss"));
    console.log("  [PASS] Pre-build validation successfully flags missing @tailwindcss/postcss plugin");

    // Simulate installed plugin
    const fakePluginDir = path.join(postCssTestDir, "node_modules", "@tailwindcss", "postcss");
    await fs.promises.mkdir(fakePluginDir, { recursive: true });
    await fs.promises.writeFile(path.join(fakePluginDir, "index.js"), "module.exports = () => ({});");

    const validPostCssCheck = validatePostCssDependencies(postCssTestDir);
    assert.strictEqual(validPostCssCheck.hasPostCssConfig, true);
    assert.strictEqual(validPostCssCheck.isMissing, false);
    console.log("  [PASS] Pre-build validation passes once @tailwindcss/postcss is installed");

    console.log("\n=== ALL DEPENDENCY INSTALLATION REGRESSION TESTS PASSED! ===");
  } finally {
    // Cleanup temporary test directory
    try {
      await fs.promises.rm(tempBase, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

runDependencyInstallationTests().catch((err) => {
  console.error("Dependency Test Suite Failed:", err);
  process.exit(1);
});
