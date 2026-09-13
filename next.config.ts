import type { NextConfig } from "next";

// Check environment variables at startup
const requiredEnvs = [
  "MONGODB_URI",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET"
];

const missing = requiredEnvs.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error(`\n\x1b[31m🚨 CRITICAL ERROR: Missing required environment variables!\x1b[0m`);
  console.error(`\x1b[31mThe following variables must be defined in your .env.local file:\x1b[0m`);
  missing.forEach(key => console.error(`\x1b[31m- ${key}\x1b[0m`));
  console.error(`\x1b[31mCheck .env.example for required configuration.\n\x1b[0m`);
  
  // Don't crash the build on Vercel if some runtime envs are missing during static generation,
  // but do log it heavily. 
}

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "mongodb"],
};

export default nextConfig;
