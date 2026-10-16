/**
 * Build Command and Path Sanitization Security Module
 * Protects build infrastructure against command injection, shell metacharacter exploits,
 * and unauthorized filesystem traversal.
 */

// Allowlisted package managers and CLI tools that are permitted in build/install scripts
const ALLOWED_EXECUTABLES = new Set([
  "npm",
  "pnpm",
  "yarn",
  "bun",
  "npx",
  "node",
  "next",
  "vite",
  "astro",
  "remix",
  "nuxt",
  "gatsby",
  "webpack",
  "tsc",
  "svelte-kit",
  "ng",
  "turbo",
  "cross-env",
  "rimraf",
]);

// Shell dangerous sequences that attempt subshell execution or dangerous piping
const DANGEROUS_PATTERNS = [
  /\$\(/,                    // Subshell execution $(...)
  /`/,                       // Backtick subshell execution `...`
  /\bpowershell(\.exe)?\b/i, // PowerShell spawning
  /\bcmd(\.exe)?\b/i,        // Nested cmd.exe spawning
  /\bbash(\.exe)?\b/i,       // Bash spawning
  /\bsh(\.exe)?\b/i,         // Sh spawning
  /\bcurl(\.exe)?\b/i,       // Unauthorized download tools
  /\bwget(\.exe)?\b/i,       // Unauthorized download tools
  /\bnc(\.exe)?\b/i,         // Netcat / reverse shells
  /\bnet\s+user\b/i,         // User account manipulation
  /\bformat\b/i,             // Disk formatting
  /\bshutdown\b/i,           // System shutdown
];

/**
 * Validates a build or install command to prevent malicious shell injection.
 */
export function validateBuildCommand(command: string | undefined | null): {
  valid: boolean;
  error?: string;
  sanitized?: string;
} {
  if (!command || typeof command !== "string" || command.trim() === "") {
    return { valid: true, sanitized: "" };
  }

  const trimmed = command.trim();

  // Enforce reasonable length limits
  if (trimmed.length > 512) {
    return { valid: false, error: "Build command exceeds maximum allowed length of 512 characters." };
  }

  // Check for dangerous subshell or binary spawning patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        error: `Security violation: Prohibited shell instruction or binary detected in command: '${trimmed}'.`,
      };
    }
  }

  // Split on chaining operators (&&, ||, ;, &) to inspect each sub-command
  const subCommands = trimmed
    .split(/&&|\|\||;|&/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const subCmd of subCommands) {
    // Extract base binary/executable name (first word, stripping quotes or flags)
    const baseBinary = subCmd.split(/\s+/)[0]?.replace(/^["']|["']$/g, "").toLowerCase();

    if (baseBinary && !ALLOWED_EXECUTABLES.has(baseBinary)) {
      // If not in standard allowlist, ensure it's at least an allowed npm/pnpm script or relative runner
      if (!/^(run|build|export|generate|compile)$/.test(baseBinary)) {
        return {
          valid: false,
          error: `Security violation: Command '${baseBinary}' is not an authorized build executable.`,
        };
      }
    }
  }

  return { valid: true, sanitized: trimmed };
}

/**
 * Validates an output directory path to ensure it cannot escape the build workspace.
 */
export function validateOutputDirectory(dir: string | undefined | null): {
  valid: boolean;
  error?: string;
  sanitized?: string;
} {
  if (!dir || typeof dir !== "string" || dir.trim() === "") {
    return { valid: true, sanitized: "" };
  }

  const trimmed = dir.trim();

  // Enforce reasonable length limit
  if (trimmed.length > 256) {
    return { valid: false, error: "Output directory path exceeds maximum allowed length of 256 characters." };
  }

  // Check for path traversal or absolute roots
  if (
    trimmed.includes("..") ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\") ||
    /^[a-zA-Z]:/.test(trimmed)
  ) {
    return {
      valid: false,
      error: `Security violation: Output directory '${trimmed}' contains forbidden traversal sequences or absolute paths.`,
    };
  }

  // Normalize slashes
  const normalized = trimmed.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
  return { valid: true, sanitized: normalized };
}
