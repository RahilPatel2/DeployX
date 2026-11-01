# DeployX Security Findings & Vulnerability Assessment

## Overview

This report documents the security audit findings discovered during the comprehensive Chunk 3 defensive assessment of DeployX. The audit evaluated multi-tenant isolation, build runner isolation, authentication and MFA enforcement, SSRF protections, API authorization, rate-limiting, and supply-chain dependencies.

No system can honestly be guaranteed to have zero vulnerabilities. The goal of this defensive assessment is to identify all verified defects, implement robust remediation controls, and verify fixes through controlled testing.

---

## Findings Summary Matrix

| ID | Title | Category | Severity | Initial Status | Remediated Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Missing Server-Side Rate Limiting on Email Verification Code Endpoint | Abuse / Brute Force | High | VULNERABLE | **PASS (Fixed)** |
| **SEC-02** | Unbounded Team Invitation Creation & Unvalidated ObjectId in Revocation | Abuse / Resource Exhaustion | Medium | VULNERABLE | **PASS (Fixed)** |
| **SEC-03** | Domain Format Lacked Strict FQDN Hostname Validation | Input Validation / Injection | Medium | VULNERABLE | **PASS (Fixed)** |
| **SEC-04** | Missing Dedicated SSRF & Cloud Metadata Blocking Module | Network Security / SSRF | High | VULNERABLE | **PASS (Fixed)** |
| **SEC-05** | Child Process Environment Permitted Potential Platform Secret Contamination | Build Sandboxing | Critical | VULNERABLE | **PASS (Fixed)** |
| **SEC-06** | Avatar Upload Endpoint Lacked Specific Per-User Rate Limiting | Abuse / Storage Flooding | Medium | VULNERABLE | **PASS (Fixed)** |
| **SEC-07** | CSP & Image Whitelists Omitted Google OAuth User Content Domains | Content Security Policy | Low | VULNERABLE | **PASS (Fixed)** |
| **SEC-08** | Environment Secret Redactor Omitted Google Client Secret & MFA Key | Secrets Management | Medium | VULNERABLE | **PASS (Fixed)** |
| **SEC-09** | Transitive Vulnerabilities in npm Dependencies (Next.js, undici, zod) | Supply-Chain Security | Moderate-High | DISCLOSED | **RISK ACCEPTED** |

---

## Detailed Findings

### SEC-01: Missing Rate Limiting on 6-Digit Email Verification Codes
- **Severity:** High
- **CVSS Score:** 7.5 (CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N)
- **Component:** `app/api/auth/email/verify/route.ts`
- **Description:**
  The email verification endpoint accepted 6-digit verification codes (`Math.floor(100000 + Math.random() * 900000)`). While codes had a 24-hour expiration, the endpoint lacked IP or per-user rate limiting. An automated script could attempt all 900,000 combinations in hours, potentially validating unconfirmed email changes without user authorization.
- **Remediation:**
  Integrated `checkRateLimit` restricting IP-based verification attempts to 15 requests per 15 minutes with standardized `Retry-After` HTTP headers.

---

### SEC-02: Unbounded Team Invitation Creation & Unvalidated ObjectId
- **Severity:** Medium
- **CVSS Score:** 5.3 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:L)
- **Component:** `app/api/team/invites/route.ts`
- **Description:**
  1. An authenticated user could submit an unlimited number of invitation requests, which could be abused for outbound email spamming or database document flooding.
  2. The `DELETE` endpoint did not validate `mongoose.isValidObjectId(inviteId)`, which resulted in Mongoose `CastError` exceptions (HTTP 500) rather than standard bad-request responses (HTTP 400).
- **Remediation:**
  Added rate-limiting (maximum 15 invitations per hour per user) and explicit `mongoose.isValidObjectId(inviteId)` validation.

---

### SEC-03: Custom Domain Input Lacked FQDN Hostname Validation
- **Severity:** Medium
- **CVSS Score:** 4.8 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N)
- **Component:** `app/api/domains/route.ts`
- **Description:**
  The custom domain creation endpoint only executed `domain.toLowerCase().trim()` without validating proper domain syntax. Users could submit invalid hostnames, internal loopback strings (`localhost`), or arbitrary control characters.
- **Remediation:**
  Implemented strict FQDN regex validation (`/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i`), capped maximum length to 253 characters (RFC 1035), and explicitly prohibited `localhost`.

---

