/**
 * Cloudflare Provider Module for DeployX
 * 
 * Provides high-level deployment operations for Cloudflare Pages and Cloudflare Workers.
 * Features:
 * - Real API credential verification & diagnostics
 * - Deployment target evaluation (Pages Static vs. Pages Functions/SSR vs. Workers)
 * - Safe project resolution & duplicate prevention
 * - Real deployment triggers, status mapping, and log retrieval
 * - Server-only execution with zero secret exposure
 */

import {
  cfRequest,
  CloudflareError,
  getCloudflareConfig,
} from "./client";

export type DeploymentTargetType = "pages_static" | "pages_functions" | "workers" | "unsupported";

export interface CloudflareVerificationResult {
  connected: boolean;
  accountId: string;
  accountName: string;
  tokenStatus: "active" | "disabled" | "expired" | "unknown";
  permissions: {
    pages: boolean;
    workers: boolean;
  };
  checkedAt: string;
  error?: string;
  category: "OK" | "MISSING_CONFIG" | "INVALID_CREDENTIALS" | "INSUFFICIENT_PERMISSIONS" | "ACCOUNT_NOT_FOUND" | "NETWORK_ERROR";
}

export interface DeploymentEvaluationInput {
  framework: string;
  deploymentMode?: "static" | "ssr";
  rootDirectory?: string;
  buildCommand?: string;
  outputDirectory?: string;
}

export interface DeploymentEvaluationResult {
  target: DeploymentTargetType;
  compatible: boolean;
  reason?: string;
  recommendation?: string;
  outputDirectory: string;
  buildCommand: string;
}

export interface CloudflarePagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  production_branch: string;
  created_on: string;
  latest_deployment?: {
    id: string;
    url: string;
    environment: string;
    created_on: string;
    latest_stage?: {
      name: string;
      status: string;
    };
  };
  build_config?: {
    build_command?: string;
    destination_dir?: string;
    root_dir?: string;
  };
}

export interface CloudflarePagesDeployment {
  id: string;
  short_id: string;
  project_id: string;
  project_name: string;
  environment: string;
  url: string;
  created_on: string;
  modified_on: string;
  latest_stage?: {
    name: string;
    status: string;
    started_on?: string;
    ended_on?: string;
  };
  stages?: Array<{
    name: string;
    status: string;
    started_on?: string;
    ended_on?: string;
  }>;
  deployment_trigger?: {
    type: string;
    metadata?: {
      branch?: string;
      commit_hash?: string;
      commit_message?: string;
    };
  };
}

export interface CreatePagesProjectInput {
  name: string;
  productionBranch: string;
  repoFullName: string;
  buildCommand?: string;
  outputDirectory?: string;
  rootDir?: string;
}

export interface CloudflareWorkerSummary {
  id: string;
  created_on: string;
  modified_on: string;
}

/**
 * Verifies server-side Cloudflare API credentials and returns a sanitized diagnostic report.
 */
