# DeployX Authentication Security & Account Takeover Protection

## 1. Authentication State Machine

DeployX implements an unambiguous server-controlled state machine:

```
                  +--------------------------------+
                  |         Unauthenticated        |
                  +---------------+----------------+
                                  |
                +-----------------+-----------------+
                | (Email/Password)|                 | (OAuth Start)
                v                 |                 v
+-------------------------------+ | +-------------------------------+
| Password Authenticated        | | | OAuth Callback Verified       |
| (MFA check pending)           | | | (State/Nonce/PKCE valid)      |
+---------------+---------------+ | +---------------+---------------+
                |                 |                 |
                +--------+--------+--------+--------+
                         |                 |
                MFA Not Enabled       MFA Enabled
                         |                 |
                         |                 v
                         |  +-------------------------------+
                         |  | MFA Challenge Pending         |
                         |  | (Issues 5-min AuthChallenge,  |
                         |  |  NO session cookie issued)    |
                         |  +---------------+---------------+
                         |                  |
                         |           (Submit TOTP / Recovery)
                         |                  |
                         v                  v
                  +--------------------------------+
                  |      Fully Authenticated       |
                  |  (Issues HTTP-only JWT Cookie, |
                  |   Binds to tokenVersion)       |
                  +---------------+----------------+
                                  |
                   +--------------+--------------+
                   | (User Logout)|              | (Session Revocation / Expiry)
                   v                             v
+-------------------------------+ +-------------------------------+
| Session Destroyed (Cookie set | | Session Invalidated           |
| maxAge: 0, removed from DB)   | | (tokenVersion mismatch -> 401)|
+-------------------------------+ +-------------------------------+
```

---

## 2. Password Security & Account Enumeration Defense

- **Hashing Algorithm:** bcrypt with 12 salt rounds (computationally resistant to GPU-accelerated dictionary attacks).
- **Password Complexity:** Minimum 8 characters, maximum 128 characters (preventing DoS during hashing), requires uppercase, lowercase, numbers, and special characters.
- **Timing & Enumeration Resistance:** Failed login attempts return unified, generic error messages: `"Invalid credentials. Please check your username/email and password."` preventing account discovery.
- **Account-Level & IP Throttling:**
  - IP-level throttling: 25 requests per 15-minute window per IP.
  - Account-level throttling: 5 failed attempts per 15-minute window per target account identifier.

---

## 3. Google OAuth 2.0 & Account Takeover Defense

- **PKCE Enforcement:** Uses Proof Key for Code Exchange (RFC 7636) with SHA-256 code challenge (`code_challenge_method=S256`) and cryptographically random code verifiers.
- **Encrypted State & Nonce Binding:** State cookie contains an AES-256-GCM encrypted payload storing `{ nonce, userId, returnTo, expiresAt }`. On callback, the state is decrypted, nonces are compared with `crypto.timingSafeEqual`, and single-use state nonces are recorded in a replay cache.
- **Strict Account Linking Policy:**
  - To prevent account takeover where an attacker creates a Google account using a victim's email address, DeployX **strictly prohibits automatic account linking**.
  - If a user attempts to sign in via Google and an existing account is found with the same email, the system rejects automatic login with: `"An account with this email already exists. Please sign in with your password first, then connect Google in Settings."`
- **MFA Enforcement on OAuth:** Google OAuth does not bypass MFA. If the account has `mfaEnabled: true`, the callback issues a 5-minute restricted `AuthChallenge` token and routes the browser to `/login/mfa`. Full access is granted only after TOTP or recovery code verification.

---

## 4. Multi-Factor Authentication (TOTP & RFC 6238)

- **Algorithm & Parameters:** Standard HMAC-based One-Time Password with SHA-1, 30-second time-step interval, and 6 digits (RFC 6238 compliant). Compatible with Google Authenticator, Authy, and 1Password.
- **Clock Drift Tolerance:** ±1 time-step (30-second window) to accommodate client clock skew.
- **Replay Protection:** The system stores `mfaLastUsedTimeStep` on the user record. If an attacker replays the exact same 6-digit code during the same 30-second window, the verification engine detects that `result.timeStep <= user.mfaLastUsedTimeStep` and rejects the request.
- **Secret Encryption at Rest:** TOTP seeds are never stored in plaintext. They are encrypted using AES-256-GCM with a dedicated `MFA_ENCRYPTION_KEY` and formatted as `mfa:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
- **Emergency Recovery Codes:**
  - 8 cryptographically random recovery codes (format `XXXXXX-XXXXXX`) generated upon enrollment.
  - Plaintext codes are displayed to the user once and never stored on the server.
  - Server stores only salted SHA-256 hashes: `crypto.createHash('sha256').update('deployx_recovery:' + normalizedCode).digest('hex')`.
  - Single-use consumption: upon use, the record is flagged with `usedAt: new Date()` and cannot be replayed.

---

## 5. Session Security & Revocation

- **Session Format:** HS256-signed JSON Web Tokens (`jose` library) containing `userId`, `sessionId`, and `tokenVersion`.
- **Cookie Flags:** `HttpOnly: true`, `SameSite: 'lax'`, `Secure: isProductionSecure()`, `Path: '/'`, `Max-Age: 7 days`.
- **Global Invalidation:** Incrementing `user.tokenVersion` immediately invalidates all active sessions across all devices without requiring database session lookups on every request.
- **Per-Device Revocation:** The user can revoke individual devices in Settings -> Security (`/api/auth/sessions/revoke`).
