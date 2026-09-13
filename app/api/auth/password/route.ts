import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Current and new passwords are required" }, { status: 400 });
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
    await user.save();

    // Log Activity
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId: session.userId,
      type: "password_changed",
      title: "Password Changed",
      description: "Your account password was updated successfully.",
      icon: "Shield",
      color: "text-emerald-500",
    });

    return NextResponse.json({ message: "Password updated successfully" }, { status: 200 });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
