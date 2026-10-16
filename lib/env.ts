/**
 * Server-side Environment Validation & Diagnostics Utility
 * 
 * Securely audits required environment variables without logging or exposing secrets.
 * Distinguishes between missing variables, invalid credential formats, and connection failures.
 */

export interface EnvReport {
  configured: boolean;
  missing: string[];
  diagnostics: Record<string, boolean>;
}

export interface ServiceDiagnostic {
  service: string;
  status: "OK" | "WARNING" | "ERROR";
  category?: "VARIABLE_MISSING" | "DATABASE_CONNECTION_FAILURE" | "INVALID_PROVIDER_CREDENTIALS" | "INSUFFICIENT_PROVIDER_PERMISSIONS";
  message: string;
}

export function getEnvDiagnostics(): Record<string, boolean> {
  return {
    "MONGODB_URI configured": !!process.env.MONGODB_URI,
    "MONGODB_DB configured": !!process.env.MONGODB_DB,
    "JWT_SECRET configured": !!process.env.JWT_SECRET,
    "GITHUB_CLIENT_ID configured": !!process.env.GITHUB_CLIENT_ID,
    "GITHUB_CLIENT_SECRET configured": !!process.env.GITHUB_CLIENT_SECRET,
    "GITHUB_CALLBACK_URL configured (optional)": !!process.env.GITHUB_CALLBACK_URL,
    "ENCRYPTION_KEY configured (optional)": !!process.env.ENCRYPTION_KEY,
    "CLOUDFLARE_ACCOUNT_ID configured": !!process.env.CLOUDFLARE_ACCOUNT_ID,
    "CLOUDFLARE_API_TOKEN configured": !!process.env.CLOUDFLARE_API_TOKEN,
  };
}

export interface ProductionEnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Strictly audits environment variables for production readiness.
 * Validates formatting, entropy, protocol standards, and secret hygiene
 * without exposing sensitive values.
 */
