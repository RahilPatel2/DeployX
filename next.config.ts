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

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://avatars.githubusercontent.com https://*.githubusercontent.com https://github.com",
      "font-src 'self' data:",
      "connect-src 'self' https://api.github.com https://api.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "mongodb"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
          { key: "Surrogate-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
