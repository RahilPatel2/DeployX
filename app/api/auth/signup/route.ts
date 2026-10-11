import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { createSession } from "@/lib/auth/session";
import * as z from "zod";

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and dashes"),
  email: z.string().trim().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
});

export async function POST(req: Request) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          code: "VALIDATION_ERROR",
          error: "Invalid request payload",
          message: "Invalid request payload",
        },
        { status: 400 }
      );
    }

    // Validate payload
    const parsedData = signupSchema.safeParse(body);
    if (!parsedData.success) {
      const firstIssue = parsedData.error.issues[0]?.message || "Invalid data provided";
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

    // Connect to database
    try {
      await connectToDatabase();
    } catch (dbError: any) {
      console.error("[Auth/Signup] Database connection error:", {
        type: dbError?.name || "MongoConnectionError",
        message: dbError?.message || "Failed to connect to database",
      });
      return NextResponse.json(
        {
          success: false,
          code: "INTERNAL_ERROR",
          error: "Database service temporarily unavailable. Please try again shortly.",
          message: "Database service temporarily unavailable. Please try again shortly.",
        },
        { status: 500 }
      );
    }

    // Check for existing user by email
    const existingEmail = await User.findOne({ email: normalizedEmail });
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

    // Check for existing user by username (case-insensitive)
    const existingUsername = await User.findOne({
      username: { $regex: new RegExp(`^${normalizedUsername}$`, "i") },
    });
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

    // Hash password securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user in MongoDB
    const newUser = await User.create({
      name: fullName.trim(),
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      lastLogin: new Date(),
    });

    // Create authenticated session
    await createSession(newUser._id.toString());

    return NextResponse.json(
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
  } catch (error: any) {
    // Handle MongoDB duplicate key error (E11000)
    if (error && typeof error === "object" && (error.code === 11000 || error.code === "11000")) {
      const isEmail = error.message?.includes("email") || (error.keyPattern && "email" in error.keyPattern);
      return NextResponse.json(
        {
          success: false,
          code: isEmail ? "EMAIL_EXISTS" : "USERNAME_EXISTS",
          error: isEmail ? "An account with this email already exists." : "That username is already taken.",
          message: isEmail ? "An account with this email already exists." : "That username is already taken.",
        },
        { status: 409 }
      );
    }

    console.error("[Auth/Signup] Unexpected signup error:", {
      type: error?.name || "UnknownError",
      message: error?.message || "Unknown error occurred",
    });

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
