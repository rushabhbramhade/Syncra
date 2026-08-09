/**
 * HTTP rate-limit header mapping — pure module (node-testable, no DB, no
 * network). Kept out of `lib/rate-limiter.ts` (which imports `server-only`) so
 * the exact 429/503 contract this app emits is regression-tested as a unit.
 */

export interface RateLimitHeaders {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
  unavailable: boolean;
}

/** RFC-6585 / standardized rate-limit response headers from a result. */
export function getRateLimitHeaders(result: RateLimitHeaders): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
  };
}