import { createHash } from "node:crypto";

/**
 * Single-flight / request deduplication (Phase 5).
 *
 * Concurrent invocations of the same logical operation (same key) share ONE
 * underlying promise, so a double-click, React re-render, or retried server
 * action can never fire two identical requests (e.g. two AI draft calls or two
 * sends). After the promise settles the key is released, so a genuine repeat
 * click later still re-runs the operation.
 *
 * Pure module: node-testable, no imports beyond node:crypto.
 */

const inFlight = new Map<string, Promise<unknown>>();

/** Deterministic request key from stable parts (never includes secrets). */
export function dedupeKey(parts: Array<string | number | null | undefined>): string {
  const canonical = parts.filter((p) => p !== null && p !== undefined && p !== "").join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function isInFlight(key: string): boolean {
  return inFlight.has(key);
}

export function pendingRequestCount(): number {
  return inFlight.size;
}

export async function singleFlight<T>(key: string, work: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const promise = (async () => {
    try {
      return await work();
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, promise);
  return promise;
}