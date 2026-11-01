import fs from "fs";
import path from "path";
import { redactSensitive } from "@/lib/cloudflare/client";

export interface ManifestValidationResult {
  valid: boolean;
  error?: string;
  manifest?: Record<string, unknown>;
  name?: string;
  hasDependencies?: boolean;
}

export interface LockfileInspectionResult {
  exists: boolean;
  lockfilePath?: string;
  type: "npm" | "pnpm" | "yarn" | "bun" | "none";
  valid: boolean;
  isCorrupted: boolean;
  reason?: string;
}

export interface WorkingDirResolution {
  workingDir: string;
  relativeDir: string;
  hasPackageJson: boolean;
  detectedNested: boolean;
  note?: string;
}

export interface InstallStrategyResult {
  command: string;
  explanation: string;
  warning?: string;
}

/**
 * Validates a package.json file for syntax correctness and valid dependency specs.
 */
export function validatePackageManifest(packageJsonPath: string): ManifestValidationResult {
  if (!fs.existsSync(packageJsonPath)) {
    return {
      valid: false,
      error: `Manifest file not found at '${packageJsonPath}'.`,
    };
  }

  let raw: string;
  try {
    raw = fs.readFileSync(packageJsonPath, "utf-8");
  } catch (err) {
    return {
      valid: false,
      error: `Failed to read package.json: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(raw);
  } catch (parseErr) {
    return {
      valid: false,
      error: `Invalid JSON in package.json: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
    };
  }

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return {
      valid: false,
      error: "package.json must contain a top-level JSON object.",
    };
  }

  // Verify dependencies and devDependencies specs
  const depFields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
  let totalDeps = 0;

  for (const field of depFields) {
    const deps = manifest[field];
    if (deps !== undefined) {
      if (typeof deps !== "object" || deps === null || Array.isArray(deps)) {
        return {
          valid: false,
          error: `Field '${field}' in package.json must be an object map of package names to version strings.`,
        };
      }

      for (const [depName, spec] of Object.entries(deps as Record<string, unknown>)) {
        totalDeps++;
        if (typeof spec !== "string" || spec.trim() === "") {
          return {
            valid: false,
            error: `Invalid version specification for dependency '${depName}' in '${field}': expected non-empty string, received ${typeof spec}.`,
          };
        }
      }
    }
  }

  return {
    valid: true,
    manifest,
    name: typeof manifest.name === "string" ? manifest.name : undefined,
    hasDependencies: totalDeps > 0,
  };
}

/**
 * Inspects lockfiles in the working directory for structural integrity and corruption.
 * Specifically checks npm package-lock.json for corrupted non-string specs that cause Arborist crashes.
 */
