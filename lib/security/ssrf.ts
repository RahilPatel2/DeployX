import dns from "dns";
import { promisify } from "util";
import net from "net";

const lookupAsync = promisify(dns.lookup);

/**
 * Checks whether an IPv4 or IPv6 address is in a private, loopback, link-local,
 * multicast, or cloud-metadata network range.
 */
export function isPrivateOrBlockedIp(ipAddress: string): boolean {
  if (!ipAddress || typeof ipAddress !== "string") {
    return true;
  }

  const cleanIp = ipAddress.trim();

  // Handle IPv6 mapped IPv4 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (cleanIp.startsWith("::ffff:")) {
    const v4Part = cleanIp.slice(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateOrBlockedIp(v4Part);
    }
  }

  // IPv4 Evaluation
  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }

    const [b0, b1, b2] = parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;

    // 10.0.0.0/8 (RFC 1918 Private)
    if (b0 === 10) return true;

    // 172.16.0.0/12 (RFC 1918 Private: 172.16.0.0 - 172.31.255.255)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

    // 192.168.0.0/16 (RFC 1918 Private)
    if (b0 === 192 && b1 === 168) return true;

    // 169.254.0.0/16 (Link-local & AWS/GCP/Azure Metadata: 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;

    // 100.64.0.0/10 (Carrier Grade NAT)
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (b0 === 192 && b1 === 0 && b2 === 0) return true;

    // 198.18.0.0/15 (Network benchmark tests)
    if (b0 === 198 && (b1 === 18 || b1 === 19)) return true;

    // 224.0.0.0/4 (Multicast: 224.0.0.0 - 239.255.255.255)
    if (b0 >= 224 && b0 <= 239) return true;

    // 240.0.0.0/4 (Reserved for future use: 240.0.0.0 - 255.255.255.254)
    // 255.255.255.255 (Broadcast)
    if (b0 >= 240) return true;

    return false;
  }

  // IPv6 Evaluation
  if (net.isIPv6(cleanIp)) {
    const lower = cleanIp.toLowerCase();

    // Loopback ::1
    if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;

    // Unspecified ::
    if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;

    // Unique Local fc00::/7 (fc00... or fd00...)
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;

    // Link-local unicast fe80::/10 (fe8..., fe9..., fea..., feb...)
    if (/^fe[89ab]/i.test(lower)) return true;

    // Multicast ff00::/8
    if (lower.startsWith("ff")) return true;

    return false;
  }

  return true;
}

/**
 * Validates whether a target URL is safe to fetch and does not target internal or restricted networks.
 */
export async function validateSafeUrl(urlString: string): Promise<{
  safe: boolean;
  error?: string;
  resolvedIp?: string;
  url?: URL;
}> {
  if (!urlString || typeof urlString !== "string") {
    return { safe: false, error: "Empty or invalid URL supplied." };
  }

  let parsed: URL;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { safe: false, error: "Malformed URL syntax." };
  }

  // Only permit standard HTTP and HTTPS schemes
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      safe: false,
      error: `Forbidden scheme '${parsed.protocol}'. Only http: and https: protocols are permitted.`,
    };
  }

  const hostname = parsed.hostname.toLowerCase().trim();

  // Deny raw loopback / metadata hostnames
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "metadata.google.internal" ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    return { safe: false, error: `Host '${hostname}' is restricted from remote fetching.` };
  }

  // If host is already an IP literal, validate directly
  if (net.isIP(hostname)) {
    if (isPrivateOrBlockedIp(hostname)) {
      return {
        safe: false,
        error: `IP address '${hostname}' belongs to a private, loopback, or metadata subnet.`,
        resolvedIp: hostname,
      };
    }
    return { safe: true, resolvedIp: hostname, url: parsed };
  }

  // Resolve DNS to verify all returned IPs
  try {
    const lookupResult = await lookupAsync(hostname, { all: true });
    if (!lookupResult || lookupResult.length === 0) {
      return { safe: false, error: `Could not resolve hostname '${hostname}'.` };
    }

    for (const entry of lookupResult) {
      if (isPrivateOrBlockedIp(entry.address)) {
        return {
          safe: false,
          error: `Resolved IP '${entry.address}' for host '${hostname}' targets a prohibited internal network.`,
          resolvedIp: entry.address,
        };
      }
    }

    return { safe: true, resolvedIp: lookupResult[0].address, url: parsed };
  } catch (err) {
    return {
      safe: false,
      error: `DNS resolution failed for '${hostname}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * SSRF-Safe HTTP Fetch wrapper. Validates URLs and handles redirects by recursively checking each hop.
 */
export async function safeFetch(
  inputUrl: string,
  init?: RequestInit,
  maxRedirects: number = 3
): Promise<Response> {
  let currentUrl = inputUrl;
  let redirectsRemaining = maxRedirects;

  while (redirectsRemaining >= 0) {
    const check = await validateSafeUrl(currentUrl);
    if (!check.safe || !check.url) {
      throw new Error(`SSRF Security Error: ${check.error || "Blocked fetch target."}`);
    }

    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual", // Intercept redirects to re-validate destination IP
    });

    // Check for redirect status codes (301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        return response;
      }

      currentUrl = new URL(location, currentUrl).toString();
      redirectsRemaining--;

      if (redirectsRemaining < 0) {
        throw new Error("Too many redirects during safe fetch.");
      }
      continue;
    }

    return response;
  }

  throw new Error("Maximum redirect limit reached.");
}
