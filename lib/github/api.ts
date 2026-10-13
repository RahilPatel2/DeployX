import { decryptToken } from "@/lib/auth/encryption";

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  language: string | null;
  updated_at: string;
}

export async function getUserRepositories(accessToken: string): Promise<GitHubRepository[]> {
  const token = decryptToken(accessToken);
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "DeployX-Platform",
    },
    // Don't cache this heavily as repos change
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.statusText}`);
  }

  return res.json();
}

export interface GitHubDirectoryItem {
  name: string;
  path: string;
  type: "file" | "dir" | "submodule" | "symlink";
  size?: number;
}

export async function getRepositoryFile(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  ref: string = "main"
): Promise<string | null> {
  const token = decryptToken(accessToken);
  const cleanPath = path.replace(/^\/+/, "");
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "DeployX-Platform",
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub API error: ${res.statusText}`);
  }

  const data = await res.json();
  if (data.type === "file" && data.content) {
    // GitHub API returns base64 encoded content, sometimes with newlines
    return Buffer.from(data.content, "base64").toString("utf-8");
  }

  return null;
}

export async function getRepositoryDirectory(
  accessToken: string,
  owner: string,
  repo: string,
  path: string = "",
  ref: string = "main"
): Promise<GitHubDirectoryItem[] | null> {
  const token = decryptToken(accessToken);
  const cleanPath = path.replace(/^\/+/, "");
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
  const url = cleanPath
    ? `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}${query}`
    : `https://api.github.com/repos/${owner}/${repo}/contents${query}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "DeployX-Platform",
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`GitHub API error: ${res.statusText}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) {
    return data.map((item) => ({
      name: item.name,
      path: item.path,
      type: item.type,
      size: item.size,
    }));
  }

  return null;
}

export interface GitHubCommitInfo {
  sha: string;
  shortSha: string;
  message: string;
  authorName: string;
  authorEmail?: string;
  date: string;
}

/**
 * Retrieves commit metadata for a branch or commit reference.
 * Pins the commit SHA for reproducibility.
 */
export async function getBranchCommit(
  accessToken: string,
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubCommitInfo> {
  const token = decryptToken(accessToken);
  const cleanBranch = branch.trim();
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits/${encodeURIComponent(cleanBranch)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "DeployX-Platform",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Branch or commit '${cleanBranch}' not found in repository '${owner}/${repo}'.`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Access denied to repository '${owner}/${repo}'. Please verify your GitHub integration permissions.`);
    }
    throw new Error(`GitHub API error (${res.status}): ${res.statusText}`);
  }

  const data = await res.json();
  const sha = data.sha || "";
  const commit = data.commit || {};
  const message = (commit.message || "").split("\n")[0] || "Update from GitHub";
  const authorName = commit.author?.name || data.author?.login || "Unknown Author";
  const authorEmail = commit.author?.email;
  const date = commit.author?.date || data.commit?.committer?.date || new Date().toISOString();

  return {
    sha,
    shortSha: sha.slice(0, 7),
    message,
    authorName,
    authorEmail,
    date,
  };
}

/**
 * Downloads and unpacks repository source code securely into an isolated directory.
 * Token is never stored on disk or written to repository git configurations.
 */
export async function downloadRepositoryArchive(
  accessToken: string,
  owner: string,
  repo: string,
  ref: string,
  targetDirectory: string
): Promise<{ extractedPath: string }> {
  const token = decryptToken(accessToken);
  const fs = await import("fs");
  const path = await import("path");
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  await fs.promises.mkdir(targetDirectory, { recursive: true });

  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/tarball/${encodeURIComponent(ref)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "DeployX-Platform",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`Repository or ref '${ref}' not found in '${owner}/${repo}'.`);
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(`Access denied to repository archive for '${owner}/${repo}'.`);
    }
    throw new Error(`Failed to download repository archive: ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const tarballPath = path.join(targetDirectory, `archive-${Date.now()}.tar.gz`);

  await fs.promises.writeFile(tarballPath, buffer);

  try {
    // Extract using bsdtar (built-in on Windows 10/11 and Linux)
    await execAsync(`tar -xzf "${tarballPath}" -C "${targetDirectory}" --strip-components 1`);
  } catch (tarErr) {
    // Fallback: If tar extraction fails, shallow clone using memory-only extraheader
    try {
      const gitUrl = `https://github.com/${owner}/${repo}.git`;
      await execAsync(
        `git -c http.extraheader="Authorization: Bearer ${token}" clone --depth 1 --branch "${ref}" "${gitUrl}" "${targetDirectory}"`
      );
      // Clean .git folder immediately to prevent secret exposure
      const gitDir = path.join(targetDirectory, ".git");
      if (fs.existsSync(gitDir)) {
        await fs.promises.rm(gitDir, { recursive: true, force: true });
      }
    } catch {
      throw new Error(`Failed to extract repository archive: ${tarErr instanceof Error ? tarErr.message : String(tarErr)}`);
    }
  } finally {
    if (fs.existsSync(tarballPath)) {
      await fs.promises.unlink(tarballPath).catch(() => {});
    }
  }

  return { extractedPath: targetDirectory };
}

