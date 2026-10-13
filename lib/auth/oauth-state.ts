import crypto from "crypto";
import { encryptToken, decryptToken } from "./encryption";
import { getSafeRedirectUrl } from "./redirect";

export interface OAuthStatePayload {
  nonce: string;
  userId: string;
  returnTo: string;
  expiresAt: number;
}

export const OAUTH_STATE_COOKIE_NAME = "github_oauth_state";
export const OAUTH_STATE_MAX_AGE = 600; // 10 minutes

/**
 * Creates an unpredictably random OAuth state nonce and an encrypted cookie value
 * that cryptographically binds the state to the user ID and destination URL.
 */
export function createOAuthState(
  userId: string,
  rawReturnTo?: string | null
): { state: string; encryptedCookie: string; returnTo: string } {
  const nonce = crypto.randomBytes(16).toString("hex");
  const returnTo = getSafeRedirectUrl(rawReturnTo, "/dashboard/settings/github");
  const expiresAt = Date.now() + OAUTH_STATE_MAX_AGE * 1000;

  const payload: OAuthStatePayload = {
    nonce,
    userId,
    returnTo,
    expiresAt,
  };

  const encryptedCookie = encryptToken(JSON.stringify(payload));
  return { state: nonce, encryptedCookie, returnTo };
}

/**
 * Verifies the OAuth state returned in the callback query parameter against
 * the encrypted state cookie and the current user's session ID.
 */
export function verifyOAuthState(
  encryptedCookie: string | undefined,
  receivedState: string | null,
  currentUserId: string
): { valid: boolean; returnTo: string; error?: string } {
  const fallbackReturnTo = "/dashboard/settings/github";

  if (!receivedState) {
    return { valid: false, returnTo: fallbackReturnTo, error: "Missing OAuth state parameter." };
  }

  if (!encryptedCookie) {
    return { valid: false, returnTo: fallbackReturnTo, error: "OAuth session cookie not found. Please try connecting again." };
  }

  try {
    const decryptedJson = decryptToken(encryptedCookie);
    const payload: OAuthStatePayload = JSON.parse(decryptedJson);

    const safeReturnTo = getSafeRedirectUrl(payload.returnTo, fallbackReturnTo);

    if (!payload.expiresAt || Date.now() > payload.expiresAt) {
      return { valid: false, returnTo: safeReturnTo, error: "OAuth authorization expired. Please try connecting again." };
    }

    if (!payload.nonce || payload.nonce !== receivedState) {
      return { valid: false, returnTo: safeReturnTo, error: "Invalid OAuth state. Potential CSRF attempt detected." };
    }

    if (!payload.userId || payload.userId !== currentUserId) {
      return { valid: false, returnTo: safeReturnTo, error: "OAuth session mismatch between initiator and current user." };
    }

    return { valid: true, returnTo: safeReturnTo };
  } catch (err) {
    console.error("OAuth state verification error:", err);
    return { valid: false, returnTo: fallbackReturnTo, error: "Could not verify OAuth state." };
  }
}
