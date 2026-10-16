/**
 * Network Utilities & Canonical URL Resolution
 * 
 * Provides robust resolution of canonical application URLs, reverse proxy protocol
 * detection (x-forwarded-proto), and HTTPS enforcement across serverless and container hosts.
 */

/**
 * Checks whether an incoming HTTP request was transmitted over HTTPS.
 * Respects standard reverse-proxy headers (x-forwarded-proto, cf-visitor).
 */
export function isHttpsRequest(req: Request): boolean {
  // Direct URL protocol
  try {
    const url = new URL(req.url);
    if (url.protocol === "https:") {
      return true;
    }
  } catch {
    // Fall back to header inspection
  }

  // Reverse proxy forwarding headers
  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (forwardedProto && forwardedProto.split(",")[0].trim().toLowerCase() === "https") {
    return true;
  }

  // Cloudflare visitor header
  const cfVisitor = req.headers.get("cf-visitor");
  if (cfVisitor && cfVisitor.includes('"scheme":"https"')) {
    return true;
  }

  return false;
}

/**
 * Resolves the canonical base URL for the application.
 * Precedence:
 * 1. NEXT_PUBLIC_APP_URL environment variable (stripped of trailing slash).
 * 2. Request host/proto headers (x-forwarded-proto + x-forwarded-host / host).
 * 3. Default fallback: http://localhost:3000
 */
export function getCanonicalAppUrl(req?: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    let clean = envUrl.replace(/\/+$/, "");
    if (process.env.NODE_ENV === "production" && clean.startsWith("http://")) {
      clean = `https://${clean.slice(7)}`;
    }
    return clean;
  }

  if (req) {
    const isHttps = isHttpsRequest(req) || process.env.NODE_ENV === "production";
    const proto = isHttps ? "https" : "http";
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
      req.headers.get("host")?.trim();

    if (host) {
      return `${proto}://${host}`;
    }

    try {
      const parsed = new URL(req.url);
      return `${proto}://${parsed.host}`;
    } catch {
      // Fallback
    }
  }

  return "http://localhost:3000";
}
