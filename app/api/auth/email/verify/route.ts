import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    // Rate limit verification attempts to thwart brute-force on 6-digit codes
    const { checkRateLimit, getClientIp, getRateLimitHeaders } = await import("@/lib/auth/rate-limit");
    const clientIp = getClientIp(req);
    const ipRl = checkRateLimit(`email-verify:ip:${clientIp}`, 15, 15 * 60 * 1000);
    if (!ipRl.allowed) {
      return NextResponse.json(
        { error: `Too many verification attempts. Please wait ${ipRl.retryAfterSeconds} seconds.` },
        { status: 429, headers: getRateLimitHeaders(15, ipRl.remaining, ipRl.retryAfterSeconds) }
      );
    }

    const { code, token } = body;
    if (!code && !token) {
      return NextResponse.json(
        { error: "Verification code or token is required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    // Check if authenticated
    const session = await getSession(req).catch(() => null);
    let user = null;

    if (session?.userId && mongoose.isValidObjectId(session.userId)) {
      user = await User.findById(session.userId);
    } else if (token && typeof token === "string") {
      user = await User.findOne({ emailVerificationToken: token.trim() });
    } else if (code && typeof code === "string") {
      user = await User.findOne({ emailVerificationCode: code.trim() });
    }

    if (!user || !user.pendingEmail) {
      return NextResponse.json(
        { error: "No pending email verification request found" },
        { status: 400 }
      );
    }

    // Check expiration
    if (!user.emailVerificationExpires || user.emailVerificationExpires.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Verification code or token has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Match code or token
    const isCodeValid = code && typeof code === "string" && user.emailVerificationCode === code.trim();
    const isTokenValid = token && typeof token === "string" && user.emailVerificationToken === token.trim();

    if (!isCodeValid && !isTokenValid) {
      return NextResponse.json(
        { error: "Invalid verification code or token. Please try again." },
        { status: 400 }
      );
    }

    // Double check email uniqueness before committing
    const newEmail = user.pendingEmail.toLowerCase().trim();
    const existing = await User.findOne({
      email: newEmail,
      _id: { $ne: user._id },
    }).lean();

    if (existing) {
      user.pendingEmail = undefined;
      user.emailVerificationCode = undefined;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
      return NextResponse.json(
        { error: "This email address was recently claimed by another account" },
        { status: 409 }
      );
    }

    // Promote pendingEmail to verified email
    const oldEmail = user.email;
    user.email = newEmail;
    user.emailVerified = new Date();
    user.pendingEmail = undefined;
    user.emailVerificationCode = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Log Activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: user._id,
        type: "email_changed",
        title: "Email Address Updated",
        description: `Email updated from ${oldEmail} to ${newEmail}.`,
        icon: "Mail",
        color: "text-emerald-500",
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your email address has been successfully updated and verified.",
        email: user.email,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[Email Verify POST Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      const errorUrl = new URL("/dashboard/settings/profile?error=missing_token", req.url);
      return NextResponse.redirect(errorUrl);
    }

    await connectToDatabase();

    const user = await User.findOne({ emailVerificationToken: token.trim() });
    if (!user || !user.pendingEmail) {
      const errorUrl = new URL("/dashboard/settings/profile?error=invalid_token", req.url);
      return NextResponse.redirect(errorUrl);
    }

    if (!user.emailVerificationExpires || user.emailVerificationExpires.getTime() < Date.now()) {
      const errorUrl = new URL("/dashboard/settings/profile?error=expired_token", req.url);
      return NextResponse.redirect(errorUrl);
    }

    const newEmail = user.pendingEmail.toLowerCase().trim();
    const existing = await User.findOne({
      email: newEmail,
      _id: { $ne: user._id },
    }).lean();

    if (existing) {
      user.pendingEmail = undefined;
      user.emailVerificationCode = undefined;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();
      const errorUrl = new URL("/dashboard/settings/profile?error=email_claimed", req.url);
      return NextResponse.redirect(errorUrl);
    }

    const oldEmail = user.email;
    user.email = newEmail;
    user.emailVerified = new Date();
    user.pendingEmail = undefined;
    user.emailVerificationCode = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Log Activity
    try {
      const Activity = (await import("@/models/Activity")).default;
      await Activity.create({
        userId: user._id,
        type: "email_changed",
        title: "Email Address Updated",
        description: `Email updated from ${oldEmail} to ${newEmail}.`,
        icon: "Mail",
        color: "text-emerald-500",
      });
    } catch {
      // Non-fatal
    }

    const successUrl = new URL("/dashboard/settings/profile?emailVerified=true", req.url);
    return NextResponse.redirect(successUrl);
  } catch (error: unknown) {
    console.error("[Email Verify GET Error]:", error);
    const errorUrl = new URL("/dashboard/settings/profile?error=server_error", req.url);
    return NextResponse.redirect(errorUrl);
  }
}
