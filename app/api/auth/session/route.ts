import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    await connectToDatabase();
    
    // Omit password hash
    const user = await User.findById(session.userId).select("-passwordHash");
    
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error("Session error:", error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
