import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth/session";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import Activity from "@/models/Activity";
import { decryptMfaSecret, verifyMfaToken, verifyAndConsumeRecoveryCode } from "@/lib/auth/mfa";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`mfa_disable:${session.userId}`, 5, 60000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { password, code } = body;

    await connectToDatabase();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.mfaEnabled) {
      return NextResponse.json({ error: "Two-Factor Authentication is not enabled on this account." }, { status: 400 });
    }

    // Step-up authentication verification
    let verified = false;

    // Option A: Password confirmation
    if (password && typeof password === "string") {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (isMatch) verified = true;
    }

    // Option B: Current TOTP code or recovery code
    if (!verified && code && typeof code === "string") {
      if (user.mfaSecretEncrypted) {
        try {
          const rawSecret = decryptMfaSecret(user.mfaSecretEncrypted);
          const totpCheck = verifyMfaToken(code, rawSecret, user.mfaLastUsedTimeStep);
          if (totpCheck.valid) {
            verified = true;
          }
        } catch {
          // Fall through to recovery code check
        }
      }

      if (!verified && user.mfaRecoveryCodes) {
        const recoveryCheck = verifyAndConsumeRecoveryCode(code, user.mfaRecoveryCodes);
        if (recoveryCheck.valid) {
          verified = true;
        }
      }
    }

    if (!verified) {
      return NextResponse.json(
        { error: "Invalid password or verification code. Security confirmation required to disable MFA." },
        { status: 403 }
      );
    }

    // Disable MFA
    user.mfaEnabled = false;
    user.mfaSecretEncrypted = undefined;
    user.mfaRecoveryCodes = [];
    user.mfaEnrolledAt = undefined;
    user.pendingMfaEnrollment = undefined;
    await user.save();

    await Activity.create({
      userId: user._id,
      type: "security_mfa_disabled",
      title: "Two-Factor Authentication Disabled",
      description: "MFA protection was disabled from account settings.",
      icon: "ShieldAlert",
    });

    return NextResponse.json({
      success: true,
      message: "Two-Factor Authentication has been successfully disabled.",
    });
  } catch (error) {
    console.error("[MFA Disable Error]", error);
    return NextResponse.json({ error: "Failed to disable MFA." }, { status: 500 });
  }
}