export function inspectLockfile(workingDir: string): LockfileInspectionResult {
  const npmLockPath = path.join(workingDir, "package-lock.json");
  const pnpmLockPath = path.join(workingDir, "pnpm-lock.yaml");
  const yarnLockPath = path.join(workingDir, "yarn.lock");
  const bunLockPath = path.join(workingDir, "bun.lockb");
  const bunTextLockPath = path.join(workingDir, "bun.lock");

  if (fs.existsSync(pnpmLockPath)) {
    return { exists: true, lockfilePath: pnpmLockPath, type: "pnpm", valid: true, isCorrupted: false };
  }
  if (fs.existsSync(yarnLockPath)) {
    return { exists: true, lockfilePath: yarnLockPath, type: "yarn", valid: true, isCorrupted: false };
  }
  if (fs.existsSync(bunLockPath) || fs.existsSync(bunTextLockPath)) {
    return { exists: true, lockfilePath: fs.existsSync(bunLockPath) ? bunLockPath : bunTextLockPath, type: "bun", valid: true, isCorrupted: false };
  }

  if (!fs.existsSync(npmLockPath)) {
    return { exists: false, type: "none", valid: true, isCorrupted: false };
  }

  // Inspect npm package-lock.json
  let raw: string;
  try {
    raw = fs.readFileSync(npmLockPath, "utf-8");
  } catch (err) {
    return {
      exists: true,
      lockfilePath: npmLockPath,
      type: "npm",
      valid: false,
      isCorrupted: true,
      reason: `Could not read package-lock.json: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  let lock: Record<string, unknown>;
  try {
    lock = JSON.parse(raw);
  } catch (parseErr) {
    return {
      exists: true,
      lockfilePath: npmLockPath,
      type: "npm",
      valid: false,
      isCorrupted: true,
      reason: `Invalid JSON in package-lock.json: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
    };
  }

  if (typeof lock !== "object" || lock === null) {
    return {
      exists: true,
      lockfilePath: npmLockPath,
      type: "npm",
      valid: false,
      isCorrupted: true,
      reason: "package-lock.json must contain a top-level JSON object.",
    };
  }

  // Known metadata keys that cannot appear as valid dependency package names
  const INVALID_DEP_NAMES = new Set([
    "version",
    "license",
    "resolved",
    "integrity",
    "dependencies",
    "devDependencies",
    "bin",
    "engines",
    "funding",
    "peerDependencies",
    "peerDependenciesMeta",
    "optionalDependencies",
  ]);

  // Deep inspection of packages map in v2/v3 lockfiles
  const packages = lock.packages;
  if (packages && typeof packages === "object") {
    for (const [pkgPath, pkgData] of Object.entries(packages as Record<string, unknown>)) {
      if (!pkgData || typeof pkgData !== "object") continue;

      const pObj = pkgData as Record<string, unknown>;

      for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
        const deps = pObj[field];
        if (deps && typeof deps === "object") {
          for (const [depName, spec] of Object.entries(deps as Record<string, unknown>)) {
            // Check for non-string specs (causes npm TypeError: must provide string spec)
            if (typeof spec !== "string") {
              return {
                exists: true,
                lockfilePath: npmLockPath,
                type: "npm",
                valid: false,
                isCorrupted: true,
                reason: `Corrupted dependency entry '${depName}' with non-string spec in '${pkgPath}.${field}' (causes 'npm error must provide string spec')`,
              };
            }

            // Check for metadata keys accidentally nested inside dependencies
            if (INVALID_DEP_NAMES.has(depName)) {
              return {
                exists: true,
                lockfilePath: npmLockPath,
                type: "npm",
                valid: false,
                isCorrupted: true,
                reason: `Corrupted package-lock.json metadata key '${depName}' nested inside dependencies for '${pkgPath}'`,
              };
            }
          }
        }
      }
    }
  }

  // Inspection of legacy v1 dependencies tree if present
  const legacyDeps = lock.dependencies;
  if (legacyDeps && typeof legacyDeps === "object") {
    for (const [depName, depData] of Object.entries(legacyDeps as Record<string, unknown>)) {
      if (INVALID_DEP_NAMES.has(depName)) {
        return {
          exists: true,
          lockfilePath: npmLockPath,
          type: "npm",
          valid: false,
          isCorrupted: true,
          reason: `Corrupted legacy dependency entry '${depName}' in package-lock.json`,
        };
      }
      if (depData && typeof depData === "object") {
        const dObj = depData as Record<string, unknown>;
        const requires = dObj.requires;
        if (requires && typeof requires === "object") {
          for (const [reqName, spec] of Object.entries(requires as Record<string, unknown>)) {
            if (typeof spec !== "string") {
              return {
                exists: true,
                lockfilePath: npmLockPath,
                type: "npm",
                valid: false,
                isCorrupted: true,
                reason: `Corrupted 'requires' entry '${reqName}' with non-string spec in '${depName}'`,
              };
            }
          }
        }
      }
    }
  }

  return { exists: true, lockfilePath: npmLockPath, type: "npm", valid: true, isCorrupted: false };
}

/**
 * Resolves the appropriate application working directory containing package.json.
 * Supports root directory configs, monorepo structures, and nested client/frontend/app directories.
 */
