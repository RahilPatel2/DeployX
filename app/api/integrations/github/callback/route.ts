import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    const userId = await requireAuth();
    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(new URL("/dashboard/projects/new?error=No+code+provided", req.url));
    }

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL("/dashboard/projects/new?error=Missing+GitHub+Credentials", req.url));
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      return NextResponse.redirect(new URL(`/dashboard/projects/new?error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`, req.url));
    }

    const accessToken = tokenData.access_token;

    // Get GitHub User Info
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    
    const githubUser = await userRes.json();

    await connectToDatabase();

    await Integration.findOneAndUpdate(
      { userId, provider: 'github' },
      { 
        accessToken, 
        providerAccountId: githubUser.id.toString(),
        metadata: { username: githubUser.login }
      },
      { upsert: true, new: true }
    );

    // Log Activity
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId,
      type: "github_connected",
      title: "GitHub Connected",
      description: `Connected GitHub account ${githubUser.login}.`,
      icon: "Github",
      color: "text-neutral-500",
    });

    return NextResponse.redirect(new URL("/dashboard/projects/new", req.url));
  } catch (error) {
    console.error("GitHub callback error:", error);
    return NextResponse.redirect(new URL("/dashboard/projects/new?error=Integration+failed", req.url));
  }
}
