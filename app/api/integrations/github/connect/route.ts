import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { createOAuthState, OAUTH_STATE_COOKIE_NAME, OAUTH_STATE_MAX_AGE } from "@/lib/auth/oauth-state";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { getGitHubOAuthConfig } from "@/lib/github/oauth-config";

export async function GET(req: Request) {
  try {
    const userId = await requireAuth(req);
    const url = new URL(req.url);

    // Rate limit connection initiations per user (max 10 / minute)
    const rl = checkRateLimit(`gh_connect:${userId}`, 10, 60 * 1000);
    const returnToParam = url.searchParams.get("returnTo") || url.searchParams.get("next");
    const { state, encryptedCookie, returnTo } = createOAuthState(userId, returnToParam);

    if (!rl.allowed) {
      const redirectUrl = new URL(returnTo, req.url);
      redirectUrl.searchParams.set("error", "Too many GitHub connection attempts. Please wait a minute and try again.");
      return NextResponse.redirect(redirectUrl);
    }

    const { clientId, clientSecret, callbackUrl, isConfigured } = getGitHubOAuthConfig(url.origin);

    if (!isConfigured) {
      const redirectUrl = new URL(returnTo, req.url);
      redirectUrl.searchParams.set("error", "GitHub OAuth App is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.");
      return NextResponse.redirect(redirectUrl);
    }

    // Request permissions: 'read:user' for profile display, 'repo' for project cloning and build detection
    const requestedScope = url.searchParams.get("scope") === "public" ? "read:user" : "read:user,repo";

    const githubAuthorizeUrl = new URL("https://github.com/login/oauth/authorize");
    githubAuthorizeUrl.searchParams.set("client_id", clientId);
    githubAuthorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    githubAuthorizeUrl.searchParams.set("scope", requestedScope);
    githubAuthorizeUrl.searchParams.set("state", state);

    const response = NextResponse.redirect(githubAuthorizeUrl);
    response.cookies.set(OAUTH_STATE_COOKIE_NAME, encryptedCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: OAUTH_STATE_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("GitHub connect initiation error:", error);
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
}
