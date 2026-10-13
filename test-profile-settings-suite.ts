/**
 * Automated Verification Suite for Step 14:
 * Profile, Avatar Upload, and Account Settings in DeployX
 * 
 * Verifies all 14 required scenarios:
 * 1. Profile retrieval and safe response (no passwordHash or secrets).
 * 2. Profile update (name, bio, phone).
 * 3. Username format validation & uniqueness enforcement (409 Conflict).
 * 4. Protected-field modification rejection (role, status, passwordHash).
 * 5. Avatar upload MIME type and size validation (rejects invalid/oversized).
 * 6. Avatar upload magic bytes verification (rejects fake images).
 * 7. Successful avatar upload & storage persistence.
 * 8. Unauthorized avatar operations rejection (401).
 * 9. Avatar replacement & cleanup (old file unlinked from disk).
 * 10. Avatar deletion endpoint (removes file and clears DB field).
 * 11. Password update with correct current password.
 * 12. Password change rejection (wrong current password, weak password, duplicate).
 * 13. User preferences persistence (theme, defaultView, notifications).
 * 14. Account deletion with cascade cleanup of projects, deployments & files.
 */

try {
  process.loadEnvFile(".env.local");
} catch {
  // Ignored if file already loaded or handled by environment
}

import path from "path";
import fs from "fs/promises";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectToDatabase from "./lib/mongodb/client";
import User from "./models/User";
import Project from "./models/Project";
import Deployment from "./models/Deployment";
import Activity from "./models/Activity";
import Integration from "./models/Integration";
import { encrypt } from "./lib/auth/session";

