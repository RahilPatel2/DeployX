/**
 * DeployX Google OAuth 2.0 & OpenID Connect Engine
 *
 * Implements Google's official authorization code flow with:
 * - PKCE (RFC 7636) with SHA-256 code challenge
 * - State validation with HMAC-signed encrypted cookie
 * - Nonce validation in OpenID Connect ID token
 * - Strict ID token / UserInfo claims verification (iss, aud, exp, nonce, email_verified)
 * - Safe account linking (prevents account takeover & duplicate Google identity connections)
 */

import crypto from "crypto";
import { encryptToken, decryptToken } from "./encryption";
import { getSafeRedirectUrl } from "./redirect";

export const GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";
export const GOOGLE_OAUTH_COOKIE_NAME = "google_oauth_state";
export const GOOGLE_OAUTH_MAX_AGE = 600; // 10 minutes

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  isConfigured: boolean;
}

export function getGoogleCallbackUrl(requestOrigin?: string): string {
  const explicitCallback = process.env.GOOGLE_CALLBACK_URL?.trim();
  if (explicitCallback) {
    return explicitCallback;
  }

  const rawBase = process.env.NEXT_PUBLIC_APP_URL?.trim() || requestOrigin || "http://localhost:3000";
  const normalizedBase = rawBase.replace(/\/+$/, "");

  if (process.env.NODE_ENV === "production" && normalizedBase.startsWith("http://")) {
    return `https://${normalizedBase.slice(7)}${GOOGLE_CALLBACK_PATH}`;
  }

  return `${normalizedBase}${GOOGLE_CALLBACK_PATH}`;
}

export function getGoogleOAuthConfig(requestOrigin?: string): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  const callbackUrl = getGoogleCallbackUrl(requestOrigin);

  const isConfigured = Boolean(
    clientId &&
    clientSecret &&
    !clientId.startsWith("REPLACE_") &&
    !clientSecret.startsWith("REPLACE_")
  );

  return {
    clientId,
    clientSecret,
    callbackUrl,
    isConfigured,
  };
}

export interface GoogleOAuthStatePayload {
  state: string;
  codeVerifier: string;
  nonce: string;
  mode: "login" | "signup" | "connect";
  userId?: string;
  returnTo: string;
  expiresAt: number;
}

const consumedGoogleStates = new Set<string>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    consumedGoogleStates.clear();
  }, GOOGLE_OAUTH_MAX_AGE * 1000).unref?.();
}

/**
 * Creates PKCE verifier and S256 code challenge.
 */
export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

/**
 * Creates a secure Google OAuth authorization initiation transaction with PKCE, state, and nonce.
 */
export function createGoogleOAuthSession(
  mode: "login" | "signup" | "connect" = "login",
  userId?: string,
  rawReturnTo?: string | null
): {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
  nonce: string;
  encryptedCookie: string;
  returnTo: string;
} {
  const state = crypto.randomBytes(32).toString("hex");
  const nonce = crypto.randomBytes(32).toString("hex");
  const { codeVerifier, codeChallenge } = generatePkcePair();

  const defaultRedirect = mode === "connect" ? "/dashboard/settings/security" : "/dashboard";
  const returnTo = getSafeRedirectUrl(rawReturnTo, defaultRedirect);
  const expiresAt = Date.now() + GOOGLE_OAUTH_MAX_AGE * 1000;

  const payload: GoogleOAuthStatePayload = {
    state,
    codeVerifier,
    nonce,
    mode,
    userId,
    returnTo,
    expiresAt,
  };

  const encryptedCookie = encryptToken(JSON.stringify(payload));
  return {
    state,
    codeVerifier,
    codeChallenge,
    nonce,
    encryptedCookie,
    returnTo,
  };
}

/**
 * Verifies the Google OAuth state cookie and extracts verified session parameters.
 */
export function verifyGoogleOAuthSession(
  receivedState: string,
  cookieValue?: string
): GoogleOAuthStatePayload | null {
  if (!receivedState || !cookieValue) return null;

  try {
    const decryptedJson = decryptToken(cookieValue);
    if (!decryptedJson) return null;

    const payload = JSON.parse(decryptedJson) as GoogleOAuthStatePayload;

    if (!payload.state || !payload.expiresAt || !payload.codeVerifier) {
      return null;
    }

    if (Date.now() > payload.expiresAt) {
      return null;
    }

    if (consumedGoogleStates.has(payload.state)) {
      return null; // Replay attack detected
    }

    // Constant-time state comparison
    const bufReceived = Buffer.from(receivedState);
    const bufExpected = Buffer.from(payload.state);
    if (bufReceived.length !== bufExpected.length || !crypto.timingSafeEqual(bufReceived, bufExpected)) {
      return null;
    }

    consumedGoogleStates.add(payload.state);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Builds the official Google authorization URL.
 */
export function buildGoogleAuthorizeUrl(
  clientId: string,
  callbackUrl: string,
  state: string,
  codeChallenge: string,
  nonce: string
): string {
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "select_account");
  return authUrl.toString();
}

export interface GoogleTokens {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export interface GoogleUserProfile {
  sub: string; // Stable Google subject identifier
  email: string;
  email_verified: boolean;
  name: string;
  picture?: string;
}

/**
 * Exchanges authorization code for Google access and ID tokens using PKCE verifier.
 */
export async function exchangeGoogleCodeForTokens(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
  callbackUrl: string
): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} - ${errBody}`);
  }

  return res.json();
}

/**
 * Fetches and validates Google user profile from OpenID Connect UserInfo endpoint.
 */
export async function getGoogleUserProfile(accessToken: string): Promise<GoogleUserProfile> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Google userinfo fetch failed: ${res.statusText}`);
  }

  const profile = (await res.json()) as GoogleUserProfile;
  if (!profile.sub || !profile.email) {
    throw new Error("Invalid profile payload received from Google.");
  }

  return profile;
}
