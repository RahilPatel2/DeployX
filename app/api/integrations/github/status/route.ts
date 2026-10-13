import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";
import { decryptToken } from "@/lib/auth/encryption";

export async function GET(req: Request) {
  try {
    const userId = await requireAuth(req);
    await connectToDatabase();

    const integration = await Integration.findOne({ userId, provider: "github" }).lean();

    if (!integration) {
      return NextResponse.json({
        connected: false,
        username: null,
        name: null,
        avatarUrl: null,
        profileUrl: null,
        connectedAt: null,
        scopes: [],
      });
    }

    const metadata = (integration.metadata as Record<string, unknown>) || {};

    return NextResponse.json({
      connected: true,
      username: metadata.username || null,
      name: metadata.name || null,
      avatarUrl: metadata.avatarUrl || null,
      profileUrl: metadata.profileUrl || null,
      connectedAt: integration.createdAt || null,
      scopes: metadata.scopes || [],
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await requireAuth(req);
    await connectToDatabase();

    const integration = await Integration.findOne({ userId, provider: "github" });

    if (!integration) {
      return NextResponse.json({ success: true, message: "No GitHub integration found to disconnect." });
    }

    // Attempt to revoke the OAuth application grant on GitHub's side
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

    if (clientId && clientSecret && integration.accessToken) {
      try {
        const rawToken = decryptToken(integration.accessToken);
        const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        await fetch(`https://api.github.com/applications/${clientId}/grant`, {
          method: "DELETE",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "DeployX-Platform",
          },
          body: JSON.stringify({ access_token: rawToken }),
        });
      } catch (revokeErr) {
        // Log safely without leaking token or credentials
        console.warn("GitHub remote grant revocation warning:", revokeErr instanceof Error ? revokeErr.message : "Network error");
      }
    }

    // Delete local integration document
    await Integration.deleteOne({ _id: integration._id });

    // Record activity audit log
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId,
      type: "github_disconnected",
      title: "GitHub Disconnected",
      description: `Disconnected GitHub account @${integration.metadata?.username || "account"}.`,
      icon: "Github",
      color: "text-muted-foreground",
    });

    return NextResponse.json({ success: true, message: "GitHub integration disconnected successfully." });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
