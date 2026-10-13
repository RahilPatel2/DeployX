/**
 * Validates and normalizes redirect URLs to prevent Open Redirect attacks.
 * Only allows relative paths on the same origin (e.g., /dashboard, /dashboard/projects).
 * Disallows absolute URLs, protocol-relative URLs (//evil.com), backslash tricks (/\\evil.com),
 * or non-HTTP protocols (javascript:, data:).
 */
export function getSafeRedirectUrl(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target || typeof target !== "string") {
    return fallback;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return fallback;
  }

  // Must begin with a single slash
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  // Disallow protocol-relative URLs (e.g. //evil.com) and backslash evasions (e.g. /\evil.com or \/evil.com)
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.startsWith("\\")) {
    return fallback;
  }

  // Check if URL attempts to encode a scheme
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback;
  }

  return trimmed;
}