export async function resolveProjectWorkingDir(
  workspaceDir: string,
  configuredRootDir?: string
): Promise<WorkingDirResolution> {
  const normWorkspace = path.resolve(workspaceDir);
  const targetDir = configuredRootDir && configuredRootDir.trim()
    ? path.resolve(workspaceDir, configuredRootDir.trim())
    : normWorkspace;

  // Verify boundaries
  if (!targetDir.startsWith(normWorkspace + path.sep) && targetDir !== normWorkspace) {
    throw new Error(`Security Violation: Configured root directory escapes build workspace.`);
  }

  if (fs.existsSync(path.join(targetDir, "package.json"))) {
    return {
      workingDir: targetDir,
      relativeDir: path.relative(normWorkspace, targetDir).replace(/\\/g, "/") || ".",
      hasPackageJson: true,
      detectedNested: false,
    };
  }

  // If not at targetDir, search common nested candidate directories
  const candidateSubdirs = ["client", "frontend", "web", "app", "ui", "site"];
  for (const sub of candidateSubdirs) {
    const candidatePath = path.join(targetDir, sub);
    if (fs.existsSync(path.join(candidatePath, "package.json"))) {
      const rel = path.relative(normWorkspace, candidatePath).replace(/\\/g, "/");
      return {
        workingDir: candidatePath,
        relativeDir: rel,
        hasPackageJson: true,
        detectedNested: true,
        note: `Discovered application package.json in nested directory '${rel}'.`,
      };
    }
  }

  // Check monorepo packages/ or apps/ subdirectories
  for (const monoParent of ["packages", "apps"]) {
    const parentPath = path.join(targetDir, monoParent);
    if (fs.existsSync(parentPath)) {
      try {
        const subdirs = await fs.promises.readdir(parentPath, { withFileTypes: true });
        for (const dirent of subdirs) {
          if (dirent.isDirectory()) {
            const candidate = path.join(parentPath, dirent.name);
            if (fs.existsSync(path.join(candidate, "package.json"))) {
              const rel = path.relative(normWorkspace, candidate).replace(/\\/g, "/");
              return {
                workingDir: candidate,
                relativeDir: rel,
                hasPackageJson: true,
                detectedNested: true,
                note: `Discovered monorepo application package.json in '${rel}'.`,
              };
            }
          }
        }
      } catch {
        // Ignore read errors
      }
    }
  }

  return {
    workingDir: targetDir,
    relativeDir: path.relative(normWorkspace, targetDir).replace(/\\/g, "/") || ".",
    hasPackageJson: false,
    detectedNested: false,
  };
}

/**
 * Determines the safest, most reliable installation strategy based on package manager and lockfile health.
 * Prefers npm ci when a valid matching lockfile exists; falls back to documented safe strategy on corruption.
 */
export function determineInstallStrategy(options: {
  workingDir: string;
  configuredInstallCmd?: string;
  packageManager?: string;
  lockfileResult: LockfileInspectionResult;
}): InstallStrategyResult {
  const { configuredInstallCmd, packageManager, lockfileResult } = options;

  // If the user specified an explicit custom install command (not "npm install"), respect it
  if (configuredInstallCmd && configuredInstallCmd.trim() !== "npm install") {
    return {
      command: configuredInstallCmd.trim(),
      explanation: "Using user-configured custom install command.",
    };
  }

  const pm = packageManager || (lockfileResult.type !== "none" ? lockfileResult.type : "npm");

  switch (pm) {
    case "pnpm":
      return {
        command: lockfileResult.exists ? "pnpm install --frozen-lockfile" : "pnpm install",
        explanation: lockfileResult.exists ? "Using pnpm with frozen lockfile." : "Using pnpm install.",
      };

    case "yarn":
      return {
        command: lockfileResult.exists ? "yarn install --frozen-lockfile" : "yarn install",
        explanation: lockfileResult.exists ? "Using yarn with frozen lockfile." : "Using yarn install.",
      };

    case "bun":
      return {
        command: lockfileResult.exists ? "bun install --frozen-lockfile" : "bun install",
        explanation: lockfileResult.exists ? "Using bun with frozen lockfile." : "Using bun install.",
      };

    case "npm":
    default:
      if (lockfileResult.exists) {
        if (lockfileResult.isCorrupted) {
          return {
            command: "npm install --include=dev --no-package-lock --no-audit --no-fund",
            explanation: "Corrupted lockfile detected; installing declared dependencies safely via 'npm install --include=dev --no-package-lock --no-audit --no-fund'.",
            warning: `Repository lockfile 'package-lock.json' is corrupted: ${lockfileResult.reason}. Using '--include=dev --no-package-lock' to install all declared dependencies from package.json without failing.`,
          };
        }
        // Valid lockfile exists -> prefer npm ci for clean, deterministic CI install
        return {
          command: "npm ci --include=dev --no-audit --no-fund",
          explanation: "Valid package-lock.json verified; using 'npm ci --include=dev' for fast, deterministic installation with build tools.",
        };
      }

      // No lockfile -> safe npm install
      return {
        command: "npm install --include=dev --no-package-lock --no-audit --no-fund",
        explanation: "No package-lock.json found; installing dependencies safely from package.json with build tools.",
      };
  }
}