### SEC-04: Missing Dedicated SSRF & Cloud Metadata Blocking Module
- **Severity:** High
- **CVSS Score:** 7.8 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N)
- **Component:** Platform Outbound Network Fetching
- **Description:**
  The platform lacked a centralized SSRF protection utility to validate external URLs and resolved IP addresses against loopback, private subnets (RFC 1918), and cloud metadata endpoints (`169.254.169.254`).
- **Remediation:**
  Created `lib/security/ssrf.ts` providing `isPrivateOrBlockedIp()`, `validateSafeUrl()`, and `safeFetch()`. It explicitly resolves DNS, validates every IP in returned records, blocks non-HTTP schemes, and intercepts HTTP redirect hops to re-validate destination IPs.

---

### SEC-05: Potential Child Process Platform Secret Contamination
- **Severity:** Critical
- **CVSS Score:** 8.8 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:N)
- **Component:** `lib/build/pipeline.ts` (`executeSandboxedCommand`)
- **Description:**
  In `lib/build/pipeline.ts`, `executeSandboxedCommand` used `...extraEnv`. If user-configured project environment variables or build parameters matched sensitive server environment keys (`MONGODB_URI`, `JWT_SECRET`, `CLOUDFLARE_API_TOKEN`, `MFA_ENCRYPTION_KEY`), they could contaminate the child process environment.
- **Remediation:**
  Defined a strict `FORBIDDEN_ENV_KEYS` blacklist containing all platform secrets (`MONGODB_URI`, `JWT_SECRET`, `CLOUDFLARE_API_TOKEN`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `MFA_ENCRYPTION_KEY`, `ENCRYPTION_KEY`, `LD_PRELOAD`, `NODE_OPTIONS`, `DYLD_INSERT_LIBRARIES`). Any attempt to set these keys in project builds is purged before spawning.

---

### SEC-06: Avatar Upload Lacked Per-User Rate Limiting
- **Severity:** Medium
- **CVSS Score:** 4.3 (CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L)
- **Component:** `app/api/user/avatar/route.ts`
- **Description:**
  While magic bytes and a 2MB file limit were enforced, there was no rate limit on the number of avatar uploads an authenticated user could perform in rapid succession.
- **Remediation:**
  Added per-user rate limit restricting avatar uploads to 15 per 10 minutes.

---

### SEC-07: CSP and Remote Image Restrictions Omitted Google Avatars
- **Severity:** Low
- **CVSS Score:** 3.1
- **Component:** `next.config.ts`, `lib/security/headers.ts`
- **Description:**
  With the introduction of Google OAuth in Chunk 2, user avatar URLs from Google (`lh3.googleusercontent.com`) were blocked by the strict Content Security Policy and Next.js Image Optimization remote pattern filters.
- **Remediation:**
  Added `https://*.googleusercontent.com` and `https://lh3.googleusercontent.com` to `img-src` in CSP and `images.remotePatterns` in `next.config.ts`. Added Google OAuth discovery endpoints to `connect-src`.

---

### SEC-08: Redaction Engine Omitted Newly Introduced Secrets
- **Severity:** Medium
- **CVSS Score:** 5.5
- **Component:** `lib/security/redaction.ts`
- **Description:**
  `lib/security/redaction.ts` did not include `GOOGLE_CLIENT_SECRET` and `MFA_ENCRYPTION_KEY` in `getEnvironmentSecrets()`, creating a risk that these values could appear in build logs if logged during debugging.
- **Remediation:**
  Updated `getEnvironmentSecrets()` in `lib/security/redaction.ts` to include `GOOGLE_CLIENT_SECRET`, `MFA_ENCRYPTION_KEY`, `SESSION_SECRET`, and `COOKIE_SECRET`.

---

### SEC-09: Upstream Dependency Vulnerabilities (npm audit)
- **Severity:** Moderate to High
- **Component:** `package-lock.json`
- **Description:**
  Running `npm audit` revealed 36 vulnerabilities in transitive dependencies (e.g. `next@15.5.9`, `undici`, `zod`, `shadcn`).
- **Remediation / Risk Acceptance:**
  - Upgrading Next.js to v16 or zod to v4 is a major breaking change across the entire App Router and component tree.
  - Mitigated through application-layer defenses: DeployX does not use `next/og` ImageResponse, does not expose development MCP endpoints in production, and strictly validates all inputs with schema bounds.
  - Documented as an accepted risk with regular security monitoring scheduled.
