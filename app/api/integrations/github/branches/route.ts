import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const userId = await requireAuth();
    const { searchParams } = new URL(req.url);
    const repo = searchParams.get("repo");

    if (!repo) {
      return NextResponse.json({ error: "Repository is required" }, { status: 400 });
    }

    await connectToDatabase();

    const integration = await Integration.findOne({ userId, provider: 'github' });
    if (!integration) {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 404 });
    }

    const branchesRes = await fetch(`https://api.github.com/repos/${repo}/branches`, {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!branchesRes.ok) {
      return NextResponse.json({ error: "Failed to fetch branches" }, { status: branchesRes.status });
    }

    const branches = await branchesRes.json();
    return NextResponse.json({ branches: branches.map((b: any) => ({ name: b.name, protected: b.protected })) });
  } catch (error) {
    console.error("GitHub branches fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
