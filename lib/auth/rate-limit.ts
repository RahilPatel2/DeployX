interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Clean up expired rate limit records periodically
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetAt) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref?.();
}

/**
 * Safely extracts client IP address from standard proxy headers
 */
export function getClientIp(req: Request): string {
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp && cfConnectingIp.trim()) {
    return cfConnectingIp.trim();
  }

  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp && xRealIp.trim()) {
    return xRealIp.trim();
  }

  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  return "127.0.0.1";
}

/**
 * Returns standard HTTP rate limit headers
 */
export function getRateLimitHeaders(
  limit: number,
  remaining: number,
  retryAfterSeconds: number
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": limit.toString(),
    "X-RateLimit-Remaining": Math.max(0, remaining).toString(),
  };

  if (retryAfterSeconds > 0) {
    headers["Retry-After"] = retryAfterSeconds.toString();
  }

  return headers;
}

/**
 * Check if an action is within rate limits.
 * @param key Unique identifier (e.g., `login:${ip}:${identifier}`)
 * @param maxAttempts Maximum allowed attempts in window
 * @param windowMs Time window in milliseconds (default 15 minutes)
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0, remaining: maxAttempts - 1 };
  }

  if (record.count >= maxAttempts) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }

  record.count += 1;
  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxAttempts - record.count),
  };
}

/**
 * Reset rate limit record upon successful authentication
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}
