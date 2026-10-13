/**
 * Server-only Cloudflare API HTTP Client
 * 
 * Provides authenticated, resilient, and secure communication with the Cloudflare v4 API.
 * Enforces timeout controls, token redaction, safe retries with exponential backoff,
 * and structured error handling.
 */

const CF_API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_TIMEOUT_MS = 25000; // 25 seconds
const MAX_SAFE_RETRIES = 2;

export class CloudflareError extends Error {
  public status: number;
  public code?: number;
  public errors?: Array<{ code: number; message: string }>;

  constructor(status: number, message: string, code?: number, errors?: Array<{ code: number; message: string }>) {
    super(redactSensitive(message));
    this.name = "CloudflareError";
    this.status = status;
    this.code = code;
    this.errors = errors?.map((e) => ({
      code: e.code,
      message: redactSensitive(e.message),
    }));
  }
}

export class CloudflareConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CloudflareConfigError";
  }
}

export class CloudflareTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Cloudflare API request timed out after ${timeoutMs}ms.`);
    this.name = "CloudflareTimeoutError";
  }
}

/**
 * Redacts Cloudflare API tokens or Authorization headers from any string.
 */
export function redactSensitive(input: string, tokenToRedact?: string): string {
  if (!input || typeof input !== "string") return input;
  let redacted = input;
  const token = tokenToRedact || process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (token && token.length > 5) {
    redacted = redacted.split(token).join("[REDACTED_API_TOKEN]");
  }
  if (process.env.GITHUB_CLIENT_SECRET?.trim()) {
    redacted = redacted.split(process.env.GITHUB_CLIENT_SECRET.trim()).join("[REDACTED]");
  }
  // Redact Bearer tokens in headers or strings
  redacted = redacted.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  // Redact GitHub personal access and OAuth tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  redacted = redacted.replace(/gh[pousr]_[A-Za-z0-9_]{16,}/g, "[REDACTED_TOKEN]");
  return redacted;
}

/**
 * Retrieves and validates the server-side Cloudflare configuration.
 */
export function getCloudflareConfig(): { accountId: string; apiToken: string } {
  let accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    throw new CloudflareConfigError(
      "Missing Cloudflare API credentials. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your environment."
    );
  }

  // Handle accidental leading non-hex character (e.g. stray prefix from copy-paste)
  if (accountId.length === 33 && !/^[a-f0-9]/i.test(accountId[0])) {
    accountId = accountId.slice(1);
  }

  return { accountId, apiToken };
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  timeoutMs?: number;
  maxRetries?: number;
  isRetryable?: boolean;
  headers?: Record<string, string>;
  overrideAccountId?: string;
  overrideApiToken?: string;
}

export interface CloudflareResponse<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  messages?: Array<{ code: number; message: string }>;
  result: T;
  result_info?: {
    page: number;
    per_page: number;
    count: number;
    total_count: number;
    total_pages?: number;
  };
}

/**
 * Dispatches an authenticated request to the Cloudflare API.
 */
export async function cfRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const {
    method = "GET",
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = method === "GET" ? MAX_SAFE_RETRIES : 0,
    isRetryable = method === "GET",
    headers: customHeaders = {},
    overrideAccountId,
    overrideApiToken,
  } = options;

  let accountId = overrideAccountId;
  let apiToken = overrideApiToken;

  if (!accountId || !apiToken) {
    const config = getCloudflareConfig();
    accountId = accountId || config.accountId;
    apiToken = apiToken || config.apiToken;
  }

  // Construct final URL
  const cleanEndpoint = endpoint.replace("{account_id}", accountId);
  const url = cleanEndpoint.startsWith("http")
    ? cleanEndpoint
    : `${CF_API_BASE}${cleanEndpoint.startsWith("/") ? "" : "/"}${cleanEndpoint}`;

  let attempt = 0;

  while (attempt <= maxRetries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: HeadersInit = {
        Authorization: `Bearer ${apiToken}`,
        Accept: "application/json",
        "User-Agent": "DeployX-Platform",
        ...customHeaders,
      };

      if (body && !(body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      const res = await fetch(url, {
        method,
        headers,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);

      // 1. Handle Rate Limiting (429)
      if (res.status === 429) {
        if (isRetryable && attempt <= maxRetries) {
          const retryAfterSec = parseInt(res.headers.get("Retry-After") || "2", 10);
          const waitMs = Math.min(Math.max(retryAfterSec * 1000, 1000), 10000);
          console.warn(`[Cloudflare API] Rate limited (429). Retrying in ${waitMs}ms (attempt ${attempt}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }
        throw new CloudflareError(429, "Cloudflare API rate limit exceeded. Please try again shortly.", 429);
      }

      // 2. Handle Transient Server Errors (502, 503, 504)
      if ([502, 503, 504].includes(res.status)) {
        if (isRetryable && attempt <= maxRetries) {
          const backoffMs = attempt * 1000;
          console.warn(`[Cloudflare API] Gateway error (${res.status}). Retrying in ${backoffMs}ms (attempt ${attempt}/${maxRetries})...`);
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }
      }

      // 3. Parse JSON response
      let data: CloudflareResponse<T>;
      try {
        data = (await res.json()) as CloudflareResponse<T>;
      } catch {
        throw new CloudflareError(res.status, `Cloudflare API returned non-JSON response with status ${res.status}.`);
      }

      // 4. Handle Cloudflare Error Envelopes
      if (!res.ok || data.success === false) {
        const primaryError = data.errors?.[0];
        const errorMsg = primaryError?.message || `Cloudflare API request failed with status ${res.status}`;
        throw new CloudflareError(res.status, errorMsg, primaryError?.code, data.errors);
      }

      return data.result;
    } catch (err: unknown) {
      clearTimeout(timer);

      // Handle Abort / Timeout
      if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError")) {
        if (isRetryable && attempt <= maxRetries) {
          console.warn(`[Cloudflare API] Request timed out. Retrying (attempt ${attempt}/${maxRetries})...`);
          continue;
        }
        throw new CloudflareTimeoutError(timeoutMs);
      }

      // If it's already a CloudflareError, re-throw directly
      if (err instanceof CloudflareError) {
        throw err;
      }

      // Network / Fetch failure
      if (err instanceof Error) {
        if (isRetryable && attempt <= maxRetries) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw new CloudflareError(0, `Network failure reaching Cloudflare API: ${err.message}`);
      }

      throw new CloudflareError(0, "Unexpected error communicating with Cloudflare API.");
    }
  }

  throw new CloudflareError(0, "Cloudflare API request failed after maximum retry attempts.");
}