export async function verifyCloudflareConfiguration(): Promise<CloudflareVerificationResult> {
  let accountId = "";
  let apiToken = "";

  try {
    const config = getCloudflareConfig();
    accountId = config.accountId;
    apiToken = config.apiToken;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Cloudflare credentials not configured.";
    return {
      connected: false,
      accountId: "",
      accountName: "",
      tokenStatus: "unknown",
      permissions: { pages: false, workers: false },
      checkedAt: new Date().toISOString(),
      error: message,
      category: "MISSING_CONFIG",
    };
  }

  // 1. Verify token status via /user/tokens/verify
  let tokenStatus: "active" | "disabled" | "expired" | "unknown" = "unknown";
  try {
    const tokenRes = await cfRequest<{ id: string; status: string }>("/user/tokens/verify", {
      method: "GET",
      overrideAccountId: accountId,
      overrideApiToken: apiToken,
      maxRetries: 1,
    });
    tokenStatus = tokenRes.status === "active" ? "active" : "disabled";
  } catch (tokenErr: unknown) {
    if (tokenErr instanceof CloudflareError && tokenErr.status === 401) {
      return {
        connected: false,
        accountId,
        accountName: "",
        tokenStatus: "expired",
        permissions: { pages: false, workers: false },
        checkedAt: new Date().toISOString(),
        error: "Cloudflare API token is invalid or expired.",
        category: "INVALID_CREDENTIALS",
      };
    }
  }

  // 2. Fetch account details via /accounts/{account_id} (optional permission)
  let accountName = "Cloudflare Account";
  try {
    const accountRes = await cfRequest<{ id: string; name: string }>(`/accounts/${accountId}`, {
      method: "GET",
      overrideAccountId: accountId,
      overrideApiToken: apiToken,
      maxRetries: 0,
      isRetryable: false,
    });
    if (accountRes?.name) {
      accountName = accountRes.name;
    }
  } catch (accErr: unknown) {
    if (accErr instanceof CloudflareError) {
      if (accErr.status === 404) {
        return {
          connected: false,
          accountId,
          accountName: "",
          tokenStatus,
          permissions: { pages: false, workers: false },
          checkedAt: new Date().toISOString(),
          error: "Cloudflare account ID not found. Verify CLOUDFLARE_ACCOUNT_ID.",
          category: "ACCOUNT_NOT_FOUND",
        };
      }
      // On 403 (lack of Account Settings:Read), keep fallback name and proceed to Pages check
    }
  }

  // 3. Test Pages permissions via /accounts/{account_id}/pages/projects
  let hasPagesPermission = false;
  try {
    await cfRequest(`/accounts/${accountId}/pages/projects?per_page=1`, {
      method: "GET",
      overrideAccountId: accountId,
      overrideApiToken: apiToken,
      maxRetries: 1,
    });
    hasPagesPermission = true;
  } catch (pagesErr: unknown) {
    if (pagesErr instanceof CloudflareError && pagesErr.status === 403) {
      hasPagesPermission = false;
    }
  }

  // 4. Test Workers permissions via /accounts/{account_id}/workers/scripts
  let hasWorkersPermission = false;
  try {
    await cfRequest(`/accounts/${accountId}/workers/scripts`, {
      method: "GET",
      overrideAccountId: accountId,
      overrideApiToken: apiToken,
      maxRetries: 1,
    });
    hasWorkersPermission = true;
  } catch {
    hasWorkersPermission = false;
  }

  const isConnected = tokenStatus === "active" && hasPagesPermission;

  return {
    connected: isConnected,
    accountId,
    accountName: accountName || "Cloudflare Account",
    tokenStatus,
    permissions: {
      pages: hasPagesPermission,
      workers: hasWorkersPermission,
    },
    checkedAt: new Date().toISOString(),
    error: isConnected ? undefined : "API token does not have sufficient permissions to manage Cloudflare Pages.",
    category: isConnected ? "OK" : "INSUFFICIENT_PERMISSIONS",
  };
}

/**
 * Statically evaluates whether a project's framework and build settings
 * are compatible with Cloudflare Pages or Cloudflare Workers.
 * 
 * Rejects unsupported configurations (e.g. unadapted Next.js SSR) instead of
 * silently converting them into broken static deployments.
 */
