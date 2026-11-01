# DeployX — Session Security & Cookie Protection Architecture
**Document ID:** `DEPLOYX_SESSION_SECURITY.md`  
**Version:** 2.0.0 (Production Release Pass)  
**Lead Architect:** Senior Software Reliability & Security Engineer  
**Workspace:** `d:\DEPLOYX`  

---

## 1. Executive Summary

This document specifies the session management, cryptographic signing, cookie defense, and remote invalidation mechanics across DeployX. The architecture enforces session fixation defense, session rotation upon credential/MFA verification, and remote token versioning.

---

## 2. Session Token Specification

### 2.1 Cryptographic Signing (`lib/auth/session.ts`)
- **Format:** JSON Web Token (JWT) signed using HMAC-SHA256 (`HS256`) via `jose` (v6.1.3).
- **Payload Schema:**
  ```typescript
  interface SessionPayload {
    userId: string;
    sessionId?: string;
    tokenVersion?: number;
    expires?: string;
    iat?: number;
    exp?: number;
  }
  ```
- **Lifespan:** 7 days (`SESSION_DURATION_SECONDS = 604800`).
- **Clock Drift:** 15-second clock tolerance enabled during verification.
- **Production Secret Validation:** In production mode (`NODE_ENV === "production"`), `getSessionSecretKey()` throws a fatal runtime exception if `JWT_SECRET` is missing or uses the default insecure fallback.

---

## 3. Cookie Defense-in-Depth

Session cookies are issued under the name `session` with the following security flags:

| Attribute | Setting | Security Rationale |
| :--- | :--- | :--- |
| `HttpOnly` | `true` | Prevents document scripts from reading session tokens via XSS. |
| `SameSite` | `"lax"` | Defends against Cross-Site Request Forgery (CSRF) across top-level navigations. |
| `Secure` | Dynamic | Automatically enforced in production or when `NEXT_PUBLIC_APP_URL` begins with `https://`. |
| `Path` | `"/"` | Scopes token to the canonical root application origin. |
| `Max-Age` | `604800` | 7-day persistent lifespan. |

---

## 4. Session Rotation & Fixation Protection

### 4.1 Rotation Lifecycle
- **After Password Login:** The server executes `rotateSession()`, revoking any previous anonymous cookie state and issuing a fresh cryptographic token with a new `sessionId`.
- **After MFA Completion:** When a user completes their MFA challenge at `/login/mfa`, `rotateSession()` mints the full session cookie only after the second factor is verified.
- **After Password Rotation:** Modifying user credentials automatically increments `user.tokenVersion`, rendering any existing sessions on other devices instantly invalid.

### 4.2 Remote Token Invalidation (`tokenVersion`)
- DeployX uses a hybrid stateless/stateful session invalidation model:
  1. The user's JWT embeds their current `tokenVersion`.
  2. When security-critical events occur (password change, global sign-out, security incident), the server increments `user.tokenVersion` in MongoDB.
  3. Subsequent server-side session checks verify that `session.tokenVersion === user.tokenVersion`. If the token's version is stale, the request is immediately rejected with `401 Unauthorized` and the cookie is cleared.

---

## 5. Active Session Registry & Device Management

- Active user devices are tracked in `models/User.ts` (`user.sessions` array):
  - `sessionId`: Cryptographically random UUID.
  - `userAgent`: Client browser signature.
  - `ip`: Client IP address.
  - `createdAt`: Session creation timestamp.
  - `lastActive`: Most recent request timestamp.
- Users can view and selectively revoke individual sessions or sign out all other devices simultaneously via `/dashboard/settings/security`.
