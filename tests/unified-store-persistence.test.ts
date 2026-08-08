import { test } from "node:test";
import assert from "node:assert/strict";
import { UnifiedStoreRepository } from "../lib/repositories/unified-store-repository";
import { normalizeResult } from "../lib/briefing/pipeline";
import type { AdminDb } from "../lib/repositories/types";

/**
 * Regression: the maintenance/auto-sync path must PERSIST normalized entities
 * to the unified store (surviving restarts), and a subsequent cold read must
 * return exactly what was written — keyed by integration+provider ids so
 * re-syncs upsert instead of duplicating.
 */

type Table = Array<Record<string, unknown>>;
type Store = Map<string, Table>;

/**
 * Minimal in-memory postgrest-lookalike supporting the two chains the repo
 * uses: `from(t).upsert(rows, {onConflict})` and
 * `from(t).select().eq(c,v).eq(c2,v2).order(c).limit(n)`.
 */
function fakeDb(store: Store): AdminDb {
  const build = (table: string) => {
    const eqs: Array<[string, unknown]> = [];
    let orderCol = "";
    const chain: Record<string, unknown> = {};
    const api = {
      upsert(rows: Array<Record<string, unknown>>, opts?: { onConflict?: string }) {
        const t = store.get(table) ?? [];
        const conflictKey = (opts?.onConflict || "provider_notification_id").split(",")[0].trim();
        for (const row of rows) {
          const existingIdx = t.findIndex((r) => row[conflictKey] != null && r[conflictKey] === row[conflictKey]);
          if (existingIdx >= 0) t[existingIdx] = { ...t[existingIdx], ...row };
          else t.push(row);
        }
        store.set(table, t);
        return Promise.resolve({ data: null, error: null });
      },
      select() { return api; },
      eq(col: string, val: unknown) { eqs.push([col, val]); return api; },
      order(col: string) { orderCol = col; return api; },
      limit(max: number) {
        return Promise.resolve({ data: resolved(table, eqs, orderCol).slice(0, max), error: null });
      },
    };
    chain.api = api;
    return api;
  };

  const resolved = (table: string, eqs: Array<[string, unknown]>, orderCol: string): Table => {
    let t = Array.from(store.get(table) ?? []);
    for (const [col, val] of eqs) t = t.filter((r) => r[col] === val);
    if (orderCol) {
      t = t.slice().sort((a, b) => String(a[orderCol]).localeCompare(String(b[orderCol])));
    }
    return t;
  };

  return { database: { from: (table: string) => build(table) } } as unknown as AdminDb;
}

test("maintenance persistence: upsertBatch writes commit entities to unified_notifications", async () => {
  const store: Store = new Map();
  store.set("unified_notifications", []);
  const db = fakeDb(store);

  const entities = normalizeResult("github", {
    issues: [],
    notifications: [],
    activity: [{ sha: "aaabbbccc", repo: "o/r", message: "perf: scale shards", date: "2026-07-04T10:00:00Z", author: "Nana" }],
  }, "integration-1");

  const written = await new UnifiedStoreRepository(db).upsertBatch("user-1", "integration-1", entities);
  assert.equal(written, 1, "one commit written");

  const rows = store.get("unified_notifications")!;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, "user-1");
  assert.equal(rows[0].integration_id, "integration-1");
  assert.equal(rows[0].provider_notification_id, "commit_aaabbbccc");
  assert.equal(rows[0].kind, "commit");
  assert.equal(rows[0].title, "perf: scale shards");
  assert.equal((rows[0].metadata as Record<string, unknown>).pushedAt, "2026-07-04T10:00:00Z");
});

test("maintenance restart survival: re-sync upserts (no duplicate rows), fresh handle reads persisted state", async () => {
  const store: Store = new Map();
  store.set("unified_notifications", []);

  const activity = (sha: string) => ({
    issues: [], notifications: [], activity: [{ sha, repo: "o/r", message: "fix: sync race", date: "2026-07-05T09:00:00Z", author: null }],
  });

  // Run 1 — initial sync writes.
  await new UnifiedStoreRepository(fakeDb(store)).upsertBatch(
    "user-9", "integration-1", normalizeResult("github", activity("a1b2c3d"), "integration-1"));

  // "Restart" — a FRESH repository instance (new db handle = cold boot) runs
  // auto-sync again with the same provider ids. Must upsert, not duplicate.
  await new UnifiedStoreRepository(fakeDb(store)).upsertBatch(
    "user-9", "integration-1", normalizeResult("github", activity("a1b2c3d"), "integration-1"));

  assert.equal(store.get("unified_notifications")!.length, 1, "no duplicate after re-sync");
});

test("maintenance: whatsapp rows written to unified_messages are readable via getRecentMessages (cold restart)", async () => {
  const store: Store = new Map();
  store.set("unified_messages", []);

  const entities = normalizeResult("whatsapp", [
    { id: "W1", from: "123@s.whatsapp.net", fromName: "Me", message: "see you at 5", timestamp: "2026-07-06T12:00:00Z", isGroup: false },
  ], "integration-2");
  await new UnifiedStoreRepository(fakeDb(store)).upsertBatch("user-1", "integration-2", entities);

  // Cold read via getRecentMessages with a FRESH db handle over the same store.
  const { getRecentMessages } = await import("../lib/repositories/unified-store-repository");
  const rows = await getRecentMessages("user-1", "integration-2", 10, fakeDb(store));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].provider_message_id, "W1");
  assert.equal(rows[0].body_text, "see you at 5");
  assert.equal(rows[0].user_id, "user-1");
  assert.equal(rows[0].integration_id, "integration-2");
});