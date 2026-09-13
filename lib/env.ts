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
    
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}
