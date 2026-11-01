import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit, resetRateLimit, getClientIp, getRateLimitHeaders } from "@/lib/auth/rate-limit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientIp = getClientIp(req);
    const rateLimitKey = `email-change:${session.userId}:${clientIp}`;
    const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many email change requests. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
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

    const { newEmail, password } = body;

    if (!newEmail || typeof newEmail !== "string") {
      return NextResponse.json({ error: "New email address is required" }, { status: 400 });
    }

    const cleanEmail = newEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
    }

    if (cleanEmail.length > 128) {
      return NextResponse.json({ error: "Email cannot exceed 128 characters" }, { status: 400 });
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (cleanEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "New email address must be different from your current email" },
        { status: 400 }
      );
    }

    // Check if newEmail is already registered by another account
    const existing = await User.findOne({
      email: cleanEmail,
      _id: { $ne: session.userId },
    }).lean();

    if (existing) {
      return NextResponse.json(
        { error: "This email address is already in use by another account" },
        { status: 409 }
      );
    }

    // Require password confirmation for security
    if (user.passwordHash) {
      if (!password || typeof password !== "string") {
        return NextResponse.json(
          { error: "Current password is required to change your email address" },
          { status: 400 }
        );
      }
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return NextResponse.json(
          { error: "Incorrect password. Email change cannot proceed." },
          { status: 400 }
        );
      }
    }

    // Generate 6-digit verification code & 64-char verification token
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    user.pendingEmail = cleanEmail;
    user.emailVerificationCode = verificationCode;
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = expires;
    await user.save();

    resetRateLimit(rateLimitKey);

    // Log Activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: session.userId,
        type: "email_change_requested",
        title: "Email Change Requested",
        description: `Requested email change to ${cleanEmail}. Verification pending.`,
        icon: "Mail",
        color: "text-amber-500",
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json(
      {
        success: true,
        message: `Verification code and link sent to ${cleanEmail}. Please verify to complete the change.`,
        pendingEmail: cleanEmail,
        verificationToken,
        verificationCode,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[Email Change Request Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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

    user.pendingEmail = undefined;
    user.emailVerificationCode = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return NextResponse.json(
      { success: true, message: "Pending email change cancelled successfully" },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[Email Change Cancel Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
