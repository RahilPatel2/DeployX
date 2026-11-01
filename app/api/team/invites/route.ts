import { NextResponse } from "next/server";
import crypto from "crypto";
import connectToDatabase from "@/lib/mongodb/client";
import TeamInvite from "@/models/TeamInvite";
import Notification from "@/models/Notification";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const invites = await TeamInvite.find({
      workspaceOwnerId: session.userId,
      status: "pending",
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Team invites GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { checkRateLimit } = await import("@/lib/auth/rate-limit");
    const rl = checkRateLimit(`team_invite:${session.userId}`, 15, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many invitations sent. Please wait before inviting more members." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, role } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRole = ["admin", "member", "viewer"].includes(role) ? role : "member";

    await connectToDatabase();

    // Check if invite already pending
    const existing = await TeamInvite.findOne({
      workspaceOwnerId: session.userId,
      email: cleanEmail,
      status: "pending",
    });

    if (existing) {
      return NextResponse.json(
        { error: `An invitation is already pending for ${cleanEmail}` },
        { status: 409 }
      );
    }

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await TeamInvite.create({
      workspaceOwnerId: session.userId,
      email: cleanEmail,
      role: cleanRole,
      status: "pending",
      token,
      expiresAt,
    });

    // Fire application notification
    await Notification.create({
      userId: session.userId,
      title: "Team invitation sent",
      message: `Invited ${cleanEmail} as ${cleanRole} to the workspace`,
      category: "system",
      read: false,
    }).catch(() => {});

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error("Team invites POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const inviteId = searchParams.get("id");

    const mongoose = (await import("mongoose")).default;
    if (!inviteId || !mongoose.isValidObjectId(inviteId)) {
      return NextResponse.json({ error: "Valid invitation ID is required" }, { status: 400 });
    }

    await connectToDatabase();

    const deleted = await TeamInvite.findOneAndDelete({
      _id: inviteId,
      workspaceOwnerId: session.userId,
    });

    if (!deleted) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Invitation revoked successfully" }, { status: 200 });
  } catch (error) {
    console.error("Team invites DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
