import "server-only";

import { createAdminDb } from "@/lib/db";

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  "ai-agent": { windowMs: 60_000, maxRequests: 10 },
  "api": { windowMs: 60_000, maxRequests: 30 },
  "auth": { windowMs: 60_000, maxRequests: 5 },
};

const TIER_MULTIPLIERS: Record<string, number> = {
  free: 1,
  pro: 3,
  enterprise: 10,
};

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

interface RateLimitRpcRow {
  allowed: boolean;
  remaining: number;
  reset_at_ms: number | string;
  retry_after_ms: number | string;
}

export async function checkRateLimit(
  userId: string,
  bucket: string,
  userTier: string = "free"
): Promise<RateLimitResult> {
  const config = DEFAULT_CONFIGS[bucket] || DEFAULT_CONFIGS.api;
  const multiplier = TIER_MULTIPLIERS[userTier] || 1;
  const maxRequests = config.maxRequests * multiplier;

  const now = Date.now();

  try {
    const db = createAdminDb();
    const { data, error } = await db.database.rpc("consume_rate_limit", {
      p_user_id: userId,
      p_bucket: bucket,
      p_window_ms: config.windowMs,
      p_max_requests: maxRequests,
    });

    if (error) {
      throw new Error(`Rate limit RPC failed: ${error.message}`);
    }

    const row = (Array.isArray(data) ? data[0] : data) as RateLimitRpcRow | null;
    if (!row || typeof row.allowed !== "boolean") {
      throw new Error("Rate limit RPC returned an invalid response");
    }

    return {
      allowed: row.allowed,
      limit: maxRequests,
      remaining: Number(row.remaining),
      resetAt: Number(row.reset_at_ms),
      retryAfterMs: Number(row.retry_after_ms),
    };
  } catch (error) {
    const failClosed = bucket === "ai-agent";
    console.error("Rate limiter unavailable", { bucket, userId, failClosed, error });
    return {
      allowed: !failClosed,
      limit: maxRequests,
      remaining: 0,
      resetAt: now + config.windowMs,
      retryAfterMs: failClosed ? config.windowMs : 0,
    };
  }
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
  };
}