export function evaluateDeploymentTarget(
  project: DeploymentEvaluationInput
): DeploymentEvaluationResult {
  const framework = project.framework || "Other";
  const mode = project.deploymentMode || "static";
  const buildCommand = project.buildCommand || "npm run build";
  const outputDirectory = project.outputDirectory || "dist";

  // 1. Plain Static HTML
  if (framework === "Static HTML") {
    return {
      target: "pages_static",
      compatible: true,
      outputDirectory: project.outputDirectory || ".",
      buildCommand: "",
    };
  }

  // 2. Next.js Static Export
  if (framework === "Next.js (Static Export)" || (framework === "Next.js" && mode === "static")) {
    return {
      target: "pages_static",
      compatible: true,
      outputDirectory: outputDirectory === ".next" ? "out" : outputDirectory,
      buildCommand,
    };
  }

  // 3. Next.js SSR (Unadapted)
  if (framework === "Next.js" && mode === "ssr") {
    return {
      target: "pages_functions",
      compatible: false,
      reason: "Next.js SSR applications require static export ('output: export') or the @cloudflare/next-on-pages edge adapter.",
      recommendation: "Add `output: 'export'` to your next.config.js or install and configure @cloudflare/next-on-pages before deploying.",
      outputDirectory: ".next",
      buildCommand,
    };
  }

  // 4. Astro
  if (framework === "Astro") {
    return {
      target: "pages_static",
      compatible: true,
      outputDirectory: "dist",
      buildCommand,
    };
  }
  if (framework === "Astro (SSR)") {
    return {
      target: "pages_functions",
      compatible: true, // Supported via @astrojs/cloudflare
      outputDirectory: "dist",
      buildCommand,
    };
  }

  // 5. Nuxt
  if (framework === "Nuxt (Static)") {
    return {
      target: "pages_static",
      compatible: true,
      outputDirectory: "dist",
      buildCommand: buildCommand || "npm run generate",
    };
  }
  if (framework === "Nuxt" && mode === "ssr") {
    return {
      target: "pages_functions",
      compatible: true, // Supported via Nitro cloudflare-pages preset
      outputDirectory: ".output/public",
      buildCommand,
    };
  }

  // 6. SvelteKit
  if (framework === "SvelteKit (Static)") {
    return {
      target: "pages_static",
      compatible: true,
      outputDirectory: "build",
      buildCommand,
    };
  }
  if (framework.includes("SvelteKit") && mode === "ssr") {
    return {
      target: "pages_functions",
      compatible: true, // Supported via @sveltejs/adapter-cloudflare
      outputDirectory: ".svelte-kit/cloudflare",
      buildCommand,
    };
  }

  // 7. Client-Side Frameworks (React, Vue, Vite, CRA, Angular)
  if (
    [
      "React (Vite)",
      "Vue (Vite)",
      "Vite",
      "Create React App",
      "Angular",
      "Node.js",
    ].includes(framework)
  ) {
    return {
      target: "pages_static",
      compatible: true,
      outputDirectory,
      buildCommand,
    };
  }

  // 8. Python / Backend Services
  if (framework === "Python") {
    return {
      target: "unsupported",
      compatible: false,
      reason: "Python backend applications cannot be deployed directly to Cloudflare Pages static edge hosting.",
      recommendation: "Deploy frontend Jamstack assets or export a static documentation site.",
      outputDirectory: ".",
      buildCommand: "",
    };
  }

  // Default fallback (treat as generic static site if output is configured)
  return {
    target: "pages_static",
    compatible: true,
    outputDirectory,
    buildCommand,
  };
}

/**
 * Sanitizes project name to comply with Cloudflare Pages naming rules:
 * - 1-58 characters
 * - Lowercase alphanumeric and hyphens only
 * - Cannot start or end with a hyphen
 */
export function sanitizePagesProjectName(name: string): string {
  if (!name) return "project";
  let clean = name.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (clean.length > 58) {
    clean = clean.substring(0, 58).replace(/-+$/, "");
  }
  return clean || "project";
}

/**
 * Maps Cloudflare Pages deployment stage status to DeployX standard status.
 */
export function mapCloudflareStatus(cfStatus?: string): "QUEUED" | "BUILDING" | "READY" | "FAILED" | "CANCELED" {
  if (!cfStatus) return "QUEUED";
  const s = cfStatus.toLowerCase();
  if (["success", "active"].includes(s)) return "READY";
  if (["failure", "failed", "error"].includes(s)) return "FAILED";
  if (["canceled", "cancelled"].includes(s)) return "CANCELED";
  if (["building", "cloning", "initializing", "uploading"].includes(s)) return "BUILDING";
  if (["queued", "pending"].includes(s)) return "QUEUED";
  return "BUILDING";
}

