# DeployX — Two-Factor Authentication (TOTP / Google Authenticator) Implementation
**Document ID:** `DEPLOYX_MFA_IMPLEMENTATION.md`  
**Version:** 2.0.0 (Production Release Pass)  
**Lead Architect:** Senior Application Security Architect  
**Workspace:** `d:\DEPLOYX`  

---

## 1. Executive Summary

DeployX implements an enterprise-grade Multi-Factor Authentication (MFA) system adhering to RFC 6238 (TOTP: Time-Based One-Time Password Algorithm). The implementation is fully compatible with Google Authenticator, 1Password, Authy, Apple Passwords, and any standard RFC 6238 authenticator app.

---

## 2. Cryptographic Architecture

### 2.1 TOTP Specification (RFC 6238)
- **Algorithm:** HMAC-SHA1 with dynamic truncation.
- **Time Step:** 30 seconds ($X = 30$).
- **Digits:** 6 numeric digits ($10^6$ modulo).
- **Clock Drift Tolerance:** Configured with $\pm 30$ seconds window (`epochTolerance: 30`) to accommodate slight server/device clock offsets.
- **Replay Protection:** The platform tracks `mfaLastUsedTimeStep` on the user record. Once a code for a specific 30-second time step has been verified, subsequent verification attempts within the same time step are rejected.

### 2.2 Encrypted Secret Storage at Rest
- **Algorithm:** AES-256-GCM authenticated symmetric encryption with 96-bit random initialization vectors (IV) and 128-bit authentication tags.
- **Key Separation:** Derived from a dedicated `MFA_ENCRYPTION_KEY` environment variable, separate from database credentials and session JWT signing keys.
- **Format:** `mfa:v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`.
- **Zero Exposure Policy:** The plaintext TOTP secret is never stored in MongoDB, never included in logs, and never returned in normal API responses after enrollment.

---

## 3. Enrollment Lifecycle

### 3.1 Two-Phase Enrollment
A QR code is **never** considered proof of enrollment. MFA is not enabled until the user proves possession of the shared secret:
1. **Phase 1 (Initiation — `POST /api/auth/mfa/enroll`):**
   - Generates high-entropy Base32 secret via `otplib.generateSecret()`.
   - Generates provisioning URI `otpauth://totp/DeployX:<email>?secret=...&issuer=DeployX`.
   - Generates vector QR code data URL.
   - Generates 8 single-use recovery codes.
   - Encrypts secret and temporarily stores it in `user.pendingMfaEnrollment` with a strict 15-minute expiration timestamp.
2. **Phase 2 (Confirmation — `POST /api/auth/mfa/confirm`):**
   - User inputs the current 6-digit code displayed in Google Authenticator.
   - Server verifies the code against the pending secret.
   - Upon successful verification, promotes the encrypted secret to `user.mfaSecretEncrypted`, hashes recovery codes, sets `user.mfaEnabled = true`, and wipes the pending enrollment.

### 3.2 Optional MFA During Registration
- On the registration page (`/signup`), users are presented with an explicit choice:
  - **"Set up Google Authenticator"**
  - **"Skip for now"**
- Skipping allows completing registration normally without forcing MFA. Setup can be completed at any time in Account Settings.

---

## 4. Mandatory Login Enforcement

When MFA is enabled, login requests follow a strict two-step authentication sequence:
1. **Step 1:** User enters credentials (or completes Google OAuth).
2. **Step 2:** Server verifies credentials.
3. **Step 3:** Server checks `user.mfaEnabled`.
4. **Step 4:** If enabled, the server **does not** issue an authenticated session cookie.
5. **Step 5:** The server generates a single-use `AuthChallenge` record with a 5-minute time-to-live (TTL).
6. **Step 6:** The user is directed to the MFA verification screen (`/login/mfa`).
7. **Step 7:** The user provides their 6-digit TOTP code or emergency recovery code.
8. **Step 8:** The server validates the code, marks the challenge as consumed, and issues the rotated session cookie.

---

## 5. Single-Use Emergency Recovery Codes

- **Generation:** 8 high-entropy 12-character codes formatted as `XXXX-XXXX`.
- **Storage:** Only SHA-256 cryptographic hashes (`codeHash`) are stored in MongoDB. Plaintext codes are displayed only once upon generation.
- **Consumption:** When a recovery code is used, it is atomically marked with `usedAt: new Date()` and cannot be used again.
- **Regeneration:** Users can regenerate recovery codes in Settings with password reauthentication, immediately invalidating all previous codes.

---

## 6. MFA Attack Mitigation

1. **Brute Force Protection:** Maximum 5 failed attempts per challenge token before challenge revocation.
2. **IP Rate Limiting:** 15 verification requests / 60 seconds per IP address.
3. **Challenge Expiration:** 5-minute strict TTL.
4. **One-Time Consumption:** Challenge tokens are marked consumed upon initial verification, preventing replay attacks.
5. **Audit Logging:** Emits structured security activity events for all MFA activations, logins, and recovery code regenerations.
