/**
 * Comprehensive Secret and Credential Redaction Utility
 * Prevents unintentional exposure of tokens, private keys, database credentials,
 * and environment secrets across build logs, API responses, and error traces.
 */

// Patterns matching known token and credential formats
const SECRET_PATTERNS: Array<{ regex: RegExp; replacement: string }> = [
  // GitHub access tokens (classic, fine-grained, OAuth, refresh)
  { regex: /gh[pousr]_[A-Za-z0-9_]{16,}/g, replacement: "[REDACTED_GITHUB_TOKEN]" },
  { regex: /github_pat_[A-Za-z0-9_]{22,}/g, replacement: "[REDACTED_GITHUB_PAT]" },

  // MongoDB connection strings with credentials (mongodb://user:pass@... or mongodb+srv://user:pass@...)
  {
    regex: /mongodb(\+srv)?:\/\/[^:\s]+:[^@\s]+@[^\s"']+/gi,
    replacement: "mongodb$1://[REDACTED_USER]:[REDACTED_PASSWORD]@[REDACTED_HOST]",
  },

  // Bearer tokens and Authorization headers
  { regex: /Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, replacement: "Bearer [REDACTED_BEARER_TOKEN]" },
  { regex: /Basic\s+[A-Za-z0-9+/=]{10,}/gi, replacement: "Basic [REDACTED_BASIC_AUTH]" },

  // JWT tokens (three Base64URL segments separated by dots)
  {
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replacement: "[REDACTED_JWT_TOKEN]",
  },

  // PEM private keys
  {
    regex: /-----BEGIN\s+[A-Z\s]+PRIVATE\s+KEY-----[\s\S]*?-----END\s+[A-Z\s]+PRIVATE\s+KEY-----/gi,
    replacement: "[REDACTED_PRIVATE_KEY]",
  },

  // Generic key/token assignments (e.g., token="...", secret: '...', apiKey = "...")
  {
    regex: /(api[_-]?key|secret|password|access[_-]?token|auth[_-]?token)\s*[:=]\s*["']?([A-Za-z0-9_~./-]{8,})["']?/gi,
    replacement: "$1=[REDACTED_SECRET]",
  },
];

/**
 * Returns a list of all non-empty configured server environment secrets
 */
function getEnvironmentSecrets(): string[] {
  const envSecrets = [
    process.env.JWT_SECRET,
    process.env.CLOUDFLARE_API_TOKEN,
    process.env.GITHUB_CLIENT_SECRET,
    process.env.MONGODB_URI,
    process.env.ENCRYPTION_KEY,
  ];

  return envSecrets
    .filter((s): s is string => Boolean(s && typeof s === "string" && s.trim().length >= 6))
    .map((s) => s.trim());
}

/**
 * Redacts all known secret patterns and server-configured environment secrets from a string.
 */
export function redactSensitiveData(input: string, customTokens?: string[]): string {
  if (!input || typeof input !== "string") {
    return input;
  }

  let sanitized = input;

  // 1. Redact specific environment variable values
  const allEnvSecrets = [...getEnvironmentSecrets(), ...(customTokens || [])];
  for (const secret of allEnvSecrets) {
    if (secret && secret.length >= 6) {
      sanitized = sanitized.split(secret).join("[REDACTED_CONFIGURED_SECRET]");
    }
  }

  // 2. Redact regex patterns
  for (const { regex, replacement } of SECRET_PATTERNS) {
    sanitized = sanitized.replace(regex, replacement);
  }

  return sanitized;
}

/**
 * Redacts sensitive credentials from build log line arrays
 */
export function redactLogs(logs: string[], customTokens?: string[]): string[] {
  if (!Array.isArray(logs)) return [];
  return logs.map((line) => redactSensitiveData(line, customTokens));
}