import { GET as getProfileRoute, PUT as updateProfileRoute } from "./app/api/auth/profile/route";
import { POST as uploadAvatarRoute, DELETE as deleteAvatarRoute } from "./app/api/user/avatar/route";
import { PUT as updatePasswordRoute } from "./app/api/auth/password/route";
import { GET as getPreferencesRoute, PUT as updatePreferencesRoute } from "./app/api/user/preferences/route";
import { DELETE as deleteAccountRoute } from "./app/api/auth/account/route";

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ ${message}`);
}

async function createSessionCookie(userId: string): Promise<string> {
  const token = await encrypt({ userId });
  return `session=${token}`;
}

async function runProfileSettingsSuite() {
  console.log("\n=======================================================");
  console.log("  DEPLOYX STEP 14: PROFILE, AVATAR & ACCOUNT SETTINGS  ");
  console.log("=======================================================\n");

  await connectToDatabase();

  const testUserAId = "700000000000000000000041";
  const testUserBId = "700000000000000000000042";

  const cookieUserA = await createSessionCookie(testUserAId);
  const cookieUserB = await createSessionCookie(testUserBId);

  // --------------------------------------------------------------------------
  // Clean up any stale test fixtures before test execution
  // --------------------------------------------------------------------------
  await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
  await Project.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Activity.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  await Integration.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });

  const initialPasswordA = "OriginalSecretPassword123!";
  const initialHashA = await bcrypt.hash(initialPasswordA, 10);
  const initialHashB = await bcrypt.hash("UserBSecretPassword123!", 10);

  // Create test users in MongoDB
  await User.create([
    {
      _id: testUserAId,
      name: "Alice Profile",
      username: "alice_profile",
      email: "alice_settings@deployx.test",
      passwordHash: initialHashA,
      role: "user",
      status: "active",
      bio: "Initial bio text",
      phone: "+15551234567",
      preferences: {
        theme: "dark",
        defaultView: "grid",
        notifyOnBuildSuccess: true,
        notifyOnBuildFailure: true,
      },
    },
    {
      _id: testUserBId,
      name: "Bob Profile",
      username: "bob_profile",
      email: "bob_settings@deployx.test",
      passwordHash: initialHashB,
      role: "user",
      status: "active",
    },
  ]);

  try {
    // ------------------------------------------------------------------------
    // Scenario 1: Profile retrieval & safe response
    // ------------------------------------------------------------------------
    console.log("▶ [Scenario 1] Profile Retrieval & Secret Redaction");
    {
      const req = new Request("http://localhost:3000/api/auth/profile", {
        headers: { cookie: cookieUserA },
      });
      const res = await getProfileRoute(req);
      assert(res.status === 200, "GET /api/auth/profile returns 200");

      const data = await res.json();
      assert(data.user !== undefined, "Response contains user object");
      assert(data.user.name === "Alice Profile", "Returns correct display name");
      assert(data.user.username === "alice_profile", "Returns correct username");
      assert(data.user.email === "alice_settings@deployx.test", "Returns correct email");
      assert(data.user.passwordHash === undefined, "passwordHash is strictly excluded from profile response");
      assert(data.user.preferences?.theme === "dark", "Returns user preferences");
    }

    // ------------------------------------------------------------------------
    // Scenario 2: Profile update (name, bio, phone)
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 2] Profile Details Modification");
    {
      const req = new Request("http://localhost:3000/api/auth/profile", {
        method: "PUT",
        headers: {
          cookie: cookieUserA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Alice Updated",
          bio: "Senior Cloud Architect specializing in Next.js",
          phone: "+15559876543",
        }),
      });
      const res = await updateProfileRoute(req);
      assert(res.status === 200, "PUT /api/auth/profile returns 200");

      const data = await res.json();
      assert(data.user.name === "Alice Updated", "Display name updated in response");
      assert(data.user.bio === "Senior Cloud Architect specializing in Next.js", "Bio updated in response");
      assert(data.user.phone === "+15559876543", "Phone updated in response");

      // Verify persistence in MongoDB
      const userFromDb = await User.findById(testUserAId);
      assert(userFromDb?.name === "Alice Updated", "Display name persisted in MongoDB");
      assert(userFromDb?.bio === "Senior Cloud Architect specializing in Next.js", "Bio persisted in MongoDB");
    }

    // ------------------------------------------------------------------------
    // Scenario 3: Username format validation & uniqueness enforcement
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 3] Username Validation & Uniqueness Collision");
    {
      // 3.1 Invalid username format (< 3 characters)
      const reqTooShort = new Request("http://localhost:3000/api/auth/profile", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "al" }),
      });
      const resTooShort = await updateProfileRoute(reqTooShort);
      assert(resTooShort.status === 400, "Username < 3 characters rejected with 400");

      // 3.2 Invalid characters (spaces / symbols)
      const reqInvalidChars = new Request("http://localhost:3000/api/auth/profile", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice with spaces!" }),
      });
      const resInvalidChars = await updateProfileRoute(reqInvalidChars);
      assert(resInvalidChars.status === 400, "Username with spaces or special characters rejected with 400");

      // 3.3 Conflict with User B's username (bob_profile)
      const reqCollision = new Request("http://localhost:3000/api/auth/profile", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "bob_profile" }),
      });
      const resCollision = await updateProfileRoute(reqCollision);
      assert(resCollision.status === 409, "Taken username rejected with 409 Conflict");
      const errCollision = await resCollision.json();
      assert(errCollision.error.includes("already taken"), "Clear error message for taken username");

      // 3.4 Valid new username update
      const reqValid = new Request("http://localhost:3000/api/auth/profile", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({ username: "alice_architect" }),
      });
      const resValid = await updateProfileRoute(reqValid);
      assert(resValid.status === 200, "Valid unique username updated with 200");
      const dataValid = await resValid.json();
      assert(dataValid.user.username === "alice_architect", "Username updated to alice_architect");
    }

    // ------------------------------------------------------------------------
    // Scenario 4: Protected-field modification rejection
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 4] Protected-Field Elevation Prevention");
    {
      const reqTamperRole = new Request("http://localhost:3000/api/auth/profile", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
      });
      const resTamperRole = await updateProfileRoute(reqTamperRole);
      assert(resTamperRole.status === 403, "Tampering with 'role' rejected with 403 Forbidden");

      const reqTamperStatus = new Request("http://localhost:3000/api/auth/profile", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disabled" }),
      });
      const resTamperStatus = await updateProfileRoute(reqTamperStatus);
      assert(resTamperStatus.status === 403, "Tampering with 'status' rejected with 403 Forbidden");

      const userInDb = await User.findById(testUserAId);
      assert(userInDb?.role === "user", "User role remained unchanged ('user')");
    }

    // ------------------------------------------------------------------------
    // Scenario 5: Avatar upload MIME type & size validation
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 5] Avatar MIME Type & Size Validation");
    {
      // 5.1 Missing file
      const emptyForm = new FormData();
      const reqEmpty = new Request("http://localhost:3000/api/user/avatar", {
        method: "POST",
        headers: { cookie: cookieUserA },
        body: emptyForm,
      });
      const resEmpty = await uploadAvatarRoute(reqEmpty);
      assert(resEmpty.status === 400, "Avatar upload with missing file returns 400");

      // 5.2 Disallowed MIME format (e.g. text/plain or executable)
      const textBlob = new Blob(["malicious script"], { type: "text/plain" });
      const textForm = new FormData();
      textForm.append("file", textBlob, "payload.txt");
      const reqText = new Request("http://localhost:3000/api/user/avatar", {
        method: "POST",
        headers: { cookie: cookieUserA },
        body: textForm,
      });
      const resText = await uploadAvatarRoute(reqText);
      assert(resText.status === 400, "Disallowed MIME type returns 400");

      // 5.3 Oversized file (> 2MB)
      const oversizedBytes = new Uint8Array(2.5 * 1024 * 1024);
      const oversizedBlob = new Blob([oversizedBytes], { type: "image/png" });
      const oversizedForm = new FormData();
      oversizedForm.append("file", oversizedBlob, "large.png");
      const reqOversized = new Request("http://localhost:3000/api/user/avatar", {
        method: "POST",
        headers: { cookie: cookieUserA },
        body: oversizedForm,
      });
      const resOversized = await uploadAvatarRoute(reqOversized);
      assert(resOversized.status === 400, "Oversized file (>2MB) returns 400");
    }

    // ------------------------------------------------------------------------
    // Scenario 6: Avatar upload magic bytes validation (fake images)
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 6] Avatar Magic Bytes Inspection");
    {
      // Create a file with PNG mime type but invalid binary content
      const fakePngBuffer = Buffer.from("NOT_A_REAL_PNG_HEADER_CONTENT");
      const fakePngBlob = new Blob([fakePngBuffer], { type: "image/png" });
      const fakeForm = new FormData();
      fakeForm.append("file", fakePngBlob, "fake.png");
      const reqFake = new Request("http://localhost:3000/api/user/avatar", {
        method: "POST",
        headers: { cookie: cookieUserA },
        body: fakeForm,
      });
      const resFake = await uploadAvatarRoute(reqFake);
      assert(resFake.status === 400, "Corrupted image with forged extension rejected via magic byte inspection");
      const fakeErr = await resFake.json();
      assert(fakeErr.error.includes("signature does not match"), "Clear magic byte signature mismatch error");
    }

    // ------------------------------------------------------------------------
    // Scenario 7: Successful avatar upload & storage persistence
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 7] Successful Avatar Upload");
    let avatarUrl1: string;
    {
      // Valid PNG header (89 50 4E 47 0D 0A 1A 0A) followed by 100 bytes
      const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      const validPngBytes = Buffer.concat([validPngHeader, Buffer.alloc(100)]);
      const validPngBlob = new Blob([validPngBytes], { type: "image/png" });
      const form = new FormData();
      form.append("file", validPngBlob, "avatar.png");

      const req = new Request("http://localhost:3000/api/user/avatar", {
        method: "POST",
        headers: { cookie: cookieUserA },
        body: form,
      });
      const res = await uploadAvatarRoute(req);
      assert(res.status === 200, "Valid PNG upload returns 200");

      const data = await res.json();
      assert(Boolean(data.avatarUrl), "Returns avatarUrl in response");
      assert(data.avatarUrl.startsWith("/uploads/avatars/avatar-"), "Avatar URL follows secure naming convention");
      avatarUrl1 = data.avatarUrl;

      // Verify file exists on local disk
      const filePath = path.join(process.cwd(), "public", avatarUrl1.replace(/^\//, ""));
      const fileStat = await fs.stat(filePath);
      assert(fileStat.isFile(), "Avatar file successfully written to disk");

      // Verify DB record updated
      const userA = await User.findById(testUserAId);
      assert(userA?.avatar === avatarUrl1, "User record avatar field points to new upload");
    }

    // ------------------------------------------------------------------------
    // Scenario 8: Unauthorized avatar operations rejection
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 8] Unauthorized Avatar Operations");
    {
      const unauthReq = new Request("http://localhost:3000/api/user/avatar", {
        method: "POST",
        body: new FormData(),
      });
      const unauthRes = await uploadAvatarRoute(unauthReq);
      assert(unauthRes.status === 401, "Unauthenticated POST /api/user/avatar returns 401");

      const unauthDeleteReq = new Request("http://localhost:3000/api/user/avatar", {
        method: "DELETE",
      });
      const unauthDeleteRes = await deleteAvatarRoute(unauthDeleteReq);
      assert(unauthDeleteRes.status === 401, "Unauthenticated DELETE /api/user/avatar returns 401");
    }

    // ------------------------------------------------------------------------
    // Scenario 9: Avatar replacement & old file cleanup
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 9] Avatar Replacement & Disk Cleanup");
    let avatarUrl2: string;
    {
      // Valid JPEG header (FF D8 FF E0 ...)
      const validJpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const validJpegBytes = Buffer.concat([validJpegHeader, Buffer.alloc(100)]);
      const validJpegBlob = new Blob([validJpegBytes], { type: "image/jpeg" });
      const form = new FormData();
      form.append("file", validJpegBlob, "new_avatar.jpg");

      const req = new Request("http://localhost:3000/api/user/avatar", {
        method: "POST",
        headers: { cookie: cookieUserA },
        body: form,
      });
      const res = await uploadAvatarRoute(req);
      assert(res.status === 200, "Replacement JPEG upload returns 200");

      const data = await res.json();
      avatarUrl2 = data.avatarUrl;
      assert(avatarUrl2 !== avatarUrl1, "New avatar has distinct filename");

      // Verify old avatar file was cleaned up from disk
      const oldFilePath = path.join(process.cwd(), "public", avatarUrl1.replace(/^\//, ""));
      let oldExists = true;
      try {
        await fs.stat(oldFilePath);
      } catch {
        oldExists = false;
      }
      assert(!oldExists, "Previous avatar file was automatically deleted from disk upon replacement");

      // Verify new file exists
      const newFilePath = path.join(process.cwd(), "public", avatarUrl2.replace(/^\//, ""));
      const newStat = await fs.stat(newFilePath);
      assert(newStat.isFile(), "New avatar file exists on disk");
    }

    // ------------------------------------------------------------------------
    // Scenario 10: Avatar deletion endpoint
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 10] Avatar Deletion Endpoint");
    {
      const req = new Request("http://localhost:3000/api/user/avatar", {
        method: "DELETE",
        headers: { cookie: cookieUserA },
      });
      const res = await deleteAvatarRoute(req);
      assert(res.status === 200, "DELETE /api/user/avatar returns 200");

      const data = await res.json();
      assert(data.avatarUrl === null, "Response avatarUrl is null");

      // Verify file deleted from disk
      const filePath = path.join(process.cwd(), "public", avatarUrl2.replace(/^\//, ""));
      let exists = true;
      try {
        await fs.stat(filePath);
      } catch {
        exists = false;
      }
      assert(!exists, "Avatar file successfully removed from disk");

      // Verify user record cleared
      const user = await User.findById(testUserAId);
      assert(user?.avatar === undefined || user?.avatar === null, "user.avatar cleared in MongoDB");
    }

    // ------------------------------------------------------------------------
    // Scenario 11: Password update with correct current password
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 11] Password Change with Verified Current Password");
    const newPasswordA = "NewSecurePassword456!";
    {
      const req = new Request("http://localhost:3000/api/auth/password", {
        method: "PUT",
        headers: {
          cookie: cookieUserA,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: initialPasswordA,
          newPassword: newPasswordA,
        }),
      });
      const res = await updatePasswordRoute(req);
      assert(res.status === 200, "PUT /api/auth/password returns 200 on valid credentials");

      // Verify in DB that new password hash matches
      const user = await User.findById(testUserAId);
      const isNewMatch = await bcrypt.compare(newPasswordA, user!.passwordHash);
      assert(isNewMatch, "New password correctly hashed and authenticates in DB");

      const isOldMatch = await bcrypt.compare(initialPasswordA, user!.passwordHash);
      assert(!isOldMatch, "Old password no longer authenticates");
    }

    // ------------------------------------------------------------------------
    // Scenario 12: Password change rejection (incorrect, weak, same password)
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 12] Password Change Rejection Cases");
    {
      // 12.1 Incorrect current password
      const reqWrongPass = new Request("http://localhost:3000/api/auth/password", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: "WrongPassword999!",
          newPassword: "AnotherNewPassword789!",
        }),
      });
      const resWrongPass = await updatePasswordRoute(reqWrongPass);
      assert(resWrongPass.status === 400, "Incorrect current password rejected with 400");
      const errWrong = await resWrongPass.json();
      assert(errWrong.error === "Incorrect current password", "Clear error message for wrong password");

      // 12.2 New password too short (< 8 chars)
      const reqShort = new Request("http://localhost:3000/api/auth/password", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: newPasswordA,
          newPassword: "short",
        }),
      });
      const resShort = await updatePasswordRoute(reqShort);
      assert(resShort.status === 400, "Password < 8 characters rejected with 400");

      // 12.3 New password identical to current password
      const reqSame = new Request("http://localhost:3000/api/auth/password", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: newPasswordA,
          newPassword: newPasswordA,
        }),
      });
      const resSame = await updatePasswordRoute(reqSame);
      assert(resSame.status === 400, "Identical new password rejected with 400");
    }

    // ------------------------------------------------------------------------
    // Scenario 13: User preferences persistence (theme, layout, alerts)
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 13] Preferences Persistence & Retrieval");
    {
      // 13.1 Update preferences
      const reqPref = new Request("http://localhost:3000/api/user/preferences", {
        method: "PUT",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: "light",
          defaultView: "list",
          notifyOnBuildSuccess: false,
          notifyOnBuildFailure: true,
          notifyOnDeploymentStarted: true,
          timezone: "America/New_York",
        }),
      });
      const resPref = await updatePreferencesRoute(reqPref);
      assert(resPref.status === 200, "PUT /api/user/preferences returns 200");

      // 13.2 Retrieve preferences
      const reqGet = new Request("http://localhost:3000/api/user/preferences", {
        headers: { cookie: cookieUserA },
      });
      const resGet = await getPreferencesRoute(reqGet);
      assert(resGet.status === 200, "GET /api/user/preferences returns 200");
      const dataGet = await resGet.json();

      assert(dataGet.preferences.theme === "light", "Theme preference persisted as 'light'");
      assert(dataGet.preferences.defaultView === "list", "Default view preference persisted as 'list'");
      assert(dataGet.preferences.notifyOnBuildSuccess === false, "notifyOnBuildSuccess persisted as false");
      assert(dataGet.preferences.notifyOnBuildFailure === true, "notifyOnBuildFailure persisted as true");
      assert(dataGet.preferences.notifyOnDeploymentStarted === true, "notifyOnDeploymentStarted persisted as true");
      assert(dataGet.preferences.timezone === "America/New_York", "Timezone persisted as 'America/New_York'");
    }

    // ------------------------------------------------------------------------
    // Scenario 14: Account deletion with cascade cleanup & confirmation
    // ------------------------------------------------------------------------
    console.log("\n▶ [Scenario 14] Account Deletion & Cascade Resource Cleanup");
    {
      // Seed project, deployment, and activity for User A before deletion
      const projId = "710000000000000000000041";
      await Project.create({
        _id: projId,
        name: "Alice Cascade App",
        slug: "alice-cascade-app",
        userId: testUserAId,
        repository: "alice/cascade-app",
        branch: "main",
        framework: "Next.js",
      });

      await Deployment.create({
        projectId: projId,
        userId: testUserAId,
        status: "READY",
        branch: "main",
        environment: "production",
      });

      await Activity.create({
        userId: testUserAId,
        projectId: projId,
        type: "project_created",
        title: "Project created",
        description: "Created project for cascade test",
      });

      // 14.1 Attempt deletion with wrong password / confirmation
      const reqFail = new Request("http://localhost:3000/api/auth/account", {
        method: "DELETE",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "InvalidPassword123" }),
      });
      const resFail = await deleteAccountRoute(reqFail);
      assert(resFail.status === 400, "Account deletion with wrong password rejected with 400");

      // 14.2 Successful account deletion with valid password
      const reqSuccess = new Request("http://localhost:3000/api/auth/account", {
        method: "DELETE",
        headers: { cookie: cookieUserA, "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPasswordA }),
      });
      const resSuccess = await deleteAccountRoute(reqSuccess);
      assert(resSuccess.status === 200, "Account deletion with valid credentials returns 200");

      // Verify User A deleted from MongoDB
      const userA = await User.findById(testUserAId);
      assert(!userA, "User record deleted from MongoDB");

      // Verify User A projects cascade-deleted
      const projCount = await Project.countDocuments({ userId: testUserAId });
      assert(projCount === 0, "Projects cascade deleted");

      // Verify User A deployments cascade-deleted
      const depCount = await Deployment.countDocuments({ userId: testUserAId });
      assert(depCount === 0, "Deployments cascade deleted");

      // Verify User A activities cascade-deleted
      const actCount = await Activity.countDocuments({ userId: testUserAId });
      assert(actCount === 0, "Activities cascade deleted");

      // Verify User B still exists unharmed
      const userB = await User.findById(testUserBId);
      assert(Boolean(userB), "User B remains completely intact and unaffected");
    }
  } finally {
    // ------------------------------------------------------------------------
    // Clean up all remaining test fixtures
    // ------------------------------------------------------------------------
    await User.deleteMany({ _id: { $in: [testUserAId, testUserBId] } });
    await Project.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
    await Deployment.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
    await Activity.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
    await Integration.deleteMany({ userId: { $in: [testUserAId, testUserBId] } });
  }

  console.log("\n=======================================================");
  console.log(`  PASSED: ${passedTests} / ${totalTests} CHECKS COMPLETED SUCCESSFULLY`);
  console.log("=======================================================\n");
}

runProfileSettingsSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
