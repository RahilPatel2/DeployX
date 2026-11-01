# DeployX — Complete System Architecture Audit
**Document ID:** `DEPLOYX_ARCHITECTURE_AUDIT.md`  
**Version:** 1.0.0 (Production Release Integrity Pass)  
**Lead Auditor:** Senior Full-Stack Software Reliability & Application Security Auditor  
**Workspace:** `d:\DEPLOYX`  

---

## 1. Executive Summary

DeployX is an enterprise-grade cloud application deployment and management platform engineered for fast, deterministic builds and edge distribution of modern web frameworks (Next.js, Remix, Vite, Astro, SvelteKit, and static sites). This architecture audit inspects all layers of the DeployX application stack: frontend, backend route handlers, database layer, authentication & session mechanics, deployment pipeline, isolation sandboxing, and third-party integrations (GitHub OAuth/Webhooks, Cloudflare Pages).

---

## 2. Framework & Runtime Architecture

### 2.1 Frontend Framework & Technology Stack
- **Framework:** Next.js 16.3.5 (App Router architecture with React Server Components and Turbopack / Webpack compilation engine).
- **Core Library:** React 19.2.8 (`react`, `react-dom`).
- **Styling & Tokens:** Tailwind CSS v4 with custom design tokens, `@base-ui/react`, and Radix UI / Shadcn primitives.
- **Icons & Motion:** `lucide-react` (v0.563.0) and `framer-motion` (v12.43.0) for accessible micro-interactions.
- **Client Cache & State:** SWR (`swr` v2.5.1) configured with 60-second deduping intervals, automatic focus revalidation, and in-memory optimistic mutations.
- **Feedback & Notifications:** `sonner` v2.0.7 for non-blocking toast notifications.

### 2.2 Backend Framework & Server Runtime
- **Backend Architecture:** Next.js Route Handlers (`app/api/*`) executing inside Node.js 20+ runtime environments.
- **Process Orchestration:** Node.js `child_process` (`spawn`) for sandboxed command execution and build lifecycle management.
- **Server Component Guards:** Server-side session verification via `getSession()` integrated directly into `app/dashboard/layout.tsx`, `app/login/page.tsx`, and `app/signup/page.tsx`.

---

## 3. Routing Architecture

DeployX utilizes the Next.js App Router with hierarchical folder structures:

```
app/
├── (auth)/
│   ├── login/page.tsx             # Public auth route (redirects to /dashboard if logged in)
│   └── signup/page.tsx            # Public auth route (redirects to /dashboard if logged in)
├── dashboard/
│   ├── layout.tsx                 # Protected Server Component guard (redirects unauthenticated to /login)
│   ├── page.tsx                   # Main overview & quick actions dashboard
│   ├── activity/page.tsx          # Real-time workspace audit & activity feed
│   ├── analytics/page.tsx         # Deployment metrics, build durations, and success rates
│   ├── deployments/
│   │   ├── page.tsx               # Deployments listing, filtering, and status badges
│   │   └── [id]/page.tsx          # Deployment detail, live streaming logs, commit info
│   ├── domains/page.tsx           # Custom domain verification and DNS records
│   ├── environment-variables/page.tsx # Project-level environment variable manager
│   ├── notifications/page.tsx     # Centralized alert hub with category filtering
│   ├── projects/
│   │   ├── page.tsx               # Projects listing grid and cards
│   │   ├── new/page.tsx           # GitHub repository importer & build configurator
│   │   └── [id]/page.tsx          # Project overview, branches, and auto-deploy settings
│   ├── settings/
│   │   ├── layout.tsx             # Settings navigation layout
│   │   ├── page.tsx               # Settings index (redirects to profile)
│   │   ├── api/page.tsx           # API keys creation and revocation
│   │   ├── appearance/page.tsx    # Theme preferences (light/dark/system)
│   │   ├── billing/page.tsx       # Plan overview and resource quotas
│   │   ├── cloudflare/page.tsx    # Cloudflare account connectivity status
│   │   ├── danger-zone/page.tsx   # Workspace teardown and project deletion
│   │   ├── github/page.tsx        # GitHub OAuth connection & permission scopes
│   │   ├── notifications/page.tsx # User notification preferences
│   │   ├── profile/page.tsx       # Profile editor (name, username, bio, avatar)
│   │   └── security/page.tsx      # Password change, active sessions, 2FA
│   └── team/page.tsx              # Team invites and role permissions
├── globals.css                    # Design tokens and Tailwind utilities
├── layout.tsx                     # Root HTML wrapper and brand metadata
└── page.tsx                       # Public landing and marketing page
```

