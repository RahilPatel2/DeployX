/**
 * MongoDB Schema Validation & Data Integrity Automated Test Suite
 *
 * Verifies:
 * 1. Model schema constraints, required fields, and field length limits.
 * 2. Compound MongoDB index declarations for performant queries.
 * 3. Status enum boundary enforcement on Deployments.
 * 4. Default user preferences and database configuration isolation.
 */

import assert from "assert";
import User from "../models/User";
import Project from "../models/Project";
import Deployment from "../models/Deployment";
import Activity from "../models/Activity";

async function runDatabaseTests() {
  console.log("=== STARTING MONGODB SCHEMA & DATA INTEGRITY TEST SUITE ===");

  // 1. User Model Schema Constraints
  console.log("\n1. Testing User Model Schema Constraints...");
  const userPaths = User.schema.paths;

  assert(userPaths.name.isRequired, "User name must be required");
  assert(userPaths.email.isRequired, "User email must be required");
  assert(userPaths.username.isRequired, "User username must be required");
  assert(userPaths.passwordHash.isRequired, "User passwordHash must be required");

  // Length constraints
  assert.strictEqual(userPaths.name.options.maxlength, 64, "User name maxlength must be 64");
  assert.strictEqual(userPaths.username.options.maxlength, 32, "User username maxlength must be 32");
  assert.strictEqual(userPaths.email.options.maxlength, 128, "User email maxlength must be 128");

  // Default preferences
  assert.strictEqual(userPaths["preferences.theme"].options.default, "dark");
  assert.strictEqual(userPaths["preferences.defaultView"].options.default, "grid");
  console.log("  [PASS] User required fields, field lengths, and preference defaults verified");

  // 2. Project Model Schema & Indexes
  console.log("\n2. Testing Project Model Schema & Compound Indexes...");
  const projPaths = Project.schema.paths;

  assert(projPaths.name.isRequired, "Project name must be required");
  assert(projPaths.slug.isRequired, "Project slug must be required");
  assert(projPaths.userId.isRequired, "Project userId must be required");
  assert(projPaths.repository.isRequired, "Project repository must be required");

  // Compound Indexes
  const projIndexes = Project.schema.indexes() as Array<[Record<string, number>, unknown]>;
  const hasUserCreatedIdx = projIndexes.some(
    ([idx]) => idx.userId === 1 && idx.createdAt === -1
  );
  const hasUserFrameworkIdx = projIndexes.some(
    ([idx]) => idx.userId === 1 && idx.framework === 1 && idx.createdAt === -1
  );

  assert(hasUserCreatedIdx, "Project must have compound index on { userId: 1, createdAt: -1 }");
  assert(hasUserFrameworkIdx, "Project must have compound index on { userId: 1, framework: 1, createdAt: -1 }");
  console.log("  [PASS] Project required fields and compound query indexes verified");

  // 3. Deployment Model Schema, Enums & Compound Indexes
  console.log("\n3. Testing Deployment Model Schema & State Enums...");
  const depPaths = Deployment.schema.paths;

  assert(depPaths.projectId.isRequired, "Deployment projectId must be required");
  assert(depPaths.userId.isRequired, "Deployment userId must be required");
  assert.strictEqual(depPaths.status.options.default, "QUEUED", "Default deployment status must be 'QUEUED'");

  // Enum values
  const allowedStatuses = depPaths.status.options.enum;
  assert(Array.isArray(allowedStatuses), "Deployment status must have enum constraints");
  for (const s of ["QUEUED", "BUILDING", "READY", "FAILED", "CANCELED"]) {
    assert(allowedStatuses.includes(s), `Status enum must include ${s}`);
  }

  // Compound Indexes
  const depIndexes = Deployment.schema.indexes() as Array<[Record<string, number>, unknown]>;
  const hasDepUserCreatedIdx = depIndexes.some(
    ([idx]) => idx.userId === 1 && idx.createdAt === -1
  );
  const hasDepUserStatusIdx = depIndexes.some(
    ([idx]) => idx.userId === 1 && idx.status === 1
  );
  const hasDepProjStatusIdx = depIndexes.some(
    ([idx]) => idx.projectId === 1 && idx.status === 1 && idx.createdAt === -1
  );

  assert(hasDepUserCreatedIdx, "Deployment must have index on { userId: 1, createdAt: -1 }");
  assert(hasDepUserStatusIdx, "Deployment must have compound index on { userId: 1, status: 1 }");
  assert(hasDepProjStatusIdx, "Deployment must have compound index on { projectId: 1, status: 1, createdAt: -1 }");
  console.log("  [PASS] Deployment enum boundaries and compound indexes verified");

  // 4. Activity Model Schema
  console.log("\n4. Testing Activity Model Schema...");
  const actPaths = Activity.schema.paths;

  assert(actPaths.userId.isRequired, "Activity userId must be required");
  assert(actPaths.type.isRequired, "Activity type must be required");
  assert(actPaths.title.isRequired, "Activity title must be required");
  assert(actPaths.description.isRequired, "Activity description must be required");
  console.log("  [PASS] Activity audit trail required fields verified");

  // 5. Database Name Isolation
  console.log("\n5. Testing Database Name Configuration...");
  const targetDbName = process.env.MONGODB_DB || "deployx_db";
  assert.strictEqual(targetDbName, "deployx_db", "Project must target deployx_db database");
  console.log("  [PASS] Database configuration targets intended deployx_db database");

  console.log("\n=== ALL MONGODB SCHEMA & DATA INTEGRITY TESTS PASSED! ===");
}

runDatabaseTests().catch((e) => {
  console.error("Database Test Error:", e);
  process.exit(1);
});
