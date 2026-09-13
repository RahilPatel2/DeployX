/**
 * Cloudflare Pages API Provider
 * Provides methods for interacting with Cloudflare Pages API
 */

const CF_API_URL = "https://api.cloudflare.com/client/v4";

interface CFRequestOptions {
  method: string;
  body?: any;
}

async function cfFetch(endpoint: string, options: CFRequestOptions = { method: "GET" }) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error("Missing Cloudflare API credentials. Please set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.");
  }

  // Replace {account_id} placeholder if present
  const url = `${CF_API_URL}${endpoint.replace("{account_id}", accountId)}`;

  const headers: HeadersInit = {
    "Authorization": `Bearer ${apiToken}`,
  };

  // Only set content-type for non-FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method: options.method,
    headers,
    body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    console.error("Cloudflare API Error:", data.errors);
    throw new Error(data.errors?.[0]?.message || `Cloudflare API request failed with status ${res.status}`);
  }

  return data.result;
}

export const CloudflareProvider = {
  /**
   * Create a new Cloudflare Pages project linked to a GitHub repo
   */
  async createProject(projectName: string, productionBranch: string, repoFullName: string, buildCommand: string, outputDirectory: string) {
    const [owner, repo_name] = repoFullName.split("/");

    return await cfFetch(`/accounts/{account_id}/pages/projects`, {
      method: "POST",
      body: {
        name: projectName,
        production_branch: productionBranch,
        build_config: {
          build_command: buildCommand,
          destination_dir: outputDirectory,
          root_dir: "",
          web_analytics_tag: null,
          web_analytics_token: null
        },
        source: {
          type: "github",
          config: {
            owner,
            repo_name,
            production_branch: productionBranch,
            pr_comments_enabled: true,
            deployments_enabled: true
          }
        }
      }
    });
  },

  /**
   * Trigger a new deployment for an existing project
   */
  async createDeployment(projectName: string, branch: string = "main") {
    return await cfFetch(`/accounts/{account_id}/pages/projects/${projectName}/deployments`, {
      method: "POST",
      body: {
        branch
      }
    });
  },

  /**
   * Get the status of a specific deployment
   */
  async getDeployment(projectName: string, deploymentId: string) {
    return await cfFetch(`/accounts/{account_id}/pages/projects/${projectName}/deployments/${deploymentId}`, {
      method: "GET"
    });
  },

  /**
   * Get the logs of a specific deployment
   */
  async getDeploymentLogs(projectName: string, deploymentId: string) {
    return await cfFetch(`/accounts/{account_id}/pages/projects/${projectName}/deployments/${deploymentId}/history/logs`, {
      method: "GET"
    });
  }
};