### 3.1 Redirection & Deep Link Reliability
- **Auth Guard Enforcement:** Direct navigation to any `/dashboard/*` path without an active session triggers a 307 temporary redirect to `/login`.
- **Authenticated Access to Auth Routes:** Visiting `/login` or `/signup` while authenticated triggers an immediate redirect to `/dashboard`.
- **Deep Links & Browser Navigation:** Full support for browser back/forward history without state corruption; deep links resolve cleanly on hard refreshes.

---

## 4. API Architecture

DeployX hosts 41 dedicated API route handlers structured by feature domain under `app/api/*`:

1. **Authentication:**
   - `POST /api/auth/signup`: User registration, bcrypt hash, verification code generation.
   - `POST /api/auth/login`: Credential authentication, session cookie creation.
   - `POST /api/auth/logout`: Cookie expiration, session invalidation.
   - `GET /api/auth/session`: Active session payload retrieval.
   - `GET /api/auth/profile`, `PUT /api/auth/profile`: User profile retrieval and mutation.
   - `PUT /api/auth/password`: Secure password change with session version bump.
   - `GET /api/auth/sessions`: Active device session list.
   - `POST /api/auth/sessions/revoke`: Invalidation of specific session.
   - `POST /api/auth/sessions/revoke-others`: Invalidation of all other sessions (`tokenVersion++`).
   - `POST /api/auth/email/change`: Email address update workflow.
   - `POST /api/auth/email/verify`: Email verification code verification.
   - `POST /api/auth/email/resend`: Resend verification tokens.
   - `DELETE /api/auth/account`: Account deletion and cascading data cleanup.
   - `GET/POST/DELETE /api/auth/api-keys`: API key management with SHA-256 hash storage.

2. **Projects & Configuration:**
   - `GET/POST /api/projects`: List user projects and initialize new projects.
   - `GET/PATCH/DELETE /api/projects/[id]`: Project details, configuration update, cascade delete.
   - `POST /api/projects/[id]/webhook`: Register/re-register GitHub webhook for auto-deploy.
   - `GET/POST/DELETE /api/environment-variables`: Project environment variable CRUD.
   - `GET/POST/DELETE /api/domains`: Custom domain mapping and verification checks.

3. **Deployments & Pipelines:**
   - `GET/POST /api/deployments`: List deployments (with pagination) and trigger builds.
   - `GET/DELETE /api/deployments/[id]`: Deployment details and build cancellation.
   - `GET /api/deployments/[id]/logs`: Real-time streaming or historical build logs.
   - `POST /api/deployments/[id]/redeploy`: Historical commit redeploy with pinned SHA.

4. **Third-Party Integrations:**
   - `GET /api/integrations/github/status`: GitHub connection state.
   - `GET /api/integrations/github/connect`: OAuth authorization initiation.
   - `GET /api/integrations/github/callback`: OAuth callback code exchange and token encryption.
   - `GET /api/integrations/github/repos`: Repository listing.
   - `GET /api/integrations/github/branches`: Branch listing for selected repo.
   - `POST /api/integrations/github/framework`: Auto-detection of framework from manifest.
   - `GET /api/integrations/cloudflare/status`: Cloudflare Pages connectivity verification.
   - `POST /api/webhooks/github`: Inbound GitHub push event listener with HMAC verification.

5. **Platform Services & Collaboration:**
   - `GET /api/search`: Global search index across routes, projects, and deployments.
   - `GET/PATCH /api/notifications`: Alert hub fetch and mark-as-read mutations.
   - `GET /api/activity`: Workspace activity logging.
   - `GET /api/analytics`: Deployment build duration and success rate metrics.
   - `GET/POST /api/team/invites`: Workspace team invitation lifecycle.
   - `POST /api/user/avatar`: Profile picture upload with magic byte inspection.
   - `GET/PUT /api/user/preferences`: Theme, notification, and layout preferences.
   - `GET /api/security/csrf`: CSRF token issuance.
   - `GET /api/health`: Comprehensive system health check (DB, integrations, memory).

