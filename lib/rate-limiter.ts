import "server-only";

import { createAdminDb } from "@/lib/db";
import { bucketConfig as rateLimitBucketConfig, tierMultiplier } from "@/lib/rate-limit-config";
import { getRateLimitHeaders } from "@/lib/rate-limit-headers";

export { getRateLimitHeaders };

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
  /** True ONLY when the limiter itself could not be reached (infra/DB failure).
   *  NOT a real user rate-limit. Callers must distinguish the two: infra →
   *  "temporarily unavailable" (503), genuine deny → "rate limit exceeded" (429). */
  unavailable: boolean;
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
  const config = rateLimitBucketConfig(bucket);
  const multiplier = tierMultiplier(userTier);
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
      unavailable: false,
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
      unavailable: true,
    };
  }
}
