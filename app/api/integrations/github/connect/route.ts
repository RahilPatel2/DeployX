import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import crypto from "crypto";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    await requireAuth();
    
    const clientId = process.env.GITHUB_CLIENT_ID;
    
    if (!clientId) {
      const url = new URL("/dashboard/projects/new", req.url);
      url.searchParams.set("error", "GitHub OAuth App is not configured. Please set GITHUB_CLIENT_ID in your environment.");
      return NextResponse.redirect(url);
    }

    const state = crypto.randomBytes(16).toString("hex");
    
    // Using cookies() returns a Promise in Next.js 16/15
    const cookieStore = await cookies();
    cookieStore.set("github_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 10 // 10 minutes
    });

    const redirectUri = `${new URL(req.url).origin}/api/integrations/github/callback`;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${state}`;

    return NextResponse.redirect(githubUrl);
  } catch (error) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
}
