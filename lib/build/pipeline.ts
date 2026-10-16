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
    const { validateBuildCommand } = require("@/lib/security/command-sanitizer");
    const cmdCheck = validateBuildCommand(command);
    if (!cmdCheck.valid) {
      const secErr = new Error(cmdCheck.error || "Prohibited command execution rejected.");
      onLog?.(`[DeployX Security Alert] ${secErr.message}`);
      return reject(secErr);
    }

    // Whitelist only safe environment variables
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
      ...extraEnv,
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

    const [owner, repo] = project.repository.split("/");
    if (!owner || !repo) {
      throw new Error(`Invalid repository format '${project.repository}'. Expected 'owner/repo'.`);
    }

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

    // 5. Validate Root Directory and Output Directory Boundaries
    const projectRootDir = validatePathInsideWorkspace(workspaceDir, project.rootDirectory);
    if (!fs.existsSync(projectRootDir)) {
      throw new Error(`Project root directory '${project.rootDirectory}' not found in repository.`);
    }

    // 6. Execute Dependency Installation
    const packageJsonPath = path.join(projectRootDir, "package.json");
    const hasPackageJson = fs.existsSync(packageJsonPath);

    if (hasPackageJson && !options.mockBuild) {
      const installCmd = project.installCommand || "npm install";
      await addLog(`[DeployX] Installing dependencies with '${installCmd}'...`);

      const installResult = await executeSandboxedCommand(
        installCmd,
        projectRootDir,
        {},
        180000, // 3 minutes
        (line) => addLog(`  [install] ${line}`)
      );

      if (installResult.code !== 0) {
        throw new Error(`Dependency installation failed with exit code ${installResult.code}.`);
      }
      await addLog(`[DeployX] ✓ Dependencies installed successfully.`);
    }

    // 7. Execute Build Command
    const buildCmd = project.buildCommand;
    if (buildCmd && buildCmd.trim() !== "" && !options.mockBuild) {
      await addLog(`[DeployX] Executing build command '${buildCmd}'...`);

      const buildResult = await executeSandboxedCommand(
        buildCmd,
        projectRootDir,
        {},
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
    const outputDirPath = validatePathInsideWorkspace(projectRootDir, outputDirRel);

    if (!fs.existsSync(outputDirPath)) {
      throw new Error(`Output directory '${outputDirRel}' not found after build. Please verify your build command and output settings.`);
    }

    const filesInOutput = await fs.promises.readdir(outputDirPath);
    if (filesInOutput.length === 0) {
      throw new Error(`Output directory '${outputDirRel}' exists but is empty.`);
    }

    await addLog(`[DeployX] ✓ Verified build output in '${outputDirRel}' (${filesInOutput.length} assets ready for publishing).`);

    // 9. Publish via Cloudflare Pages
    await addLog(`[DeployX] Preparing Cloudflare Pages publishing...`);

    const { accountId, apiToken } = getCloudflareConfig();
    let cfProjectName = project.cloudflareProjectName;
    if (!cfProjectName) {
      cfProjectName = sanitizePagesProjectName(project.slug || project.name);
      project.cloudflareProjectName = cfProjectName;
      await project.save();
    }

    // Ensure Cloudflare Pages project container exists
    let cfProject = await CloudflareProvider.getPagesProject(cfProjectName);
    if (!cfProject) {
      await addLog(`[DeployX] Creating Cloudflare Pages project '${cfProjectName}'...`);
      cfProject = await CloudflareProvider.createProject(
        cfProjectName,
        deployment.branch,
        project.repository,
        project.buildCommand,
        outputDirRel,
        project.rootDirectory
      );
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

      const wranglerCmd = `npx wrangler pages deploy "${outputDirPath}" --project-name="${cfProjectName}" --branch="${deployment.branch}" --commit-hash="${commitInfo.sha}" --commit-message="${commitInfo.message.replace(/"/g, '\\"')}"`;

      const wranglerResult = await executeSandboxedCommand(
        wranglerCmd,
        projectRootDir,
        {
          CLOUDFLARE_ACCOUNT_ID: accountId,
          CLOUDFLARE_API_TOKEN: apiToken,
        },
        180000,
        (line) => addLog(`  [cloudflare] ${line}`)
      );

      if (wranglerResult.code !== 0) {
        throw new Error(`Cloudflare Pages upload failed: ${wranglerResult.stderr || "Unknown error"}`);
      }

      // Extract deployment URL from output
      const urlMatch = wranglerResult.stdout.match(/https:\/\/[a-zA-Z0-9.-]+\.pages\.dev/);
      if (urlMatch) {
        assignedUrl = urlMatch[0];
      } else {
        assignedUrl = `https://${cfProjectName}.pages.dev`;
      }

      // Discover latest deployment ID from Cloudflare
      try {
        const freshProject = await CloudflareProvider.getPagesProject(cfProjectName);
        cloudflareDeploymentId = freshProject?.latest_deployment?.id || `cf-${Date.now()}`;
      } catch {
        cloudflareDeploymentId = `cf-${Date.now()}`;
      }
    }

    // 10. Update Deployment & Project Records
    const elapsedSeconds = Math.max(Math.round((Date.now() - startTime) / 1000), 1);
    deployment.status = "READY";
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

    // Audit log
    await Activity.create({
      userId: project.userId,
      projectId: project._id,
      type: "deployment_ready",
      title: "Deployment succeeded",
      description: `Deployment #${deploymentId.slice(-6)} for '${project.name}' is live at https://${deployment.url}`,
      icon: "CheckCircle",
      color: "text-emerald-500",
    });

  } catch (err: unknown) {
    const rawError = err instanceof Error ? err.message : String(err);
    const sanitizedError = redactSensitive(rawError);
    const elapsedSeconds = Math.max(Math.round((Date.now() - startTime) / 1000), 1);

    await addLog(`[DeployX] ❌ Deployment failed: ${sanitizedError}`);

    deployment.status = "FAILED";
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
