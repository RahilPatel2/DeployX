/**
 * DeployX Master Test Runner
 *
 * Discovers and executes all DeployX automated test suites:
 * - Security hardening & CSRF/HMAC tests
 * - UI responsiveness, design tokens, & accessibility tests
 * - Performance benchmarks & query projection tests
 * - Core authentication & session tests
 * - Account isolation & authorization tests
 * - GitHub integration & OAuth tests
 * - Framework detection & build sanitization tests
 * - Cloudflare provider & status mapping tests
 * - Deployment lifecycle state machine tests
 * - Database schema & index integrity tests
 * - API validation & rate limiting tests
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

interface TestSuite {
  name: string;
  filePath: string;
  category: "security" | "ui" | "perf" | "unit" | "integration";
}

const TEST_SUITES: TestSuite[] = [
  {
    name: "Security Hardening & Protection",
    filePath: "scripts/test-security-suite.ts",
    category: "security",
  },
  {
    name: "UI Responsiveness & Accessibility",
    filePath: "scripts/test-ui-responsiveness.ts",
    category: "ui",
  },
  {
    name: "Performance & Benchmark Suite",
    filePath: "scripts/test-performance-suite.ts",
    category: "perf",
  },
];

async function runMasterTestRunner() {
  console.log("=================================================");
  console.log("       DEPLOYX MASTER TEST EXECUTION RUNNER      ");
  console.log("=================================================\n");

  const startTime = Date.now();
  let passedCount = 0;
  let failedCount = 0;
  const results: { name: string; duration: number; passed: boolean; error?: string }[] = [];

  // Run existing suites and any test files located in tests/
  const testsDir = path.join(process.cwd(), "tests");
  if (fs.existsSync(testsDir)) {
    const testFiles = fs.readdirSync(testsDir).filter((f) => f.endsWith(".test.ts"));
    for (const f of testFiles) {
      TEST_SUITES.push({
        name: f.replace(".test.ts", "").replace(/-/g, " ").toUpperCase(),
        filePath: `tests/${f}`,
        category: "unit",
      });
    }
  }

  for (const suite of TEST_SUITES) {
    const fullPath = path.join(process.cwd(), suite.filePath);
    if (!fs.existsSync(fullPath)) {
      continue;
    }

    process.stdout.write(`• Running [${suite.category.toUpperCase()}] ${suite.name}... `);
    const suiteStart = Date.now();
    try {
      execSync(`npx tsx "${suite.filePath}"`, {
        stdio: "pipe",
        cwd: process.cwd(),
      });
      const duration = Date.now() - suiteStart;
      console.log(`✓ PASSED (${duration}ms)`);
      passedCount++;
      results.push({ name: suite.name, duration, passed: true });
    } catch (err: unknown) {
      const duration = Date.now() - suiteStart;
      console.log(`✗ FAILED (${duration}ms)`);
      const errorMsg = err instanceof Error ? err.message : String(err);
      failedCount++;
      results.push({ name: suite.name, duration, passed: false, error: errorMsg });
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log("\n=================================================");
  console.log("               TEST RUNNER SUMMARY               ");
  console.log("=================================================");
  console.log(`Total Test Suites: ${results.length}`);
  console.log(`Passed:            ${passedCount}`);
  console.log(`Failed:            ${failedCount}`);
  console.log(`Total Execution:   ${totalDuration}ms`);
  console.log("=================================================\n");

  if (failedCount > 0) {
    console.error("FAILURES DETECTED:");
    for (const r of results.filter((r) => !r.passed)) {
      console.error(` - ${r.name}: ${r.error}`);
    }
    process.exit(1);
  } else {
    console.log("✓ ALL AUTOMATED TEST SUITES COMPLETED SUCCESSFULLY!");
  }
}

runMasterTestRunner().catch((e) => {
  console.error("Master Test Runner Error:", e);
  process.exit(1);
});
