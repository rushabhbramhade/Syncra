import { test } from "node:test";
import assert from "node:assert/strict";
import { NotificationHistoryRepository } from "../lib/repositories/notification-history-repository.ts";
import type { AdminDb } from "../lib/repositories/types.ts";

interface Row {
  id: string;
  status: string;
}

type FakeDb = { database: unknown };

/** Cast any object to the repository's abstract db shape without `any` leaks. */
function asRepoDb(db: FakeDb) {
  return db as unknown as AdminDb;
}

/** Minimal scriptable DB mirroring the postgrest `.update().eq().in().select()` chain. */
function fakeDb() {
  const rows = new Map<string, Row>();
  return {
    rows,
    database: {
      from() {
        let updatePayload: Record<string, unknown> | null = null;
        let eqVal: string | null = null;
        let statuses: string[] = [];
        const api = {
          update(payload: Record<string, unknown>) {
            updatePayload = payload;
            return api;
          },
          select() {
            return api;
          },
          eq(_col: string, val: unknown) {
            eqVal = val as string;
            return api;
          },
          in(_col: string, vals: unknown[]) {
            statuses = vals as string[];
            return api;
          },
          then(resolve: (v: { data: Row[] | null; error: null }) => void) {
            const row = eqVal != null ? rows.get(eqVal) : undefined;
            const match = !!row && (statuses.length === 0 || statuses.includes(row.status));
            if (match && updatePayload) {
              row.status = updatePayload.status as string;
            }
            resolve({ data: match && row ? [row] : null, error: null });
          },
        };
        return api;
      },
    },
  };
}

test("claimForProcessing claims a queued row exactly once (second caller loses)", async () => {
  const db = fakeDb();
  db.rows.set("n1", { id: "n1", status: "queued" });
  const repo = new NotificationHistoryRepository(asRepoDb(db));

  const first = await repo.claimForProcessing("n1");
  const second = await repo.claimForProcessing("n1");

  assert.equal(first, true);
  assert.equal(second, false, "already-processing row must not be re-claimed");
  assert.equal(db.rows.get("n1")!.status, "processing");
});

test("claimForProcessing ignores sent/failed rows", async () => {
  const db = fakeDb();
  db.rows.set("n2", { id: "n2", status: "sent" });
  const repo = new NotificationHistoryRepository(asRepoDb(db));

  const result = await repo.claimForProcessing("n2");
  assert.equal(result, false);
  assert.equal(db.rows.get("n2")!.status, "sent");
});

test("claimForProcessing claims retrying rows (retry path)", async () => {
  const db = fakeDb();
  db.rows.set("n3", { id: "n3", status: "retrying" });
  const repo = new NotificationHistoryRepository(asRepoDb(db));

  const result = await repo.claimForProcessing("n3");
  assert.equal(result, true);
  assert.equal(db.rows.get("n3")!.status, "processing");
});

test("claimForProcessing is a no-op for unknown id", async () => {
  const db = fakeDb();
  const repo = new NotificationHistoryRepository(asRepoDb(db));
  const result = await repo.claimForProcessing("nope");
  assert.equal(result, false);
});