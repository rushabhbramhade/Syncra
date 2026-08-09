import { test } from "node:test";
import assert from "node:assert/strict";
import { singleFlight, dedupeKey, isInFlight, pendingRequestCount } from "../lib/single-flight";

/**
 * Regression: the AI Draft flow must never fire duplicate generations or sends.
 * Concurrent invocations of the same logical key share ONE promise; a fresh
 * call after settlement runs again. Keys are deterministic and stable.
 */

test("dedupeKey is deterministic and ignores empty parts", () => {
  const a = dedupeKey(["draft", "user-1", "gmail", "Reply to Sarah", ""]);
  const b = dedupeKey(["draft", "user-1", "gmail", "Reply to Sarah", null]);
  assert.equal(a, b, "empty/null parts must not change the key");
  assert.equal(a, dedupeKey(["draft", "user-1", "gmail", "Reply to Sarah"]));
});

test("dedupeKey: distinct inputs produce distinct keys", () => {
  assert.notEqual(
    dedupeKey(["draft", "user-1", "gmail", "say hi"]),
    dedupeKey(["draft", "user-1", "gmail", "say bye"])
  );
  assert.notEqual(
    dedupeKey(["draft", "user-1", "gmail", "say hi"]),
    dedupeKey(["draft", "user-2", "gmail", "say hi"]),
    "users must never share a flight"
  );
});

test("single-flight: two concurrent identical calls share ONE invocation", async () => {
  let runs = 0;
  const work = async () => { runs += 1; await new Promise((r) => setTimeout(r, 20)); return "ok"; };
  const key = dedupeKey(["test", "single"]);

  const [r1, r2, r3] = await Promise.all([
    singleFlight(key, work),
    singleFlight(key, work),
    singleFlight(key, work),
  ]);

  assert.equal(r1, "ok");
  assert.equal(r2, "ok");
  assert.equal(r3, "ok");
  assert.equal(runs, 1, "three concurrent identical calls must invoke work exactly once");
  assert.equal(isInFlight(key), false, "key must be released after settlement");
  assert.equal(pendingRequestCount(), 0);
});

test("single-flight: a repeat call AFTER completion re-runs", async () => {
  let runs = 0;
  const work = async () => { runs += 1; return runs; };
  const key = dedupeKey(["test", "sequenced"]);

  const first = await singleFlight(key, work);
  const second = await singleFlight(key, work);

  assert.equal(first, 1);
  assert.equal(second, 2, "a subsequent identical click is a real new request and must run");
});

test("single-flight: concurrent duplicate click does not double-fire (draft scenario)", async () => {
  let aiCalls = 0;
  const generateDraft = async () => {
    aiCalls += 1;
    await new Promise((r) => setTimeout(r, 10));
    return { success: true, draft: "Hi!" };
  };

  const key = dedupeKey(["draft", "user-1", "gmail", "Reply to the roadmap email"]);
  const results = await Promise.all(new Array(8).fill(null).map(() => singleFlight(key, generateDraft)));

  assert.equal(aiCalls, 1, "rapid repeated clicks must share one AI call");
  for (const r of results) assert.deepEqual(r, { success: true, draft: "Hi!" });
});

test("single-flight: failure propagates to all waiters and releases the key", async () => {
  let runs = 0;
  const work = async () => { runs += 1; throw new Error("boom"); };
  const key = dedupeKey(["test", "failure"]);

  const results = await Promise.allSettled([singleFlight(key, work), singleFlight(key, work)]);

  assert.equal(runs, 1);
  assert.equal(results[0].status, "rejected");
  assert.equal(results[1].status, "rejected");
  assert.equal(isInFlight(key), false, "failed flight must still release the key");
});

test("single-flight: distinct keys run independently in parallel", async () => {
  let active = 0;
  let maxActive = 0;
  const work = async () => { active += 1; maxActive = Math.max(maxActive, active); await new Promise((r) => setTimeout(r, 15)); active -= 1; return "x"; };

  await Promise.all([
    singleFlight(dedupeKey(["k1"]), work),
    singleFlight(dedupeKey(["k2"]), work),
    singleFlight(dedupeKey(["k3"]), work),
  ]);

  assert.equal(maxActive, 3, "unrelated requests must NOT be serialized");
});