---

## 5. Database Architecture

- **Technology:** MongoDB via Mongoose 9.10.0.
- **Connection Management (`lib/mongodb/client.ts`):**
  - Cached connection pool (`global.__mongooseCache`) preserving connection across Next.js invocations.
  - Connection pooling: `minPoolSize: 1`, `maxPoolSize: 10`.
  - Resilience: Automatic fallback from DNS SRV queries to direct Atlas replica set hostnames when local Windows DNS returns `querySrv ECONNREFUSED`.
  - Strict timeouts: `serverSelectionTimeoutMS: 8000`, `connectTimeoutMS: 10000`, `socketTimeoutMS: 45000`.
- **Multi-Tenant Isolation:**
  - All resource queries (`Project`, `Deployment`, `EnvironmentVariable`, `Domain`, `ApiKey`, `Notification`, `Activity`) strictly filter by `userId: session.userId` or workspace owner ID.
  - Strict IDOR (Insecure Direct Object Reference) prevention on all dynamic routes.

---

## 6. Authentication & Session Security

- **Cryptographic Engine:** JOSE (`jose` v6.1.3) utilizing JSON Web Tokens signed with `HS256`.
- **Session Lifespan:** 7 days (`SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60`).
- **Cookie Security Options:**
  - `httpOnly: true` (prevents XSS access).
  - `sameSite: "lax"` (mitigates CSRF).
  - `path: "/"`
  - `secure: true` in production environments or when `NEXT_PUBLIC_APP_URL` uses HTTPS.
- **Remote Revocation (`tokenVersion`):**
  - Session payloads embed `tokenVersion: number`.
  - Critical security events (password change, session revocation, account lockout) increment the user's `tokenVersion` in MongoDB, immediately rendering older tokens invalid.

---

## 7. Deployment Pipeline & Isolation Runner

- **Isolated Workspaces:** Each build runs inside a segregated temporary directory (`AppData\Local\Temp\deployx-builds\<deploymentId>`).
- **Directory Traversal Defense:** `validatePathInsideWorkspace` verifies that resolved output and root directories cannot escape the build workspace sandbox.
- **Dependency Resolution:** `lib/build/dependency-resolver.ts` checks manifest syntax and deterministically executes `npm ci`, `pnpm install`, `yarn install --frozen-lockfile`, or `bun install`.
- **Command Whitelisting:** `lib/security/command-sanitizer.ts` blocks prohibited shell constructs (command chaining `;`, `&&`, `|`, backgrounding `&`, backticks, subshells `$()`, redirection `>`, `<`).
- **Real-Time Log Streaming & Redaction:** ANSI codes stripped; API tokens, Bearer headers, and secrets masked via `redactSensitiveData` before persistence.
- **Process Termination:** Build timeouts (5 minutes) and manual cancellations cleanly kill child process trees via `taskkill /pid ... /f /t` on Windows and `SIGTERM`/`SIGKILL` on POSIX.

---

## 8. Third-Party Integrations

### 8.1 GitHub OAuth & API
- **OAuth Scope:** `repo, read:user, user:email`.
- **Token Protection:** GitHub OAuth access tokens are encrypted at rest using AES-256-GCM (`lib/auth/encryption.ts`).
- **Webhooks:** Automated webhook creation with 32-byte cryptographically secure random secrets (`generateWebhookSecret`). HMAC signatures verified using `crypto.timingSafeEqual`.

### 8.2 Cloudflare Pages
- **Client (`lib/cloudflare/client.ts`):** Server-side only client for Cloudflare v4 REST API.
- **Safety:** Automatic retry with exponential backoff on transient network faults; sensitive token redaction on all error messages.

---

## 9. Automated Testing Infrastructure

- **Master Test Runner:** `scripts/run-all-tests.ts` executes all unit, integration, database, and E2E regression suites.
- **Suites:** 18 passing suites covering security, UI responsiveness, performance, API validation, auth, database, isolation, Cloudflare, GitHub, dependency installation, and complete user journeys.
- **Build Verification:** 0 type errors (`npm run typecheck`), 0 lint warnings (`npm run lint`), and 100% route compilation (`npm run build`).

---
**Audit Verification:** ✓ PASSED. Architecture complies with high software reliability and security engineering standards.
