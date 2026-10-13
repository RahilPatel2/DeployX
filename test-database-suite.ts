import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectToDatabase from "./lib/mongodb/client";
import { User, Project, Deployment, Notification, Domain, UserSettings, Activity } from "./models";

async function runTestSuite() {
  console.log("=== STEP 3: MONGODB & DATABASE MODELS TEST SUITE ===");

  // 1. Connection Test
  console.log("\n[TEST 1] Verifying MongoDB Connection...");
  const m = await connectToDatabase();
  const readyState = m.connection.readyState;
  if (readyState !== 1) {
    throw new Error(`Expected readyState 1, got ${readyState}`);
  }
  console.log("✓ MongoDB connection active (readyState: 1)");

  // 2. Database Name Verification
  console.log("\n[TEST 2] Verifying explicit deployx_db selection...");
  const dbName = m.connection.db?.databaseName;
  if (dbName !== "deployx_db") {
    throw new Error(`Expected database 'deployx_db', but got '${dbName}'!`);
  }
  console.log(`✓ Active database is explicitly '${dbName}'`);

  // 3. Existing Data Integrity
  console.log("\n[TEST 3] Verifying existing data remains intact...");
  const existingUsersCount = await User.countDocuments();
  console.log(`Current user count in deployx_db: ${existingUsersCount}`);
  const existingUser = await User.findOne({ email: "rahilpatel5182@gmail.com" });
  if (existingUser) {
    console.log(`✓ Existing user '${existingUser.email}' intact (ID: ${existingUser._id.toString()})`);
  } else {
    console.log("Notice: No pre-existing rahilpatel5182 user found, skipping specific user check.");
  }

  // 4. Temporary Test User Creation & Document Read/Write
  const ts = Date.now();
  const testEmailA = `test_step3_a_${ts}@deployx-test.internal`;
  const testUsernameA = `testuser_a_${ts}`;
  const testPassword = "SuperSecretPassword123!";
  const passwordHash = await bcrypt.hash(testPassword, 10);

  console.log(`\n[TEST 4] Creating temporary Test User A (${testUsernameA})...`);
  const userA = await User.create({
    name: "Test User A",
    username: testUsernameA,
    email: testEmailA,
    passwordHash,
  });
  console.log(`✓ User A created with ID: ${userA._id.toString()}`);

  // Test retrieval by ID and by Email
  const retrievedUser = await User.findById(userA._id);
  if (!retrievedUser || retrievedUser.email !== testEmailA) {
    throw new Error("Failed to retrieve user by ID!");
  }
  console.log("✓ User successfully retrieved by ID");

  // 5. Test Document Write & Read for all models
  console.log("\n[TEST 5] Writing & reading documents for Project, Deployment, Notification, Domain, UserSettings...");
  const projectA = await Project.create({
    name: "Test Project A",
    slug: `test-proj-a-${ts}`,
    userId: userA._id,
    repository: "deployx/test-repo-a",
    branch: "main",
    framework: "Next.js",
  });
  console.log(`✓ Project created with ID: ${projectA._id.toString()}`);

  const deploymentA = await Deployment.create({
    projectId: projectA._id,
    userId: userA._id,
    status: "READY",
    branch: "main",
    cloudflareDeploymentId: `cf_dep_${ts}`,
    url: "https://test-a.pages.dev",
  });
  console.log(`✓ Deployment created with ID: ${deploymentA._id.toString()}`);

  const notificationA = await Notification.create({
    userId: userA._id,
    title: "Build Succeeded",
    message: "Your project deployed cleanly.",
    type: "success",
  });
  console.log(`✓ Notification created with ID: ${notificationA._id.toString()}`);

  const domainA = await Domain.create({
    userId: userA._id,
    projectId: projectA._id,
    domain: `custom-step3-${ts}.com`,
    status: "active",
  });
  console.log(`✓ Domain created with ID: ${domainA._id.toString()}`);

  const settingsA = await UserSettings.create({
    userId: userA._id,
    theme: "dark",
    emailNotifications: true,
  });
  console.log(`✓ UserSettings created for user A`);

  // 6. Test Duplicate Email & Username Constraints
  console.log("\n[TEST 6] Testing duplicate constraints on email and username...");
  let duplicateEmailCaught = false;
  try {
    await User.create({
      name: "Duplicate Email User",
      username: `another_${ts}`,
      email: testEmailA, // duplicate!
      passwordHash,
    });
  } catch (err: any) {
    if (err.code === 11000 || err.message?.includes("duplicate")) {
      duplicateEmailCaught = true;
      console.log("✓ Duplicate email correctly rejected by MongoDB unique index");
    } else {
      throw err;
    }
  }
  if (!duplicateEmailCaught) {
    throw new Error("Duplicate email was not rejected!");
  }

  let duplicateUsernameCaught = false;
  try {
    await User.create({
      name: "Duplicate Username User",
      username: testUsernameA, // duplicate!
      email: `diff_${ts}@test.com`,
      passwordHash,
    });
  } catch (err: any) {
    if (err.code === 11000 || err.message?.includes("duplicate")) {
      duplicateUsernameCaught = true;
      console.log("✓ Duplicate username correctly rejected by MongoDB unique index");
    } else {
      throw err;
    }
  }
  if (!duplicateUsernameCaught) {
    throw new Error("Duplicate username was not rejected!");
  }

  // 7. Ownership & Account Isolation Test
  console.log("\n[TEST 7] Testing Cross-Account Ownership Isolation...");
  const testEmailB = `test_step3_b_${ts}@deployx-test.internal`;
  const testUsernameB = `testuser_b_${ts}`;
  const userB = await User.create({
    name: "Test User B",
    username: testUsernameB,
    email: testEmailB,
    passwordHash,
  });
  console.log(`✓ User B created with ID: ${userB._id.toString()}`);

  // User B tries to query User A's project with ownership filter
  const unauthorizedProject = await Project.findOne({ _id: projectA._id, userId: userB._id });
  if (unauthorizedProject !== null) {
    throw new Error("Security Violation: User B was able to access User A's project!");
  }
  console.log("✓ Cross-account Project query blocked: returned null");

  // User B tries to query User A's deployment with ownership filter
  const unauthorizedDeployment = await Deployment.findOne({ _id: deploymentA._id, userId: userB._id });
  if (unauthorizedDeployment !== null) {
    throw new Error("Security Violation: User B was able to access User A's deployment!");
  }
  console.log("✓ Cross-account Deployment query blocked: returned null");

  // User B tries to delete User A's project with ownership filter
  const unauthorizedDelete = await Project.findOneAndDelete({ _id: projectA._id, userId: userB._id });
  if (unauthorizedDelete !== null) {
    throw new Error("Security Violation: User B was able to delete User A's project!");
  }
  const stillExists = await Project.findById(projectA._id);
  if (!stillExists) {
    throw new Error("Project was deleted despite unauthorized user!");
  }
  console.log("✓ Cross-account Project delete blocked: project remains intact");

  // 8. Safe Cleanup of Test Fixtures
  console.log("\n[TEST 8] Safely cleaning up isolated test records...");
  await Project.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  await Deployment.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  await Notification.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  await Domain.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  await UserSettings.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  await Activity.deleteMany({ userId: { $in: [userA._id, userB._id] } });
  await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
  console.log("✓ All temporary test fixtures cleaned up safely.");

  // Verify final count matches initial count
  const finalUsersCount = await User.countDocuments();
  if (finalUsersCount !== existingUsersCount) {
    throw new Error(`Cleanup discrepancy! Initial: ${existingUsersCount}, Final: ${finalUsersCount}`);
  }
  console.log(`✓ Database user count verified: exact match (${finalUsersCount} users).`);

  await m.disconnect();
  console.log("\n=== ALL DATABASE TESTS PASSED WITH 100% SUCCESS ===");
}

runTestSuite().catch(err => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
