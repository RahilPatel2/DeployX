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

  // Format checks (without exposing values)
  const cfAccount = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  if (cfAccount && !/^[a-f0-9]{32}$/i.test(cfAccount)) {
    console.warn(
      `\x1b[33m[DeployX Env] ⚠️ CLOUDFLARE_ACCOUNT_ID appears malformed (${cfAccount.length} chars). Cloudflare Account IDs are strictly 32 hexadecimal characters.\x1b[0m`
    );
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
