import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import Activity from "@/models/Activity";
import { decryptMfaSecret, verifyMfaToken } from "@/lib/auth/mfa";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`mfa_confirm:${session.userId}`, 10, 60000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Verification code is required." }, { status: 400 });
    }

    await connectToDatabase();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.pendingMfaEnrollment || !user.pendingMfaEnrollment.secretEncrypted) {
      return NextResponse.json(
        { error: "No pending MFA enrollment found. Please initiate setup again." },
        { status: 400 }
      );
    }

    if (new Date() > new Date(user.pendingMfaEnrollment.expiresAt)) {
      user.pendingMfaEnrollment = undefined;
      await user.save();
      return NextResponse.json(
        { error: "MFA enrollment expired. Please restart the setup process." },
        { status: 400 }
      );
    }

    const rawSecret = decryptMfaSecret(user.pendingMfaEnrollment.secretEncrypted);
    const verification = verifyMfaToken(token, rawSecret);

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Invalid verification code. Please check your authenticator app." },
        { status: 400 }
      );
    }

    // Permanently activate MFA
    user.mfaSecretEncrypted = user.pendingMfaEnrollment.secretEncrypted;
    user.mfaEnabled = true;
    user.mfaEnrolledAt = new Date();
    user.mfaLastVerifiedAt = new Date();
    user.mfaLastUsedTimeStep = verification.timeStep || 0;
    user.pendingMfaEnrollment = undefined;
    await user.save();

    await Activity.create({
      userId: user._id,
      type: "security_mfa_enabled",
      title: "Two-Factor Authentication Enabled",
      description: "Google Authenticator / TOTP MFA successfully activated.",
      icon: "ShieldCheck",
    });

    return NextResponse.json({
      success: true,
      message: "Two-Factor Authentication is now permanently active on your account.",
    });
  } catch (error) {
    console.error("[MFA Confirm Error]", error);
    return NextResponse.json({ error: "Failed to confirm MFA setup." }, { status: 500 });
  }
}
