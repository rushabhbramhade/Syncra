/**
 * Rate-limit policy — pure config so tests can assert buckets without a DB.
 * Mirrors the values historically duplicated in `lib/rate-limiter.ts`.
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export const RATE_LIMIT_BUCKETS: Record<string, RateLimitConfig> = {
  "ai-agent": { windowMs: 60_000, maxRequests: 10 },
  "ai-draft": { windowMs: 60_000, maxRequests: 6 },
  auth: { windowMs: 60_000, maxRequests: 5 },
  api: { windowMs: 60_000, maxRequests: 30 },
};

/** Multipliers by tier; unknown tiers fall back to free. */
export const TIER_MULTIPLIERS: Record<string, number> = {
  free: 1,
  pro: 3,
  enterprise: 10,
};

export const DEFAULT_BUCKET = "api";

export function bucketConfig(bucket: string): RateLimitConfig {
  return RATE_LIMIT_BUCKETS[bucket] || RATE_LIMIT_BUCKETS[DEFAULT_BUCKET];
}

export function tierMultiplier(userTier: string): number {
  return TIER_MULTIPLIERS[userTier] || TIER_MULTIPLIERS.free;
}

/** The exact user-facing message when a determined rate limit denies a draft. */
export const DRAFT_RATE_LIMIT_ERROR =
  "Rate limit exceeded. Please wait before generating another draft.";