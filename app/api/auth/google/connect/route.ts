import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  getGoogleOAuthConfig,
  createGoogleOAuthSession,
  buildGoogleAuthorizeUrl,
  GOOGLE_OAUTH_COOKIE_NAME,
  GOOGLE_OAUTH_MAX_AGE,
} from "@/lib/auth/google";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { isProductionSecure } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rl = checkRateLimit(`google_connect:${ip}`, 10, 60000);

    const mode = (url.searchParams.get("mode") as "login" | "signup" | "connect") || "login";
    const rawReturnTo = url.searchParams.get("returnTo");

    let userId: string | undefined;
    if (mode === "connect") {
      const session = await getSession(req);
      if (!session || !session.userId) {
        return NextResponse.redirect(new URL("/login?error=Please+sign+in+first", req.url));
      }
      userId = session.userId;
    }

    const { clientId, callbackUrl, isConfigured } = getGoogleOAuthConfig(url.origin);

    if (!rl.allowed) {
      const fallback = mode === "connect" ? "/dashboard/settings/security" : "/login";
      const redirectUrl = new URL(rawReturnTo || fallback, req.url);
      redirectUrl.searchParams.set("error", "Too many attempts. Please wait a minute and try again.");
      return NextResponse.redirect(redirectUrl);
    }

    if (!isConfigured) {
      const fallback = mode === "connect" ? "/dashboard/settings/security" : "/login";
      const redirectUrl = new URL(rawReturnTo || fallback, req.url);
      redirectUrl.searchParams.set(
        "error",
        "Google OAuth is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
      );
      return NextResponse.redirect(redirectUrl);
    }

    const { state, codeChallenge, nonce, encryptedCookie } = createGoogleOAuthSession(
      mode,
      userId,
      rawReturnTo
    );

    const authorizeUrl = buildGoogleAuthorizeUrl(
      clientId,
      callbackUrl,
      state,
      codeChallenge,
      nonce
    );

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(GOOGLE_OAUTH_COOKIE_NAME, encryptedCookie, {
      httpOnly: true,
      secure: isProductionSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: GOOGLE_OAUTH_MAX_AGE,
    });

    return response;
  } catch (error) {
    console.error("[Google OAuth Connect Error]", error);
    return NextResponse.redirect(new URL("/login?error=Failed+to+initiate+Google+Sign-In", req.url));
  }
}
