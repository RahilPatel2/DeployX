import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";
import { decryptToken } from "@/lib/auth/encryption";

export async function GET(req: Request) {
  try {
    const userId = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const repo = searchParams.get("repo")?.trim();

    if (!repo) {
      return NextResponse.json({ error: "Repository parameter is required (e.g. 'owner/repo')" }, { status: 400 });
    }

    // Validate format: owner/name
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
      return NextResponse.json({ error: "Invalid repository format. Expected 'owner/repo'." }, { status: 400 });
    }

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "100", 10)));

    await connectToDatabase();

    const integration = await Integration.findOne({ userId, provider: "github" });
    if (!integration) {
      return NextResponse.json({ error: "GitHub not connected. Please connect your GitHub account." }, { status: 404 });
    }

    let token: string;
    try {
      token = decryptToken(integration.accessToken);
    } catch {
      return NextResponse.json(
        { error: "Could not decrypt GitHub credentials. Please reconnect your account." },
        { status: 401 }
      );
    }

    const cleanRepoPath = repo.split("/").map(encodeURIComponent).join("/");

    // 1. Fetch repository metadata to determine official default_branch and accessibility
    const repoRes = await fetch(`https://api.github.com/repos/${cleanRepoPath}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DeployX-Platform",
      },
    });

    if (!repoRes.ok) {
      if (repoRes.status === 401) {
        await Integration.deleteOne({ _id: integration._id });
        return NextResponse.json(
          { error: "GitHub token has expired or been revoked. Please reconnect your account." },
          { status: 401 }
        );
      }
      if (repoRes.status === 404) {
        return NextResponse.json(
          { error: `Repository '${repo}' not found or you do not have permission to access it.` },
          { status: 404 }
        );
      }
      if (repoRes.status === 403) {
        const remainingRate = repoRes.headers.get("x-ratelimit-remaining");
        if (remainingRate === "0") {
          return NextResponse.json({ error: "GitHub API rate limit exceeded. Please wait a moment." }, { status: 429 });
        }
        return NextResponse.json(
          { error: `Access forbidden for repository '${repo}'. Ensure repository permissions are granted.` },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: `GitHub error: ${repoRes.statusText}` }, { status: repoRes.status });
    }

    const repoInfo = await repoRes.json();
    const defaultBranch = repoInfo.default_branch || "main";

    // 2. Fetch branches for the repository
    const branchesRes = await fetch(
      `https://api.github.com/repos/${cleanRepoPath}/branches?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "DeployX-Platform",
        },
      }
    );

    if (!branchesRes.ok) {
      // 409 Conflict indicates an empty repository (no git commits or branches)
      if (branchesRes.status === 409) {
        return NextResponse.json({
          repository: repo,
          defaultBranch,
          branches: [],
          isEmpty: true,
          message: "Repository is empty. Push at least one commit before importing.",
        });
      }
      return NextResponse.json({ error: `Failed to fetch branches from GitHub: ${branchesRes.statusText}` }, { status: branchesRes.status });
    }

    const linkHeader = branchesRes.headers.get("link") || "";
    const hasMore = linkHeader.includes('rel="next"');

    const rawBranches = await branchesRes.json();
    interface RawBranch {
      name: string;
      commit?: { sha?: string };
      protected?: boolean;
    }

    const branchesList = (rawBranches as RawBranch[]).map((b) => ({
      name: b.name,
      isDefault: b.name === defaultBranch,
      protected: !!b.protected,
      commitSha: b.commit?.sha || undefined,
    }));

    // Ensure default branch is at the top of the list if present
    branchesList.sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      repository: repo,
      defaultBranch,
      branches: branchesList,
      isEmpty: branchesList.length === 0,
      hasMore,
    });
  } catch (error) {
    console.error("GitHub branches fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
