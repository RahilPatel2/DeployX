import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import {
  generateMfaEnrollment,
  encryptMfaSecret,
  generateRecoveryCodes,
} from "@/lib/auth/mfa";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`mfa_enroll:${session.userId}`, 5, 60000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many MFA enrollment attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    await connectToDatabase();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate enrollment credentials
    const enrollment = await generateMfaEnrollment(user.email);
    const encryptedSecret = encryptMfaSecret(enrollment.secret);
    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);

    // Save ephemeral pending enrollment (expires in 15 minutes)
    user.pendingMfaEnrollment = {
      secretEncrypted: encryptedSecret,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    };

    // Stash pending recovery codes temporarily until confirmation
    user.mfaRecoveryCodes = hashedCodes;
    await user.save();

    return NextResponse.json({
      success: true,
      manualKey: enrollment.manualKey,
      otpauthUrl: enrollment.otpauthUrl,
      qrCodeDataUrl: enrollment.qrCodeDataUrl,
      recoveryCodes: plainCodes,
    });
  } catch (error) {
    console.error("[MFA Enroll Error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to initialize MFA enrollment." },
      { status: 500 }
    );
  }
}
