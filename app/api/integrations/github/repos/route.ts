import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";
import { decryptToken } from "@/lib/auth/encryption";

export async function GET(req: Request) {
  try {
    const userId = await requireAuth(req);
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("per_page") || "50", 10)));
    const searchQuery = searchParams.get("search")?.toLowerCase().trim() || "";
    const visibilityFilter = searchParams.get("visibility")?.toLowerCase().trim(); // 'public' | 'private' | 'all'

    await connectToDatabase();

    const integration = await Integration.findOne({ userId, provider: "github" });

    if (!integration) {
      return NextResponse.json(
        { error: "GitHub not connected. Please connect your GitHub account in settings or import." },
        { status: 404 }
      );
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

    // Build query to GitHub's official user repos endpoint
    const ghUrl = new URL("https://api.github.com/user/repos");
    ghUrl.searchParams.set("sort", "updated");
    ghUrl.searchParams.set("direction", "desc");
    ghUrl.searchParams.set("per_page", String(perPage));
    ghUrl.searchParams.set("page", String(page));
    ghUrl.searchParams.set("affiliation", "owner,collaborator,organization_member");

    if (visibilityFilter === "public" || visibilityFilter === "private") {
      ghUrl.searchParams.set("visibility", visibilityFilter);
    }

    const reposRes = await fetch(ghUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DeployX-Platform",
      },
    });

    if (!reposRes.ok) {
      const remainingRateLimit = reposRes.headers.get("x-ratelimit-remaining");
      if (reposRes.status === 403 && remainingRateLimit === "0") {
        return NextResponse.json(
          { error: "GitHub API rate limit exceeded. Please wait a few moments and try again." },
          { status: 429 }
        );
      }

      if (reposRes.status === 401) {
        // Token expired or revoked on GitHub
        await Integration.deleteOne({ _id: integration._id });
        return NextResponse.json(
          { error: "GitHub token has expired or been revoked. Please reconnect your account." },
          { status: 401 }
        );
      }

      if (reposRes.status === 403) {
        return NextResponse.json(
          { error: "Insufficient permissions to list repositories for this GitHub account." },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: `GitHub API error (${reposRes.status}): ${reposRes.statusText}` },
        { status: reposRes.status }
      );
    }

    const reposData = await reposRes.json();
    const linkHeader = reposRes.headers.get("link") || "";
    const hasMore = linkHeader.includes('rel="next"');

    interface RawGitHubRepo {
      id: number;
      full_name: string;
      name: string;
      description: string | null;
      private: boolean;
      visibility?: string;
      html_url: string;
      language: string | null;
      default_branch: string;
      updated_at: string;
      permissions?: {
        admin?: boolean;
        push?: boolean;
        pull?: boolean;
      };
      owner?: {
        login: string;
        avatar_url: string;
      };
    }

    let formattedRepos = (reposData as RawGitHubRepo[]).map((repo) => ({
      id: repo.id,
      full_name: repo.full_name,
      name: repo.name,
      description: repo.description || null,
      private: repo.private,
      visibility: (repo.visibility as "public" | "private") || (repo.private ? "private" : "public"),
      html_url: repo.html_url,
      language: repo.language || null,
      default_branch: repo.default_branch || "main",
      updated_at: repo.updated_at,
      permissions: repo.permissions
        ? {
            admin: !!repo.permissions.admin,
            push: !!repo.permissions.push,
            pull: !!repo.permissions.pull,
          }
        : undefined,
      owner: {
        login: repo.owner?.login || repo.full_name.split("/")[0] || "unknown",
        avatar_url: repo.owner?.avatar_url || "https://github.com/ghost.png",
      },
    }));

    // Apply search filter if query is present
    if (searchQuery) {
      formattedRepos = formattedRepos.filter(
        (r) =>
          r.name.toLowerCase().includes(searchQuery) ||
          r.full_name.toLowerCase().includes(searchQuery) ||
          (r.description && r.description.toLowerCase().includes(searchQuery))
      );
    }

    return NextResponse.json({
      repos: formattedRepos,
      page,
      perPage,
      hasMore,
      total: formattedRepos.length,
    });
  } catch (error) {
    console.error("GitHub repos fetch error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