export const CloudflareProvider = {
  /**
   * List Cloudflare Pages projects for the configured account with pagination support.
   */
  async listPagesProjects(page: number = 1, perPage: number = 25): Promise<{ projects: CloudflarePagesProject[]; total: number }> {
    const res = await cfRequest<CloudflarePagesProject[]>(
      `/accounts/{account_id}/pages/projects?page=${page}&per_page=${perPage}`,
      { method: "GET" }
    );
    return {
      projects: res || [],
      total: res?.length || 0,
    };
  },

  /**
   * Retrieves a Cloudflare Pages project by name. Returns null if not found.
   */
  async getPagesProject(projectName: string): Promise<CloudflarePagesProject | null> {
    try {
      const cleanName = sanitizePagesProjectName(projectName);
      return await cfRequest<CloudflarePagesProject>(
        `/accounts/{account_id}/pages/projects/${cleanName}`,
        { method: "GET", isRetryable: false }
      );
    } catch (err: unknown) {
      if (err instanceof CloudflareError && err.status === 404) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Checks if a Pages project already exists.
   */
  async projectExists(projectName: string): Promise<boolean> {
    const project = await this.getPagesProject(projectName);
    return project !== null;
  },

  /**
   * Safely creates or resolves a Cloudflare Pages project linked to a GitHub repository.
   * If the project already exists, returns the existing project to prevent duplicate 409 errors.
   */
  async createProject(
    projectName: string,
    productionBranch: string,
    repoFullName: string,
    buildCommand: string = "npm run build",
    outputDirectory: string = "dist",
    rootDir: string = ""
  ): Promise<CloudflarePagesProject> {
    const cleanName = sanitizePagesProjectName(projectName);

    // 1. Idempotency Check: if project already exists, return it
    const existing = await this.getPagesProject(cleanName);
    if (existing) {
      return existing;
    }

    const [owner, repo_name] = repoFullName.split("/");

    try {
      return await cfRequest<CloudflarePagesProject>(`/accounts/{account_id}/pages/projects`, {
        method: "POST",
        body: {
          name: cleanName,
          production_branch: productionBranch,
          build_config: {
            build_command: buildCommand,
            destination_dir: outputDirectory,
            root_dir: rootDir || "",
            web_analytics_tag: null,
            web_analytics_token: null,
          },
          source: {
            type: "github",
            config: {
              owner,
              repo_name,
              production_branch: productionBranch,
              pr_comments_enabled: true,
              deployments_enabled: true,
            },
          },
        },
      });
    } catch (err: unknown) {
      // If error is 8000011 (Pages Git app not installed or repository not granted)
      // Fallback to creating a direct-upload Pages project container
      if (err instanceof CloudflareError) {
        if (err.errors?.some((e) => e.code === 8000011)) {
          try {
            return await cfRequest<CloudflarePagesProject>(`/accounts/{account_id}/pages/projects`, {
              method: "POST",
              body: {
                name: cleanName,
                production_branch: productionBranch,
              },
            });
          } catch (directUploadErr) {
            if (directUploadErr instanceof CloudflareError && directUploadErr.status === 409) {
              const raceExisting = await this.getPagesProject(cleanName);
              if (raceExisting) return raceExisting;
            }
            throw directUploadErr;
          }
        }
        // Handle race condition where project was created concurrently
        if (err.status === 409) {
          const raceExisting = await this.getPagesProject(cleanName);
          if (raceExisting) return raceExisting;
        }
      }
      throw err;
    }
  },

  /**
   * Triggers a new deployment for an existing Cloudflare Pages project.
   */
  async createDeployment(
    projectName: string,
    branch: string = "main"
  ): Promise<CloudflarePagesDeployment> {
    const cleanName = sanitizePagesProjectName(projectName);
    return await cfRequest<CloudflarePagesDeployment>(
      `/accounts/{account_id}/pages/projects/${cleanName}/deployments`,
      {
        method: "POST",
        body: { branch },
      }
    );
  },

  /**
   * Retrieves the live status and metadata of a specific Cloudflare Pages deployment.
   */
  async getDeployment(
    projectName: string,
    deploymentId: string
  ): Promise<CloudflarePagesDeployment> {
    const cleanName = sanitizePagesProjectName(projectName);
    return await cfRequest<CloudflarePagesDeployment>(
      `/accounts/{account_id}/pages/projects/${cleanName}/deployments/${deploymentId}`,
      { method: "GET" }
    );
  },

  /**
   * Retrieves build and execution logs for a deployment.
   */
  async getDeploymentLogs(
    projectName: string,
    deploymentId: string
  ): Promise<{ data: Array<{ line: string; ts: string }> }> {
    const cleanName = sanitizePagesProjectName(projectName);
    try {
      return await cfRequest<{ data: Array<{ line: string; ts: string }> }>(
        `/accounts/{account_id}/pages/projects/${cleanName}/deployments/${deploymentId}/history/logs`,
        { method: "GET" }
      );
    } catch (err: unknown) {
      // Cloudflare returns 404 if logs haven't initialized yet
      if (err instanceof CloudflareError && err.status === 404) {
        return { data: [] };
      }
      throw err;
    }
  },
};

/**
 * Cloudflare Workers Provider Module
 * Prepares standalone Worker script verification and deployment capabilities.
 */
export const CloudflareWorkersProvider = {
  /**
   * Lists Workers scripts configured on the Cloudflare account.
   */
  async listWorkers(): Promise<CloudflareWorkerSummary[]> {
    return await cfRequest<CloudflareWorkerSummary[]>("/accounts/{account_id}/workers/scripts", {
      method: "GET",
    });
  },

  /**
   * Retrieves a specific Worker script metadata. Returns null if not found.
   */
  async getWorker(scriptName: string): Promise<CloudflareWorkerSummary | null> {
    try {
      return await cfRequest<CloudflareWorkerSummary>(
        `/accounts/{account_id}/workers/scripts/${scriptName}`,
        { method: "GET", isRetryable: false }
      );
    } catch (err: unknown) {
      if (err instanceof CloudflareError && err.status === 404) {
        return null;
      }
      throw err;
    }
  },

  /**
   * Publishes a standalone Worker script via Cloudflare API.
   */
  async deployWorker(
    scriptName: string,
    scriptContent: string,
    compatibilityDate: string = "2024-04-01"
  ): Promise<{ id: string; success: boolean }> {
    if (!scriptContent || typeof scriptContent !== "string") {
      throw new Error("Worker script content must be a valid JavaScript string.");
    }

    const formData = new FormData();
    const metadata = {
      main_module: "index.js",
      compatibility_date: compatibilityDate,
    };

    formData.append("metadata", JSON.stringify(metadata));
    formData.append(
      "index.js",
      new Blob([scriptContent], { type: "application/javascript+module" }),
      "index.js"
    );

    return await cfRequest<{ id: string; success: boolean }>(
      `/accounts/{account_id}/workers/scripts/${scriptName}`,
      {
        method: "PUT",
        body: formData,
      }
    );
  },

  /**
   * Retrieves the account's Workers subdomain (e.g., username.workers.dev).
   */
  async getWorkerSubdomain(): Promise<string | null> {
    try {
      const res = await cfRequest<{ subdomain: string }>("/accounts/{account_id}/workers/subdomain", {
        method: "GET",
      });
      return res?.subdomain || null;
    } catch {
      return null;
    }
  },

  /**
   * Evaluates whether a project can be published directly to Cloudflare Workers.
   */
  validateWorkerDeployment(project: { framework: string; deploymentMode?: string }): {
    supported: boolean;
    reason?: string;
  } {
    if (["Next.js", "Nuxt", "SvelteKit", "Astro"].includes(project.framework)) {
      return {
        supported: false,
        reason: `${project.framework} full-stack applications require framework-specific adapters (@cloudflare/next-on-pages or Nitro) to build Pages Functions rather than raw Workers script uploads.`,
      };
    }
    return {
      supported: true,
    };
  },
};
