import { getRepositoryFile, getRepositoryDirectory, GitHubDirectoryItem } from "./api";

export type PackageManagerType = "npm" | "pnpm" | "yarn" | "bun";
export type DeploymentModeType = "static" | "ssr";

export interface FrameworkDetectionResult {
  framework: string;
  buildCommand: string;
  installCommand: string;
  outputDirectory: string;
  packageManager: PackageManagerType;
  deploymentMode: DeploymentModeType;
  rootDirectory: string;
  detectedRoots: string[];
  warnings: string[];
}

/**
 * Sanitizes a candidate root directory path to prevent path traversal attacks.
 * Rejects or strips leading/trailing slashes, null bytes, and ".." navigation.
 */
export function sanitizeRootDirectory(rootDir?: string | null): string {
  if (!rootDir || typeof rootDir !== "string") return "";
  
  // Normalize Windows-style backslashes to forward slashes
  const normalized = rootDir.replace(/\\/g, "/").trim();
  
  // Split segments and filter out empty, current dir (.), and parent dir (..)
  const segments = normalized.split("/").filter((segment) => {
    const s = segment.trim();
    return s && s !== "." && s !== "..";
  });

  return segments.join("/");
}

/**
 * Resolves the lockfile present in the directory items and maps to the appropriate package manager.
 */
export function detectPackageManager(dirItems: GitHubDirectoryItem[] = []): PackageManagerType {
  const itemNames = new Set(dirItems.map((item) => item.name.toLowerCase()));

  // Order of lockfile resolution precedence
  if (itemNames.has("pnpm-lock.yaml")) return "pnpm";
  if (itemNames.has("bun.lock") || itemNames.has("bun.lockb")) return "bun";
  if (itemNames.has("yarn.lock")) return "yarn";
  if (itemNames.has("package-lock.json")) return "npm";

  return "npm";
}

/**
 * Constructs the default install command for a package manager.
 */
export function getInstallCommand(packageManager: PackageManagerType): string {
  switch (packageManager) {
    case "pnpm":
      return "pnpm install";
    case "yarn":
      return "yarn install";
    case "bun":
      return "bun install";
    case "npm":
    default:
      return "npm install";
  }
}

/**
 * Detects the build command from package.json scripts with fallback precedence.
 */
export function resolveBuildCommand(
  scripts: Record<string, string> = {},
  packageManager: PackageManagerType,
  preferredScript?: string
): string {
  let scriptKey: string | null = null;

  if (preferredScript && scripts[preferredScript]) {
    scriptKey = preferredScript;
  } else if (scripts.build) {
    scriptKey = "build";
  } else if (scripts.generate) {
    scriptKey = "generate";
  } else if (scripts["build:prod"]) {
    scriptKey = "build:prod";
  } else if (scripts["prod"]) {
    scriptKey = "prod";
  }

  if (!scriptKey) return "";

  switch (packageManager) {
    case "yarn":
      return `yarn ${scriptKey}`;
    case "pnpm":
      return `pnpm run ${scriptKey}`;
    case "bun":
      return `bun run ${scriptKey}`;
    case "npm":
    default:
      return `npm run ${scriptKey}`;
  }
}

/**
 * Statically analyzes project files in a repository to detect the framework,
 * build commands, output directory, lockfile, deployment mode, and potential warnings.
 * 
 * Safe static analysis: NEVER evaluates repository JavaScript/TypeScript or runs shell commands.
 */
