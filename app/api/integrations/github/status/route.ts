import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";

export async function GET() {
  try {
    const userId = await requireAuth();
    await connectToDatabase();

    const integration = await Integration.findOne({ userId, provider: 'github' });
    
    return NextResponse.json({ connected: !!integration });
  } catch (error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
