import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { createSession } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import * as z from "zod";

const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(64, "Full name cannot exceed 64 characters"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username cannot exceed 32 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and dashes"
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(128, "Email cannot exceed 128 characters")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
});

export async function POST(req: Request) {
  try {
    // 1. IP rate limiting for signup attempts
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
    const rateCheck = checkRateLimit(`signup:${clientIp}`, 10, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: "RATE_LIMITED",
          error: `Too many signup attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
          message: `Too many signup attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    // 2. Parse request payload
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          error: "Invalid JSON request payload",
          message: "Invalid JSON request payload",
        },
        { status: 400 }
      );
    }

    // 3. Validate schema
    const parsedData = signupSchema.safeParse(body);
    if (!parsedData.success) {
      const firstIssue = parsedData.error.issues[0]?.message || "Invalid registration data provided";
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          error: firstIssue,
          message: firstIssue,
        },
        { status: 400 }
      );
    }

    const { fullName, username, email, password } = parsedData.data;
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedUsername = username.toLowerCase().trim();

    // 4. Connect to database
    try {
      await connectToDatabase();
    } catch (dbError: unknown) {
      const dbMsg = dbError instanceof Error ? dbError.message : "Database connection failed";
      console.error("[Auth/Signup] Database connection error:", dbMsg);
      return NextResponse.json(
        {
          success: false,
          code: "SERVICE_UNAVAILABLE",
          error: "Database service temporarily unavailable. Please try again shortly.",
          message: "Database service temporarily unavailable. Please try again shortly.",
        },
        { status: 503 }
      );
    }

    // 5. Check if email already registered
    const existingEmail = await User.findOne({ email: normalizedEmail }).lean();
    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          code: "EMAIL_EXISTS",
          error: "An account with this email already exists.",
          message: "An account with this email already exists.",
        },
        { status: 409 }
      );
    }

    // 6. Check if username already taken
    const existingUsername = await User.findOne({
      username: { $regex: new RegExp(`^${normalizedUsername}$`, "i") },
    }).lean();
    if (existingUsername) {
      return NextResponse.json(
        {
          success: false,
          code: "USERNAME_EXISTS",
          error: "That username is already taken.",
          message: "That username is already taken.",
        },
        { status: 409 }
      );
    }

    // 7. Hash password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 8. Create user document in deployx_db
    const newUser = await User.create({
      name: fullName.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      status: "active",
      lastLogin: new Date(),
    });

    // 9. Issue fresh authenticated session cookie
    const sessionToken = await createSession(newUser._id.toString());

    const response = NextResponse.json(
      {
        success: true,
        message: "Account created successfully",
        user: {
          id: newUser._id.toString(),
          name: newUser.name,
          username: newUser.username,
          email: newUser.email,
        },
      },
      { status: 201 }
    );

    response.cookies.set("session", sessionToken, {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      maxAge: 7 * 24 * 60 * 60,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch (error: unknown) {
    // Handle MongoDB duplicate key error (E11000) race conditions cleanly
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ((error as { code: unknown }).code === 11000 || (error as { code: unknown }).code === "11000")
    ) {
      const errObj = error as { message?: string; keyPattern?: Record<string, unknown> };
      const isEmail =
        errObj.message?.includes("email") ||
        (errObj.keyPattern && "email" in errObj.keyPattern);

      return NextResponse.json(
        {
          success: false,
          code: isEmail ? "EMAIL_EXISTS" : "USERNAME_EXISTS",
          error: isEmail
            ? "An account with this email already exists."
            : "That username is already taken.",
          message: isEmail
            ? "An account with this email already exists."
            : "That username is already taken.",
        },
        { status: 409 }
      );
    }

    const errMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Auth/Signup] Unexpected error:", errMessage);

    return NextResponse.json(
      {
        success: false,
        code: "INTERNAL_ERROR",
        error: "Unable to create your account right now. Please try again.",
        message: "Unable to create your account right now. Please try again.",
      },
      { status: 500 }
    );
  }
}
