import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/auth/session";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import Activity from "@/models/Activity";
import { generateRecoveryCodes } from "@/lib/auth/mfa";
import { checkRateLimit } from "@/lib/auth/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`mfa_regen_recovery:${session.userId}`, 5, 60000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please wait a minute and try again." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { password } = body;

    await connectToDatabase();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.mfaEnabled) {
      return NextResponse.json({ error: "Two-Factor Authentication is not enabled on this account." }, { status: 400 });
    }

    // Require password confirmation
    if (user.passwordHash && user.passwordHash.length > 20) {
      if (!password || typeof password !== "string") {
        return NextResponse.json({ error: "Password confirmation is required to regenerate recovery codes." }, { status: 400 });
      }
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json({ error: "Invalid password confirmation." }, { status: 403 });
      }
    }

    // Generate new recovery codes and invalidate old ones
    const { plainCodes, hashedCodes } = generateRecoveryCodes(8);
    user.mfaRecoveryCodes = hashedCodes;
    await user.save();

    await Activity.create({
      userId: user._id,
      type: "security_mfa_recovery_regenerated",
      title: "MFA Recovery Codes Regenerated",
      description: "Previous recovery codes were invalidated and 8 new codes generated.",
      icon: "KeyRound",
    });

    return NextResponse.json({
      success: true,
      recoveryCodes: plainCodes,
      message: "New recovery codes generated. Store them in a secure place.",
    });
  } catch (error) {
    console.error("[Regenerate Recovery Codes Error]", error);
    return NextResponse.json({ error: "Failed to regenerate recovery codes." }, { status: 500 });
  }
}
