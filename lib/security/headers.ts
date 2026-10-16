import { NextResponse } from "next/server";

/**
 * Security Headers Configuration for DeployX
 * Standardized security headers enforcing defense-in-depth against
 * clickjacking, MIME sniffing, XSS, and unauthorized external framing.
 */

export const SECURITY_HEADERS = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.githubusercontent.com https://github.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.github.com https://api.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

export const ANTI_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  "Pragma": "no-cache",
  "Expires": "0",
  "Surrogate-Control": "no-store",
};

export function getSecurityHeadersRecord(): Record<string, string> {
  return SECURITY_HEADERS.reduce((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Applies anti-caching headers to a NextResponse to prevent browser and CDN disk caching of sensitive data.
 */
export function applyAntiCacheHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(ANTI_CACHE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
