import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { createSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";
import { checkRateLimit, resetRateLimit } from "@/lib/auth/rate-limit";
import * as z from "zod";

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email or username is required").max(128),
  password: z.string().min(1, "Password is required").max(128),
  remember: z.boolean().optional(),
});

// Dummy hash to defend against timing attacks when user does not exist
const DUMMY_HASH = "$2a$10$abcdefghijklmnopqrstuvwxyz123456789012345678901234567890";

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request payload" },
        { status: 400 }
      );
    }

    const parsedData = loginSchema.safeParse(body);
    if (!parsedData.success) {
      const firstIssue = parsedData.error.issues[0]?.message || "Invalid credentials provided";
      return NextResponse.json({ error: firstIssue }, { status: 400 });
    }

    const { identifier, password } = parsedData.data;
    const normalizedIdentifier = identifier.toLowerCase().trim();
    const rateLimitKey = `login:${clientIp}:${normalizedIdentifier}`;

    // Rate limiting check: 5 failed attempts per 15 minutes
    const rateCheck = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
          retryAfterSeconds: rateCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    try {
      await connectToDatabase();
    } catch (dbError: unknown) {
      const dbMsg = dbError instanceof Error ? dbError.message : "Database connection failed";
      console.error("[Auth/Login] Database connection error:", dbMsg);
      return NextResponse.json(
        { error: "Database service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    // Find by email or username
    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier },
        { username: identifier.trim() },
        { username: normalizedIdentifier },
      ],
    });

    if (!user) {
      // Execute dummy compare to mitigate timing side-channel attacks
      await bcrypt.compare(password, DUMMY_HASH).catch(() => false);
      return NextResponse.json(
        { error: "Incorrect username or password." },
        { status: 401 }
      );
    }

    // Check account status
    if (user.status === "disabled") {
      return NextResponse.json(
        { error: "This account has been disabled. Please contact support." },
        { status: 403 }
      );
    }

    // Verify password hash
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Incorrect username or password." },
        { status: 401 }
      );
    }

    // Reset rate limit on successful credentials
    resetRateLimit(rateLimitKey);

    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();

    // Issue fresh session
    const sessionToken = await createSession(user._id.toString());

    const response = NextResponse.json(
      {
        success: true,
        message: "Logged in successfully",
        user: {
          id: user._id.toString(),
          name: user.name,
          username: user.username,
          email: user.email,
          avatar: user.avatar || "",
        },
      },
      { status: 200 }
    );

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      ...SESSION_COOKIE_OPTIONS,
      expires: new Date(Date.now() + SESSION_COOKIE_OPTIONS.maxAge * 1000),
    });

    return response;
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Auth/Login] Unexpected login error:", errMessage);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
