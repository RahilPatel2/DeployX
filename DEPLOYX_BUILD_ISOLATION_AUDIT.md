# DeployX Build Infrastructure & Process Sandboxing Audit

## 1. Threat Profile: Arbitrary Code Execution

In a deployment platform, users connect repositories containing untrusted source code and custom `package.json` build scripts. When the build pipeline executes `npm run build` or custom install instructions, arbitrary code executes on the build host.

The build runner must prevent:
1. Access to DeployX host server credentials and database URIs.
2. Compromising other tenants' workspaces or filesystem artifacts.
3. Persistent malware, reverse shells, or background daemon processes surviving beyond the build lifecycle.
4. Host resource exhaustion (CPU spin loops, RAM leaks, fork bombs).
5. Escaping the isolated workspace directory via path traversal.

---

## 2. Sandboxing Architecture & Defense Controls

### A. Temporary Workspace Isolation
- Workspaces are generated dynamically in an isolated operating system directory:
  `os.tmpdir()/deployx-builds/<deploymentId>/`
- Workspaces are strictly destroyed and cleaned up upon build completion or failure.
- Directory validation (`validatePathInsideWorkspace`):
  Ensures any referenced file or directory path is strictly anchored within the workspace root:
  ```typescript
  if (!resolved.startsWith(normalizedWorkspace + path.sep) && resolved !== normalizedWorkspace) {
    throw new Error(`Security Violation: Path '${relativePath}' escapes the isolated build workspace.`);
  }
  ```

### B. Command Sanitization & Allowlisted Binaries
- Before any child process is spawned, `validateBuildCommand` executes:
  - **Permitted executables allowlist:** `npm`, `pnpm`, `yarn`, `bun`, `npx`, `node`, `next`, `vite`, `astro`, `remix`, `nuxt`, `gatsby`, `webpack`, `tsc`, `svelte-kit`, `ng`, `turbo`, `cross-env`, `rimraf`, `wrangler`.
  - **Forbidden patterns (strictly rejected):**
    - Subshell invocations: `$()`, backticks `` ` ``.
    - Interactive shell spawners: `powershell`, `cmd`, `bash`, `sh`.
    - Unauthorized download utilities: `curl`, `wget`.
    - Networking / reverse shell tools: `nc` (netcat).
    - Administrative commands: `net user`, `format`, `shutdown`.
  - **Output directory validation (`validateOutputDirectory`):**
    Rejects directory traversal sequences (`..`), leading root slashes (`/`), and drive letters (`C:`).

### C. Environment Variable Whitelisting & Secret Stripping
- User code must NEVER inherit host platform secrets.
- `executeSandboxedCommand` builds a minimal, explicit environment:
  ```typescript
  const safeEnv: Record<string, string> = {
    PATH: process.env.PATH || "",
    PATHEXT: process.env.PATHEXT || "",
    SystemRoot: process.env.SystemRoot || "",
    SYSTEMDRIVE: process.env.SYSTEMDRIVE || "",
    TEMP: process.env.TEMP || "",
    TMP: process.env.TMP || "",
    USERPROFILE: process.env.USERPROFILE || "",
    HOME: process.env.HOME || "",
    APPDATA: process.env.APPDATA || "",
    LOCALAPPDATA: process.env.LOCALAPPDATA || "",
    COMSPEC: process.env.COMSPEC || "",
    NODE_ENV: "production",
    ...filteredExtraEnv,
  };
  ```
- **Platform Secret Exclusion:** `filteredExtraEnv` strips `MONGODB_URI`, `JWT_SECRET`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MFA_ENCRYPTION_KEY`, `ENCRYPTION_KEY`, `COOKIE_SECRET`, `SESSION_SECRET`, `LD_PRELOAD`, and `NODE_OPTIONS`.

### D. Process Timeout & Tree Termination
- Maximum execution timeout: **300 seconds (5 minutes)** for builds, **420 seconds (7 minutes)** for dependency installation.
- Upon timeout expiration, DeployX terminates the child process and its entire process tree:
  - On Windows: `taskkill /pid <child.pid> /f /t` to eliminate orphaned worker processes.
  - On Linux/Unix: `SIGTERM` followed by forceful `SIGKILL`.

### E. Real-Time Secret Redaction in Log Streaming
- All stdout and stderr output lines pass through `redactSensitiveData()` prior to storage in MongoDB or client streaming.
- Strips database connection strings, GitHub tokens, JWTs, Bearer authorization headers, and user-configured environment secrets.

---

## 3. Verification Test Evidence

All 5 sandboxing and command injection tests in `tests/security-penetration.test.ts` passed:
- `Shell injection patterns ($(), backticks, powershell, cmd, bash, nc) blocked` -> **PASS**
- `Unauthorized executables outside whitelist rejected` -> **PASS**
- `Authorized standard build commands accepted` -> **PASS**
- `Output directory path traversal sequences rejected` -> **PASS**
- `Valid relative output directories accepted` -> **PASS**
