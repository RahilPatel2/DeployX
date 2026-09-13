import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";

export async function GET() {
  try {
    const userId = await requireAuth();
    await connectToDatabase();

    const integration = await Integration.findOne({ userId, provider: 'github' });
    
    if (!integration) {
      return NextResponse.json({ error: "GitHub not connected" }, { status: 404 });
    }

    const reposRes = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!reposRes.ok) {
      if (reposRes.status === 401) {
        // Token expired or revoked
        await Integration.deleteOne({ _id: integration._id });
        return NextResponse.json({ error: "GitHub token expired. Please reconnect." }, { status: 401 });
      }
      return NextResponse.json({ error: "Failed to fetch repositories" }, { status: reposRes.status });
    }

    const repos = await reposRes.json();

    const formattedRepos = repos.map((repo: any) => ({
      id: repo.id,
      full_name: repo.full_name,
      name: repo.name,
      private: repo.private,
      language: repo.language,
      default_branch: repo.default_branch,
      updated_at: repo.updated_at,
    }));

    return NextResponse.json({ repos: formattedRepos });
  } catch (error) {
    console.error("GitHub repos fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
