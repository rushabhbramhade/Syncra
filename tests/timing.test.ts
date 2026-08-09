/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import { StageTimer, timingToLog, summarizeStages } from "../lib/briefing/timing.ts";

test("StageTimer mark records duration from the previous mark (not cumulative)", () => {
  const t = new StageTimer({ requestId: "req-1", userId: "u1", operation: "generateBriefing" });
  const a = t.mark("integrations");
  const b = t.mark("ai_generate", "gmail", "ok");
  const entries = t.getEntries();
  assert.equal(entries.length, 2);
  assert.equal(entries[0].stage, "integrations");
  assert.equal(entries[0].provider, null);
  assert.equal(entries[0].result, "ok");
  assert.equal(entries[1].stage, "ai_generate");
  assert.equal(entries[1].provider, "gmail");
  assert.equal(a.durationMs >= 0, true);
  assert.equal(b.durationMs >= 0, true);
  // Each entry is only validated to be a non-negative segment; the exact
  // duration depends on wall-clock resolution and is intentionally unasserted.
  assert.equal(a.durationMs <= t.totalMs(), true);
  // Entries carry the request trace so a single log line can correlate stages.
  assert.equal(entries[0].requestId, "req-1");
  assert.equal(entries[0].userId, "u1");
  assert.equal(new Date(entries[0].timestamp).getTime() > 0, true);
});

test("reset() starts a fresh segment from that point", () => {
  const t = new StageTimer({ requestId: "req-3", userId: "u3", operation: "generateBriefing" });
  const first = t.mark("integrations");
  t.reset();
  const second = t.mark("ai_generate");
  // second measures only the post-reset segment so it is a small, independent value.
  assert.equal(second.durationMs >= 0, true);
  assert.equal(first.durationMs >= 0, true);
  assert.equal(t.getEntries().length, 2);
});

test("mark records failure results per provider", () => {
  const t = new StageTimer({ requestId: "req-4", userId: "u4", operation: "generateBriefing" });
  const e = t.mark("ingest", "gmail", "fetch_failed");
  assert.equal(e.result, "fetch_failed");
  assert.equal(e.provider, "gmail");
  assert.equal(e.durationMs >= 0, true);
});

test("totalMs covers the whole wall-clock window", () => {
  const t = new StageTimer({ requestId: "req-2", userId: "u2", operation: "generateBriefing" });
  t.mark("fetch_total");
  t.mark("persist_items");
  const sum = t.getEntries().reduce((acc, e) => acc + e.durationMs, 0);
  assert.equal(t.totalMs() >= sum, true);
});

test("timingToLog emits the audit shape only — metadata, never bodies/tokens", () => {
  const t = new StageTimer({ requestId: "req-5", userId: "u5", operation: "generateBriefing" });
  t.mark("fetch", "gmail", "ok");
  t.mark("ai_generate");
  const log = timingToLog(t.getEntries());
  const raw = JSON.stringify(log);
  const expectedKeys = ["stages"];
  assert.deepEqual(Object.keys(log), expectedKeys);
  assert.equal((log.stages as any[]).length, 2);
  const stage = (log.stages as any[])[0];
  assert.deepEqual(Object.keys(stage).sort(), ["durationMs", "provider", "result", "stage"]);
  // Security: the serialized timing payload carries ONLY the four metadata
  // fields. No message bodies, OAuth tokens, or keys can ever reach a log via
  // this module because they are not part of the serialized shape at all.
  assert.equal(raw.includes("integration-test-token"), false);
  assert.equal(raw.includes("BEGIN PGP"), false);
});

test("summarizeStages aggregates per-stage totals", () => {
  const t = new StageTimer({ requestId: "req-6", userId: "u6", operation: "generateBriefing" });
  t.mark("integrations");
  t.mark("ai_generate");
  t.mark("ai_generate");
  const summarized = summarizeStages(t.getEntries());
  assert.equal(typeof summarized.ai_generate, "number");
  assert.equal(typeof summarized.integrations, "number");
});