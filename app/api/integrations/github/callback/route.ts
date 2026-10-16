import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import connectToDatabase from "@/lib/mongodb/client";
import Integration from "@/models/Integration";
import { requireAuth } from "@/lib/auth/session";
import { verifyOAuthState, OAUTH_STATE_COOKIE_NAME } from "@/lib/auth/oauth-state";
import { encryptToken } from "@/lib/auth/encryption";
import { getGitHubOAuthConfig } from "@/lib/github/oauth-config";

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireAuth(req);
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const ghError = url.searchParams.get("error");
  const ghErrorDesc = url.searchParams.get("error_description");

  // Read state cookie safely
  let stateCookie: string | undefined;
  try {
    const cookieStore = await cookies();
    stateCookie = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;
  } catch {
    // cookies() unavailable outside request scope
  }

  if (!stateCookie) {
    const cookieHeader = req.headers.get("cookie");
    if (cookieHeader) {
      const match = cookieHeader.match(new RegExp(`${OAUTH_STATE_COOKIE_NAME}=([^;]+)`));
      if (match) stateCookie = decodeURIComponent(match[1]);
    }
  }

  const stateResult = verifyOAuthState(stateCookie, state, userId);
  const returnTo = stateResult.returnTo;

  // Handle GitHub consent denial or user cancellation
  if (ghError) {
    const errorMsg =
      ghError === "access_denied"
        ? "GitHub authorization was cancelled or denied."
        : ghErrorDesc || "GitHub authorization failed.";

    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set("error", errorMsg);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  // Validate state
  if (!stateResult.valid) {
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set("error", stateResult.error || "Invalid or expired OAuth state.");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  // Check code presence
  if (!code) {
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set("error", "No authorization code received from GitHub.");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  const { clientId, clientSecret, callbackUrl, isConfigured } = getGitHubOAuthConfig(url.origin);

  if (!isConfigured) {
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set("error", "Server configuration error: GitHub credentials missing.");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }

  try {

    // 1. Exchange authorization code for access token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "DeployX-Platform",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      const redirectUrl = new URL(returnTo, req.url);
      redirectUrl.searchParams.set("error", "Failed to connect to GitHub token service.");
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      const redirectUrl = new URL(returnTo, req.url);
      redirectUrl.searchParams.set(
        "error",
        tokenData.error_description || "GitHub authorization code exchange failed."
      );
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      const redirectUrl = new URL(returnTo, req.url);
      redirectUrl.searchParams.set("error", "No access token returned from GitHub.");
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    // 2. Fetch authenticated GitHub user details
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DeployX-Platform",
      },
    });

    if (!userRes.ok) {
      const redirectUrl = new URL(returnTo, req.url);
      redirectUrl.searchParams.set("error", "Failed to retrieve GitHub profile details.");
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    const githubUser = await userRes.json();
    const providerAccountId = String(githubUser.id);

    await connectToDatabase();

    // 3. Multi-tenant account safety: ensure this GitHub account is not already linked to another DeployX user
    const conflictingIntegration = await Integration.findOne({
      provider: "github",
      providerAccountId,
      userId: { $ne: userId },
    });

    if (conflictingIntegration) {
      const redirectUrl = new URL(returnTo, req.url);
      redirectUrl.searchParams.set(
        "error",
        "This GitHub account is already connected to another DeployX account."
      );
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
      return response;
    }

    // 4. Encrypt token at rest
    const encryptedAccessToken = encryptToken(accessToken);

    const scopesHeader = userRes.headers.get("x-oauth-scopes");
    const grantedScopes = scopesHeader
      ? scopesHeader.split(",").map((s) => s.trim())
      : tokenData.scope
      ? String(tokenData.scope).split(",").map((s: string) => s.trim())
      : ["read:user", "repo"];

    // 5. Store or update integration in MongoDB
    await Integration.findOneAndUpdate(
      { userId, provider: "github" },
      {
        accessToken: encryptedAccessToken,
        providerAccountId,
        metadata: {
          username: githubUser.login,
          name: githubUser.name || githubUser.login,
          avatarUrl: githubUser.avatar_url,
          profileUrl: githubUser.html_url,
          email: githubUser.email || null,
          scopes: grantedScopes,
        },
      },
      { upsert: true, new: true }
    );

    // 6. Record audit activity
    const Activity = (await import("@/models/Activity")).default;
    await Activity.create({
      userId,
      type: "github_connected",
      title: "GitHub Connected",
      description: `Connected GitHub account @${githubUser.login}.`,
      icon: "Github",
      color: "text-emerald-500",
    });

    // 7. Successful redirect
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set("success", `GitHub account @${githubUser.login} connected successfully.`);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  } catch (err: unknown) {
    console.error("GitHub callback processing error:", err);
    const redirectUrl = new URL(returnTo, req.url);
    redirectUrl.searchParams.set("error", "An unexpected error occurred while completing GitHub integration.");
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE_NAME);
    return response;
  }
}
