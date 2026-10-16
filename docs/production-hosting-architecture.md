# DeployX Production Hosting Architecture & Control Plane Isolation

**Document Version:** 1.0.0  
**Target Environment:** Node.js 20+ / Serverless Next.js Hosting (Vercel, Railway, Render, or Containerized AWS/GCP)  
**Edge Deployment Target:** Cloudflare Pages API v4  
**Database Cluster:** MongoDB Atlas M0/M10+ (Dedicated `deployx_db`)

---

## 1. Architectural Model & Responsibility Separation

DeployX is a multi-tenant developer platform that orchestrates static website and fullstack deployments for external users. A fundamental security and architectural principle of DeployX is the strict separation between:

1. **The DeployX Control Plane (Backend & Management Console):**
   - Built on Next.js 16 (App Router), React 19, TypeScript, Mongoose, and Tailwind CSS.
   - Manages user authentication, session security, project settings, GitHub webhooks, Cloudflare API credentials, and deployment telemetry.
   - Runs in a privileged, server-side environment where sensitive environment variables (`MONGODB_URI`, `JWT_SECRET`, `CLOUDFLARE_API_TOKEN`, `GITHUB_CLIENT_SECRET`) reside exclusively.

2. **The Deployed User Applications (Edge Websites):**
   - User applications (e.g., Next.js, Vite, React, Astro, Nuxt sites imported from GitHub).
   - Deployed directly to Cloudflare Pages edge network under isolated project names (e.g., `userproject.pages.dev` or custom domains).
   - **Zero Execution in Control Plane:** User repository code is **never** executed inside the privileged DeployX control plane process. Build artifact coordination is delegated securely to the Cloudflare Pages deployment pipeline or an isolated runner.
   - **Credential Isolation:** Deployed websites never receive or inherit DeployX platform credentials.

```
+--------------------------------------------------------------------------------+
|                             USER BROWSER / CLIENT                              |
+--------------------------------------------------------------------------------+
                                       |
                HTTPS / TLS 1.3        |       HTTPS / Custom Domain
       +-------------------------------+-------------------------------+
       |                                                               |
       v                                                               v
+-------------------------------+                     +-------------------------------+
|     DEPLOYX CONTROL PLANE     |                     |     DEPLOYED USER WEBSITES    |
| (Vercel / Railway / Docker)   |                     |   (Cloudflare Pages Edge)     |
| - Next.js 16 App Router       |                     | - Static HTML / JS / Assets   |
| - Server Actions & API Routes |                     | - Isolated Edge Workers       |
| - Privileged Credentials      |                     | - Public Edge CDN             |
+-------------------------------+                     +-------------------------------+
       |                 |
       | Mongoose / TLS  | HTTPS API v4 (Scoped Bearer Token)
       v                 v
+---------------+ +-----------------------+
| MONGODB ATLAS | | CLOUDFLARE PAGES API  |
| (deployx_db)  | | - Project Management  |
| - Multi-tenant| | - Deployment Status   |
| - Compound idx| | - Direct Asset Upload |
+---------------+ +-----------------------+
```

---

## 2. Control Plane Hosting Environments

The DeployX control plane can be hosted on any modern Node.js hosting platform supporting Next.js 16 App Router:

### Recommended Option A: Vercel (Managed Serverless Next.js)
- **Strengths:** Native Next.js App Router support, automatic edge asset caching, automatic HTTPS with Let's Encrypt, zero-downtime rollbacks, preview deployments.
- **Runtime:** Node.js 20.x Serverless Functions.
- **Configuration:** Handled via standard Next.js build output. Set environment variables in Vercel Project Settings.

### Recommended Option B: Railway / Render / AWS App Runner (Container / Node Server)
- **Strengths:** Persistent Node.js process, continuous background workers, predictable memory allocation, native WebSocket support if real-time streaming is scaled.
- **Runtime:** `standalone` output or `next start` on Node.js 20-alpine.
- **Build Command:** `npm run build`
- **Start Command:** `npm run start`

---

## 3. Serverless vs. Persistent Runtime Considerations

1. **Database Connection Pooling:**
   - In serverless runtimes (AWS Lambda, Vercel), serverless functions freeze between invocations.
   - DeployX implements connection caching via `global.__mongooseCache` in `lib/mongodb/client.ts` with `maxPoolSize: 10`, `minPoolSize: 1`, and `serverSelectionTimeoutMS: 8000`. This prevents connection exhaustion during traffic bursts.

2. **Ephemeral File Storage:**
   - Cloud hosting environments provide ephemeral `/tmp` storage only.
   - DeployX stores all persistent state (projects, deployments, logs, user preferences) in MongoDB Atlas and avatar images as base64/data URIs or Cloudflare KV, ensuring stateless horizontal scalability.

3. **Background Tasks & Webhooks:**
   - GitHub webhook delivery (`/api/webhooks/github`) processes push events idempotently and dispatches deployment creation asynchronously within standard HTTP response timeouts (< 10 seconds).

---

## 4. Security & Isolation Boundaries

- **Server-Only Code Separation:** All database queries, encryption operations, GitHub API requests, and Cloudflare communications reside in `lib/` and `app/api/` and are never bundled into client-side JavaScript.
- **Zero-Trust Multi-Tenancy:** All queries to MongoDB composite tenant identifiers `{ userId, _id }`, preventing IDOR cross-tenant access.
- **Sensitive Log Redaction:** Real-time build log streaming applies `redactSensitiveData` before persisting or broadcasting logs to the browser.
