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

// In-memory single-use replay protection cache
const consumedNonces = new Set<string>();

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    // Periodically reset consumed nonces (TTL matches max age)
    consumedNonces.clear();
  }, OAUTH_STATE_MAX_AGE * 1000).unref?.();
}

/**
 * Creates an unpredictably random OAuth state nonce and an encrypted cookie value
 * that cryptographically binds the state to the user ID and destination URL.
 */
export function createOAuthState(
  userId: string,
  rawReturnTo?: string | null
): { state: string; encryptedCookie: string; returnTo: string } {
  const nonce = crypto.randomBytes(32).toString("hex");
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
 * the encrypted state cookie and the current user's session ID using timing-safe comparisons.
 */
export function verifyOAuthState(
  encryptedCookie: string | undefined,
  receivedState: string | null,
  currentUserId: string
): { valid: boolean; returnTo: string; error?: string } {
  const fallbackReturnTo = "/dashboard/settings/github";

  if (!receivedState || typeof receivedState !== "string") {
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

    if (!payload.nonce || typeof payload.nonce !== "string") {
      return { valid: false, returnTo: safeReturnTo, error: "Invalid OAuth state payload." };
    }

    // Check for replay attacks
    if (consumedNonces.has(payload.nonce)) {
      return { valid: false, returnTo: safeReturnTo, error: "OAuth state token already consumed. Replay attempt detected." };
    }

    // Timing-safe nonce equality check
    const expectedNonceBuf = Buffer.from(payload.nonce, "utf-8");
    const receivedNonceBuf = Buffer.from(receivedState, "utf-8");

    if (
      expectedNonceBuf.length !== receivedNonceBuf.length ||
      !crypto.timingSafeEqual(expectedNonceBuf, receivedNonceBuf)
    ) {
      return { valid: false, returnTo: safeReturnTo, error: "Invalid OAuth state. Potential CSRF attempt detected." };
    }

    // Timing-safe userId equality check
    const expectedUserBuf = Buffer.from(payload.userId || "", "utf-8");
    const currentUserBuf = Buffer.from(currentUserId || "", "utf-8");

    if (
      expectedUserBuf.length !== currentUserBuf.length ||
      !crypto.timingSafeEqual(expectedUserBuf, currentUserBuf)
    ) {
      return { valid: false, returnTo: safeReturnTo, error: "OAuth session mismatch between initiator and current user." };
    }

    // Mark nonce as consumed
    consumedNonces.add(payload.nonce);

    return { valid: true, returnTo: safeReturnTo };
  } catch (err) {
    console.error("OAuth state verification error:", err);
    return { valid: false, returnTo: fallbackReturnTo, error: "Could not verify OAuth state." };
  }
}
