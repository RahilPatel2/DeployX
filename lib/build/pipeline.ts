import fs from "fs";
import path from "path";
import os from "os";
import { spawn, type ChildProcess } from "child_process";
import connectToDatabase from "@/lib/mongodb/client";
import Deployment from "@/models/Deployment";
import Project from "@/models/Project";
import Integration from "@/models/Integration";
import Activity from "@/models/Activity";
import { getBranchCommit, downloadRepositoryArchive } from "@/lib/github/api";
import {
  CloudflareProvider,
  evaluateDeploymentTarget,
  sanitizePagesProjectName,
} from "@/lib/cloudflare/provider";
import { getCloudflareConfig, redactSensitive } from "@/lib/cloudflare/client";
import { validateBuildCommand } from "@/lib/security/command-sanitizer";

const FORBIDDEN_ENV_KEYS = new Set([
  "MONGODB_URI",
  "JWT_SECRET",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "MFA_ENCRYPTION_KEY",
  "ENCRYPTION_KEY",
  "COOKIE_SECRET",
  "SESSION_SECRET",
  "LD_PRELOAD",
  "LD_LIBRARY_PATH",
  "NODE_OPTIONS",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
]);

/**
 * Strips ANSI terminal color codes from command output.
 */
function stripAnsi(text: string): string {
  return text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
}

/**
 * Validates that a path is securely contained within the workspace root directory.
 * Prevents directory traversal attacks (e.g. `../../etc`).
 */
export function validatePathInsideWorkspace(workspaceDir: string, relativePath?: string): string {
  if (!relativePath || relativePath.trim() === "" || relativePath === ".") {
    return path.resolve(workspaceDir);
  }
  const resolved = path.resolve(workspaceDir, relativePath);
  const normalizedWorkspace = path.resolve(workspaceDir);

  if (!resolved.startsWith(normalizedWorkspace + path.sep) && resolved !== normalizedWorkspace) {
    throw new Error(`Security Violation: Path '${relativePath}' escapes the isolated build workspace.`);
  }

  return resolved;
}

export interface BuildPipelineOptions {
  mockCloudflareDeploy?: boolean;
  mockBuild?: boolean;
  simulateMissingOutput?: boolean;
  testWranglerOutput?: string;
  testCommitSha?: string;
}

export interface CommandExecutionResult {
  code: number;
  stdout: string;
  stderr: string;
  logs: string[];
}

/**
 * Safely executes a shell command in an isolated child process with timeout and environment filtering.
 * Sensitive tokens are redacted from output before recording.
 */
export function executeSandboxedCommand(
  command: string,
  cwd: string,
  extraEnv: Record<string, string> = {},
  timeoutMs: number = 300000, // 5 minutes default
  onLog?: (line: string) => void
): Promise<CommandExecutionResult> {
  return new Promise((resolve, reject) => {
    // Validate command security before spawning process
    const cmdCheck = validateBuildCommand(command);
    if (!cmdCheck.valid) {
      const secErr = new Error(cmdCheck.error || "Prohibited command execution rejected.");
      onLog?.(`[DeployX Security Alert] ${secErr.message}`);
      return reject(secErr);
    }

    // Whitelist only safe environment variables and strip prohibited platform secrets
    const filteredExtraEnv: Record<string, string> = {};
    for (const [key, val] of Object.entries(extraEnv)) {
      if (!FORBIDDEN_ENV_KEYS.has(key.toUpperCase()) && typeof val === "string") {
        filteredExtraEnv[key] = val;
      }
    }

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

    const isWindows = process.platform === "win32";
    const shell = isWindows ? (process.env.COMSPEC || "cmd.exe") : "/bin/sh";
    const shellArgs = isWindows ? ["/d", "/s", "/c", command] : ["-c", command];

    const child: ChildProcess = spawn(shell, shellArgs, {
      cwd,
      env: safeEnv as NodeJS.ProcessEnv,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const logs: string[] = [];
    let stdoutBuffer = "";
    let stderrBuffer = "";

    const handleChunk = (chunk: Buffer, isErr: boolean) => {
      const text = chunk.toString();
      if (isErr) stderrBuffer += text;
      else stdoutBuffer += text;

      const lines = stripAnsi(text).split(/\r?\n/);
      for (const rawLine of lines) {
        const line = redactSensitive(rawLine.trim());
        if (line) {
          logs.push(line);
          onLog?.(line);
        }
      }
    };

    child.stdout?.on("data", (chunk: Buffer) => handleChunk(chunk, false));
    child.stderr?.on("data", (chunk: Buffer) => handleChunk(chunk, true));

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        if (process.platform === "win32") {
          try {
            spawn("taskkill", ["/pid", child.pid.toString(), "/f", "/t"], { windowsHide: true });
          } catch {
            child.kill();
          }
        } else {
          child.kill("SIGTERM");
          setTimeout(() => child.kill("SIGKILL"), 2000);
        }
      }
    }, timeoutMs);

    child.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`Command timed out after ${timeoutMs / 1000} seconds.`));
      } else {
        resolve({
          code: code ?? 1,
          stdout: stdoutBuffer,
          stderr: stderrBuffer,
          logs,
        });
      }
    });
  });
}

