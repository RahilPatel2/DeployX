import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import AuthChallenge from "@/models/AuthChallenge";
import Activity from "@/models/Activity";
import { decryptMfaSecret, verifyMfaToken, verifyAndConsumeRecoveryCode } from "@/lib/auth/mfa";
import { rotateSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rl = checkRateLimit(`mfa_challenge_ip:${ip}`, 15, 60000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts from this IP address. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { challengeToken, code, isRecoveryCode } = body;

    if (!challengeToken || typeof challengeToken !== "string") {
      return NextResponse.json({ error: "Missing authentication challenge identifier." }, { status: 400 });
    }

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Authentication code is required." }, { status: 400 });
    }

    await connectToDatabase();
    const challenge = await AuthChallenge.findOne({ challengeToken });

    if (!challenge) {
      return NextResponse.json({ error: "Authentication challenge not found or expired." }, { status: 404 });
    }

    if (challenge.consumed) {
      return NextResponse.json(
        { error: "This authentication challenge has already been used. Please sign in again." },
        { status: 400 }
      );
    }

    if (new Date() > new Date(challenge.expiresAt)) {
      challenge.consumed = true;
      await challenge.save();
      return NextResponse.json(
        { error: "Authentication challenge expired. Please sign in again." },
        { status: 400 }
      );
    }

    // Rate limiting per challenge token
    challenge.attempts = (challenge.attempts || 0) + 1;
    if (challenge.attempts > (challenge.maxAttempts || 5)) {
      challenge.consumed = true;
      await challenge.save();
      return NextResponse.json(
        { error: "Maximum attempts exceeded. This challenge has been revoked. Please sign in again." },
        { status: 429 }
      );
    }

    const user = await User.findById(challenge.userId);
    if (!user) {
      return NextResponse.json({ error: "Associated user account not found." }, { status: 404 });
    }

    let isCodeValid = false;
    let failureMessage = "Invalid verification code.";

    if (isRecoveryCode) {
      // Recovery code path
      const recoveryResult = verifyAndConsumeRecoveryCode(code, user.mfaRecoveryCodes || []);
      if (recoveryResult.valid) {
        isCodeValid = true;
        user.mfaRecoveryCodes = recoveryResult.updatedCodes;
        await user.save();
      } else {
        failureMessage = recoveryResult.error || "Invalid or already used recovery code.";
      }
    } else {
      // Standard TOTP path
      if (!user.mfaSecretEncrypted) {
        return NextResponse.json({ error: "MFA is not configured on this account." }, { status: 400 });
      }

      try {
        const rawSecret = decryptMfaSecret(user.mfaSecretEncrypted);
        const verification = verifyMfaToken(code, rawSecret, user.mfaLastUsedTimeStep);
        if (verification.valid) {
          isCodeValid = true;
          user.mfaLastUsedTimeStep = verification.timeStep || 0;
          user.mfaLastVerifiedAt = new Date();
          await user.save();
        } else {
          failureMessage = verification.error || "Invalid authenticator code. Please check your app.";
        }
      } catch (err) {
        console.error("[MFA Decryption Error]", err);
        failureMessage = "Security engine error decrypting authentication credentials.";
      }
    }

    if (!isCodeValid) {
      await challenge.save();
      const remaining = Math.max(0, (challenge.maxAttempts || 5) - challenge.attempts);
      return NextResponse.json(
        {
          error: failureMessage,
          remainingAttempts: remaining,
        },
        { status: 400 }
      );
    }

    // Code verified successfully!
    challenge.consumed = true;
    await challenge.save();

    user.lastLogin = new Date();
    await user.save();

    await Activity.create({
      userId: user._id,
      type: "login_mfa_success",
      title: "Second-Factor Verification Succeeded",
      description: isRecoveryCode
        ? "Signed in successfully using single-use emergency recovery code."
        : "Signed in successfully using Google Authenticator TOTP.",
      icon: "ShieldCheck",
    });

    const sessionToken = await rotateSession(user._id.toString());
    const returnTo = challenge.returnTo || "/dashboard";

    const response = NextResponse.json({
      success: true,
      message: "Authentication successful.",
      returnTo,
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
    return response;
  } catch (error) {
    console.error("[MFA Challenge Verification Error]", error);
    return NextResponse.json({ error: "Internal server error during verification." }, { status: 500 });
  }
}
