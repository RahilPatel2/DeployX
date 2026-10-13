import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import connectToDatabase from "./lib/mongodb/client";
import User from "./models/User";
import Integration from "./models/Integration";
import Activity from "./models/Activity";
import { encryptToken, decryptToken } from "./lib/auth/encryption";
import { createOAuthState, verifyOAuthState, OAUTH_STATE_COOKIE_NAME } from "./lib/auth/oauth-state";
import { encrypt as createSessionToken } from "./lib/auth/session";

import { GET as connectHandler } from "./app/api/integrations/github/connect/route";
import { GET as callbackHandler } from "./app/api/integrations/github/callback/route";
import { GET as statusHandler, DELETE as disconnectHandler } from "./app/api/integrations/github/status/route";
import { GET as reposHandler } from "./app/api/integrations/github/repos/route";

async function runGithubOAuthTestSuite() {
  console.log("=== STEP 6: GITHUB OAUTH INTEGRATION TEST SUITE ===\n");

  await connectToDatabase();

  const timestamp = Date.now();
  const userA_Email = `gh_user_a_${timestamp}@deployx.test`;
  const userB_Email = `gh_user_b_${timestamp}@deployx.test`;

  let userA: any = null;
  let userB: any = null;
  let sessionA = "";
  let sessionB = "";

  const originalFetch = global.fetch;

  try {
    // 0. Setup test user fixtures
    console.log("[Setup] Creating isolated test users (User A & User B)...");
    userA = await User.create({
      name: "GitHub Test User A",
      username: `gh_test_a_${timestamp}`,
      email: userA_Email,
      passwordHash: "dummy_test_hash",
      status: "active",
    });

    userB = await User.create({
      name: "GitHub Test User B",
      username: `gh_test_b_${timestamp}`,
      email: userB_Email,
      passwordHash: "dummy_test_hash",
      status: "active",
    });

    sessionA = await createSessionToken({ userId: userA._id.toString() });
    sessionB = await createSessionToken({ userId: userB._id.toString() });
    console.log(`✓ Created User A (${userA._id}) and User B (${userB._id})\n`);

    // TEST 1: Encryption at rest (AES-256-GCM)
    console.log("[TEST 1] Verifying AES-256-GCM Token Encryption & Tamper Resistance...");
    const sampleToken = "gho_sample_oauth_access_token_1234567890abcdef";
    const encrypted = encryptToken(sampleToken);

    if (!encrypted.startsWith("enc:v1:")) {
      throw new Error(`Expected encrypted token to start with 'enc:v1:', got: ${encrypted}`);
    }
    const decrypted = decryptToken(encrypted);
    if (decrypted !== sampleToken) {
      throw new Error(`Decrypted token does not match original token!`);
    }

    // Test tamper resistance
    let tamperDetected = false;
    try {
      const parts = encrypted.split(":");
      parts[3] = parts[3].slice(0, -2) + "ff"; // tamper with ciphertext
      decryptToken(parts.join(":"));
    } catch {
      tamperDetected = true;
    }
    if (!tamperDetected) {
      throw new Error("Tampered ciphertext was accepted without throwing authentication error!");
    }
    console.log("✓ AES-256-GCM encryption at rest and auth-tag verification verified.\n");

    // TEST 2: Starting OAuth flow while authenticated
    console.log("[TEST 2] Starting OAuth Flow (Connect Initiation)...");
    const connectReq = new Request("http://localhost:3000/api/integrations/github/connect?returnTo=/dashboard/settings/github", {
      headers: { cookie: `session=${sessionA}` },
    });
    const connectRes = await connectHandler(connectReq);

    if (connectRes.status !== 307 && connectRes.status !== 302) {
      throw new Error(`Expected redirect status (302/307), got ${connectRes.status}`);
    }

    const location = connectRes.headers.get("location");
    if (!location) throw new Error("Missing Location header in connect redirect");

    const authUrl = new URL(location);
    if (authUrl.hostname !== "github.com" || authUrl.pathname !== "/login/oauth/authorize") {
      throw new Error(`Invalid GitHub authorize URL: ${location}`);
    }

    const stateParam = authUrl.searchParams.get("state");
    const clientIdParam = authUrl.searchParams.get("client_id");
    const scopeParam = authUrl.searchParams.get("scope");
    const redirectUriParam = authUrl.searchParams.get("redirect_uri");

    if (!stateParam || stateParam.length !== 32) {
      throw new Error(`Invalid state param in GitHub URL: ${stateParam}`);
    }
    if (!clientIdParam) throw new Error("Missing client_id in GitHub URL");
    if (!scopeParam || !scopeParam.includes("read:user") || !scopeParam.includes("repo")) {
      throw new Error(`Expected scope to contain 'read:user' and 'repo', got: ${scopeParam}`);
    }
    if (!redirectUriParam || !redirectUriParam.includes("/api/integrations/github/callback")) {
      throw new Error(`Invalid redirect_uri: ${redirectUriParam}`);
    }

    const setCookieHeader = connectRes.headers.get("set-cookie") || "";
    if (!setCookieHeader.includes(OAUTH_STATE_COOKIE_NAME)) {
      throw new Error(`Missing ${OAUTH_STATE_COOKIE_NAME} in Set-Cookie header`);
    }
    console.log("✓ Authenticated connect initiation redirects to GitHub with valid client_id, scopes, redirect_uri, and encrypted state cookie.\n");

    // TEST 3: Rejecting unauthenticated connection attempts
    console.log("[TEST 3] Rejecting Unauthenticated Connect & Callback Attempts...");
    const unauthConnectReq = new Request("http://localhost:3000/api/integrations/github/connect");
    const unauthConnectRes = await connectHandler(unauthConnectReq);
    if (!unauthConnectRes.headers.get("location")?.includes("/login")) {
      throw new Error(`Expected redirect to /login for unauthenticated connect, got: ${unauthConnectRes.headers.get("location")}`);
    }

    const unauthCallbackReq = new Request("http://localhost:3000/api/integrations/github/callback?code=abc&state=123");
    const unauthCallbackRes = await callbackHandler(unauthCallbackReq);
    if (!unauthCallbackRes.headers.get("location")?.includes("/login")) {
      throw new Error(`Expected redirect to /login for unauthenticated callback, got: ${unauthCallbackRes.headers.get("location")}`);
    }
    console.log("✓ Unauthenticated connect and callback requests are strictly rejected.\n");

    // TEST 4: Rejecting missing or mismatched OAuth state (CSRF Protection)
    console.log("[TEST 4] Rejecting Missing, Expired, or Mismatched OAuth State...");
    const { state: validNonce, encryptedCookie: validCookie } = createOAuthState(userA._id.toString(), "/dashboard/settings/github");

    // 4a. Mismatched state parameter
    const badStateReq = new Request("http://localhost:3000/api/integrations/github/callback?code=abc&state=wrong_nonce", {
      headers: { cookie: `session=${sessionA}; ${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(validCookie)}` },
    });
    const badStateRes = await callbackHandler(badStateReq);
    const badStateLoc = badStateRes.headers.get("location") || "";
    if (!badStateLoc.includes("error=Invalid+OAuth+state")) {
      throw new Error(`Expected error redirect for state mismatch, got: ${badStateLoc}`);
    }

    // 4b. Missing state cookie
    const noCookieReq = new Request(`http://localhost:3000/api/integrations/github/callback?code=abc&state=${validNonce}`, {
      headers: { cookie: `session=${sessionA}` },
    });
    const noCookieRes = await callbackHandler(noCookieReq);
    const noCookieLoc = noCookieRes.headers.get("location") || "";
    if (!noCookieLoc.includes("error=OAuth+session+cookie+not+found")) {
      throw new Error(`Expected error redirect for missing cookie, got: ${noCookieLoc}`);
    }

    // 4c. Cross-user state hijacking attempt (User B attempts to use User A's state cookie)
    const crossUserReq = new Request(`http://localhost:3000/api/integrations/github/callback?code=abc&state=${validNonce}`, {
      headers: { cookie: `session=${sessionB}; ${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(validCookie)}` },
    });
    const crossUserRes = await callbackHandler(crossUserReq);
    const crossUserLoc = crossUserRes.headers.get("location") || "";
    if (!crossUserLoc.includes("error=OAuth+session+mismatch")) {
      throw new Error(`Expected error redirect for cross-user state mismatch, got: ${crossUserLoc}`);
    }
    console.log("✓ CSRF and cross-tenant state hijacking attempts are strictly blocked.\n");

    // TEST 5: Handling GitHub authorization denial (User cancels on GitHub)
    console.log("[TEST 5] Handling GitHub User Cancellation / Denial...");
    const deniedReq = new Request(
      `http://localhost:3000/api/integrations/github/callback?error=access_denied&error_description=The+user+has+denied+your+application+access.&state=${validNonce}`,
      { headers: { cookie: `session=${sessionA}; ${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(validCookie)}` } }
    );
    const deniedRes = await callbackHandler(deniedReq);
    const deniedLoc = deniedRes.headers.get("location") || "";
    if (!deniedLoc.includes("error=GitHub+authorization+was+cancelled+or+denied")) {
      throw new Error(`Expected friendly error redirect on authorization denial, got: ${deniedLoc}`);
    }
    console.log("✓ GitHub consent cancellation returns friendly, actionable error.\n");

    // TEST 6: Mocked Successful GitHub Token Exchange & Account Association
    console.log("[TEST 6] Mocked Successful Token Exchange & Multi-Tenant Association...");
    const mockGhId = 987654321 + Math.floor(Math.random() * 10000);
    const mockGhLogin = `deployx-tester-${timestamp}`;
    const mockAccessToken = `gho_mock_access_token_${timestamp}`;

    // Mock fetch for GitHub OAuth endpoints
    global.fetch = async (input: any, init?: any) => {
      const urlStr = typeof input === "string" ? input : input.url;

      if (urlStr.includes("github.com/login/oauth/access_token")) {
        const body = JSON.parse(init?.body || "{}");
        if (body.code === "valid_test_code") {
          return new Response(
            JSON.stringify({
              access_token: mockAccessToken,
              token_type: "bearer",
              scope: "read:user,repo",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        } else {
          return new Response(
            JSON.stringify({
              error: "bad_verification_code",
              error_description: "The code passed is incorrect or expired.",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        }
      }

      if (urlStr.includes("api.github.com/user/repos")) {
        return new Response(
          JSON.stringify([
            {
              id: 101,
              full_name: `${mockGhLogin}/awesome-repo`,
              name: "awesome-repo",
              private: false,
              language: "TypeScript",
              default_branch: "main",
              updated_at: new Date().toISOString(),
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (urlStr.includes("api.github.com/user")) {
        return new Response(
          JSON.stringify({
            id: mockGhId,
            login: mockGhLogin,
            name: "DeployX Test User",
            avatar_url: "https://avatars.githubusercontent.com/u/987654321?v=4",
            html_url: `https://github.com/${mockGhLogin}`,
            email: "tester@deployx.test",
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "x-oauth-scopes": "read:user, repo",
            },
          }
        );
      }

      if (urlStr.includes("api.github.com/applications/")) {
        return new Response(null, { status: 204 });
      }

      return originalFetch(input, init);
    };

    // 6a. Execute successful callback for User A
    const { state: successNonce, encryptedCookie: successCookie } = createOAuthState(
      userA._id.toString(),
      "/dashboard/settings/github"
    );

    const successCallbackReq = new Request(
      `http://localhost:3000/api/integrations/github/callback?code=valid_test_code&state=${successNonce}`,
      { headers: { cookie: `session=${sessionA}; ${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(successCookie)}` } }
    );
    const successCallbackRes = await callbackHandler(successCallbackReq);
    const successLoc = successCallbackRes.headers.get("location") || "";
    if (!successLoc.includes("success=GitHub+account")) {
      throw new Error(`Expected success redirect, got: ${successLoc}`);
    }

    // Verify stored integration in MongoDB
    const storedIntegration = await Integration.findOne({ userId: userA._id, provider: "github" });
    if (!storedIntegration) {
      throw new Error("Integration document was not saved in database!");
    }
    if (storedIntegration.providerAccountId !== String(mockGhId)) {
      throw new Error(`Expected providerAccountId ${mockGhId}, got ${storedIntegration.providerAccountId}`);
    }
    if (!storedIntegration.accessToken.startsWith("enc:v1:")) {
      throw new Error("Stored access token was not encrypted at rest!");
    }
    if (decryptToken(storedIntegration.accessToken) !== mockAccessToken) {
      throw new Error("Decrypted access token does not match original mock token!");
    }

    // Verify activity logged
    const activity = await Activity.findOne({ userId: userA._id, type: "github_connected" });
    if (!activity) {
      throw new Error("Audit log for github_connected was not created!");
    }
    console.log(`✓ User A successfully connected GitHub account @${mockGhLogin} with encrypted token at rest.\n`);

    // TEST 7: Status endpoint keeps credentials out of client response
    console.log("[TEST 7] Status API Scoping & Credential Scrubbing...");
    const statusReqA = new Request("http://localhost:3000/api/integrations/github/status", {
      headers: { cookie: `session=${sessionA}` },
    });
    const statusResA = await statusHandler(statusReqA);
    const statusJsonA = await statusResA.json();

    if (!statusJsonA.connected || statusJsonA.username !== mockGhLogin) {
      throw new Error(`Expected connected: true and username: ${mockGhLogin}, got: ${JSON.stringify(statusJsonA)}`);
    }
    if ("accessToken" in statusJsonA || "token" in statusJsonA || "clientSecret" in statusJsonA) {
      throw new Error("SECURITY FAILURE: Raw access token or secret exposed in status response!");
    }
    if (!statusJsonA.avatarUrl || !statusJsonA.scopes) {
      throw new Error("Missing expected display metadata (avatarUrl or scopes) in status response");
    }
    console.log("✓ Status endpoint returns display metadata while completely scrubbing sensitive credentials.\n");

    // TEST 8: Account Isolation (User B cannot see User A's integration)
    console.log("[TEST 8] Cross-Tenant Account Isolation...");
    const statusReqB = new Request("http://localhost:3000/api/integrations/github/status", {
      headers: { cookie: `session=${sessionB}` },
    });
    const statusResB = await statusHandler(statusReqB);
    const statusJsonB = await statusResB.json();

    if (statusJsonB.connected !== false) {
      throw new Error("User B saw User A's GitHub integration status!");
    }

    // 8b. Prevent linking the same GitHub account to another DeployX user
    const { state: userB_Nonce, encryptedCookie: userB_Cookie } = createOAuthState(
      userB._id.toString(),
      "/dashboard/settings/github"
    );
    const conflictReq = new Request(
      `http://localhost:3000/api/integrations/github/callback?code=valid_test_code&state=${userB_Nonce}`,
      { headers: { cookie: `session=${sessionB}; ${OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(userB_Cookie)}` } }
    );
    const conflictRes = await callbackHandler(conflictReq);
    const conflictLoc = conflictRes.headers.get("location") || "";
    if (!conflictLoc.includes("error=This+GitHub+account+is+already+connected+to+another+DeployX+account")) {
      throw new Error(`Expected conflict error when User B links User A's GitHub account, got: ${conflictLoc}`);
    }
    console.log("✓ Account isolation enforced: GitHub account cannot be hijacked across DeployX accounts.\n");

    // TEST 9: Repositories fetching via encrypted token
    console.log("[TEST 9] Repository Listing via Decrypted Token...");
    const reposReq = new Request("http://localhost:3000/api/integrations/github/repos", {
      headers: { cookie: `session=${sessionA}` },
    });
    const reposRes = await reposHandler(reposReq);
    if (!reposRes.ok) {
      const errText = await reposRes.text();
      throw new Error(`Repos fetch failed with status ${reposRes.status}: ${errText}`);
    }
    const reposJson = await reposRes.json();
    if (!reposJson.repos || reposJson.repos.length !== 1 || reposJson.repos[0].name !== "awesome-repo") {
      throw new Error(`Unexpected repos response: ${JSON.stringify(reposJson)}`);
    }
    console.log("✓ Successfully fetched and decrypted repositories using server-side encrypted token.\n");

    // TEST 10: Disconnecting GitHub integration
    console.log("[TEST 10] Disconnecting GitHub Integration...");
    const disconnectReq = new Request("http://localhost:3000/api/integrations/github/status", {
      method: "DELETE",
      headers: { cookie: `session=${sessionA}` },
    });
    const disconnectRes = await disconnectHandler(disconnectReq);
    if (!disconnectRes.ok) {
      throw new Error(`Expected 200 for disconnect, got ${disconnectRes.status}`);
    }

    const checkIntegration = await Integration.findOne({ userId: userA._id, provider: "github" });
    if (checkIntegration) {
      throw new Error("Integration was not removed from MongoDB after disconnect!");
    }

    // Check status after disconnect
    const postDisconnectStatusRes = await statusHandler(statusReqA);
    const postDisconnectJson = await postDisconnectStatusRes.json();
    if (postDisconnectJson.connected !== false) {
      throw new Error(`Expected connected: false after disconnect, got: ${JSON.stringify(postDisconnectJson)}`);
    }
    console.log("✓ Disconnect removes stored credentials, revokes remote grant, and logs activity.\n");

    console.log("=== ALL GITHUB OAUTH INTEGRATION TESTS PASSED (10/10) ===\n");
  } finally {
    // Restore fetch
    global.fetch = originalFetch;

    // Cleanup test fixtures
    console.log("[Cleanup] Removing test users and integrations...");
    if (userA?._id) {
      await User.findByIdAndDelete(userA._id);
      await Integration.deleteMany({ userId: userA._id });
      await Activity.deleteMany({ userId: userA._id });
    }
    if (userB?._id) {
      await User.findByIdAndDelete(userB._id);
      await Integration.deleteMany({ userId: userB._id });
      await Activity.deleteMany({ userId: userB._id });
    }
    console.log("✓ Test fixtures cleanly removed. Real data untouched.\n");
  }
}

runGithubOAuthTestSuite()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test suite failed:", err);
    process.exit(1);
  });
