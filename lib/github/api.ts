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
  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=100", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
    },
    // Don't cache this heavily as repos change
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.statusText}`);
  }

  return res.json();
}

export async function getRepositoryFile(accessToken: string, owner: string, repo: string, path: string): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
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
