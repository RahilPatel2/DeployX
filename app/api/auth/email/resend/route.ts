import { NextResponse } from "next/server";
import crypto from "crypto";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit, getClientIp, getRateLimitHeaders } from "@/lib/auth/rate-limit";

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clientIp = getClientIp(req);
    const rateLimitKey = `email-resend:${session.userId}:${clientIp}`;
    // 1 resend per 60 seconds
    const rateCheck = checkRateLimit(rateLimitKey, 1, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Please wait ${rateCheck.retryAfterSeconds} seconds before requesting another verification code.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(1, rateCheck.remaining, rateCheck.retryAfterSeconds),
        }
      );
    }

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.pendingEmail) {
      return NextResponse.json(
        { error: "No pending email change request found" },
        { status: 400 }
      );
    }

    // Generate fresh verification code & token and extend expiration by 24h
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.emailVerificationCode = verificationCode;
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = expires;
    await user.save();

    return NextResponse.json(
      {
        success: true,
        message: `A new verification code has been sent to ${user.pendingEmail}.`,
        pendingEmail: user.pendingEmail,
        verificationToken,
        verificationCode,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[Email Resend Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
