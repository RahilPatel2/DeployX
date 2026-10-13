import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    
    const user = await User.findById(session.userId).select("-passwordHash").lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Profile GET error]:", errMessage);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, avatar, phone, bio } = body;

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (name !== undefined) user.name = String(name).trim().slice(0, 64);
    if (avatar !== undefined) user.avatar = String(avatar).slice(0, 200000); // 200KB limit
    if (phone !== undefined) user.phone = String(phone).trim().slice(0, 32);
    if (bio !== undefined) user.bio = String(bio).trim().slice(0, 500);

    await user.save();

    // Log activity
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId: session.userId,
      type: "profile_updated",
      title: "Profile updated",
      description: "You updated your profile information.",
      icon: "User",
      color: "text-blue-500",
    });

    const userObj = user.toObject();
    delete userObj.passwordHash;

    return NextResponse.json({ user: userObj });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[Profile PUT error]:", errMessage);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
