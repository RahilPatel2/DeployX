import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";
import { detectFramework, sanitizeRootDirectory } from "@/lib/github/framework";

export async function GET(req: Request) {
  try {
    const userId = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const repo = searchParams.get("repo");
    const branch = searchParams.get("branch") || "main";
    const rawRootDir = searchParams.get("rootDir") || searchParams.get("rootDirectory") || "";

    if (!repo || !repo.includes("/")) {
      return NextResponse.json(
        { error: "Valid repository in 'owner/repo' format is required" },
        { status: 400 }
      );
    }

    const [owner, repoName] = repo.split("/");
    const rootDir = sanitizeRootDirectory(rawRootDir);

    await connectToDatabase();

    const integration = await Integration.findOne({ userId, provider: "github" });
    if (!integration) {
      return NextResponse.json({ error: "GitHub account not connected" }, { status: 404 });
    }

    try {
      const result = await detectFramework(
        integration.accessToken,
        owner,
        repoName,
        branch,
        rootDir
      );

      return NextResponse.json(result);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      if (errorMsg.includes("401") || errorMsg.includes("Bad credentials")) {
        await Integration.deleteOne({ _id: integration._id });
        return NextResponse.json(
          { error: "GitHub token has expired or been revoked. Please reconnect your account." },
          { status: 401 }
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    console.error("GitHub framework detection route error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
