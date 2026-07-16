import { createAdminClient } from "@insforge/sdk";

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
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

function createDb() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Missing InsForge configuration");
  }
  return createAdminClient({ baseUrl, apiKey });
}

export async function checkRateLimit(
  userId: string,
  bucket: string,
  userTier: string = "free"
): Promise<RateLimitResult> {
  const config = DEFAULT_CONFIGS[bucket] || DEFAULT_CONFIGS.api;
  const multiplier = TIER_MULTIPLIERS[userTier] || 1;
  const maxRequests = config.maxRequests * multiplier;

  const db = createDb();
  const now = Date.now();
  const windowStart = now - config.windowMs;

  try {
    await db.database.rpc("cleanup_rate_limits", {}).catch(() => {});

    const { data: existing } = await db.database
      .from("rate_limits")
      .select("*")
      .eq("user_id", userId)
      .eq("bucket", bucket)
      .maybeSingle();

    if (!existing) {
      await db.database.from("rate_limits").insert({
        user_id: userId,
        bucket,
        count: 1,
        window_start: new Date(windowStart).toISOString(),
        reset_at: new Date(now + config.windowMs).toISOString(),
      });
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + config.windowMs, retryAfterMs: 0 };
    }

    const existingWindowStart = new Date(existing.window_start).getTime();
    if (existingWindowStart < windowStart) {
      await db.database.from("rate_limits").update({
        count: 1,
        window_start: new Date(windowStart).toISOString(),
        reset_at: new Date(now + config.windowMs).toISOString(),
      }).eq("id", existing.id);
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + config.windowMs, retryAfterMs: 0 };
    }

    const currentCount = (existing.count || 0) + 1;
    const resetAt = new Date(existing.reset_at).getTime();
    const retryAfterMs = Math.max(0, resetAt - now);

    if (currentCount > maxRequests) {
      return { allowed: false, remaining: 0, resetAt, retryAfterMs };
    }

    await db.database.from("rate_limits").update({ count: currentCount }).eq("id", existing.id);
    return { allowed: true, remaining: maxRequests - currentCount, resetAt, retryAfterMs };
  } catch (error) {
    console.error("Rate limiter error (allowing through):", error);
    return { allowed: true, remaining: 1, resetAt: now + 60_000, retryAfterMs: 0 };
  }
}

export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.remaining + (result.allowed ? 1 : 0)),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    "Retry-After": String(Math.ceil(result.retryAfterMs / 1000)),
  };
}
