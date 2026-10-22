/**
 * Repository Identifier Normalization and Validation
 *
 * Ensures robust extraction and validation of GitHub repository identifiers
 * across various project storage schemas and client representations.
 * Strict canonical format: 'owner/repo'
 */

export interface NormalizedRepository {
  owner: string;
  repo: string;
  fullName: string;
}

export interface RepositoryValidationResult {
  valid: boolean;
  error?: string;
  code?: "REPOSITORY_MISSING" | "INVALID_REPOSITORY_FORMAT";
  repository?: NormalizedRepository;
}

/**
 * Validates whether a string matches valid GitHub owner or repository naming rules.
 * GitHub allows alphanumeric characters, hyphens (-), underscores (_), and dots (.).
 * Disallows path traversal, slashes, and control characters.
 */
export function isValidGitHubSegment(segment: string): boolean {
  if (!segment || typeof segment !== "string") return false;
  const trimmed = segment.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return false;
  if (trimmed === "." || trimmed === "..") return false;
  return /^[a-zA-Z0-9_.-]+$/.test(trimmed);
}

/**
 * Normalizes an unknown repository representation into canonical { owner, repo, fullName } format.
 * Handles:
 * - Direct "owner/repo" strings
 * - URLs: "https://github.com/owner/repo", "https://github.com/owner/repo.git", "github.com/owner/repo"
 * - Object representations containing:
 *   - repository
 *   - repo
 *   - repositoryFullName / fullName / full_name
 *   - repositoryOwner & repositoryName
 */
export function normalizeRepository(input: unknown): NormalizedRepository | null {
  if (!input) return null;

  // Case 1: String input
  if (typeof input === "string") {
    let clean = input.trim();
    if (!clean) return null;

    // Strip URL prefixes and .git suffixes
    clean = clean
      .replace(/^https?:\/\/github\.com\//i, "")
      .replace(/^github\.com\//i, "")
      .replace(/^git@github\.com:/i, "")
      .replace(/\.git$/i, "")
      .replace(/^\/+|\/+$/g, "");

    if (clean.includes("//")) {
      return null;
    }

    const parts = clean.split("/");
    if (parts.length === 2) {
      const [owner, repo] = parts.map((p) => p.trim());
      if (isValidGitHubSegment(owner) && isValidGitHubSegment(repo)) {
        return {
          owner,
          repo,
          fullName: `${owner}/${repo}`,
        };
      }
    }
    return null;
  }

  // Case 2: Object input (e.g. Project document, payload)
  if (typeof input === "object") {
    const obj = input as Record<string, unknown>;

    // 2a. Check candidate string properties
    const candidateKeys = ["repository", "repo", "repositoryFullName", "fullName", "full_name"];
    for (const key of candidateKeys) {
      if (typeof obj[key] === "string" && obj[key]) {
        const normalized = normalizeRepository(obj[key] as string);
        if (normalized) return normalized;
      }
    }

    // 2b. Check composite owner and repository properties
    const ownerCandidate =
      typeof obj.repositoryOwner === "string"
        ? obj.repositoryOwner
        : typeof obj.owner === "string"
        ? obj.owner
        : typeof (obj.owner as Record<string, unknown> | undefined)?.login === "string"
        ? ((obj.owner as Record<string, unknown>).login as string)
        : null;

    const repoCandidate =
      typeof obj.repositoryName === "string"
        ? obj.repositoryName
        : typeof obj.name === "string" && obj.repositoryOwner
        ? obj.name
        : typeof obj.repoName === "string"
        ? obj.repoName
        : null;

    if (ownerCandidate && repoCandidate) {
      const owner = ownerCandidate.trim();
      const repo = repoCandidate.trim();
      if (isValidGitHubSegment(owner) && isValidGitHubSegment(repo)) {
        return {
          owner,
          repo,
          fullName: `${owner}/${repo}`,
        };
      }
    }
  }

  return null;
}

/**
 * Extracts and normalizes repository from a Project document or record.
 */
export function extractRepositoryFromProject(project: unknown): NormalizedRepository | null {
  return normalizeRepository(project);
}

/**
 * Validates repository information with structured, actionable error diagnostics.
 */
export function validateRepositoryContract(
  projectOrRepo: unknown
): RepositoryValidationResult {
  if (!projectOrRepo) {
    return {
      valid: false,
      code: "REPOSITORY_MISSING",
      error: "Repository information is missing or undefined.",
    };
  }

  const normalized = normalizeRepository(projectOrRepo);
  if (!normalized) {
    const rawVal =
      typeof projectOrRepo === "string"
        ? projectOrRepo
        : typeof (projectOrRepo as Record<string, unknown>)?.repository === "string"
        ? ((projectOrRepo as Record<string, unknown>).repository as string)
        : undefined;

    return {
      valid: false,
      code: "INVALID_REPOSITORY_FORMAT",
      error: `Invalid repository identifier '${rawVal ?? "undefined"}'. Expected format 'owner/repo'.`,
    };
  }

  return {
    valid: true,
    repository: normalized,
  };
}
