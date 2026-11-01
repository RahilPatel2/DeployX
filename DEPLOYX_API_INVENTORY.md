# DeployX — Complete API Inventory & Route Audit
**Document ID:** `DEPLOYX_API_INVENTORY.md`  
**Version:** 1.0.0 (Production Release Integrity Pass)  
**Lead Auditor:** Senior Full-Stack Software Reliability & Application Security Auditor  
**Workspace:** `d:\DEPLOYX`  

---

## 1. Executive Summary

This inventory details all 41 Next.js Route Handlers (`app/api/*`) operating across the DeployX platform. Each route has been audited for:
- Input validation (path parameters, query strings, and JSON payloads).
- Threat mitigation (rejection of malicious shell constructs, SQL/NoSQL injection escape, prototype pollution).
- Session authentication & token verification.
- Authorization & multi-tenant isolation (`userId` checks to prevent IDOR vulnerabilities).
- Standard HTTP status code discipline (200, 201, 400, 401, 403, 404, 409, 422, 500).
- Consistent JSON output schemas with secret redaction.
- Rate limiting enforcement on sensitive routes.
- Pagination bounds clamping (`page`, `limit`) on collection routes.

---

## 2. API Endpoint Catalog

### 2.1 Authentication & Identity Endpoints (`/api/auth/*`)

#### 1. `POST /api/auth/signup`
- **Purpose:** User registration and account creation.
- **Auth Required:** No.
- **Rate Limit:** 5 requests / 60s per IP.
- **Request Body:** `{ name: string, username: string, email: string, password: string }`.
- **Validation:** Zod schema validation (email regex, password $\ge 8$ chars with mixed case and symbols).
- **Status Codes:** `201 Created` (account provisioned), `400 Bad Request` (validation error), `409 Conflict` (email or username already exists), `500 Internal Server Error`.
- **Response:** `{ success: true, message: "Account created successfully", user: { id, email, username } }`.

#### 2. `POST /api/auth/login`
- **Purpose:** Authenticate user credentials and issue encrypted session cookie.
- **Auth Required:** No.
- **Rate Limit:** 5 requests / 60s per IP.
- **Request Body:** `{ email: string, password: string, remember?: boolean }`.
- **Validation:** Email lowercase trimmed, password present.
- **Security:** `bcrypt.compare` against hashed password, session token minted via `jose` HS256 with 7-day expiration and `tokenVersion`.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized` (invalid credentials), `500 Internal Server Error`.
- **Response:** `{ success: true, user: { id, name, email, username } }` + `Set-Cookie: session=...; HttpOnly; SameSite=Lax; Path=/`.

#### 3. `POST /api/auth/logout`
- **Purpose:** Clear session cookie and invalidate active token.
- **Auth Required:** Yes (graceful if session already expired).
- **Status Codes:** `200 OK`.
- **Response:** `{ success: true, message: "Logged out" }` + `Set-Cookie: session=; Max-Age=0`.

#### 4. `GET /api/auth/session`
- **Purpose:** Verify active session and return current user payload.
- **Auth Required:** Optional (returns `{ authenticated: false }` if absent).
- **Status Codes:** `200 OK`.
- **Response:** `{ authenticated: boolean, user?: { id, name, email, username, avatar } }`.

#### 5. `GET /api/auth/profile` & `PUT /api/auth/profile`
- **Purpose:** Retrieve and update authenticated user's profile details.
- **Auth Required:** Yes.
- **Request Body (PUT):** `{ name?: string, username?: string, bio?: string, phone?: string }`.
- **Validation:** Username characters `^[a-zA-Z0-9_-]+$`, max 32 chars; name max 64 chars; bio max 500 chars.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `409 Conflict` (username taken).

#### 6. `PUT /api/auth/password`
- **Purpose:** Rotate user password.
- **Auth Required:** Yes.
- **Request Body:** `{ currentPassword: string, newPassword: string }`.
- **Security:** Verifies `currentPassword` with bcrypt before accepting `newPassword`. Increments `tokenVersion` to invalidate any other stale sessions.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`.

