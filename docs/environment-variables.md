# DeployX Environment Variables & Security Constraints Specification

**Document Version:** 1.0.0  
**Security Classification:** Configuration Guide  

This specification defines the complete matrix of environment variables required by the DeployX platform, their formats, security boundaries, and validation requirements.

---

## 1. Environment Variable Matrix

| Variable Name | Exposure | Required In Production | Allowed Format / Pattern | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Server / Client | Recommended | `production` \| `development` \| `test` | Runtime mode. Enforces HTTPS cookie flags, CSP rules, and strict validation. |
| `NEXT_PUBLIC_APP_URL` | Public Client / Server | **YES** | `^https?:\/\/[^\/]+$` (No trailing slash) | Canonical public URL used for OAuth callbacks, webhook verification, and redirects. |
| `MONGODB_URI` | Private Server-Only | **YES** | `^mongodb(\+srv)?:\/\/...` | MongoDB Atlas cluster connection string with authentication credentials. |
| `MONGODB_DB` | Private Server-Only | Optional (Defaults to `deployx_db`) | `^[a-zA-Z0-9_-]+$` | MongoDB database name. Strictly isolates collections within `deployx_db`. |
| `JWT_SECRET` | Private Server-Only | **YES** | String, min 32 characters | High-entropy key used by `jose` to sign HS256 authentication cookies. |
| `GITHUB_CLIENT_ID` | Private Server-Only | **YES** | String (e.g., `Iv1...` or `Ov23...`) | OAuth client identifier from GitHub Developer Settings. |
| `GITHUB_CLIENT_SECRET` | Private Server-Only | **YES** | String (40-char hex) | OAuth client secret from GitHub Developer Settings. Never exposed to browser. |
| `GITHUB_CALLBACK_URL` | Private Server-Only | Optional | Valid HTTPS URL | Overrides standard `${NEXT_PUBLIC_APP_URL}/api/integrations/github/callback`. |
| `ENCRYPTION_KEY` | Private Server-Only | Optional | 64-character hex string (32 bytes) | Dedicated AES-256-GCM encryption key for GitHub access tokens at rest. |
| `CLOUDFLARE_ACCOUNT_ID` | Private Server-Only | **YES** | `^[a-f0-9]{32}$` (32 hex characters) | Cloudflare account identifier for Pages project deployment API requests. |
| `CLOUDFLARE_API_TOKEN` | Private Server-Only | **YES** | String, minimum 40 characters | Scoped API bearer token with `Account:Cloudflare Pages:Edit` permissions. |

---

## 2. Public vs. Private Boundary Rules

1. **Prefix Security:**
   - Only variables explicitly prefixed with `NEXT_PUBLIC_` are bundled into browser JavaScript by Next.js.
   - `NEXT_PUBLIC_APP_URL` is the **only** public environment variable used by DeployX.
   - All other credentials (`MONGODB_URI`, `JWT_SECRET`, `CLOUDFLARE_API_TOKEN`, `GITHUB_CLIENT_SECRET`) are strictly server-side and must never have a `NEXT_PUBLIC_` prefix.

2. **Log Sanitization & Secret Masking:**
   - DeployX's `redactSensitiveData` utility automatically redacts all active secret values from build logs, server traces, and API responses.
   - Calling `console.log(process.env)` is prohibited in production code to avoid accidental disclosure in platform logging sinks.

3. **Production Secret Generation:**
   - Generate strong cryptographically random keys for `JWT_SECRET` and `ENCRYPTION_KEY`:
     ```bash
     openssl rand -hex 32
     ```
