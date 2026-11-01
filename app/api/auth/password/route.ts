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
import { checkRateLimit, resetRateLimit, getClientIp, getRateLimitHeaders } from "@/lib/auth/rate-limit";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  return handlePasswordUpdate(req);
}

export async function PUT(req: Request) {
  return handlePasswordUpdate(req);
}

async function handlePasswordUpdate(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientIp = getClientIp(req);
    const rateLimitKey = `password-change:${session.userId}:${clientIp}`;
    const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many password update attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(5, rateCheck.remaining, rateCheck.retryAfterSeconds),
        }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json({ error: "Current password is required" }, { status: 400 });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ error: "New password is required" }, { status: 400 });
    }

    if (confirmPassword !== undefined && newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New password and confirmation do not match" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    if (newPassword.length > 128) {
      return NextResponse.json(
        { error: "New password must be 128 characters or fewer" },
        { status: 400 }
      );
    }

    // Require password complexity (at least one letter and one number or special char)
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)) {
      return NextResponse.json(
        { error: "New password must contain at least one letter and at least one number or special character" },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const newPasswordHash = await bcrypt.hash(newPassword, salt);

    user.passwordHash = newPasswordHash;
    user.passwordChangedAt = new Date();

    // Invalidate other sessions by incrementing tokenVersion
    const nextTokenVersion = (user.tokenVersion || 0) + 1;
    user.tokenVersion = nextTokenVersion;

    // Retain only current session in sessions array if present
    if (session.sessionId && Array.isArray(user.sessions)) {
      user.sessions = user.sessions.filter(
        (s: { sessionId: string }) => s.sessionId === session.sessionId
      );
      if (user.sessions.length > 0) {
        user.sessions[0].lastActive = new Date();
      }
    }

    await user.save();
    resetRateLimit(rateLimitKey);

    // Issue rotated session cookie with new tokenVersion for current device
    const currentSessionId = session.sessionId || (await import("crypto")).randomUUID();
    const newSessionToken = await createSession(user._id.toString(), {
      sessionId: currentSessionId,
      tokenVersion: nextTokenVersion,
    });

    // Log Activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: session.userId,
        type: "password_changed",
        title: "Password Changed",
        description: "Your account password was updated successfully. Other active sessions were revoked.",
        icon: "Shield",
        color: "text-emerald-500",
      });
    } catch {
      // Non-fatal
    }

    const response = NextResponse.json(
      {
        message: "Password updated successfully. Other active sessions have been revoked.",
        passwordChangedAt: user.passwordChangedAt,
      },
      { status: 200 }
    );

    response.cookies.set(SESSION_COOKIE_NAME, newSessionToken, {
      ...SESSION_COOKIE_OPTIONS,
      expires: new Date(Date.now() + SESSION_COOKIE_OPTIONS.maxAge * 1000),
    });

    return response;
  } catch (error: unknown) {
    console.error("[Change Password Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
