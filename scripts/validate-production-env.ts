/**
 * Standalone Production Environment Validation Gate
 * 
 * Verifies all required environment variables and format rules before deployment.
 * Exits with status 0 if configuration is valid, or status 1 with structured non-sensitive error reports.
 */

import fs from "fs";
import { validateProductionEnv } from "../lib/env";

// Load .env.local if present in local development
if (typeof process.loadEnvFile === "function" && fs.existsSync(".env.local")) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Ignore parse errors if .env.local is malformed or inaccessible
  }
}

function runValidation() {
  console.log("=================================================");
  console.log("     DEPLOYX PRODUCTION ENVIRONMENT AUDITOR      ");
  console.log("=================================================\n");

  const result = validateProductionEnv(process.env);

  if (result.warnings.length > 0) {
    console.log("⚠️ WARNINGS:");
    result.warnings.forEach((w) => console.log(`   - ${w}`));
    console.log();
  }

  if (result.errors.length > 0) {
    console.error("🚨 CRITICAL ENVIRONMENT ERRORS (DEPLOYMENT BLOCKED):");
    result.errors.forEach((err) => console.error(`   ✗ ${err}`));
    console.error("\nPlease configure the above keys securely in your hosting dashboard.");
    console.error("See docs/environment-variables.md for specifications.\n");
    process.exit(1);
  }

  console.log("✓ SUCCESS: Environment variables satisfy all production security criteria!\n");
  process.exit(0);
}

runValidation();
