/**
 * Pure resilience primitives for the LLM gateway — token bucket (outbound
 * rate limiting) and circuit breaker (break-site). No database, no env,
 * injectable clock so the unit tests are deterministic:
 *
 *   - TokenBucket: 35 requests / sliding wall for NVIDIA NIM's ~40/min sharing
 *     cap. A clean "bucket empty" routes to the fallback provider — it is NOT
 *     a user-facing error and is NOT a retry trigger.
 *   - CircuitBreaker: opens after `failureThreshold` NVIDIA failures within a
 *     rolling `failureWindowMs`, then stays open for `cooldownMs` during which
 *     traffic routes straight to the fallback. Once the cooldown lapses a
 *     half-open trial is allowed; success closes the breaker, failure re-opens.
 */

export interface BreakerSnapshot {
  state: "closed" | "open" | "half_open";
  failuresInWindow: number;
  consecutiveFailures: number;
  openUntil: number;
  lastFailureAt: number;
  lastSuccessAt: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefillMs = this.now();

  constructor(
    private readonly capacity: number,
    private readonly refillWindowMs: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = capacity;
  }

  /** Try to take `count` tokens; returns false when the bucket is empty. */
  tryTake(count = 1): boolean {
    this.refill();
    if (this.tokens < count) return false;
    this.tokens -= count;
    return true;
  }

  /** How many tokens are available right now (without consuming). */
  available(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const elapsed = this.now() - this.lastRefillMs;
    if (elapsed <= 0) return;
    const refilled = Math.min(this.capacity, this.tokens + (elapsed / this.refillWindowMs) * this.capacity) - this.tokens;
    if (refilled <= 0) return;
    this.tokens += refilled;
    // Preserve the sub-window remainder so long-running processes don't drift
    // away from the true refill rate.
    this.lastRefillMs += (refilled / this.capacity) * this.refillWindowMs;
  }
}

export class CircuitBreaker {
  private failures: number[] = [];
  private consecutiveFailures = 0;
  private openUntil = 0;
  private lastFailureAt = 0;
  private lastSuccessAt = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;

  constructor(
    private readonly failureThreshold: number,
    private readonly failureWindowMs: number,
    private readonly cooldownMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** May a request go to this provider right now? (closed or half-open trial) */
  mayAttempt(): boolean {
    return this.now() >= this.openUntil;
  }

  private windowFailures(): number {
    const cutoff = this.now() - this.failureWindowMs;
    return this.failures.filter((f) => f > cutoff).length;
  }

  recordFailure(): void {
    const now = this.now();
    this.failures.push(now);
    this.consecutiveFailures += 1;
    this.lastFailureAt = now;
    this.totalFailures += 1;
    const cutoff = now - this.failureWindowMs;
    this.failures = this.failures.filter((f) => f > cutoff);
    // Trip (re-trip) only when the windowed failure count still qualifies.
    if (this.failures.length >= this.failureThreshold && now >= this.openUntil) {
      this.openUntil = now + this.cooldownMs;
    }
  }

  recordSuccess(): void {
    this.failures = [];
    this.consecutiveFailures = 0;
    this.openUntil = 0;
    this.lastSuccessAt = this.now();
    this.totalSuccesses += 1;
  }

  reset(): void {
    this.failures = [];
    this.consecutiveFailures = 0;
    this.openUntil = 0;
    this.lastFailureAt = 0;
    this.lastSuccessAt = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
  }

  snapshot(): BreakerSnapshot {
    const now = this.now();
    const state: BreakerSnapshot["state"] = this.openUntil === 0 ? "closed" : now < this.openUntil ? "open" : "half_open";
    return {
      state,
      failuresInWindow: this.windowFailures(),
      consecutiveFailures: this.consecutiveFailures,
      openUntil: this.openUntil,
      lastFailureAt: this.lastFailureAt,
      lastSuccessAt: this.lastSuccessAt,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }
}