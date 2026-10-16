# DeployX Production Deployment, Maintenance & Rollback Runbook

**Runbook Version:** 1.0.0  
**Target Platform:** Next.js 16 (App Router) on Managed Node.js / Serverless Hosting  
**Operational Status:** Production-Ready Preflight Verified

---

## 1. Hosting Architecture & Prerequisites

The DeployX control plane backend runs as a Next.js application, separated from user-deployed edge applications.

- **Recommended Host:** Vercel, Railway, or containerized Docker on AWS App Runner / ECS.
- **Node.js Target:** 20.x LTS or higher.
- **Lockfile Integrity:** Always install via `npm ci` using `package-lock.json`.
- **Database:** MongoDB Atlas (AWS cluster, `deployx_db`).
- **Edge Deployment Target:** Cloudflare Pages API v4.

---

## 2. Secure Environment Variable Configuration

Configure the following environment variables in your hosting provider's encrypted environment settings (do NOT place them in source code or unencrypted files):

```env
# Application Runtime & URL (No trailing slash)
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://deployx.yourdomain.com

# Database (Atlas SRV URI + deployx_db database)
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=deployx_db

# Authentication Session Secret (Generate with: openssl rand -hex 32)
JWT_SECRET=<32+_character_random_hex_secret>

# GitHub OAuth Integration
GITHUB_CLIENT_ID=<github_oauth_client_id>
GITHUB_CLIENT_SECRET=<github_oauth_client_secret>

# Cloudflare Pages Integration
CLOUDFLARE_ACCOUNT_ID=<32_hex_char_account_id>
CLOUDFLARE_API_TOKEN=<scoped_api_token_with_pages_edit_permission>
```

---

## 3. MongoDB Atlas Network & User Configuration

1. **User Setup:**
   - In Atlas Console (**Database Access**), create user `deployx_app_user`.
   - Grant role: `readWrite` on `deployx_db` ONLY.
2. **Network Security:**
   - In Atlas Console (**Network Access**), whitelist the static outbound egress IP(s) of your hosting provider.
   - If using Vercel, link via the official MongoDB Atlas Vercel Integration or restrict the Atlas user with strong credentials and TLS 1.3.

---

## 4. GitHub OAuth Application Configuration

1. In GitHub (**Settings** -> **Developer settings** -> **OAuth Apps** -> **New OAuth App**):
   - **Application Name:** `DeployX`
   - **Homepage URL:** `https://deployx.yourdomain.com`
   - **Authorization Callback URL:** `https://deployx.yourdomain.com/api/integrations/github/callback`
2. Copy the generated `Client ID` and generate a `Client Secret`.
3. Add these to your production environment settings as `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.

---

## 5. Cloudflare Pages Scoped Token Configuration

1. In Cloudflare (**My Profile** -> **API Tokens** -> **Create Token** -> **Create Custom Token**):
   - **Token Name:** `DeployX-Pages-Deployer`
   - **Permissions:** `Account` -> `Cloudflare Pages` -> `Edit`
   - **Account Resources:** `Include` -> `Specific account` -> `<Your Cloudflare Account>`
2. Retrieve your 32-character **Account ID** from the Cloudflare Dashboard overview.
3. Configure `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` in hosting settings.

---

## 6. Custom Domain & DNS Mapping

1. In your DNS manager (Cloudflare DNS, Route53, Namecheap):
   - Add a `CNAME` record for `deployx` pointing to your hosting provider's assigned CNAME target.
2. Verify TLS certificate is provisioned automatically (Let's Encrypt / DigiCert).
3. Confirm HTTP to HTTPS redirect is active.

---

## 7. Pre-Deployment Build & Test Checks

Run the following locally before triggering a release:

```bash
# 1. Validate environment configuration
npx tsx scripts/validate-production-env.ts

# 2. Strict TypeScript type check
npm run typecheck

# 3. Full automated test suite (11+ suites)
npm test

# 4. Production Next.js build compilation
npm run build
```

---

## 8. Post-Deployment Smoke Test Procedure

Once deployed to production:
1. **Liveness & Health Check:**
   ```bash
   curl -i https://deployx.yourdomain.com/api/health
   ```
   - Verify HTTP 200 response with `status: "ok"` and `database: "connected"`.
   - Verify `Cache-Control: no-store, no-cache` header is present.
2. **Security Headers Verification:**
   ```bash
   curl -I https://deployx.yourdomain.com/
   ```
   - Confirm `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Content-Security-Policy`.
3. **Authentication & Session Smoke Test:**
   - Navigate to `https://deployx.yourdomain.com/login`.
   - Sign up a test user or log in.
   - Verify cookie `session` is issued with `HttpOnly`, `SameSite=Lax`, and `Secure` flags.
4. **GitHub Connection & Cloudflare Test:**
   - In Settings -> Integrations, verify GitHub OAuth redirects correctly to GitHub and returns without error.
   - Verify Cloudflare connectivity status is reported as OK in settings.

---

## 9. Safe Log Inspection

- Never log `process.env` or print unredacted objects containing request tokens.
- Server logs automatically pass through `redactSensitiveData`.
- In platform logging sinks (e.g. Vercel Logs, Datadog, CloudWatch), filter on `[DeployX]` tags for structured operational diagnostics.

---

## 10. Application Rollback Procedure

If a critical defect or regression is identified post-launch:
1. **Instant Hosting Rollback:**
   - In Vercel / Railway / Render dashboard: Navigate to **Deployments** -> select the previous known good deployment -> click **Promote to Production** / **Rollback**. Instant zero-downtime rollback occurs in < 5 seconds.
2. **Git Rollback (If needed):**
   - Revert the problematic commit via standard Git:
     ```bash
     git revert <commit-sha>
     ```
   - Build and test locally before releasing.
3. **Database Safeguards:**
   - Because DeployX schema migrations preserve backward compatibility and compound indexes are non-destructive, rolling back application code will not corrupt `deployx_db` collections.

---

## 11. Operational Verification Summary: Local vs. Manual Dashboard Steps

| Item | Verified Locally | Requires Manual Dashboard Step |
| :--- | :---: | :---: |
| Next.js App Router Build (`npm run build`) | **YES** | No |
| TypeScript Types (`npm run typecheck`) | **YES** | No |
| Automated Test Suites (`npm test`) | **YES** | No |
| Production Environment Validator | **YES** | No |
| Canonical URL & HTTPS Logic | **YES** | No |
| Anti-Caching & Security Headers | **YES** | No |
| MongoDB Atlas Connection Sanitization | **YES** | No |
| Atlas IP Whitelist / Vercel Integration | No | **YES** (In Atlas Console) |
| GitHub OAuth App Callback Registration | No | **YES** (In GitHub Developer Settings) |
| Cloudflare Scoped Token Creation | No | **YES** (In Cloudflare Dashboard) |
| DNS CNAME / Apex Mapping | No | **YES** (In DNS Registrar) |
