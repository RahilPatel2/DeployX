/**
 * Automated Verification Suite for Step 8: Framework Detection and Build Configuration
 * Tests all framework presets, lockfile resolution, monorepo handling,
 * static vs. SSR classification, and path traversal security.
 */

import {
  detectFramework,
  sanitizeRootDirectory,
  detectPackageManager,
  getInstallCommand,
  resolveBuildCommand,
} from "./lib/github/framework";

interface MockFileTree {
  [path: string]: {
    type: "file" | "dir";
    content?: string;
  };
}

let currentMockTree: MockFileTree = {};

// Mock global fetch for GitHub API endpoints
const originalFetch = global.fetch;

function setupMockGitHubApi(tree: MockFileTree) {
  currentMockTree = tree;
  
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const urlStr = typeof input === "string" ? input : input.toString();
    const parsedUrl = new URL(urlStr);
    
    // Pattern: https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={branch}
    const match = parsedUrl.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents(?:\/(.*))?$/);
    if (!match) {
      return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
    }

    const requestedPath = decodeURIComponent(match[1] || "").replace(/^\/+|\/+$/g, "");

    // Check if the exact path exists
    if (requestedPath && currentMockTree[requestedPath]) {
      const entry = currentMockTree[requestedPath];
      if (entry.type === "file") {
        return new Response(
          JSON.stringify({
            type: "file",
            name: requestedPath.split("/").pop(),
            path: requestedPath,
            content: Buffer.from(entry.content || "").toString("base64"),
            encoding: "base64",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Otherwise, check if requestedPath is a directory listing
    // Directory path prefix: "" for root, or "folder/" for subdirectory
    const prefix = requestedPath ? `${requestedPath}/` : "";
    const items: any[] = [];
    const seenNames = new Set<string>();

    for (const itemPath of Object.keys(currentMockTree)) {
      if (requestedPath === "" || itemPath.startsWith(prefix)) {
        const sub = requestedPath === "" ? itemPath : itemPath.slice(prefix.length);
        const segments = sub.split("/");
        const itemName = segments[0];

        if (itemName && !seenNames.has(itemName)) {
          seenNames.add(itemName);
          const isDir = segments.length > 1 || currentMockTree[itemPath].type === "dir";
          items.push({
            name: itemName,
            path: requestedPath ? `${requestedPath}/${itemName}` : itemName,
            type: isDir ? "dir" : "file",
            size: 100,
          });
        }
      }
    }

    if (items.length > 0 || requestedPath === "") {
      return new Response(JSON.stringify(items), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Not Found" }), { status: 404 });
  };
}

function restoreFetch() {
  global.fetch = originalFetch;
}

// Helper test assertions
let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  ✓ ${message}`);
}

async function runTestSuite() {
  console.log("\n=======================================================");
  console.log("  DEPLOYX STEP 8: FRAMEWORK DETECTION & BUILD CONFIG   ");
  console.log("=======================================================\n");

  try {
    // -------------------------------------------------------------
    // 1. Sanitization & Path Traversal Prevention
    // -------------------------------------------------------------
    console.log("▶ [Test 1] Path Traversal and Subdirectory Sanitization");
    assert(sanitizeRootDirectory("") === "", "Empty root directory returns empty string");
    assert(sanitizeRootDirectory("apps/web") === "apps/web", "Standard subpath preserved");
    assert(sanitizeRootDirectory("/apps/web/") === "apps/web", "Leading and trailing slashes stripped");
    assert(sanitizeRootDirectory("../../etc/passwd") === "etc/passwd", "Path traversal '../' stripped");
    assert(sanitizeRootDirectory("apps/../secret/..") === "apps/secret", "Interior '..' elements safely stripped");
    assert(sanitizeRootDirectory("packages\\ui\\src") === "packages/ui/src", "Windows backslashes normalized to forward slashes");

    // -------------------------------------------------------------
    // 2. Lockfile Resolution Precedence
    // -------------------------------------------------------------
    console.log("\n▶ [Test 2] Lockfile-Based Package Manager Detection");
    assert(
      detectPackageManager([{ name: "pnpm-lock.yaml", path: "pnpm-lock.yaml", type: "file" }]) === "pnpm",
      "pnpm-lock.yaml resolves to pnpm"
    );
    assert(
      detectPackageManager([{ name: "yarn.lock", path: "yarn.lock", type: "file" }]) === "yarn",
      "yarn.lock resolves to yarn"
    );
    assert(
      detectPackageManager([{ name: "bun.lockb", path: "bun.lockb", type: "file" }]) === "bun",
      "bun.lockb resolves to bun"
    );
    assert(
      detectPackageManager([{ name: "bun.lock", path: "bun.lock", type: "file" }]) === "bun",
      "bun.lock resolves to bun"
    );
    assert(
      detectPackageManager([{ name: "package-lock.json", path: "package-lock.json", type: "file" }]) === "npm",
      "package-lock.json resolves to npm"
    );
    assert(detectPackageManager([]) === "npm", "Empty directory defaults to npm");

    // -------------------------------------------------------------
    // 3. Build Command Script Resolution
    // -------------------------------------------------------------
    console.log("\n▶ [Test 3] Build Command Script Resolution");
    assert(
      resolveBuildCommand({ build: "vite build" }, "npm") === "npm run build",
      "npm uses 'npm run build'"
    );
    assert(
      resolveBuildCommand({ build: "vite build" }, "pnpm") === "pnpm run build",
      "pnpm uses 'pnpm run build'"
    );
    assert(
      resolveBuildCommand({ build: "vite build" }, "yarn") === "yarn build",
      "yarn uses 'yarn build'"
    );
    assert(
      resolveBuildCommand({ build: "vite build" }, "bun") === "bun run build",
      "bun uses 'bun run build'"
    );
    assert(
      resolveBuildCommand({ generate: "nuxt generate" }, "npm") === "npm run generate",
      "npm resolves 'generate' fallback script"
    );
    assert(
      resolveBuildCommand({ "build:prod": "tsc && vite build" }, "yarn") === "yarn build:prod",
      "yarn resolves 'build:prod' fallback script"
    );
    assert(resolveBuildCommand({}, "npm") === "", "Missing build scripts returns empty command");

    // -------------------------------------------------------------
    // 4. Plain Static HTML (No package.json, index.html present)
    // -------------------------------------------------------------
    console.log("\n▶ [Test 4] Plain HTML/CSS/JS Static Project");
    setupMockGitHubApi({
      "index.html": { type: "file", content: "<html><body>Hello DeployX</body></html>" },
      "style.css": { type: "file", content: "body { margin: 0; }" },
    });
    const htmlResult = await detectFramework("mock-token", "owner", "html-repo", "main");
    assert(htmlResult.framework === "Static HTML", "Framework detected as 'Static HTML'");
    assert(htmlResult.deploymentMode === "static", "Deployment mode is 'static'");
    assert(htmlResult.buildCommand === "", "Static HTML has empty build command");
    assert(htmlResult.installCommand === "", "Static HTML has empty install command");

    // -------------------------------------------------------------
    // 5. React + Vite with pnpm
    // -------------------------------------------------------------
    console.log("\n▶ [Test 5] React + Vite with pnpm-lock.yaml");
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { react: "^18.3.0", "react-dom": "^18.3.0" },
          devDependencies: { vite: "^5.4.0", "@vitejs/plugin-react": "^4.3.0" },
          scripts: { build: "vite build" },
        }),
      },
      "pnpm-lock.yaml": { type: "file", content: "lockfileVersion: '9.0'" },
      "vite.config.ts": { type: "file", content: "export default defineConfig({});" },
    });
    const viteReactResult = await detectFramework("mock-token", "owner", "vite-react-repo", "main");
    assert(viteReactResult.framework === "React (Vite)", "Framework detected as 'React (Vite)'");
    assert(viteReactResult.packageManager === "pnpm", "Package manager detected as 'pnpm'");
    assert(viteReactResult.installCommand === "pnpm install", "Install command is 'pnpm install'");
    assert(viteReactResult.buildCommand === "pnpm run build", "Build command is 'pnpm run build'");
    assert(viteReactResult.outputDirectory === "dist", "Output directory is 'dist'");
    assert(viteReactResult.deploymentMode === "static", "Deployment mode is 'static'");

    // -------------------------------------------------------------
    // 6. Vue + Vite with Yarn
    // -------------------------------------------------------------
    console.log("\n▶ [Test 6] Vue + Vite with yarn.lock");
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { vue: "^3.4.0" },
          devDependencies: { vite: "^5.2.0" },
          scripts: { build: "vite build" },
        }),
      },
      "yarn.lock": { type: "file", content: "# yarn lockfile v1" },
    });
    const vueResult = await detectFramework("mock-token", "owner", "vue-repo", "main");
    assert(vueResult.framework === "Vue (Vite)", "Framework detected as 'Vue (Vite)'");
    assert(vueResult.packageManager === "yarn", "Package manager detected as 'yarn'");
    assert(vueResult.installCommand === "yarn install", "Install command is 'yarn install'");
    assert(vueResult.buildCommand === "yarn build", "Build command is 'yarn build'");
    assert(vueResult.outputDirectory === "dist", "Output directory is 'dist'");
    assert(vueResult.deploymentMode === "static", "Deployment mode is 'static'");

    // -------------------------------------------------------------
    // 7. Generic Vite with Bun
    // -------------------------------------------------------------
    console.log("\n▶ [Test 7] Generic Vite with bun.lock");
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          devDependencies: { vite: "^5.0.0" },
          scripts: { build: "vite build" },
        }),
      },
      "bun.lock": { type: "file", content: "bun lock" },
    });
    const genericViteResult = await detectFramework("mock-token", "owner", "vite-vanilla", "main");
    assert(genericViteResult.framework === "Vite", "Framework detected as 'Vite'");
    assert(genericViteResult.packageManager === "bun", "Package manager detected as 'bun'");
    assert(genericViteResult.installCommand === "bun install", "Install command is 'bun install'");
    assert(genericViteResult.buildCommand === "bun run build", "Build command is 'bun run build'");
    assert(genericViteResult.outputDirectory === "dist", "Output directory is 'dist'");

    // -------------------------------------------------------------
    // 8. Create React App
    // -------------------------------------------------------------
    console.log("\n▶ [Test 8] Create React App");
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { react: "^18.0.0", "react-scripts": "5.0.1" },
          scripts: { build: "react-scripts build" },
        }),
      },
      "package-lock.json": { type: "file", content: "{}" },
    });
    const craResult = await detectFramework("mock-token", "owner", "cra-repo", "main");
    assert(craResult.framework === "Create React App", "Framework detected as 'Create React App'");
    assert(craResult.outputDirectory === "build", "Output directory is 'build'");
    assert(craResult.deploymentMode === "static", "Deployment mode is 'static'");

    // -------------------------------------------------------------
    // 9. Next.js Static Export vs. SSR
    // -------------------------------------------------------------
    console.log("\n▶ [Test 9] Next.js Static Export Detection");
    // Case 9A: Next.js with output: 'export' in next.config.js
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { next: "14.2.5", react: "^18.0.0" },
          scripts: { build: "next build" },
        }),
      },
      "next.config.js": {
        type: "file",
        content: "module.exports = { output: 'export', reactStrictMode: true };",
      },
      "package-lock.json": { type: "file", content: "{}" },
    });
    const nextExportResult = await detectFramework("mock-token", "owner", "next-export-repo", "main");
    assert(nextExportResult.framework === "Next.js (Static Export)", "Detected 'Next.js (Static Export)'");
    assert(nextExportResult.outputDirectory === "out", "Output directory is 'out'");
    assert(nextExportResult.deploymentMode === "static", "Deployment mode is 'static'");
    assert(nextExportResult.warnings.length === 0, "No SSR warnings for static export");

    // Case 9B: Next.js SSR (standard)
    console.log("\n▶ [Test 10] Next.js SSR Mode & Compatibility Warnings");
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { next: "14.2.5", react: "^18.0.0" },
          scripts: { build: "next build" },
        }),
      },
      "package-lock.json": { type: "file", content: "{}" },
    });
    const nextSsrResult = await detectFramework("mock-token", "owner", "next-ssr-repo", "main");
    assert(nextSsrResult.framework === "Next.js", "Detected standard 'Next.js'");
    assert(nextSsrResult.outputDirectory === ".next", "Output directory is '.next'");
    assert(nextSsrResult.deploymentMode === "ssr", "Deployment mode is 'ssr'");
    assert(nextSsrResult.warnings.length > 0, "Warning generated for SSR Next.js on Cloudflare");

    // -------------------------------------------------------------
    // 10. Astro: Static vs. SSR
    // -------------------------------------------------------------
    console.log("\n▶ [Test 11] Astro Static and SSR Modes");
    // Astro Static
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { astro: "^4.0.0" },
          scripts: { build: "astro build" },
        }),
      },
      "astro.config.mjs": {
        type: "file",
        content: "export default defineConfig({});",
      },
    });
    const astroStaticResult = await detectFramework("mock-token", "owner", "astro-static", "main");
    assert(astroStaticResult.framework === "Astro", "Detected static 'Astro'");
    assert(astroStaticResult.deploymentMode === "static", "Astro deployment mode is 'static'");

    // Astro SSR
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { astro: "^4.0.0", "@astrojs/cloudflare": "^10.0.0" },
          scripts: { build: "astro build" },
        }),
      },
      "astro.config.mjs": {
        type: "file",
        content: "export default defineConfig({ output: 'server' });",
      },
    });
    const astroSsrResult = await detectFramework("mock-token", "owner", "astro-ssr", "main");
    assert(astroSsrResult.framework === "Astro (SSR)", "Detected 'Astro (SSR)'");
    assert(astroSsrResult.deploymentMode === "ssr", "Deployment mode is 'ssr'");
    assert(astroSsrResult.warnings.length > 0, "Astro SSR warning generated");

    // -------------------------------------------------------------
    // 11. Nuxt: Static Generate vs. SSR
    // -------------------------------------------------------------
    console.log("\n▶ [Test 12] Nuxt Static Generate vs. SSR");
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { nuxt: "^3.12.0" },
          scripts: { generate: "nuxt generate", build: "nuxt build" },
        }),
      },
    });
    const nuxtStaticResult = await detectFramework("mock-token", "owner", "nuxt-static", "main");
    assert(nuxtStaticResult.framework === "Nuxt (Static)", "Detected 'Nuxt (Static)'");
    assert(nuxtStaticResult.deploymentMode === "static", "Deployment mode is 'static'");
    assert(nuxtStaticResult.outputDirectory === "dist", "Output directory is 'dist'");
    assert(nuxtStaticResult.buildCommand === "npm run generate", "Build command is 'npm run generate'");

    // -------------------------------------------------------------
    // 12. SvelteKit Static vs. SSR
    // -------------------------------------------------------------
    console.log("\n▶ [Test 13] SvelteKit Static Adapter vs. Default");
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { "@sveltejs/kit": "^2.0.0", svelte: "^4.0.0" },
          devDependencies: { "@sveltejs/adapter-static": "^3.0.0" },
          scripts: { build: "vite build" },
        }),
      },
    });
    const svelteStaticResult = await detectFramework("mock-token", "owner", "svelte-static", "main");
    assert(svelteStaticResult.framework === "SvelteKit (Static)", "Detected 'SvelteKit (Static)'");
    assert(svelteStaticResult.deploymentMode === "static", "Deployment mode is 'static'");
    assert(svelteStaticResult.outputDirectory === "build", "Output directory is 'build'");

    // -------------------------------------------------------------
    // 13. Angular Framework
    // -------------------------------------------------------------
    console.log("\n▶ [Test 14] Angular Framework Detection");
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { "@angular/core": "^18.0.0", "@angular/common": "^18.0.0" },
          scripts: { build: "ng build" },
        }),
      },
    });
    const angularResult = await detectFramework("mock-token", "owner", "angular-repo", "main");
    assert(angularResult.framework === "Angular", "Detected 'Angular'");
    assert(angularResult.deploymentMode === "static", "Angular deployment mode is 'static'");
    assert(angularResult.outputDirectory === "dist", "Output directory is 'dist'");

    // -------------------------------------------------------------
    // 14. Monorepo Discovery and Subdirectory Targeting
    // -------------------------------------------------------------
    console.log("\n▶ [Test 15] Monorepo Workspaces & Root Directory");
    setupMockGitHubApi({
      "pnpm-lock.yaml": { type: "file", content: "lockfileVersion: '9.0'" },
      "package.json": {
        type: "file",
        content: JSON.stringify({ name: "monorepo-root", private: true }),
      },
      "apps": { type: "dir" },
      "packages": { type: "dir" },
      "apps/web/package.json": {
        type: "file",
        content: JSON.stringify({
          dependencies: { next: "14.2.5" },
          scripts: { build: "next build" },
        }),
      },
      "apps/web/next.config.mjs": {
        type: "file",
        content: "export default { output: 'export' };",
      },
    });

    // Root scan detects candidate workspace folders
    const monorepoRootResult = await detectFramework("mock-token", "owner", "monorepo", "main", "");
    assert(monorepoRootResult.detectedRoots.includes("apps"), "Detected 'apps' workspace candidate");
    assert(monorepoRootResult.detectedRoots.includes("packages"), "Detected 'packages' workspace candidate");

    // Subdirectory scan on "apps/web" detects the Next.js app within the monorepo
    const monorepoSubResult = await detectFramework("mock-token", "owner", "monorepo", "main", "apps/web");
    assert(monorepoSubResult.framework === "Next.js (Static Export)", "Detected Next.js in 'apps/web' subdirectory");
    assert(monorepoSubResult.packageManager === "pnpm", "Inherited pnpm from monorepo root lockfile");
    assert(monorepoSubResult.rootDirectory === "apps/web", "Root directory set to 'apps/web'");

    // -------------------------------------------------------------
    // 15. Safe Error Handling: Corrupt / Malformed package.json
    // -------------------------------------------------------------
    console.log("\n▶ [Test 16] Safe Static Analysis on Malformed JSON");
    setupMockGitHubApi({
      "package.json": {
        type: "file",
        content: "{ broken json: true, dependencies: {",
      },
    });
    const malformedResult = await detectFramework("mock-token", "owner", "malformed", "main");
    assert(malformedResult.framework === "Other", "Gracefully falls back to 'Other'");
    assert(malformedResult.warnings.length > 0, "Emits warning about malformed package.json without crashing");

    console.log("\n=======================================================");
    console.log(`  ALL ${totalTests}/${totalTests} TESTS PASSED SUCCESSFULLY!  `);
    console.log("=======================================================\n");

    restoreFetch();
    process.exit(0);
  } catch (error) {
    restoreFetch();
    console.error("\n❌ Test Suite encountered a failure:\n", error);
    process.exit(1);
  }
}

runTestSuite();
