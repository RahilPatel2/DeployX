import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Activity from "@/models/Activity";
import { getSession } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const session = await getSession(req);
    if (!session || !session.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);
    const skip = (page - 1) * limit;

    await connectToDatabase();
    
    const [activities, total] = await Promise.all([
      Activity.find({ userId: session.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Activity.countDocuments({ userId: session.userId }),
    ]);

    return NextResponse.json({ activities, total, page, limit });
  } catch (error) {
    console.error("Activity GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
