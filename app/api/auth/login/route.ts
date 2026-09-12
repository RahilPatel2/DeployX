import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { createSession } from "@/lib/auth/session";
import * as z from "zod";

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const parsedData = loginSchema.safeParse(body);
    if (!parsedData.success) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 400 }
      );
    }
    
    const { identifier, password } = parsedData.data;

    await connectToDatabase();

    // Find by email or username
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (!user) {
      return NextResponse.json(
        { error: "Incorrect username or password." },
        { status: 401 }
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

    // Update lastLogin
    user.lastLogin = new Date();
    await user.save();

    // Create secure session
    await createSession(user._id.toString());

    return NextResponse.json(
      { message: "Logged in successfully" },
      { status: 200 }
    );

  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
