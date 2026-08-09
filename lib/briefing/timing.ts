/**
 * Structured stage timing for briefing generation — the single shape used to
 * report where time goes. Pure module: node-testable, no DB, no network.
 *
 * Every entry carries the stage name, how long that stage took, and an outcome
 * result for that stage so latency is always paired with what happened.
 * Structured logs must NEVER include email bodies, OAuth tokens, or keys.
 */
export interface TimingEntry {
  requestId: string;
  userId: string;
  operation: string;
  provider: string | null;
  stage: string;
  durationMs: number;
  result: string;
  timestamp: string;
}

export class StageTimer {
  private readonly requestId: string;
  private readonly userId: string;
  private readonly operation: string;
  private readonly startedAt = Date.now();
  private lastMark = Date.now();
  private readonly entries: TimingEntry[] = [];

  constructor(opts: { requestId: string; userId: string; operation: string }) {
    this.requestId = opts.requestId;
    this.userId = opts.userId;
    this.operation = opts.operation;
  }

  /** Start timing from this point (previously measured work is preserved). */
  reset(): void {
    this.lastMark = Date.now();
  }

  /** Record how long the segment since the last mark (or constructor) took. */
  mark(stage: string, provider: string | null = null, result = "ok"): TimingEntry {
    const now = Date.now();
    const durationMs = now - this.lastMark;
    const entry: TimingEntry = {
      requestId: this.requestId,
      userId: this.userId,
      operation: this.operation,
      provider,
      stage,
      durationMs,
      result,
      timestamp: new Date(now).toISOString(),
    };
    this.entries.push(entry);
    this.lastMark = now;
    return entry;
  }

  getEntries(): TimingEntry[] {
    return this.entries;
  }

  /** Total wall-clock since creation. */
  totalMs(): number {
    return Date.now() - this.startedAt;
  }
}

/** Serialize timings for structured logging (metadata only — never bodies). */
export function timingToLog(entries: TimingEntry[]): Record<string, unknown> {
  return {
    stages: entries.map((e) => ({
      stage: e.stage,
      provider: e.provider,
      durationMs: e.durationMs,
      result: e.result,
    })),
  };
}

/** Aggregate per-stage totals (for a summary line). */
export function summarizeStages(entries: TimingEntry[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of entries) {
    out[e.stage] = (out[e.stage] || 0) + e.durationMs;
  }
  return out;
}