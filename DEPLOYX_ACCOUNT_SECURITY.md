# DeployX — Advanced Account Security & Defense-in-Depth
**Document ID:** `DEPLOYX_ACCOUNT_SECURITY.md`  
**Version:** 2.0.0 (Production Release Pass)  
**Lead Architect:** Senior Application Security & Reliability Auditor  
**Workspace:** `d:\DEPLOYX`  

---

## 1. Executive Summary

This document details the multi-layered defense architecture protecting user accounts, workspaces, build environments, and API endpoints against account takeover, brute-force attacks, timing analysis, and unauthorized privilege escalation.

---

## 2. Authentication State Machine

DeployX establishes a strict state machine governing user access:

```
[Unauthenticated]
       │
       ├─► (Password Login) ────► [Credentials Verified] ──► MFA Enabled?
       │                                                         │
       │                                           ┌─────────────┴─────────────┐
       │                                           ▼                           ▼
       │                                        [No MFA]                 [MFA Required]
       │                                           │                           │
       │                                           │                 [Auth Challenge Issued]
       │                                           │                           │
       │                                           │               (Verify TOTP / Recovery)
       │                                           │                           │
       │                                           ▼                           ▼
       │                                    [Session Issued] ◄─────────────────┘
       │                                           │
       └─► (Google OAuth) ─────► [OIDC Verified] ──┘
```

A user **never** enters the `Fully Authenticated` state until every required authentication factor is verified.

---

## 3. Defense Against Common Attack Vectors

### 3.1 Credential Stuffing & Brute-Force Attacks
- **Dual-Layer Rate Limiting (`lib/auth/rate-limit.ts`):**
  - **IP Level:** 25 requests per 15 minutes per IP address.
  - **Account Level:** 5 failed attempts per 15 minutes per username/email target.
- **Generic Error Responses:** Login responses return `"Incorrect username or password"` regardless of whether the user exists, preventing user enumeration.
- **Timing Attack Mitigation:** When an entered identifier does not exist, DeployX executes a dummy bcrypt comparison (`bcrypt.compare(password, DUMMY_HASH)`) to prevent response-time differences from exposing account existence.

### 3.2 Insecure Direct Object Reference (IDOR) Defense
- All resource queries across projects, deployments, custom domains, API keys, and environment variables strictly scope queries by `userId: session.userId`.
- No user can access or mutate another user's projects or deployments, even if they guess or synthesize valid ObjectIds.

### 3.3 Sensitive Operation Step-Up Authentication
High-impact account operations require explicit reauthentication:
- **Password Rotation:** Requires verifying current password before accepting a new password.
- **Disabling MFA:** Requires password re-authentication or a valid current TOTP/recovery code.
- **Regenerating Recovery Codes:** Requires password reauthentication.
- **Disconnecting Identity Providers:** Validates that the user has an alternative login method to prevent accidental lockout.
- **Account Deletion:** Requires explicit password reauthentication.

---

## 4. Key Management & Environment Secrets

| Key | Purpose | Storage & Derivation |
| :--- | :--- | :--- |
| `JWT_SECRET` | Signing HS256 session tokens. | Private server environment variable (min. 32 chars in production). |
| `MFA_ENCRYPTION_KEY` | AES-256-GCM encryption of TOTP secrets. | Private server environment variable (256-bit high-entropy key). |
| `ENCRYPTION_KEY` | AES-256-GCM encryption of OAuth tokens at rest. | Private server environment variable (derived fallback in dev). |
| `GOOGLE_CLIENT_SECRET` | Google OAuth token exchange. | Private server environment variable. |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth token exchange. | Private server environment variable. |

---

## 5. Security Incident Logging & Audit Feeds

All security-critical actions generate audit records stored in `models/Activity.ts`:
- User registration (credentials or Google).
- Login events and MFA challenge completions.
- Two-Factor Authentication activation and deactivation.
- Recovery code regenerations.
- Password updates and global session sign-outs.
- Social identity linking and unlinking.
