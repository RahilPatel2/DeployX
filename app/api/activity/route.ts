import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Activity from "@/models/Activity";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDatabase();
    
    const activities = await Activity.find({ userId: session.userId }).sort({ createdAt: -1 }).limit(50).lean();

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Activity GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
