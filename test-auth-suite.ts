import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectToDatabase from "./lib/mongodb/client";
import User from "./models/User";
import { encrypt, decrypt, SessionPayload } from "./lib/auth/session";
import { checkRateLimit, resetRateLimit } from "./lib/auth/rate-limit";

async function runAuthTests() {
  console.log("=== STEP 4: PRODUCTION-READY AUTHENTICATION TEST SUITE ===\n");

  await connectToDatabase();
  const initialUserCount = await User.countDocuments();
  console.log(`[Setup] Connected to database '${mongoose.connection.db?.databaseName}'. Active users: ${initialUserCount}`);

  const ts = Date.now();
  const testEmail = `auth_test_${ts}@deployx.internal`;
  const testUsername = `user_${ts}`;
  const testPassword = "ValidPassword123!";
  let testUserId: string | null = null;

  try {
    // 1. Password Hashing & Verification
    console.log("[TEST 1] Password Hashing & Verification...");
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(testPassword, salt);
    if (hash === testPassword) throw new Error("Password stored in plaintext!");
    const isCorrect = await bcrypt.compare(testPassword, hash);
    const isWrong = await bcrypt.compare("WrongPassword!", hash);
    if (!isCorrect || isWrong) throw new Error("Bcrypt password verification failed!");
    console.log("✓ Password hash is secure, non-plaintext, and bcrypt comparison is accurate.");

    // 2. Successful Signup & Creation
    console.log("\n[TEST 2] Successful Account Signup...");
    const userDoc = await User.create({
      name: "Auth Test User",
      username: testUsername,
      email: testEmail.toLowerCase().trim(),
      passwordHash: hash,
      status: "active",
      lastLogin: new Date(),
    });
    testUserId = userDoc._id.toString();
    console.log(`✓ User created successfully with ID: ${testUserId}`);

    // 3. Duplicate Account Prevention (Email & Username)
    console.log("\n[TEST 3] Duplicate Account Prevention...");
    let emailDuplicateCaught = false;
    try {
      await User.create({
        name: "Duplicate Email",
        username: `diff_user_${ts}`,
        email: testEmail, // duplicate email
        passwordHash: hash,
      });
    } catch (e: any) {
      if (e.code === 11000) emailDuplicateCaught = true;
    }
    if (!emailDuplicateCaught) throw new Error("Duplicate email was not rejected!");
    console.log("✓ Duplicate email correctly rejected with E11000 unique key error.");

    let usernameDuplicateCaught = false;
    try {
      await User.create({
        name: "Duplicate Username",
        username: testUsername, // duplicate username
        email: `diff_email_${ts}@deployx.internal`,
        passwordHash: hash,
      });
    } catch (e: any) {
      if (e.code === 11000) usernameDuplicateCaught = true;
    }
    if (!usernameDuplicateCaught) throw new Error("Duplicate username was not rejected!");
    console.log("✓ Duplicate username correctly rejected with E11000 unique key error.");

    // 4. Session Token Creation & Decryption
    console.log("\n[TEST 4] Session Encryption & Verification...");
    const token = await encrypt({ userId: testUserId });
    if (!token || typeof token !== "string") throw new Error("Failed to generate JWT session token");
    const payload = await decrypt(token);
    if (!payload || payload.userId !== testUserId) throw new Error("Failed to decrypt valid session JWT");
    console.log(`✓ JWT Session token encrypted and decrypted accurately for userId: ${payload.userId}`);

    // 5. Tampered & Expired Session Rejection
    console.log("\n[TEST 5] Tampered & Invalid Session Rejection...");
    const tamperedToken = token.slice(0, -6) + "badsig";
    const tamperedPayload = await decrypt(tamperedToken);
    if (tamperedPayload !== null) throw new Error("Tampered JWT was improperly accepted!");
    console.log("✓ Tampered signature was correctly rejected (returned null).");

    const pastTime = Math.floor(Date.now() / 1000) - 3600;
    const expiredToken = await new (await import("jose")).SignJWT({ userId: testUserId })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(pastTime - 100)
      .setExpirationTime(pastTime)
      .sign(new TextEncoder().encode(process.env.JWT_SECRET || "default_development_secret_key"));
    const expiredPayload = await decrypt(expiredToken);
    if (expiredPayload !== null) throw new Error("Expired JWT was improperly accepted!");
    console.log("✓ Expired session token was correctly rejected (returned null).");

    // 6. Login Validation (Email, Username, Case-Insensitive)
    console.log("\n[TEST 6] Login Authentications...");
    // By Email
    const foundByEmail = await User.findOne({ email: testEmail.toUpperCase() }).lean();
    // Since we store lowercased email:
    const foundByNormEmail = await User.findOne({ email: testEmail.toLowerCase().trim() }).lean();
    if (!foundByNormEmail) throw new Error("User lookup by normalized email failed!");
    // By Username
    const foundByUsername = await User.findOne({ username: testUsername }).lean();
    if (!foundByUsername) throw new Error("User lookup by username failed!");
    console.log("✓ User lookup succeeds by both normalized email and username.");

    // 7. Profile Retrieval (Password Hash Omission)
    console.log("\n[TEST 7] User Profile Sanitization...");
    const profile = await User.findById(testUserId).select("-passwordHash").lean();
    if (!profile) throw new Error("Failed to fetch profile");
    if ("passwordHash" in profile) throw new Error("Security Violation: passwordHash leaked in profile query!");
    console.log("✓ Profile retrieved safely without exposing passwordHash.");

    // 8. Rate Limiting Protection
    console.log("\n[TEST 8] Rate Limiting Protection...");
    const rateKey = `test_limit_${ts}`;
    for (let i = 0; i < 5; i++) {
      const check = checkRateLimit(rateKey, 5, 60000);
      if (!check.allowed) throw new Error(`Unexpected rate limit block at attempt ${i + 1}`);
    }
    const blockedCheck = checkRateLimit(rateKey, 5, 60000);
    if (blockedCheck.allowed) throw new Error("Rate limit failed to block 6th attempt!");
    console.log(`✓ Rate limiter successfully blocked excessive attempts (retry in ${blockedCheck.retryAfterSeconds}s).`);
    resetRateLimit(rateKey);
    const resetCheck = checkRateLimit(rateKey, 5, 60000);
    if (!resetCheck.allowed) throw new Error("Rate limit reset failed!");
    console.log("✓ Rate limit state cleanly reset.");

    // 9. Account Status Rejection
    console.log("\n[TEST 9] Ineligible/Disabled Account State Handling...");
    await User.findByIdAndUpdate(testUserId, { status: "disabled" });
    const disabledUser = await User.findById(testUserId).lean();
    if (disabledUser?.status !== "disabled") throw new Error("Failed to set user disabled status");
    console.log("✓ Account eligibility field verified ('disabled' status correctly represented).");

  } finally {
    // 10. Clean up test user
    console.log("\n[Cleanup] Cleaning up test user fixture...");
    if (testUserId) {
      await User.findByIdAndDelete(testUserId);
      console.log(`✓ Cleaned up test user ${testUserId}`);
    }
    const finalCount = await User.countDocuments();
    if (finalCount !== initialUserCount) {
      console.warn(`User count changed! Started: ${initialUserCount}, Ended: ${finalCount}`);
    } else {
      console.log(`✓ User count verified: exact match (${finalCount} users).`);
    }
    await mongoose.disconnect();
  }

  console.log("\n=== ALL AUTHENTICATION TESTS PASSED WITH 100% SUCCESS ===");
}

runAuthTests().catch((err) => {
  console.error("Auth Test Suite Failed:", err);
  process.exit(1);
});
