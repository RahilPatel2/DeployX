import crypto from "crypto";
import { decryptToken } from "@/lib/auth/encryption";

export interface WebhookRegistrationResult {
  webhookId?: number;
  status: "active" | "manual" | "failed";
  error?: string;
  isExisting?: boolean;
}

/**
 * Generates a high-entropy cryptographically secure webhook secret.
 */
export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Verifies the X-Hub-Signature-256 header using constant-time comparison.
 * Expects the signature format "sha256=<hex_digest>".
 */
export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signatureHeader: string | null | undefined,
  secret: string
): boolean {
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return false;
  }

  if (!signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const providedHex = signatureHeader.slice(7).trim();
  // Ensure the provided signature is exactly a 64-character hex string (SHA-256)
  if (!providedHex || !/^[0-9a-f]{64}$/i.test(providedHex) || !secret) {
    return false;
  }

  try {
    const computedHex = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    const providedBuffer = Buffer.from(providedHex, "hex");
    const computedBuffer = Buffer.from(computedHex, "hex");

    if (providedBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(computedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

/**
 * Resolves the canonical public webhook URL.
 */
export function getWebhookUrl(req?: Request): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    const base = envUrl.replace(/\/+$/, "");
    return `${base}/api/webhooks/github`;
  }

  if (req) {
    try {
      const url = new URL(req.url);
      return `${url.origin}/api/webhooks/github`;
    } catch {
      // Fallback
    }
  }

  return "http://localhost:3000/api/webhooks/github";
}

/**
 * Registers or idempotently updates a GitHub repository push webhook.
 * Gracefully detects lack of admin:repo_hook permissions and provides manual setup guidance.
 */
export async function createRepositoryWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  secret: string
): Promise<WebhookRegistrationResult> {
  let token: string;
  try {
    token = decryptToken(accessToken);
  } catch {
    token = accessToken;
  }

  const listUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks?per_page=100`;

  try {
    // 1. Check existing hooks to prevent duplicate registrations
    const listRes = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DeployX-Platform",
      },
      cache: "no-store",
    });

    if (listRes.ok) {
      const existingHooks = await listRes.json();
      if (Array.isArray(existingHooks)) {
        const found = existingHooks.find(
          (h: { id: number; active?: boolean; config?: { url?: string } }) =>
            h.config?.url === webhookUrl && h.active === true
        );
        if (found) {
          return {
            webhookId: found.id,
            status: "active",
            isExisting: true,
          };
        }
      }
    } else if (listRes.status === 403 || listRes.status === 404) {
      // User or token lacks repository webhook administration rights
      return {
        status: "manual",
        error: "Your GitHub account does not have admin hook permissions for this repository. Please configure the webhook manually in GitHub repository settings.",
      };
    }

    // 2. Register new webhook
    const createUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "DeployX-Platform",
      },
      body: JSON.stringify({
        name: "web",
        active: true,
        events: ["push"],
        config: {
          url: webhookUrl,
          content_type: "json",
          secret: secret,
          insecure_ssl: "0",
        },
      }),
    });

    if (!createRes.ok) {
      if (createRes.status === 403 || createRes.status === 404) {
        return {
          status: "manual",
          error: "Permission denied by GitHub. Please set up the webhook manually in repository settings.",
        };
      }
      const errData = await createRes.json().catch(() => ({}));
      return {
        status: "failed",
        error: errData.message || `GitHub returned ${createRes.status}`,
      };
    }

    const createdData = await createRes.json();
    return {
      webhookId: createdData.id,
      status: "active",
      isExisting: false,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: "failed",
      error: `Failed to contact GitHub: ${msg}`,
    };
  }
}

/**
 * Deletes a repository webhook from GitHub when project is deleted or disconnected.
 */
export async function deleteRepositoryWebhook(
  accessToken: string,
  owner: string,
  repo: string,
  hookId: number
): Promise<boolean> {
  let token: string;
  try {
    token = decryptToken(accessToken);
  } catch {
    token = accessToken;
  }

  const deleteUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${hookId}`;
  try {
    const res = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "DeployX-Platform",
      },
    });
    return res.status === 204 || res.status === 404;
  } catch {
    return false;
  }
}
