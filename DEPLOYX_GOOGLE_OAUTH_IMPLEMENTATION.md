# DeployX — Google OAuth 2.0 & OpenID Connect Implementation
**Document ID:** `DEPLOYX_GOOGLE_OAUTH_IMPLEMENTATION.md`  
**Version:** 2.0.0 (Production Release Pass)  
**Lead Architect:** Senior Application Security Architect  
**Workspace:** `d:\DEPLOYX`  

---

## 1. Executive Summary

DeployX integrates Google OAuth 2.0 and OpenID Connect (OIDC) to enable secure single sign-on (SSO), registration, and account linking. The implementation follows Google Identity and RFC 7636 (PKCE) standards with defense-in-depth protection against authorization code interception, cross-site request forgery (CSRF), and account takeover vectors.

---

## 2. Protocol Specification & Security Controls

### 2.1 Authorization Flow Architecture
1. **Flow Type:** Standard Authorization Code Flow with Proof Key for Code Exchange (PKCE).
2. **Endpoints:**
   - **Initiation:** `GET /api/auth/google/connect`
   - **Authorization Server:** `https://accounts.google.com/o/oauth2/v2/auth`
   - **Token Endpoint:** `https://oauth2.googleapis.com/token`
   - **UserInfo Endpoint:** `https://openidconnect.googleapis.com/v1/userinfo`
   - **Callback Route:** `GET /api/auth/google/callback`
   - **Disconnect Route:** `POST /api/auth/google/disconnect`

### 2.2 Proof Key for Code Exchange (PKCE — RFC 7636)
- **Code Verifier:** Cryptographically random 32-byte string encoded as `base64url` (43 characters).
- **Code Challenge:** SHA-256 digest of the verifier, encoded as `base64url`.
- **Method:** `code_challenge_method=S256`.
- Mitigates authorization code injection attacks by requiring the original verifier during token exchange.

### 2.3 State & Nonce Cryptographic Binding
- **State Token:** High-entropy 32-byte random hex string.
- **Nonce:** High-entropy 32-byte random hex string bound to the OpenID Connect request.
- **State Cookie (`google_oauth_state`):** Encrypted using AES-256-GCM (`encryptToken`), containing `{ state, codeVerifier, nonce, mode, userId, returnTo, expiresAt }`.
- **Replay Protection:** A single-use in-memory consumed state registry guarantees each state token is consumed at most once.
- **Timing-Safe Comparison:** `crypto.timingSafeEqual` prevents timing side-channel attacks during state verification.

---

## 3. Account Linking & Takeover Defense

DeployX strictly follows zero-trust account linking rules:

1. **No Automatic Email-Based Account Linking:**
   - If a user attempts to "Sign In with Google" and their Google email matches an existing email/password account in DeployX, DeployX **refuses** to automatically link the accounts without prior authentication.
   - The user is redirected to `/login` with an informative security message prompting them to sign in with their password and connect Google explicitly in Settings.
   - This eliminates account takeover via compromised or unverified external email addresses.

2. **Authenticated Account Linking:**
   - Linking a Google account (`mode=connect`) requires an active, verified session.
   - DeployX validates that the Google subject identifier (`sub`) is not already associated with another user in the database.
   - Prevents one Google identity from being attached to multiple DeployX accounts.

3. **Safe Disconnection (`POST /api/auth/google/disconnect`):**
   - Disconnecting Google requires the user to maintain an alternative login method (either an active password or a connected GitHub integration).
   - Prevents users from accidentally locking themselves out of their workspace.

---

## 4. Google OAuth with DeployX MFA Enforcement

**MFA Bypass Defense:**
- If an account has DeployX Two-Factor Authentication enabled (`mfaEnabled: true`), signing in with Google **does not** bypass DeployX MFA.
- Upon successful Google OAuth verification, DeployX creates an ephemeral `AuthChallenge` record (5-minute TTL) and redirects the browser to `/login/mfa?challenge=...`.
- A fully authenticated session cookie is withheld until the user provides their 6-digit Google Authenticator TOTP code or emergency recovery code.

---

## 5. Configuration Reference

```env
# Google Cloud Console -> APIs & Services -> Credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
# Optional explicit callback override (defaults to ${NEXT_PUBLIC_APP_URL}/api/auth/google/callback)
GOOGLE_CALLBACK_URL=https://deployx.yourdomain.com/api/auth/google/callback
```

### Readiness Status:
- **Code Implementation:** Complete (`lib/auth/google.ts`, API routes, UI components).
- **Automated Tests:** 100% Passing (`tests/mfa-google-auth.test.ts`).
- **Provider Status:** Awaiting client credentials in production environment.
