import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import { getSession } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId || !mongoose.isValidObjectId(session.userId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || !body.sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const { sessionId } = body;

    await connectToDatabase();

    const user = await User.findById(session.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (Array.isArray(user.sessions)) {
      user.sessions = user.sessions.filter((s: { sessionId: string }) => s.sessionId !== sessionId);
      await user.save();
    }

    return NextResponse.json(
      { success: true, message: "Target session revoked successfully." },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("[Session Revoke Error]:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