export async function detectFramework(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string = "main",
  targetRootDir: string = ""
): Promise<FrameworkDetectionResult> {
  const sanitizedRoot = sanitizeRootDirectory(targetRootDir);
  const detectedRoots: string[] = [];
  const warnings: string[] = [];

  // Default fallback result
  const fallbackResult: FrameworkDetectionResult = {
    framework: "Other",
    buildCommand: "",
    installCommand: "npm install",
    outputDirectory: "public",
    packageManager: "npm",
    deploymentMode: "static",
    rootDirectory: sanitizedRoot,
    detectedRoots: [],
    warnings: [],
  };

  try {
    // 1. Inspect directory items at target root directory
    const dirItems = await getRepositoryDirectory(accessToken, owner, repo, sanitizedRoot, branch);
    
    // Also check root directory if targetRoot is non-empty, to discover monorepo workspaces and lockfiles
    let rootItems: GitHubDirectoryItem[] = [];
    if (sanitizedRoot) {
      rootItems = (await getRepositoryDirectory(accessToken, owner, repo, "", branch)) || [];
    } else {
      rootItems = dirItems || [];
    }

    // 2. Discover potential monorepo subdirectories if at root
    if (!sanitizedRoot && rootItems.length > 0) {
      for (const item of rootItems) {
        if (item.type === "dir") {
          const lower = item.name.toLowerCase();
          if (["apps", "packages", "frontend", "client", "web", "ui", "site"].includes(lower)) {
            detectedRoots.push(item.path);
          }
        }
      }
    }

    const itemsToScan = dirItems || [];
    const itemNames = new Set(itemsToScan.map((i) => i.name));

    // 3. Determine Package Manager from lockfiles (check target root first, then repo root)
    let packageManager = detectPackageManager(itemsToScan);
    if (packageManager === "npm" && sanitizedRoot && rootItems.length > 0) {
      // Check if root has a lockfile (e.g. monorepo root pnpm-lock.yaml or yarn.lock)
      const rootPm = detectPackageManager(rootItems);
      if (rootPm !== "npm") {
        packageManager = rootPm;
      }
    }

    const installCommand = getInstallCommand(packageManager);

    // 4. Check for package.json in target directory
    const packageJsonPath = sanitizedRoot ? `${sanitizedRoot}/package.json` : "package.json";
    const packageJsonRaw = await getRepositoryFile(accessToken, owner, repo, packageJsonPath, branch);

    // -------------------------------------------------------------
    // Scenario A: No package.json found
    // -------------------------------------------------------------
    if (!packageJsonRaw) {
      // Check if index.html exists -> Plain Static HTML
      if (itemNames.has("index.html")) {
        return {
          framework: "Static HTML",
          buildCommand: "",
          installCommand: "",
          outputDirectory: sanitizedRoot ? sanitizedRoot : ".",
          packageManager: "npm",
          deploymentMode: "static",
          rootDirectory: sanitizedRoot,
          detectedRoots,
          warnings: [],
        };
      }

      // Check for Python (requirements.txt)
      if (itemNames.has("requirements.txt")) {
        return {
          framework: "Python",
          buildCommand: "",
          installCommand: "pip install -r requirements.txt",
          outputDirectory: ".",
          packageManager: "npm",
          deploymentMode: "ssr",
          rootDirectory: sanitizedRoot,
          detectedRoots,
          warnings: ["Python application detected. DeployX static edge hosting currently serves static or Jamstack frontends."],
        };
      }

      return {
        ...fallbackResult,
        detectedRoots,
      };
    }

    // Parse package.json safely
    let pkg: Record<string, unknown> = {};
    try {
      pkg = JSON.parse(packageJsonRaw) as Record<string, unknown>;
    } catch {
      warnings.push("package.json was found but contains invalid JSON syntax. Falling back to default settings.");
      return {
        ...fallbackResult,
        detectedRoots,
        warnings,
      };
    }

    const rawDeps = (pkg.dependencies && typeof pkg.dependencies === "object") ? (pkg.dependencies as Record<string, string>) : {};
    const rawDevDeps = (pkg.devDependencies && typeof pkg.devDependencies === "object") ? (pkg.devDependencies as Record<string, string>) : {};
    const deps: Record<string, string> = { ...rawDeps, ...rawDevDeps };
    const scripts: Record<string, string> = (pkg.scripts && typeof pkg.scripts === "object") ? (pkg.scripts as Record<string, string>) : {};

    // -------------------------------------------------------------
    // Scenario B: Framework Static Analysis
    // -------------------------------------------------------------

    // 1. Next.js
    if (deps["next"]) {
      // Check for static export configurations:
      // - scripts with `next export`
      // - next.config.js / next.config.mjs / next.config.ts with output: 'export'
      let isStaticExport = false;

      // Check scripts for next export
      for (const scriptVal of Object.values(scripts)) {
        if (typeof scriptVal === "string" && scriptVal.includes("next export")) {
          isStaticExport = true;
          break;
        }
      }

      // Inspect next.config.* if not already determined
      if (!isStaticExport) {
        const configFiles = ["next.config.js", "next.config.mjs", "next.config.ts"];
        for (const cf of configFiles) {
          if (itemNames.has(cf)) {
            const configPath = sanitizedRoot ? `${sanitizedRoot}/${cf}` : cf;
            const configContent = await getRepositoryFile(accessToken, owner, repo, configPath, branch);
            if (configContent && /output\s*:\s*['"]export['"]/.test(configContent)) {
              isStaticExport = true;
              break;
            }
          }
        }
      }

      const buildCommand = resolveBuildCommand(scripts, packageManager);
      if (isStaticExport) {
        return {
          framework: "Next.js (Static Export)",
          buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
          installCommand,
          outputDirectory: "out",
          packageManager,
          deploymentMode: "static",
          rootDirectory: sanitizedRoot,
          detectedRoots,
          warnings: [],
        };
      } else {
        warnings.push(
          "Next.js SSR detected. Cloudflare Pages supports static exports ('output: export') or Cloudflare edge runtime via @cloudflare/next-on-pages."
        );
        return {
          framework: "Next.js",
          buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
          installCommand,
          outputDirectory: ".next",
          packageManager,
          deploymentMode: "ssr",
          rootDirectory: sanitizedRoot,
          detectedRoots,
          warnings,
        };
      }
    }

    // 2. Astro
    if (deps["astro"]) {
      let isSSR = false;
      const astroConfigs = ["astro.config.mjs", "astro.config.js", "astro.config.ts"];
      for (const ac of astroConfigs) {
        if (itemNames.has(ac)) {
          const configPath = sanitizedRoot ? `${sanitizedRoot}/${ac}` : ac;
          const configContent = await getRepositoryFile(accessToken, owner, repo, configPath, branch);
          if (configContent && /output\s*:\s*['"](server|hybrid)['"]/.test(configContent)) {
            isSSR = true;
            break;
          }
        }
      }

      const buildCommand = resolveBuildCommand(scripts, packageManager);
      if (isSSR) {
        warnings.push("Astro SSR mode detected. Ensure @astrojs/cloudflare adapter is configured for Cloudflare Pages.");
      }

      return {
        framework: isSSR ? "Astro (SSR)" : "Astro",
        buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
        installCommand,
        outputDirectory: "dist",
        packageManager,
        deploymentMode: isSSR ? "ssr" : "static",
        rootDirectory: sanitizedRoot,
        detectedRoots,
        warnings,
      };
    }

    // 3. Nuxt / Nuxt.js
    if (deps["nuxt"] || deps["nuxt3"]) {
      let isStatic = false;
      if (scripts.generate) {
        isStatic = true;
      }

      const nuxtConfigs = ["nuxt.config.js", "nuxt.config.ts"];
      for (const nc of nuxtConfigs) {
        if (itemNames.has(nc)) {
          const configPath = sanitizedRoot ? `${sanitizedRoot}/${nc}` : nc;
          const configContent = await getRepositoryFile(accessToken, owner, repo, configPath, branch);
          if (configContent && /ssr\s*:\s*false/.test(configContent)) {
            isStatic = true;
            break;
          }
        }
      }

      let buildCommand = "";
      if (isStatic && scripts.generate) {
        buildCommand = resolveBuildCommand(scripts, packageManager, "generate");
      } else {
        buildCommand = resolveBuildCommand(scripts, packageManager);
      }

      if (!isStatic) {
        warnings.push("Nuxt SSR detected. Cloudflare Pages requires static pre-rendering via 'nuxt generate' or Nitro Cloudflare Pages preset.");
      }

      return {
        framework: isStatic ? "Nuxt (Static)" : "Nuxt",
        buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
        installCommand,
        outputDirectory: isStatic ? "dist" : ".output/public",
        packageManager,
        deploymentMode: isStatic ? "static" : "ssr",
        rootDirectory: sanitizedRoot,
        detectedRoots,
        warnings,
      };
    }

    // 4. Svelte / SvelteKit
    if (deps["@sveltejs/kit"] || deps["svelte"]) {
      const hasStaticAdapter = Boolean(deps["@sveltejs/adapter-static"]);
      const hasCloudflareAdapter = Boolean(deps["@sveltejs/adapter-cloudflare"]);

      let deploymentMode: DeploymentModeType = "ssr";
      let frameworkName = "SvelteKit";
      let outputDir = "build";

      if (hasStaticAdapter) {
        deploymentMode = "static";
        frameworkName = "SvelteKit (Static)";
        outputDir = "build";
      } else if (hasCloudflareAdapter) {
        deploymentMode = "ssr";
        frameworkName = "SvelteKit (Cloudflare)";
        outputDir = ".svelte-kit/cloudflare";
      } else {
        warnings.push("SvelteKit requires @sveltejs/adapter-cloudflare or @sveltejs/adapter-static for Cloudflare Pages deployment.");
      }

      const buildCommand = resolveBuildCommand(scripts, packageManager);

      return {
        framework: frameworkName,
        buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
        installCommand,
        outputDirectory: outputDir,
        packageManager,
        deploymentMode,
        rootDirectory: sanitizedRoot,
        detectedRoots,
        warnings,
      };
    }

    // 5. React (Vite)
    if (deps["vite"] && deps["react"]) {
      const buildCommand = resolveBuildCommand(scripts, packageManager);
      return {
        framework: "React (Vite)",
        buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
        installCommand,
        outputDirectory: "dist",
        packageManager,
        deploymentMode: "static",
        rootDirectory: sanitizedRoot,
        detectedRoots,
        warnings: [],
      };
    }

    // 6. Vue (Vite)
    if (deps["vite"] && deps["vue"]) {
      const buildCommand = resolveBuildCommand(scripts, packageManager);
      return {
        framework: "Vue (Vite)",
        buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
        installCommand,
        outputDirectory: "dist",
        packageManager,
        deploymentMode: "static",
        rootDirectory: sanitizedRoot,
        detectedRoots,
        warnings: [],
      };
    }

    // 7. Generic Vite
    if (deps["vite"]) {
      const buildCommand = resolveBuildCommand(scripts, packageManager);
      return {
        framework: "Vite",
        buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
        installCommand,
        outputDirectory: "dist",
        packageManager,
        deploymentMode: "static",
        rootDirectory: sanitizedRoot,
        detectedRoots,
        warnings: [],
      };
    }

    // 8. Create React App
    if (deps["react-scripts"]) {
      const buildCommand = resolveBuildCommand(scripts, packageManager);
      return {
        framework: "Create React App",
        buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
        installCommand,
        outputDirectory: "build",
        packageManager,
        deploymentMode: "static",
        rootDirectory: sanitizedRoot,
        detectedRoots,
        warnings: [],
      };
    }

    // 9. Angular
    if (deps["@angular/core"]) {
      const buildCommand = resolveBuildCommand(scripts, packageManager);
      return {
        framework: "Angular",
        buildCommand: buildCommand || (packageManager === "yarn" ? "yarn build" : `${packageManager} run build`),
        installCommand,
        outputDirectory: "dist",
        packageManager,
        deploymentMode: "static",
        rootDirectory: sanitizedRoot,
        detectedRoots,
        warnings: [],
      };
    }

    // 10. Generic Node.js with package.json
    const buildCommand = resolveBuildCommand(scripts, packageManager);
    return {
      framework: "Node.js",
      buildCommand: buildCommand || (scripts.build ? `${packageManager} run build` : ""),
      installCommand,
      outputDirectory: "dist",
      packageManager,
      deploymentMode: "static",
      rootDirectory: sanitizedRoot,
      detectedRoots,
      warnings: [],
    };
  } catch (error) {
    console.error("Framework detection error:", error);
    return {
      ...fallbackResult,
      warnings: ["An unexpected error occurred while analyzing the repository. Default presets applied."],
    };
  }
}
