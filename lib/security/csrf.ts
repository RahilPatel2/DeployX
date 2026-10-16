import crypto from "crypto";

const CSRF_SECRET = process.env.JWT_SECRET || "deployx_csrf_secure_fallback_secret_key_2026";
export const CSRF_HEADER_NAME = "x-csrf-token";
export const CSRF_COOKIE_NAME = "deployx-csrf-token";

/**
 * Generate a cryptographically secure CSRF token tied to a session or random nonce.
 * Uses HMAC-SHA256 to ensure the token cannot be forged by an adversary.
 */
export function generateCsrfToken(sessionId?: string): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const identifier = sessionId || "anonymous";
  const hmac = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(`${identifier}:${nonce}`)
    .digest("hex");
  return `${nonce}.${hmac}`;
}

/**
 * Validate a CSRF token against the given session identifier.
 * Uses timing-safe equality comparison to prevent timing attacks.
 */
export function verifyCsrfToken(token: string | null | undefined, sessionId?: string): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return false;
  }

  const [nonce, providedHmac] = parts;
  if (!nonce || !providedHmac) {
    return false;
  }

  const identifier = sessionId || "anonymous";
  const expectedHmac = crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(`${identifier}:${nonce}`)
    .digest("hex");

  try {
    const expectedBuf = Buffer.from(expectedHmac, "hex");
    const providedBuf = Buffer.from(providedHmac, "hex");

    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Validates request Origin and Referer against the host header to defend against CSRF attacks.
 */
export function verifySameOrigin(req: Request): boolean {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  if (!host) {
    // If no host is available in request headers, allow in test environments but require otherwise
    return process.env.NODE_ENV !== "production";
  }

  // Clean host (strip port if present in comparison when origins omit default ports)
  const hostName = host.split(":")[0]?.toLowerCase();

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.hostname.toLowerCase() !== hostName) {
        return false;
      }
    } catch {
      return false;
    }
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.hostname.toLowerCase() !== hostName) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Comprehensive CSRF request validation.
 * Verifies same-origin headers and optionally validates token for state-changing requests.
 */
export function validateCsrfRequest(
  req: Request,
  sessionId?: string,
  options: { requireToken?: boolean } = {}
): { valid: boolean; reason?: string } {
  const method = req.method.toUpperCase();

  // Safe HTTP methods do not require CSRF protection
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return { valid: true };
  }

  // Verify same-origin headers
  if (!verifySameOrigin(req)) {
    return { valid: false, reason: "Cross-origin request rejected (invalid Origin/Referer)" };
  }

  if (options.requireToken) {
    const tokenFromHeader = req.headers.get(CSRF_HEADER_NAME);
    const tokenFromCookie = req.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${CSRF_COOKIE_NAME}=`))
      ?.substring(CSRF_COOKIE_NAME.length + 1);

    const token = tokenFromHeader || (tokenFromCookie ? decodeURIComponent(tokenFromCookie) : null);

    if (!token) {
      return { valid: false, reason: "Missing CSRF token in request" };
    }

    if (!verifyCsrfToken(token, sessionId)) {
      return { valid: false, reason: "Invalid or tampered CSRF token" };
    }
  }

  return { valid: true };
}
