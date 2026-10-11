export function getEnvDiagnostics() {
  return {
    "MONGODB_URI configured": !!process.env.MONGODB_URI,
    "GITHUB_CLIENT_ID configured": !!process.env.GITHUB_CLIENT_ID,
    "GITHUB_CLIENT_SECRET configured": !!process.env.GITHUB_CLIENT_SECRET,
    "CLOUDFLARE_ACCOUNT_ID configured": !!process.env.CLOUDFLARE_ACCOUNT_ID,
    "CLOUDFLARE_API_TOKEN configured": !!process.env.CLOUDFLARE_API_TOKEN,
  };
}

export function logEnvDiagnostics() {
  const diagnostics = getEnvDiagnostics();
  console.log("=== Environment Configuration Diagnostic ===");
  Object.entries(diagnostics).forEach(([k, v]) => {
    console.log(`${k}: ${v}`);
  });
  console.log("=============================================");
}

export function validateEnv() {
  const required = [
    "MONGODB_URI",
    "CLOUDFLARE_ACCOUNT_ID",
    "CLOUDFLARE_API_TOKEN",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET"
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`\x1b[31m
🚨 CRITICAL ERROR: Missing required environment variables!
The following variables must be defined in your .env.local file:
${missing.map(key => `- ${key}`).join('\n')}

Check .env.example for required configuration.
\x1b[0m`);
  }
}
