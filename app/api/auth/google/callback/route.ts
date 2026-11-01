import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import connectToDatabase from "@/lib/mongodb/client";
import User from "@/models/User";
import Integration from "@/models/Integration";
import AuthChallenge from "@/models/AuthChallenge";
import Activity from "@/models/Activity";
import {
  getGoogleOAuthConfig,
  verifyGoogleOAuthSession,
  exchangeGoogleCodeForTokens,
  getGoogleUserProfile,
  GOOGLE_OAUTH_COOKIE_NAME,
} from "@/lib/auth/google";
import { rotateSession, createSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const stateCookie = req.cookies.get(GOOGLE_OAUTH_COOKIE_NAME)?.value;

  const clearCookieResponse = (redirectUrl: URL) => {
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete(GOOGLE_OAUTH_COOKIE_NAME);
    return res;
  };

  if (oauthError) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("error", `Google authentication failed: ${oauthError}`);
    return clearCookieResponse(redirectUrl);
  }

  if (!code || !state || !stateCookie) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("error", "Invalid or missing Google authorization parameters.");
    return clearCookieResponse(redirectUrl);
  }

  const sessionPayload = verifyGoogleOAuthSession(state, stateCookie);
  if (!sessionPayload) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("error", "Google authorization session expired or tampered.");
    return clearCookieResponse(redirectUrl);
  }

  try {
    const { clientId, clientSecret, callbackUrl } = getGoogleOAuthConfig(url.origin);
    const tokens = await exchangeGoogleCodeForTokens(
      code,
      sessionPayload.codeVerifier,
      clientId,
      clientSecret,
      callbackUrl
    );

    const profile = await getGoogleUserProfile(tokens.access_token);

    if (!profile.email_verified) {
      const redirectUrl = new URL("/login", req.url);
      redirectUrl.searchParams.set("error", "Your Google email address must be verified by Google to sign in.");
      return clearCookieResponse(redirectUrl);
    }

    await connectToDatabase();
    const normalizedEmail = profile.email.toLowerCase().trim();

    // ------------------------------------------------------------------------
    // CASE 1: CONNECT GOOGLE ACCOUNT FROM SETTINGS
    // ------------------------------------------------------------------------
    if (sessionPayload.mode === "connect") {
      if (!sessionPayload.userId) {
        const redirectUrl = new URL("/login?error=Session+lost.+Please+log+in+again.", req.url);
        return clearCookieResponse(redirectUrl);
      }

      // Check if this Google identity is already connected to another user
      const existingLinkedUser = await User.findOne({ googleId: profile.sub });
      if (existingLinkedUser && existingLinkedUser._id.toString() !== sessionPayload.userId) {
        const redirectUrl = new URL("/dashboard/settings/security", req.url);
        redirectUrl.searchParams.set(
          "error",
          "This Google account is already linked to another DeployX user."
        );
        return clearCookieResponse(redirectUrl);
      }

      // Update current user
      const updatedUser = await User.findByIdAndUpdate(
        sessionPayload.userId,
        {
          $set: {
            googleId: profile.sub,
            googleEmail: normalizedEmail,
            googleConnectedAt: new Date(),
          },
        },
        { new: true }
      );

      if (!updatedUser) {
        const redirectUrl = new URL("/dashboard/settings/security?error=User+not+found.", req.url);
        return clearCookieResponse(redirectUrl);
      }

      // Record Integration
      await Integration.findOneAndUpdate(
        { userId: updatedUser._id, provider: "google" },
        {
          $set: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            providerAccountId: profile.sub,
            metadata: {
              email: normalizedEmail,
              name: profile.name,
              connectedAt: new Date(),
            },
          },
        },
        { upsert: true, new: true }
      );

      // Audit activity
      await Activity.create({
        userId: updatedUser._id,
        type: "security_google_connected",
        title: "Google Account Connected",
        description: `Connected Google identity (${normalizedEmail})`,
        icon: "ShieldCheck",
      });

      const redirectUrl = new URL(sessionPayload.returnTo || "/dashboard/settings/security", req.url);
      redirectUrl.searchParams.set("success", "Google account successfully connected.");
      return clearCookieResponse(redirectUrl);
    }

    // ------------------------------------------------------------------------
    // CASE 2: LOGIN / SIGNUP VIA GOOGLE
    // ------------------------------------------------------------------------
    const user = await User.findOne({ googleId: profile.sub });

    if (user) {
      // User found via Google ID - Check if DeployX MFA is enabled!
      if (user.mfaEnabled) {
        // Issue MFA Challenge token (5-minute expiry)
        const challengeToken = crypto.randomBytes(32).toString("hex");
        await AuthChallenge.create({
          challengeToken,
          userId: user._id,
          type: "mfa_login",
          provider: "google",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
          returnTo: sessionPayload.returnTo || "/dashboard",
        });

        const mfaUrl = new URL("/login/mfa", req.url);
        mfaUrl.searchParams.set("challenge", challengeToken);
        mfaUrl.searchParams.set("returnTo", sessionPayload.returnTo || "/dashboard");
        return clearCookieResponse(mfaUrl);
      }

      // No MFA enabled: issue fully authenticated session cookie directly
      const sessionToken = await rotateSession(user._id.toString());
      user.lastLogin = new Date();
      await user.save();

      const redirectUrl = new URL(sessionPayload.returnTo || "/dashboard", req.url);
      const res = NextResponse.redirect(redirectUrl);
      res.cookies.delete(GOOGLE_OAUTH_COOKIE_NAME);
      res.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
      return res;
    }

    // User NOT found by googleId: Check if an email matches an existing account
    const existingByEmail = await User.findOne({ email: normalizedEmail });
    if (existingByEmail) {
      // ACCOUNT LINKING RULE:
      // Do not automatically link accounts solely because their email addresses match!
      // Require user to sign in with their existing credentials first.
      const redirectUrl = new URL("/login", req.url);
      redirectUrl.searchParams.set(
        "error",
        "An account with this email address already exists. Please sign in with your password to link your Google account in Settings."
      );
      redirectUrl.searchParams.set("email", normalizedEmail);
      return clearCookieResponse(redirectUrl);
    }

    // No existing account: Register fresh user via Google
    let baseUsername = normalizedEmail.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
    if (!baseUsername) baseUsername = "user";

    // Ensure username uniqueness
    let username = baseUsername;
    let suffix = 1;
    while (await User.findOne({ username })) {
      username = `${baseUsername}${suffix++}`;
    }

    const placeholderPasswordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

    const newUser = await User.create({
      name: profile.name || username,
      username,
      email: normalizedEmail,
      passwordHash: placeholderPasswordHash,
      googleId: profile.sub,
      googleEmail: normalizedEmail,
      googleConnectedAt: new Date(),
      emailVerified: new Date(),
      avatar: profile.picture || "",
      status: "active",
      role: "user",
      tokenVersion: 0,
    });

    await Activity.create({
      userId: newUser._id,
      type: "user_registered_google",
      title: "Account Created via Google",
      description: `Welcome to DeployX! Signed up with Google (${normalizedEmail})`,
      icon: "UserPlus",
    });

    const sessionToken = await createSession(newUser._id.toString());
    const redirectUrl = new URL("/dashboard", req.url);
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.delete(GOOGLE_OAUTH_COOKIE_NAME);
    res.cookies.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
    return res;
  } catch (error) {
    console.error("[Google OAuth Callback Error]", error);
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set(
      "error",
      error instanceof Error ? error.message : "Failed to complete Google authentication."
    );
    return clearCookieResponse(redirectUrl);
  }
}
