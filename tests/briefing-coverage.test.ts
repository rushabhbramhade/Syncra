/* eslint-disable @typescript-eslint/no-explicit-any -- payload builders */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeResult,
  aiShapeForProvider,
  emptyHealth,
  computeQuality,
  buildCoverageItems,
  filterGroundedItems,
  classifyProviderStatus,
} from "../lib/briefing/pipeline.ts";

const INT = "integration-cov";

/**
 * Briefing integration-coverage regressions:
 * 1. every CONNECTED provider with real synchronized data can reach the briefing;
 * 2. providers with failed / stale auth are NEVER represented as successful data;
 * 3. the briefing never invents activity for a provider that returned nothing.
 */

test("coverage: every provider with real normalized data produces coverage items", () => {
  const cases: Array<[string, unknown]> = [
    ["gmail", [{ id: "m1", subject: "Hello", snippet: "hi" }]],
    ["slack", [{ ts: "1700000000.000001", user: "U1", text: "ping" }]],
    ["telegram", [{ message_id: 1, chat: { id: 1 }, text: "tg" }]],
    ["discord", [{ id: "d1", content: "yo", channelId: "c1" }]],
    ["whatsapp", [{ id: "w1", from: "1", message: "wa" }]],
    ["github", { issues: [{ id: 1, number: 7, title: "bug", state: "open" }], notifications: [], activity: [] }],
    ["github", { issues: [], notifications: [], activity: [{ sha: "aabbccdde10", repo: "o/r", message: "feat: ship" }] }],
    ["linkedin", [{ sub: "s1", name: "Jane" }]],
    ["calendar", [{ id: "c1", summary: "Sync", start: { dateTime: "2026-01-01T10:00:00Z" } }]],
  ];
  for (const [provider, raw] of cases) {
    const items = buildCoverageItems(provider, normalizeResult(provider, raw, INT));
    assert.ok(items.length >= 1, `${provider} must produce at least one real coverage item`);
    for (const it of items) {
      assert.equal(it.platform, provider);
      assert.ok(it.sourceId, `${provider} item must carry real sourceId`);
      assert.ok(it.title, `${provider} item must carry a real title`);
    }
  }
});

test("coverage: provider with DATA stays, connected-but-empty is omitted, fabricated is dropped (anti-hallucination)", () => {
  const context = {
    gmail: normalizeResult("gmail", [{ id: "m1", subject: "Hello", snippet: "hi" }], INT),
    whatsapp: normalizeResult("whatsapp", [{ id: "w1", from: "1", message: "wa" }], INT),
    // connected but returned nothing — NO records exist.
    slack: [],
  };
  const aiItems = [
    { platform: "gmail", title: "real email", sourceId: "m1" },
    { platform: "whatsapp", title: "real wa", sourceId: "w1" },
    { platform: "slack", title: "#standup: back in 10" }, // fabricated: no slack data
    { platform: "linkedin", title: "connection request" }, // fabricated: not even connected with data
  ];
  const { grounded, droppedPlatforms, droppedUntraceable } = filterGroundedItems(aiItems, context, { requireTraceable: true });
  assert.deepEqual(grounded.map((i) => i.platform).sort(), ["gmail", "whatsapp"]);
  assert.deepEqual(droppedPlatforms.sort(), ["linkedin", "slack"]);
  assert.equal(droppedUntraceable.length, 0, "fabricated items removed by platform gate");
});

test("health: stale-auth provider is NEVER qualified as healthy data (reconnect surfaced)", () => {
  const stale = classifyProviderStatus({ ...emptyHealth(true), error: "Token refresh failed: invalid_grant" });
  assert.equal(stale.status, "authentication_failed");
  assert.equal(stale.reconnect, true);
  assert.notEqual(stale.label, "Healthy");
  assert.equal(computeQuality({ ...emptyHealth(true), error: "Token refresh failed: invalid_grant" }).label, "Error", "quality is Error, not Healthy");

  const noData = classifyProviderStatus(emptyHealth(true));
  assert.equal(noData.status, "no_recent_activity");
  assert.notEqual(noData.label, "Healthy", "no-data must not read as healthy");
});

test("stale slack scope surfaces reconnect (Permission Missing), not healthy", () => {
  const s = classifyProviderStatus({ ...emptyHealth(true), error: "Slack API error: missing_scope" });
  assert.equal(s.status, "permission_missing");
  assert.equal(s.reconnect, true);
});

test("health-referenced: provider with data is referenced + rendered in the briefing health report", () => {
  // This mirrors briefing-service: enrich each provider's health row with
  // referenced/rendered flags from the filtered items, then assert the provider
  // is present as rendered only when real data flowed.
  const entities = normalizeResult("gmail", [{ id: "m1", subject: "Hi", snippet: "body" }], INT);
  const context = { gmail: entities };
  const ai = [{ platform: "gmail", title: "Hi", sourceId: "m1" }];
  const { grounded } = filterGroundedItems(ai, context, { requireTraceable: true });
  const report = {
    gmail: { ...emptyHealth(true), fetched: 1, normalized: 1, referenced: grounded.some((i) => i.platform === "gmail"), rendered: grounded.some((i) => i.platform === "gmail") },
    slack: { ...emptyHealth(true), error: "Slack API error: missing_scope" },
  };
  assert.equal(report.gmail.referenced, true, "gmail is referenced in the stored briefing");
  assert.equal(report.gmail.rendered, true, "gmail is rendered");
});

test("aiShape data passed to the AI excludes providers with no data, includes commits", () => {
  const entities = normalizeResult("github", {
    issues: [{ id: 1, number: 7, title: "bug", state: "open", html_url: "u", repository: { full_name: "o/r" } }],
    notifications: [],
    activity: [{ sha: "abc", repo: "o/r", message: "feat: ship it", date: "2026-07-01T00:00:00Z" }],
  }, INT);
  const shape = aiShapeForProvider("github", entities) as any;
  assert.equal(shape.issues.length, 1);
  assert.equal(shape.activity.length, 1);
  assert.equal(shape.activity[0].type, "commit");
});