import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    
    const user = await User.findById(session.userId).select('-passwordHash');
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, email, avatar, phone, bio } = body;

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (avatar !== undefined) user.avatar = avatar;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;

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
  } catch (error) {
    console.error("Profile PUT error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