/**
 * Runs the complete end-to-end build and deployment pipeline for a DeployX project.
 */
export async function runBuildPipeline(
  deploymentId: string,
  options: BuildPipelineOptions = {}
): Promise<void> {
  const startTime = Date.now();
  await connectToDatabase();

  const deployment = await Deployment.findById(deploymentId);
  if (!deployment) {
    throw new Error(`Deployment record '${deploymentId}' not found.`);
  }

  const project = await Project.findById(deployment.projectId);
  if (!project) {
    throw new Error(`Project record '${deployment.projectId}' not found.`);
  }

  // Set up logging accumulator
  const accumulatedLogs: string[] = Array.isArray(deployment.logs) ? [...deployment.logs] : [];

  const addLog = async (message: string) => {
    const cleanMsg = redactSensitive(message);
    accumulatedLogs.push(cleanMsg);
    try {
      await Deployment.findByIdAndUpdate(deploymentId, { $push: { logs: cleanMsg } });
    } catch {
      // Non-fatal logging update error
    }
  };

  const workspaceDir = path.join(os.tmpdir(), "deployx-builds", deploymentId);

  try {
    // 1. Initial State Transition & Lifecycle Tracking
    if (deployment.status === "READY" || deployment.status === "CANCELED") {
      throw new Error(`Cannot start build: deployment is already in terminal state '${deployment.status}'.`);
    }

    deployment.status = "BUILDING";
    deployment.stage = "cloning";
    deployment.startedAt = new Date();
    if (!deployment.buildConfigSnapshot) {
      deployment.buildConfigSnapshot = {
        buildCommand: project.buildCommand,
        outputDirectory: project.outputDirectory,
        installCommand: project.installCommand,
        rootDirectory: project.rootDirectory,
        framework: project.framework,
      };
    }
    await deployment.save();

    await addLog(`[DeployX] Starting build pipeline for deployment #${deploymentId.slice(-6)}`);
    await addLog(`[DeployX] Project: ${project.name} (${project.repository} @ ${deployment.branch})`);

    // 2. Validate Target Compatibility
    const targetEval = evaluateDeploymentTarget({
      framework: project.framework,
      deploymentMode: project.deploymentMode,
      rootDirectory: project.rootDirectory,
      buildCommand: project.buildCommand,
      outputDirectory: project.outputDirectory,
    });

    if (!targetEval.compatible) {
      throw new Error(`Incompatible framework target: ${targetEval.reason}. ${targetEval.recommendation || ""}`.trim());
    }

    // 3. Resolve GitHub Source & Pin Commit SHA
    const integration = await Integration.findOne({ userId: project.userId, provider: "github" });
    if (!integration || !integration.accessToken) {
      throw new Error("GitHub integration is not connected for this account. Please connect GitHub in settings.");
    }

    const { extractRepositoryFromProject } = await import("@/lib/github/repository");
    const resolvedRepo = extractRepositoryFromProject(project);
    if (!resolvedRepo) {
      throw new Error(`Invalid repository format '${project.repository || "undefined"}'. Expected 'owner/repo'.`);
    }
    const { owner, repo } = resolvedRepo;

    await addLog(`[DeployX] Verifying repository access and pinning commit SHA on branch '${deployment.branch}'...`);

    let commitInfo;
    if (options.testCommitSha) {
      commitInfo = {
        sha: options.testCommitSha,
        shortSha: options.testCommitSha.slice(0, 7),
        message: "Test commit",
        authorName: "DeployX Test",
        date: new Date().toISOString(),
      };
    } else {
      commitInfo = await getBranchCommit(integration.accessToken, owner, repo, deployment.branch);
    }

    deployment.commitHash = commitInfo.sha;
    deployment.commitMessage = commitInfo.message;
    await deployment.save();

    await addLog(`[DeployX] Pinned commit: ${commitInfo.shortSha} - "${commitInfo.message}" (Author: ${commitInfo.authorName})`);

    // 4. Download Source to Isolated Workspace
    await addLog(`[DeployX] Creating isolated build workspace: ${workspaceDir}`);
    await fs.promises.mkdir(workspaceDir, { recursive: true });

    if (!options.mockBuild) {
      await addLog(`[DeployX] Downloading repository archive from GitHub...`);
      await downloadRepositoryArchive(integration.accessToken, owner, repo, commitInfo.sha, workspaceDir);
      await addLog(`[DeployX] Source code successfully extracted to workspace.`);
    } else {
      if (!options.simulateMissingOutput) {
        // In mock build, create minimal dummy structure
        const distDir = path.join(workspaceDir, project.outputDirectory || "dist");
        await fs.promises.mkdir(distDir, { recursive: true });
        await fs.promises.writeFile(path.join(distDir, "index.html"), "<h1>DeployX Test</h1>");
        await addLog(`[DeployX] (Mock mode) Seeded static files into ${project.outputDirectory || "dist"}`);
      }
    }

    // 5. Resolve Project Working Directory (supports root, monorepos, and nested subdirectories)
    const {
      resolveProjectWorkingDir,
      validatePackageManifest,
      inspectLockfile,
      determineInstallStrategy,
      extractNpmDiagnosticSummary,
    } = await import("@/lib/build/dependency-resolver");

    const workingDirInfo = await resolveProjectWorkingDir(workspaceDir, project.rootDirectory);
    const projectRootDir = workingDirInfo.workingDir;

    if (workingDirInfo.note) {
      await addLog(`[DeployX] ${workingDirInfo.note}`);
    }

    // 6. Execute Dependency Installation
    if (workingDirInfo.hasPackageJson && !options.mockBuild) {
      deployment.stage = "installing";
      await deployment.save();

      const packageJsonPath = path.join(projectRootDir, "package.json");

      // Validate manifest syntax and dependencies
      const manifestCheck = validatePackageManifest(packageJsonPath);
      if (!manifestCheck.valid) {
        throw new Error(`Package manifest error: ${manifestCheck.error}`);
      }

      // Inspect lockfile health and corruption
      const lockfileResult = inspectLockfile(projectRootDir);
      const strategy = determineInstallStrategy({
        workingDir: projectRootDir,
        configuredInstallCmd: project.installCommand,
        packageManager: project.packageManager,
        lockfileResult,
      });

      if (strategy.warning) {
        await addLog(`[DeployX Warning] ${strategy.warning}`);
      }
      await addLog(`[DeployX] ${strategy.explanation}`);
      await addLog(`[DeployX] Installing dependencies with '${strategy.command}'...`);

      const installResult = await executeSandboxedCommand(
        strategy.command,
        projectRootDir,
        { NODE_ENV: "development" }, // Guarantee devDependencies (compilers, PostCSS plugins) are installed
        420000, // 7 minutes
        (line) => addLog(`  [install] ${line}`)
      );

      if (installResult.code !== 0) {
        const errorDetail = extractNpmDiagnosticSummary(
          installResult.stderr,
          installResult.stdout,
          installResult.logs
        );
        throw new Error(`Dependency installation failed with exit code ${installResult.code}: ${errorDetail}`);
      }
      await addLog(`[DeployX] ✓ Dependencies installed successfully.`);

      // Pre-build PostCSS & Tailwind dependency validation
      const { validatePostCssDependencies } = await import("@/lib/build/dependency-resolver");
      const postCssCheck = validatePostCssDependencies(projectRootDir);
      if (postCssCheck.isMissing) {
        throw new Error(postCssCheck.error || "Missing required PostCSS build dependencies.");
      }
    }

    // 7. Execute Build Command
    const buildCmd = project.buildCommand;
    if (buildCmd && buildCmd.trim() !== "" && !options.mockBuild) {
      deployment.stage = "building";
      await deployment.save();
      await addLog(`[DeployX] Executing build command '${buildCmd}'...`);

      // Load user project environment variables
      const EnvironmentVariable = (await import("@/models/EnvironmentVariable")).default;
      const projectEnvs = await EnvironmentVariable.find({
        projectId: project._id,
        userId: project.userId,
      }).lean();

      const userBuildEnv: Record<string, string> = {};
      const secretValuesToRedact: string[] = [];
      for (const envItem of projectEnvs) {
        if (typeof envItem.key === "string" && typeof envItem.value === "string") {
          userBuildEnv[envItem.key] = envItem.value;
          if (envItem.value.length >= 6) {
            secretValuesToRedact.push(envItem.value);
          }
        }
      }

      const buildResult = await executeSandboxedCommand(
        buildCmd,
        projectRootDir,
        userBuildEnv,
        300000, // 5 minutes
        (line) => addLog(`  [build] ${line}`)
      );

      if (buildResult.code !== 0) {
        throw new Error(`Build failed with exit code ${buildResult.code}.`);
      }
      await addLog(`[DeployX] ✓ Build completed successfully.`);
    }

    // 8. Validate Build Output Directory
    const outputDirRel = targetEval.outputDirectory || project.outputDirectory || "dist";
    let outputDirPath = validatePathInsideWorkspace(projectRootDir, outputDirRel);

    if (!fs.existsSync(outputDirPath) && fs.existsSync(path.join(workspaceDir, outputDirRel))) {
      outputDirPath = path.join(workspaceDir, outputDirRel);
    }

    // Fallback: If "out" was expected but project generated ".next", fallback to ".next"
    if (!fs.existsSync(outputDirPath)) {
      if (fs.existsSync(path.join(projectRootDir, ".next"))) {
        outputDirPath = path.join(projectRootDir, ".next");
      } else if (project.outputDirectory && fs.existsSync(path.join(projectRootDir, project.outputDirectory))) {
        outputDirPath = path.join(projectRootDir, project.outputDirectory);
      }
    }

    // For Next.js projects deployed to Cloudflare Pages static hosting:
    // If .next is being published, ensure index.html, static routes, and /_next/static are prepared at root
    if (outputDirPath.endsWith(".next")) {
      const serverAppDir = path.join(outputDirPath, "server", "app");
      const serverPagesDir = path.join(outputDirPath, "server", "pages");

      // 1. Copy all compiled HTML pages to output root
      for (const dir of [serverAppDir, serverPagesDir]) {
        if (fs.existsSync(dir)) {
          try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isFile() && entry.name.endsWith(".html")) {
                const destName = entry.name === "_not-found.html" ? "404.html" : entry.name;
                const destPath = path.join(outputDirPath, destName);
                if (!fs.existsSync(destPath)) {
                  await fs.promises.copyFile(path.join(dir, entry.name), destPath).catch(() => {});
                }
              }
            }
          } catch {
            // Non-fatal if directory reading fails
          }
        }
      }

      // 2. Mirror static/ to _next/static/ so browser requests to /_next/static/... resolve correctly
      const staticDir = path.join(outputDirPath, "static");
      const nextStaticDir = path.join(outputDirPath, "_next", "static");
      if (fs.existsSync(staticDir) && !fs.existsSync(nextStaticDir)) {
        try {
          await fs.promises.mkdir(path.join(outputDirPath, "_next"), { recursive: true });
          await fs.promises.cp(staticDir, nextStaticDir, { recursive: true }).catch(() => {});
        } catch {
          // Non-fatal fallback
        }
      }
    }

    // Ensure public/ directory assets (e.g. image sequences, favicons, media) are copied to output directory
    const publicDir = path.join(projectRootDir, "public");
    if (fs.existsSync(publicDir)) {
      try {
        const publicEntries = await fs.promises.readdir(publicDir);
        for (const entry of publicEntries) {
          const destEntryPath = path.join(outputDirPath, entry);
          if (!fs.existsSync(destEntryPath)) {
            await fs.promises.cp(path.join(publicDir, entry), destEntryPath, { recursive: true }).catch(() => {});
          }
        }
        await addLog(`[DeployX] ✓ Synced public/ assets into deployment directory.`);
      } catch {
        // Non-fatal fallback
      }
    }

    if (!fs.existsSync(outputDirPath)) {
      throw new Error(`Output directory '${outputDirRel}' not found after build. Please verify your build command and output settings.`);
    }

    const filesInOutput = await fs.promises.readdir(outputDirPath);
    if (filesInOutput.length === 0) {
      throw new Error(`Output directory '${outputDirRel}' exists but is empty.`);
    }

    await addLog(`[DeployX] ✓ Verified build output in '${outputDirRel}' (${filesInOutput.length} assets ready for publishing).`);

    // 9. Publish via Cloudflare Pages
    deployment.stage = "uploading";
    await deployment.save();
    await addLog(`[DeployX] Preparing Cloudflare Pages publishing...`);

    const { accountId, apiToken } = getCloudflareConfig();
    let cfProjectName = project.cloudflareProjectName;
    if (!cfProjectName) {
      cfProjectName = sanitizePagesProjectName(project.slug || project.name);
      project.cloudflareProjectName = cfProjectName;
      await project.save();
    }

    const wranglerCliPath = path.resolve(process.cwd(), "node_modules", "wrangler", "bin", "wrangler.js").replace(/\\/g, "/");

    // Ensure Cloudflare Pages project container exists
    let cfProject = await CloudflareProvider.getPagesProject(cfProjectName);
    if (!cfProject) {
      await addLog(`[DeployX] Creating Cloudflare Pages project '${cfProjectName}'...`);
      try {
        cfProject = await CloudflareProvider.createProject(
          cfProjectName,
          deployment.branch,
          project.repository,
          project.buildCommand,
          outputDirRel,
          project.rootDirectory
        );
      } catch {
        // Fallback to creating direct-upload Pages project container via wrangler CLI
        const createCmd = `node ${wranglerCliPath} pages project create ${cfProjectName} --production-branch=${deployment.branch || "main"}`;
        await executeSandboxedCommand(
          createCmd,
          projectRootDir,
          {
            CLOUDFLARE_ACCOUNT_ID: accountId,
            CLOUDFLARE_API_TOKEN: apiToken,
          },
          60000
        ).catch(() => {});
      }
    }

    let assignedUrl = "";
    let cloudflareDeploymentId = "";

    if (options.mockCloudflareDeploy) {
      assignedUrl = `https://${cfProjectName}.pages.dev`;
      cloudflareDeploymentId = `mock-cf-dep-${Date.now()}`;
      await addLog(`[DeployX] (Mock mode) Published to ${assignedUrl}`);
    } else {
      // Execute live Wrangler Pages Deploy in isolated process
      await addLog(`[DeployX] Uploading static assets to Cloudflare Pages via Wrangler...`);

      const safeOutputDir = outputDirPath.replace(/\\/g, "/");
      const safeCommitMessage = (commitInfo.message || "build")
        .replace(/[^a-zA-Z0-9_-]/g, "-")
        .slice(0, 50) || "build";

      const wranglerCmd = `node ${wranglerCliPath} pages deploy ${safeOutputDir} --project-name=${cfProjectName} --branch=${deployment.branch} --commit-hash=${commitInfo.sha} --commit-message=${safeCommitMessage}`;

      const wranglerResult = await executeSandboxedCommand(
        wranglerCmd,
        projectRootDir,
        {
          CLOUDFLARE_ACCOUNT_ID: accountId,
          CLOUDFLARE_API_TOKEN: apiToken,
        },
        600000, // 10 minutes to accommodate large media / image sequences
        (line) => addLog(`  [cloudflare] ${line}`)
      );

      if (wranglerResult.code !== 0) {
        const errorDetail = (wranglerResult.stderr || wranglerResult.stdout || "").trim();
        throw new Error(`Cloudflare Pages upload failed (exit code ${wranglerResult.code}): ${errorDetail || "Unknown error"}`);
      }

      // Extract deployment URL from output and combined logs
      const combinedOutput = `${wranglerResult.stdout}\n${wranglerResult.stderr}\n${wranglerResult.logs.join("\n")}`;
      const urlMatches = Array.from(combinedOutput.matchAll(/https:\/\/([a-zA-Z0-9_.-]+)\.pages\.dev/g));
      if (urlMatches && urlMatches.length > 0) {
        // Pick the last matched URL which represents the final deployment URL
        assignedUrl = urlMatches[urlMatches.length - 1][0];
      } else {
        assignedUrl = `https://${cfProjectName}.pages.dev`;
      }

      // Discover latest deployment ID from Cloudflare
      try {
        const deployments = await CloudflareProvider.listDeployments(cfProjectName, 3);
        if (deployments && deployments.length > 0) {
          cloudflareDeploymentId = deployments[0].id;
          if (deployments[0].url) {
            assignedUrl = deployments[0].url;
          }
        } else {
          const freshProject = await CloudflareProvider.getPagesProject(cfProjectName);
          cloudflareDeploymentId = freshProject?.latest_deployment?.id || `cf-${Date.now()}`;
        }
      } catch {
        cloudflareDeploymentId = `cf-${Date.now()}`;
      }
    }

    // 10. Update Deployment & Project Records
    const elapsedSeconds = Math.max(Math.round((Date.now() - startTime) / 1000), 1);
    deployment.status = "READY";
    deployment.stage = "deployed";
    deployment.completedAt = new Date();
    deployment.url = assignedUrl.replace(/^https?:\/\//, "");
    deployment.cloudflareDeploymentId = cloudflareDeploymentId;
    deployment.duration = elapsedSeconds;
    await deployment.save();

    // If production branch, update project productionUrl
    if (project.branch === deployment.branch) {
      project.productionUrl = deployment.url;
      await project.save();
    }

    await addLog(`[DeployX] ✓ Deployment successfully published to: https://${deployment.url} (${elapsedSeconds}s)`);

    // Audit log & Real Notification
    await Activity.create({
      userId: project.userId,
      projectId: project._id,
      type: "deployment_ready",
      title: "Deployment succeeded",
      description: `Deployment #${deploymentId.slice(-6)} for '${project.name}' is live at https://${deployment.url}`,
      icon: "CheckCircle",
      color: "text-emerald-500",
    });

    try {
      const Notification = (await import("@/models/Notification")).default;
      await Notification.create({
        userId: project.userId,
        title: "Build succeeded",
        message: `Deployment #${deploymentId.slice(-6)} for '${project.name}' is live at https://${deployment.url}`,
        type: "success",
        category: "deployment",
        link: `/dashboard/deployments/${deployment._id}`,
      });
    } catch {
      // Non-fatal
    }

  } catch (err: unknown) {
    const rawError = err instanceof Error ? err.message : String(err);
    const sanitizedError = redactSensitive(rawError);
    const elapsedSeconds = Math.max(Math.round((Date.now() - startTime) / 1000), 1);

    await addLog(`[DeployX] ❌ Deployment failed: ${sanitizedError}`);

    deployment.status = "FAILED";
    deployment.stage = "failed";
    deployment.completedAt = new Date();
    deployment.errorMessage = sanitizedError;
    deployment.duration = elapsedSeconds;
    await deployment.save();

    await Activity.create({
      userId: project.userId,
      projectId: project._id,
      type: "deployment_failed",
      title: "Deployment failed",
      description: `Deployment #${deploymentId.slice(-6)} failed: ${sanitizedError}`,
      icon: "XCircle",
      color: "text-red-500",
    }).catch(() => {});

    try {
      const Notification = (await import("@/models/Notification")).default;
      await Notification.create({
        userId: project.userId,
        title: "Deployment failed",
        message: `Deployment #${deploymentId.slice(-6)} for '${project.name}' failed: ${sanitizedError.slice(0, 150)}`,
        type: "error",
        category: "deployment",
        link: `/dashboard/deployments/${deployment._id}`,
      });
    } catch {
      // Non-fatal
    }

  } finally {
    // Clean up temporary workspace directory
    try {
      if (fs.existsSync(workspaceDir)) {
        await fs.promises.rm(workspaceDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore directory cleanup error
    }
  }
}
