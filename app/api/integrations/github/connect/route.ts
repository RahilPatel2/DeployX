import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";

export async function GET(req: Request) {
  try {
    await requireAuth();
    
    const clientId = process.env.GITHUB_CLIENT_ID;
    
    if (!clientId) {
      const url = new URL("/dashboard/projects/new", req.url);
      url.searchParams.set("error", "GitHub OAuth App is not configured. Please set GITHUB_CLIENT_ID in your environment.");
      return NextResponse.redirect(url);
    }

    const redirectUri = `${new URL(req.url).origin}/api/integrations/github/callback`;
    const githubUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user`;

    return NextResponse.redirect(githubUrl);
  } catch (error) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
}
