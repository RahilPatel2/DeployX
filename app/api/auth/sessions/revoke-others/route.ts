import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import {
  getSession,
  createSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentSessionId = session.sessionId;

    // Increment tokenVersion so older session tokens become immediately invalid
    const nextTokenVersion = (user.tokenVersion || 0) + 1;
    user.tokenVersion = nextTokenVersion;

    // Retain only current session in sessions array
    if (Array.isArray(user.sessions)) {
      user.sessions = user.sessions.filter(
        (s: { sessionId: string }) => s.sessionId === currentSessionId
      );
      if (user.sessions.length > 0) {
        user.sessions[0].lastActive = new Date();
      }
    }

    await user.save();

    // Re-issue fresh session cookie with new tokenVersion for the active device
    const newSessionToken = await createSession(user._id.toString(), {
      sessionId: currentSessionId,
      tokenVersion: nextTokenVersion,
    });

    // Log Activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: session.userId,
        type: "sessions_revoked",
        title: "Other Sessions Revoked",
        description: "You signed out of all other active browser sessions.",
        icon: "Shield",
        color: "text-amber-500",
      });
    } catch {
      // Non-fatal
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "All other sessions have been signed out successfully.",
      },
      { status: 200 }
    );

    response.cookies.set(SESSION_COOKIE_NAME, newSessionToken, {
      ...SESSION_COOKIE_OPTIONS,
      expires: new Date(Date.now() + SESSION_COOKIE_OPTIONS.maxAge * 1000),
    });

    return response;
  } catch (error: unknown) {
    console.error("[Revoke Others Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