export function validateProductionEnv(env: Record<string, string | undefined> = process.env): ProductionEnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = env.NODE_ENV === "production";

  // 1. Canonical Application URL
  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) {
    if (isProd) {
      errors.push("NEXT_PUBLIC_APP_URL must be defined in production.");
    } else {
      warnings.push("NEXT_PUBLIC_APP_URL is not set (defaulting to http://localhost:3000).");
    }
  } else {
    try {
      const parsed = new URL(appUrl);
      if (appUrl.endsWith("/")) {
        errors.push("NEXT_PUBLIC_APP_URL must not contain a trailing slash.");
      }
      if (isProd && parsed.protocol !== "https:") {
        warnings.push("NEXT_PUBLIC_APP_URL should use HTTPS in production environments.");
      }
    } catch {
      errors.push("NEXT_PUBLIC_APP_URL is not a valid HTTP/HTTPS URL.");
    }
  }

  // 2. Authentication JWT Secret
  const jwtSecret = env.JWT_SECRET?.trim();
  if (!jwtSecret) {
    errors.push("JWT_SECRET is required.");
  } else if (jwtSecret === "default_development_secret_key") {
    if (isProd) {
      errors.push("Insecure default JWT_SECRET detected in production! Must be replaced with a high-entropy secret.");
    } else {
      warnings.push("Using default development secret for JWT_SECRET. Do not use in production.");
    }
  } else if (jwtSecret.length < 32) {
    if (isProd) {
      errors.push(`JWT_SECRET is too short (${jwtSecret.length} chars). Production secret must be at least 32 characters.`);
    } else {
      warnings.push("JWT_SECRET should be at least 32 characters for adequate HMAC entropy.");
    }
  }

  // 3. MongoDB Configuration
  const mongoUri = env.MONGODB_URI?.trim();
  if (!mongoUri) {
    errors.push("MONGODB_URI is required.");
  } else if (!mongoUri.startsWith("mongodb://") && !mongoUri.startsWith("mongodb+srv://")) {
    errors.push("MONGODB_URI must begin with 'mongodb://' or 'mongodb+srv://'.");
  }

  const mongoDb = env.MONGODB_DB?.trim();
  if (mongoDb && !/^[a-zA-Z0-9_-]+$/.test(mongoDb)) {
    errors.push("MONGODB_DB contains invalid characters. Use alphanumeric, dashes, and underscores only.");
  }

  // 4. GitHub OAuth Credentials
  const ghClientId = env.GITHUB_CLIENT_ID?.trim();
  if (!ghClientId) {
    errors.push("GITHUB_CLIENT_ID is required.");
  } else if (ghClientId.startsWith("REPLACE_")) {
    errors.push("GITHUB_CLIENT_ID contains an unconfigured placeholder value.");
  }

  const ghClientSecret = env.GITHUB_CLIENT_SECRET?.trim();
  if (!ghClientSecret) {
    errors.push("GITHUB_CLIENT_SECRET is required.");
  } else if (ghClientSecret.startsWith("REPLACE_")) {
    errors.push("GITHUB_CLIENT_SECRET contains an unconfigured placeholder value.");
  }

  const ghCallback = env.GITHUB_CALLBACK_URL?.trim();
  if (ghCallback) {
    try {
      new URL(ghCallback);
    } catch {
      errors.push("GITHUB_CALLBACK_URL is defined but is not a valid URL.");
    }
  }

  // 5. Cloudflare Pages Credentials
  const cfAccount = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (!cfAccount) {
    errors.push("CLOUDFLARE_ACCOUNT_ID is required.");
  } else {
    const cleanedAccount = cfAccount.length === 33 && !/^[a-f0-9]/i.test(cfAccount[0]) ? cfAccount.slice(1) : cfAccount;
    if (!/^[a-f0-9]{32}$/i.test(cleanedAccount)) {
      errors.push(`CLOUDFLARE_ACCOUNT_ID must be strictly 32 hexadecimal characters (received ${cfAccount.length} chars).`);
    }
  }

  const cfToken = env.CLOUDFLARE_API_TOKEN?.trim();
  if (!cfToken) {
    errors.push("CLOUDFLARE_API_TOKEN is required.");
  } else if (cfToken.startsWith("REPLACE_")) {
    errors.push("CLOUDFLARE_API_TOKEN contains an unconfigured placeholder value.");
  } else if (cfToken.length < 20) {
    errors.push("CLOUDFLARE_API_TOKEN appears too short for a valid Cloudflare API token.");
  }

  // 6. Optional Encryption Key
  const encKey = env.ENCRYPTION_KEY?.trim();
  if (encKey && !/^[a-f0-9]{64}$/i.test(encKey)) {
    errors.push("ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes).");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateEnv(): EnvReport {
  const required = [
    "MONGODB_URI",
    "JWT_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`\n\x1b[31m[DeployX Env] 🚨 Missing required environment variables:\x1b[0m`);
    missing.forEach((key) => console.error(`\x1b[31m  - ${key}\x1b[0m`));
    console.error(`\x1b[33mEnsure these are defined in your .env.local file. See .env.example for required names.\x1b[0m\n`);
  }

  return {
    configured: missing.length === 0,
    missing,
    diagnostics: getEnvDiagnostics(),
  };
}

/**
 * Server-only connectivity diagnostic check.
 * Performs non-destructive pings to verify database and provider credentials.
 */
export async function runSafeConnectivityChecks(): Promise<ServiceDiagnostic[]> {
  const results: ServiceDiagnostic[] = [];

  // 1. MongoDB Check
  if (!process.env.MONGODB_URI) {
    results.push({
      service: "MongoDB",
      status: "ERROR",
      category: "VARIABLE_MISSING",
      message: "MONGODB_URI is not set in environment.",
    });
  } else {
    try {
      const connectToDatabase = (await import("@/lib/mongodb/client")).default;
      const conn = await connectToDatabase();
      if (conn?.connection?.readyState === 1) {
        results.push({
          service: "MongoDB",
          status: "OK",
          message: `Connected successfully to database '${process.env.MONGODB_DB || "deployx_db"}'.`,
        });
      } else {
        results.push({
          service: "MongoDB",
          status: "ERROR",
          category: "DATABASE_CONNECTION_FAILURE",
          message: "Database connection failed or disconnected.",
        });
      }
    } catch (dbErr: unknown) {
      results.push({
        service: "MongoDB",
        status: "ERROR",
        category: "DATABASE_CONNECTION_FAILURE",
        message: dbErr instanceof Error ? dbErr.message : "Failed to reach MongoDB cluster.",
      });
    }
  }

  // 2. Cloudflare Pages Check
  const cfToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  let cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();

  if (!cfToken || !cfAccount) {
    results.push({
      service: "Cloudflare Pages",
      status: "ERROR",
      category: "VARIABLE_MISSING",
      message: "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID is missing.",
    });
  } else {
    // Sanitize account ID if accidental leading char was entered
    if (cfAccount.length === 33 && !/^[a-f0-9]/.test(cfAccount[0])) {
      cfAccount = cfAccount.slice(1);
    }

    try {
      const tokenRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
        headers: { Authorization: `Bearer ${cfToken}` },
      });

      if (!tokenRes.ok) {
        results.push({
          service: "Cloudflare Pages",
          status: "ERROR",
          category: "INVALID_PROVIDER_CREDENTIALS",
          message: `API Token verification failed with status ${tokenRes.status}. Check token validity.`,
        });
      } else {
        // Now test Pages projects endpoint on the specified account
        const pagesRes = await fetch(`https://api.cloudflare.com/client/v4/accounts/${cfAccount}/pages/projects`, {
          headers: { Authorization: `Bearer ${cfToken}` },
        });

        if (pagesRes.ok) {
          results.push({
            service: "Cloudflare Pages",
            status: "OK",
            message: "API token is valid and authorized for Cloudflare Pages projects.",
          });
        } else if (pagesRes.status === 403) {
          results.push({
            service: "Cloudflare Pages",
            status: "ERROR",
            category: "INSUFFICIENT_PROVIDER_PERMISSIONS",
            message: "API token lacks permission to manage Pages projects on this account.",
          });
        } else if (pagesRes.status === 404) {
          results.push({
            service: "Cloudflare Pages",
            status: "ERROR",
            category: "INVALID_PROVIDER_CREDENTIALS",
            message: "Account ID not found. Verify your 32-character Cloudflare Account ID.",
          });
        } else {
          results.push({
            service: "Cloudflare Pages",
            status: "ERROR",
            category: "INVALID_PROVIDER_CREDENTIALS",
            message: `Pages API returned HTTP status ${pagesRes.status}.`,
          });
        }
      }
    } catch (cfErr: unknown) {
      results.push({
        service: "Cloudflare Pages",
        status: "ERROR",
        category: "INVALID_PROVIDER_CREDENTIALS",
        message: cfErr instanceof Error ? cfErr.message : "Network error reaching Cloudflare API.",
      });
    }
  }

  // 3. GitHub OAuth Check
  const ghClientId = process.env.GITHUB_CLIENT_ID?.trim();
  const ghClientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  if (!ghClientId || !ghClientSecret) {
    results.push({
      service: "GitHub OAuth",
      status: "ERROR",
      category: "VARIABLE_MISSING",
      message: "GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET is missing.",
    });
  } else {
    results.push({
      service: "GitHub OAuth",
      status: "OK",
      message: "OAuth credentials configured. (Ready for browser OAuth code grant).",
    });
  }

  return results;
}