/**
 * Extracts and redacts actionable error details from npm execution logs.
 */
export function extractNpmDiagnosticSummary(stderr: string, stdout: string, logs: string[]): string {
  const combined = `${stdout}\n${stderr}\n${logs.join("\n")}`;
  const lines = combined.split(/\r?\n/);
  const errorLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      trimmed.includes("npm error") ||
      trimmed.includes("TypeError:") ||
      trimmed.includes("code ETARGET") ||
      trimmed.includes("code ERESOLVE") ||
      trimmed.includes("code ENOENT") ||
      trimmed.includes("code E404")
    ) {
      const redacted = redactSensitive(trimmed);
      if (!errorLines.includes(redacted)) {
        errorLines.push(redacted);
      }
    }
  }

  if (errorLines.length > 0) {
    return errorLines.slice(0, 5).join(" | ");
  }

  return redactSensitive((stderr || stdout).trim().slice(-200) || "Dependency installation failed.");
}

export interface PostCssValidationResult {
  hasPostCssConfig: boolean;
  pluginReferenced?: string;
  isMissing: boolean;
  error?: string;
}

/**
 * Validates that PostCSS plugins referenced in configuration (e.g. Tailwind v4 or v3)
 * are installed in node_modules before executing the build.
 */
export function validatePostCssDependencies(workingDir: string): PostCssValidationResult {
  const configNames = [
    "postcss.config.mjs",
    "postcss.config.js",
    "postcss.config.cjs",
    "postcss.config.json",
  ];

  let configContent = "";
  let foundConfig = "";

  for (const name of configNames) {
    const fullPath = path.join(workingDir, name);
    if (fs.existsSync(fullPath)) {
      foundConfig = name;
      try {
        configContent = fs.readFileSync(fullPath, "utf-8");
      } catch {
        // ignore
      }
      break;
    }
  }

  if (!foundConfig) {
    const pkgPath = path.join(workingDir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        if (pkg.postcss) {
          foundConfig = "package.json[postcss]";
          configContent = JSON.stringify(pkg.postcss);
        }
      } catch {
        // ignore
      }
    }
  }

  if (!foundConfig) {
    return { hasPostCssConfig: false, isMissing: false };
  }

  // Check if @tailwindcss/postcss is referenced (Tailwind CSS v4)
  if (configContent.includes("@tailwindcss/postcss")) {
    const pluginPath = path.join(workingDir, "node_modules", "@tailwindcss", "postcss");
    if (!fs.existsSync(pluginPath)) {
      return {
        hasPostCssConfig: true,
        pluginReferenced: "@tailwindcss/postcss",
        isMissing: true,
        error: `PostCSS config '${foundConfig}' references '@tailwindcss/postcss' (Tailwind CSS v4), but it is not installed in 'node_modules/@tailwindcss/postcss'. Ensure devDependencies are installed with '--include=dev'.`,
      };
    }
  }

  // Check if standard tailwindcss is referenced (Tailwind CSS v3)
  if (configContent.includes('"tailwindcss"') || configContent.includes("'tailwindcss'")) {
    const pluginPath = path.join(workingDir, "node_modules", "tailwindcss");
    if (!fs.existsSync(pluginPath)) {
      return {
        hasPostCssConfig: true,
        pluginReferenced: "tailwindcss",
        isMissing: true,
        error: `PostCSS config '${foundConfig}' references 'tailwindcss', but it is not installed in 'node_modules/tailwindcss'. Ensure devDependencies are installed with '--include=dev'.`,
      };
    }
  }

  return { hasPostCssConfig: true, isMissing: false };
}

