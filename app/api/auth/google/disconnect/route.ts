import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import Integration from "@/models/Integration";
import Activity from "@/models/Activity";

export async function POST(req: NextRequest) {
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

    if (!user.googleId) {
      return NextResponse.json({ error: "No Google account is currently connected." }, { status: 400 });
    }

    // Safety Check: Verify user has another authentication factor
    const hasGitHub = await Integration.findOne({ userId: user._id, provider: "github" });
    const hasUsablePassword = user.passwordHash && user.passwordHash.length > 20;

    if (!hasGitHub && !hasUsablePassword) {
      return NextResponse.json(
        {
          error:
            "Cannot disconnect Google account. You must set a password or connect GitHub first to prevent account lockout.",
        },
        { status: 400 }
      );
    }

    // Remove Google link
    user.googleId = undefined;
    user.googleEmail = undefined;
    user.googleConnectedAt = undefined;
    await user.save();

    await Integration.deleteOne({ userId: user._id, provider: "google" });

    await Activity.create({
      userId: user._id,
      type: "security_google_disconnected",
      title: "Google Account Disconnected",
      description: "Google identity was unlinked from this DeployX account.",
      icon: "ShieldAlert",
    });

    return NextResponse.json({
      success: true,
      message: "Google account disconnected successfully.",
    });
  } catch (error) {
    console.error("[Google Disconnect Error]", error);
    return NextResponse.json({ error: "Failed to disconnect Google account." }, { status: 500 });
  }
}
