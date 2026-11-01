# DeployX — Deployment Pipeline & Runner System Integrity Audit
**Document ID:** `DEPLOYX_DEPLOYMENT_AUDIT.md`  
**Version:** 1.0.0 (Production Release Integrity Pass)  
**Lead Auditor:** Senior Software Reliability Engineer & Build Pipeline Architect  
**Workspace:** `d:\DEPLOYX`  

---

## 1. Executive Summary

The DeployX deployment system is responsible for orchestrating the end-to-end build, test, and release cycle for modern web applications. This audit inspects the complete pipeline lifecycle: stage transitions, commit pinning, dependency resolution, process sandboxing, command whitelisting, log streaming, secret redaction, cancellation signal propagation, failure recovery, and Cloudflare Pages distribution.

---

## 2. Pipeline Lifecycle & State Machine

### 2.1 State Transition Matrix (`models/Deployment.ts`)
The deployment state machine strictly validates state transitions to prevent race conditions:

| From State | Permitted Next States | Validation Enforcement |
| :--- | :--- | :--- |
| `QUEUED` | `BUILDING`, `CANCELED`, `FAILED` | Validated by `isValidDeploymentTransition` |
| `BUILDING` | `READY`, `FAILED`, `CANCELED` | Validated by `isValidDeploymentTransition` |
| `READY` | Terminal (no transitions) | Validated by `isValidDeploymentTransition` |
| `FAILED` | Terminal (no transitions) | Validated by `isValidDeploymentTransition` |
| `CANCELED` | Terminal (no transitions) | Validated by `isValidDeploymentTransition` |

### 2.2 Pipeline Execution Stages
1. **Queued:** Deployment record initialized in MongoDB with snapshot of current project build configuration (`buildCommand`, `outputDirectory`, `installCommand`, `rootDirectory`, `framework`).
2. **Cloning / Source Ingestion:** Fetches the exact commit SHA for the target branch via GitHub REST API. Downloads the repository archive directly into a fresh temporary workspace (`AppData\Local\Temp\deployx-builds\<deploymentId>`).
3. **Dependency Installation:** `lib/build/dependency-resolver.ts` inspects package manifests and lockfiles:
   - `package-lock.json` present $\to$ executes `npm ci --include=dev --no-audit --no-fund`.
   - `pnpm-lock.yaml` present $\to$ executes `pnpm install --frozen-lockfile`.
   - `yarn.lock` present $\to$ executes `yarn install --frozen-lockfile`.
   - `bun.lockb` present $\to$ executes `bun install --frozen-lockfile`.
   - Fallback: deterministic `npm install`.
4. **Build Execution:** Spawns sandboxed child process executing the project's build command (`npm run build`). Enforces a strict 5-minute timeout.
5. **Asset Verification:** Validates that the configured output directory (`.next`, `dist`, `out`, `build`) exists and contains deployable build artifacts.
6. **Deploying / Edge Publishing:** Deploys assets to Cloudflare Pages (or registers with local reverse proxy runner). Configures domain routes.
7. **Ready (Live):** Marks status as `READY`, records completion timestamp, computes duration, and emits success activity event.

---

## 3. Sandboxing & Security Controls

### 3.1 Workspace Sandboxing
- Each deployment creates a segregated directory under the OS temporary storage folder.
- Path traversal checks (`validatePathInsideWorkspace`) ensure that neither the configured root directory nor the output directory escapes the workspace boundary (blocking `../../` attacks).

### 3.2 Command Sanitization & Whitelisting (`lib/security/command-sanitizer.ts`)
Build commands are subjected to security checks:
- **Prohibited Constructs:**
  - Command chaining operators: `;`, `&&`, `||`, `|`, `&`.
  - Subshell execution: `$()`, backticks (`` ` ``).
  - Stream redirection: `>`, `<`, `>>`.
  - Dangerous binaries: `rm -rf`, `curl`, `wget`, `bash`, `sh`, `powershell`, `cmd`, `nc`, `netcat`.
- Valid commands must start with recognized package manager commands (`npm`, `pnpm`, `yarn`, `bun`, `npx`).

### 3.3 Environment Isolation
Child processes are spawned with an isolated environment whitelist:
- System essentials: `PATH`, `SystemRoot`, `TEMP`, `NODE_ENV=production`.
- Injected project environment variables from the database (decrypted only within the process context).
- Sensitive DeployX platform secrets (such as `MONGODB_URI`, `JWT_SECRET`, and `ENCRYPTION_KEY`) are excluded from build runner processes.

---

## 4. Log Streaming, ANSI Stripping & Secret Redaction

### 4.1 Real-Time Streaming (`components/deployments/log-viewer.tsx`)
- Logs are streamed to the browser via SWR polling with an active 3-second interval during the build phase.
- List view uses a windowed tail parameter (`?tail=400`) to prevent memory bloating on large builds.
- The UI features auto-scroll toggles, instant log line filtering, one-click clipboard copying, and full `.txt` file downloading.

### 4.2 Security Redaction (`lib/cloudflare/client.ts` & `lib/security/redaction.ts`)
- All stdout/stderr chunks pass through `stripAnsi()` to eliminate raw terminal escape sequences.
- Redaction filters mask:
  - GitHub tokens (`ghp_...`, `gho_...`).
  - Bearer headers (`Bearer eyJ...`).
  - Private database connection strings (`mongodb://...`, `postgres://...`).
  - Custom environment variable secret values.

---

## 5. Cancellation & Process Termination

- Active build processes are registered in an in-memory process registry keyed by `deploymentId`.
- When `DELETE /api/deployments/[id]` is invoked:
  - On Windows: Executes `taskkill /pid <childPid> /f /t` to terminate the entire process tree (including nested Node.js or Turbopack compilers).
  - On POSIX: Sends `SIGTERM` followed by `SIGKILL`.
  - Cleans up workspace directory.
  - Updates deployment status in database to `CANCELED`.

---

## 6. Failure Recovery & Error Messaging

- Build errors capture the exact trailing lines of stderr to generate a clear, user-facing error message on the deployment card.
- Ephemeral build workspace failures do not leave orphaned processes or corrupted database records.
- Historical redeployments (`POST /api/deployments/[id]/redeploy`) pin the exact Git commit SHA of the selected deployment, ensuring reproducible builds.

---
**Audit Verification:** ✓ PASSED. Build pipeline, command whitelisting, isolation runner, and log redaction satisfy production software reliability standards.