#### 7. `GET /api/auth/sessions`
- **Purpose:** List active devices / sessions for current user.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 8. `POST /api/auth/sessions/revoke`
- **Purpose:** Revoke a specific session ID.
- **Auth Required:** Yes.
- **Request Body:** `{ sessionId: string }`.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`.

#### 9. `POST /api/auth/sessions/revoke-others`
- **Purpose:** Revoke all sessions except the currently active session.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 10. `POST /api/auth/email/change`
- **Purpose:** Initiate email change workflow.
- **Auth Required:** Yes.
- **Request Body:** `{ newEmail: string, password: string }`.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `409 Conflict`.

#### 11. `POST /api/auth/email/verify`
- **Purpose:** Validate 6-character email verification code.
- **Auth Required:** Yes.
- **Request Body:** `{ code: string }`.
- **Status Codes:** `200 OK`, `400 Bad Request`.

#### 12. `POST /api/auth/email/resend`
- **Purpose:** Resend verification code with rate limit backoff.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `429 Too Many Requests`.

#### 13. `DELETE /api/auth/account`
- **Purpose:** Permanent account deletion with cascading resource cleanup.
- **Auth Required:** Yes.
- **Request Body:** `{ password: string }`.
- **Status Codes:** `200 OK`, `401 Unauthorized`, `500 Internal Server Error`.

#### 14. `GET /api/auth/api-keys`, `POST /api/auth/api-keys`, `DELETE /api/auth/api-keys`
- **Purpose:** Manage programmatic API keys.
- **Auth Required:** Yes.
- **Security:** Keys hashed with SHA-256 (`keyHash`) before storage; raw key shown only once on creation.
- **Status Codes:** `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`.

---

### 2.2 Projects Management (`/api/projects/*`)

#### 15. `GET /api/projects`
- **Purpose:** Retrieve paginated list of user projects.
- **Auth Required:** Yes.
- **Query Params:** `page` (default 1), `limit` (default 20, max 100), `search`, `framework`, `sort`.
- **Security:** Scoped strictly by `userId: session.userId`.
- **Status Codes:** `200 OK`, `401 Unauthorized`.
- **Response:** `{ projects: Project[], total: number, page: number, totalPages: number }`.

#### 16. `POST /api/projects`
- **Purpose:** Create new project linked to GitHub repository.
- **Auth Required:** Yes.
- **Request Body:** `{ name: string, repository: string, branch?: string, framework?: string, buildCommand?: string, outputDirectory?: string, installCommand?: string, rootDirectory?: string, autoDeploy?: boolean }`.
- **Validation:** Command security check (`validateBuildCommand`), path traversal prevention on `rootDirectory` and `outputDirectory`.
- **Status Codes:** `201 Created`, `400 Bad Request`, `401 Unauthorized`, `409 Conflict` (slug exists).

#### 17. `GET /api/projects/[id]`
- **Purpose:** Retrieve single project details with deployment statistics.
- **Auth Required:** Yes.
- **Path Param:** `id` (validated as valid 24-character hexadecimal ObjectId).
- **Security:** Asserts `userId === session.userId` (404/403 if unowned).
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`.

#### 18. `PATCH /api/projects/[id]`
- **Purpose:** Update project configuration (branches, build commands, auto-deploy).
- **Auth Required:** Yes.
- **Path Param:** `id` (ObjectId).
- **Request Body:** Partial project schema.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`.

#### 19. `DELETE /api/projects/[id]`
- **Purpose:** Delete project and cascade-delete all deployments, domains, and environment variables.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`, `404 Not Found`.

#### 20. `POST /api/projects/[id]/webhook`
- **Purpose:** Register or re-synchronize GitHub auto-deploy webhook on the repository.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`, `502 Bad Gateway` (GitHub API failure).

---

### 2.3 Deployments & Pipeline (`/api/deployments/*`)

#### 21. `GET /api/deployments`
- **Purpose:** List recent deployments across all projects or filtered by `projectId`.
- **Auth Required:** Yes.
- **Query Params:** `projectId`, `status`, `page`, `limit`.
- **Security:** Scoped strictly by `userId: session.userId`.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 22. `POST /api/deployments`
- **Purpose:** Trigger a new build deployment.
- **Auth Required:** Yes.
- **Rate Limit:** 10 builds / 60s per user.
- **Request Body:** `{ projectId: string, branch?: string, commitHash?: string, trigger?: "manual" | "redeploy" }`.
- **Execution:** Spawns asynchronous sandboxed runner; persists initial `QUEUED` state.
- **Status Codes:** `201 Created`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`.

#### 23. `GET /api/deployments/[id]`
- **Purpose:** Deployment status, commit metadata, timings, and live URL.
- **Auth Required:** Yes.
- **Path Param:** `id` (ObjectId).
- **Status Codes:** `200 OK`, `401 Unauthorized`, `404 Not Found`.

#### 24. `DELETE /api/deployments/[id]`
- **Purpose:** Cancel an in-progress build and terminate its process.
- **Auth Required:** Yes.
- **Path Param:** `id` (ObjectId).
- **Security:** Sends termination signal (`taskkill` / `SIGTERM`) to active runner. Updates status to `CANCELED`.
- **Status Codes:** `200 OK`, `400 Bad Request` (already completed), `401 Unauthorized`, `404 Not Found`.

#### 25. `GET /api/deployments/[id]/logs`
- **Purpose:** Fetch or stream build output logs.
- **Auth Required:** Yes.
- **Query Params:** `tail` (optional integer line limit).
- **Security:** ANSI color stripping and secret token masking applied to all log output.
- **Status Codes:** `200 OK`, `401 Unauthorized`, `404 Not Found`.

#### 26. `POST /api/deployments/[id]/redeploy`
- **Purpose:** Redeploy exact pinned commit SHA of a previous deployment.
- **Auth Required:** Yes.
- **Path Param:** `id` (ObjectId).
- **Status Codes:** `201 Created`, `401 Unauthorized`, `404 Not Found`.

---

### 2.4 Custom Domains & Environment Variables

#### 27. `GET /api/domains`, `POST /api/domains`, `DELETE /api/domains`
- **Purpose:** Manage project custom domains and verify DNS CNAME/TXT status.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `409 Conflict`.

#### 28. `GET /api/environment-variables`, `POST /api/environment-variables`, `DELETE /api/environment-variables`
- **Purpose:** Manage encrypted project environment variables.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `404 Not Found`.

#### 29. `GET /api/env`
- **Purpose:** Alias / project environment variables viewer for selected project.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

---

### 2.5 Integrations & Webhooks

#### 30. `GET /api/integrations/github/status`
- **Purpose:** Check if authenticated user has connected their GitHub account.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 31. `GET /api/integrations/github/connect`
- **Purpose:** Initiate GitHub OAuth 2.0 authorization redirect.
- **Auth Required:** Yes.
- **Status Codes:** `307 Temporary Redirect` to `https://github.com/login/oauth/authorize`.

#### 32. `GET /api/integrations/github/callback`
- **Purpose:** OAuth redirect landing point; exchanges code for access token.
- **Auth Required:** Yes.
- **Security:** State parameter verification; token encrypted via AES-256-GCM.
- **Status Codes:** `307 Temporary Redirect` back to dashboard.

#### 33. `GET /api/integrations/github/repos`
- **Purpose:** List user's GitHub repositories with pagination.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 34. `GET /api/integrations/github/branches`
- **Purpose:** List git branches for a specific repository.
- **Auth Required:** Yes.
- **Query Params:** `owner`, `repo`.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`.

#### 35. `POST /api/integrations/github/framework`
- **Purpose:** Inspect repository root manifest to detect framework (Next.js, Vite, Astro, Remix, etc.).
- **Auth Required:** Yes.
- **Request Body:** `{ owner: string, repo: string, branch?: string }`.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`.

#### 36. `GET /api/integrations/cloudflare/status`
- **Purpose:** Verify Cloudflare credentials and connection status.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 37. `POST /api/webhooks/github`
- **Purpose:** Inbound webhook receiver for GitHub push events.
- **Auth Required:** No (HMAC verification required).
- **Headers:** `x-hub-signature-256`, `x-github-event`, `x-github-delivery`.
- **Security:** Validates SHA-256 HMAC signature against project `webhookSecret` with `crypto.timingSafeEqual`. Ignores branches not configured for auto-deploy. Dispatches isolated build pipeline.
- **Status Codes:** `200 OK` (processed or gracefully ignored), `400 Bad Request`, `401 Unauthorized` (bad signature).

---

### 2.6 Collaboration, User Settings & Platform Telemetry

#### 38. `GET /api/search`
- **Purpose:** Unified global search across navigation routes, user projects, and deployments.
- **Auth Required:** Yes.
- **Query Params:** `q` (string).
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 39. `GET /api/notifications` & `PATCH /api/notifications`
- **Purpose:** Retrieve user notifications and mark items as read.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 40. `GET /api/activity`
- **Purpose:** Retrieve workspace activity events.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 41. `GET /api/analytics`
- **Purpose:** Compute deployment duration trends and success rate metrics.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 42. `GET /api/team/invites` & `POST /api/team/invites`
- **Purpose:** Team invitation management and role assignment.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `201 Created`, `401 Unauthorized`.

#### 43. `POST /api/user/avatar`
- **Purpose:** Profile avatar upload.
- **Auth Required:** Yes.
- **Security:** Magic byte validation for PNG (`89 50 4E 47`) and JPEG (`FF D8 FF`), 5MB size limit.
- **Status Codes:** `200 OK`, `400 Bad Request`, `401 Unauthorized`.

#### 44. `GET /api/user/preferences` & `PUT /api/user/preferences`
- **Purpose:** Manage UI theme, default view mode, and email notification toggles.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`, `401 Unauthorized`.

#### 45. `GET /api/security/csrf`
- **Purpose:** Issue cryptographic CSRF token for state-changing forms.
- **Auth Required:** Yes.
- **Status Codes:** `200 OK`.

#### 46. `GET /api/health`
- **Purpose:** Automated system health check for uptime monitors and load balancers.
- **Auth Required:** No.
- **Checks:** MongoDB connection status, memory utilization, environment integrity.
- **Status Codes:** `200 OK` (healthy), `503 Service Unavailable` (degraded).

---

## 3. Audit Verification

All API endpoints enforce strict input validation, sanitize inputs against shell injection and traversal, require authentication on sensitive data, verify resource ownership, and produce consistent JSON response formats with secret redaction.
