import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const unusedRecoveryCount = (user.mfaRecoveryCodes || []).filter((c: { usedAt?: Date }) => !c.usedAt).length;

    return NextResponse.json({
      mfaEnabled: Boolean(user.mfaEnabled),
      enrolledAt: user.mfaEnrolledAt || null,
      lastVerifiedAt: user.mfaLastVerifiedAt || null,
      recoveryCodesRemaining: unusedRecoveryCount,
      googleConnected: Boolean(user.googleId),
      googleEmail: user.googleEmail || null,
    });
  } catch (error) {
    console.error("[MFA Status Error]", error);
    return NextResponse.json({ error: "Failed to retrieve MFA status." }, { status: 500 });
  }
}
