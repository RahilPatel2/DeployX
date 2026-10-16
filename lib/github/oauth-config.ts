/**
 * GitHub OAuth Configuration & Canonical Callback URL Provider
 * 
 * Provides unified, single-source-of-truth derivation for GitHub OAuth credentials
 * and canonical callback URLs to ensure absolute parity between authorization and token-exchange stages.
 */

export const GITHUB_CALLBACK_PATH = "/api/integrations/github/callback";

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  isConfigured: boolean;
}

/**
 * Derives the canonical, normalized GitHub OAuth callback URL.
 * Prefers explicit GITHUB_CALLBACK_URL override, then NEXT_PUBLIC_APP_URL, then request origin.
 * Enforces removal of any trailing slash before appending the standard callback path.
 */
export function getGitHubCallbackUrl(requestOrigin?: string): string {
  const explicitCallback = process.env.GITHUB_CALLBACK_URL?.trim();
  if (explicitCallback) {
    return explicitCallback;
  }

  const rawBase = process.env.NEXT_PUBLIC_APP_URL?.trim() || requestOrigin || "http://localhost:3000";
  const normalizedBase = rawBase.replace(/\/+$/, "");

  // In production, ensure HTTPS protocol
  if (process.env.NODE_ENV === "production" && normalizedBase.startsWith("http://")) {
    return `https://${normalizedBase.slice(7)}${GITHUB_CALLBACK_PATH}`;
  }

  return `${normalizedBase}${GITHUB_CALLBACK_PATH}`;
}

/**
 * Returns current GitHub OAuth configuration status without exposing secrets.
 */
export function getGitHubOAuthConfig(requestOrigin?: string): GitHubOAuthConfig {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || "";
  const callbackUrl = getGitHubCallbackUrl(requestOrigin);

  const isConfigured = !!(
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

/**
 * Validates that an OAuth returnTo redirect target is safe and internal.
 */
export function isSafeOAuthRedirect(returnTo: string): boolean {
  if (!returnTo || typeof returnTo !== "string") return false;
  if (!returnTo.startsWith("/")) return false;
  if (returnTo.startsWith("//") || returnTo.startsWith("/\\") || returnTo.startsWith("\\")) return false;
  return true;
}
