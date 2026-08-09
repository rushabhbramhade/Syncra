import { test } from "node:test";
import assert from "node:assert/strict";
import { getRateLimitHeaders } from "../lib/rate-limit-headers";

test("getRateLimitHeaders emits the standard rate-limit headers on a genuine deny (429 path)", () => {
  const headers = getRateLimitHeaders({
    allowed: false,
    limit: 6,
    remaining: 0,
    resetAt: 1_700_000_000_123,
    retryAfterMs: 45_000,
    unavailable: false,
  });
  assert.equal(headers["X-RateLimit-Limit"], "6");
  assert.equal(headers["X-RateLimit-Remaining"], "0");
  assert.equal(headers["X-RateLimit-Reset"], "1700000001"); // ceil(ms → s)
  assert.equal(headers["Retry-After"], "45");
});

test("getRateLimitHeaders emits the same shape on the unavailable (503) path", () => {
  const headers = getRateLimitHeaders({
    allowed: false,
    limit: 10,
    remaining: 0,
    resetAt: Date.now() + 60_000,
    retryAfterMs: 60_000,
    unavailable: true,
  });
  assert.equal(headers["X-RateLimit-Limit"], "10");
  assert.equal(headers["X-RateLimit-Remaining"], "0");
  assert.ok(headers["X-RateLimit-Reset"].length > 0);
  assert.equal(headers["Retry-After"], "60");
});

test("getRateLimitHeaders rounds reset up to the next integer second (never a fractional buffer)", () => {
  const headers = getRateLimitHeaders({
    allowed: true,
    limit: 5,
    remaining: 4,
    resetAt: 1_700_000_000_001,
    retryAfterMs: 5_500,
    unavailable: false,
  });
  assert.equal(headers["X-RateLimit-Reset"], "1700000001");
  assert.equal(headers["Retry-After"], "6");
});