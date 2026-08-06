/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeResult,
  aiShapeForProvider,
  countItems,
  emptyHealth,
  computeQuality,
  buildManifest,
  buildCoverageItems,
  filterGroundedItems,
  classifyProviderStatus,
} from "../lib/briefing/pipeline.ts";

const INT = "integration-test-id";

test("gmail: normalizes summaries, keeps subject/from, ai shape carries text", () => {
  const raw = [
    { id: "1", threadId: "t1", from: "a@x.com", to: "me", subject: "Hi", snippet: "body here", unread: true },
    { id: "2", threadId: "t2", from: "b@x.com", to: "me", subject: "Re: plan", snippet: "ok", unread: false },
  ];
  const entities = normalizeResult("gmail", raw, INT);
  assert.equal(entities.length, 2);
  const [m1, m2] = entities as any[];
  assert.equal(m1.entityKind, "message");
  assert.equal(m1.providerId, "1");
  assert.equal(m1.metadata.subject, "Hi");
  assert.equal(m1.metadata.unread, true);
  assert.equal(m2.metadata.subject, "Re: plan");
  const shape = aiShapeForProvider("gmail", entities) as any[];
  assert.equal(shape.length, 2);
  assert.ok(shape[0].text.includes("Hi"));
  assert.equal(shape[0].sender, "a@x.com");
});

test("slack: drops empty-text messages (no silent fabrication), keeps real ones", () => {
  const raw = [
    { channel: "C1", ts: "1700000000.000001", user: "U1", text: "hello" },
    { channel: "C1", ts: "1700000000.000002", user: "U1", text: "" },
  ];
  const entities = normalizeResult("slack", raw, INT);
  assert.equal(entities.length, 1);
  assert.equal((entities[0] as any).bodyText, "hello");
  assert.equal((entities[0] as any).channelId, "C1");
});

test("telegram: handles both getUpdates payloads and stored webhook rows", () => {
  const rawUpdates = [
    { message_id: 5, chat: { id: 123 }, text: "tg msg", date: 1700000000, from: { username: "bob" } },
  ];
  const fromUpdates = normalizeResult("telegram", rawUpdates, INT);
  assert.equal(fromUpdates.length, 1);
  assert.equal((fromUpdates[0] as any).providerId, "msg_5");
  assert.equal((fromUpdates[0] as any).channelId, "123");

  const storedRows = [
    { provider_message_id: "msg_7", body_text: "stored", channel_id: "456", sent_at: "2024-01-01T00:00:00Z", metadata: {} },
  ];
  const fromStore = normalizeResult("telegram", storedRows, INT);
  assert.equal(fromStore.length, 1);
  assert.equal((fromStore[0] as any).bodyText, "stored");
  assert.equal((fromStore[0] as any).providerId, "msg_7");
});

test("discord: normalizes content + embeds", () => {
  const raw = [
    { id: "d1", channelId: "ch1", author: "alice", content: "hi", timestamp: "2024-01-01T00:00:00Z", guildName: "g", channelName: "c", embeds: ["title — desc"], mentions: ["bob"], replyTo: "d0" },
  ];
  const entities = normalizeResult("discord", raw, INT);
  assert.equal(entities.length, 1);
  const m = entities[0] as any;
  assert.ok(m.bodyText.includes("hi"));
  assert.equal(m.metadata.mentions.length, 1);
  assert.equal(m.metadata.embeds, 1);
});

test("whatsapp: normalizes cache messages, marks groups", () => {
  const raw = [
    { id: "w1", from: "123@s.whatsapp.net", fromName: "Me", message: "wa msg", timestamp: "2024-01-01T00:00:00Z", isGroup: false },
    { id: "w2", from: "g@s.whatsapp.net", fromName: "Alice", message: "group msg", timestamp: "2024-01-01T00:00:01Z", isGroup: true, senderName: "Alice" },
  ];
  const entities = normalizeResult("whatsapp", raw, INT);
  assert.equal(entities.length, 2);
  assert.equal((entities[1] as any).metadata.isGroup, true);
});

test("github: issues→tasks, notifications→notifications, ai shape splits", () => {
  const raw = {
    issues: [{ id: 1, number: 7, title: "bug", state: "open", html_url: "http://x/7", repository: { full_name: "o/r" } }],
    notifications: [{ id: 9, unread: true, subject: { type: "PullRequest", title: "PR title" }, repository: { full_name: "o/r" } }],
  };
  const entities = normalizeResult("github", raw, INT);
  assert.equal(entities.length, 2);
  const shape = aiShapeForProvider("github", entities) as any;
  assert.equal(shape.issues.length, 1);
  assert.equal(shape.notifications.length, 1);
  assert.equal(shape.issues[0].state, "open");
});

test("linkedin: profile → single notification entity", () => {
  const raw = [{ sub: "abc", name: "Jane", email: "j@x.com" }];
  const entities = normalizeResult("linkedin", raw, INT);
  assert.equal(entities.length, 1);
  const n = entities[0] as any;
  assert.equal(n.entityKind, "notification");
  assert.ok(n.title.includes("Jane"));
});

test("countItems: arrays sum, nested objects recurse", () => {
  assert.equal(countItems([1, 2, 3]), 3);
  assert.equal(countItems({ issues: [1], notifications: [1, 2] }), 3);
  assert.equal(countItems("nope"), 0);
});

test("computeQuality: Healthy / No data / Error labels", () => {
  const full = { ...emptyHealth(true), fetched: 5, normalized: 5, saved: 5, aiUsed: 5 };
  assert.equal(computeQuality(full).label, "Healthy");
  assert.equal(computeQuality(emptyHealth(true)).label, "No data");
  const broken = { ...emptyHealth(true), fetched: 5, normalized: 0, error: "normalization returned 0 items" };
  assert.equal(computeQuality(broken).label, "Error");
});

test("fail-fast: unknown provider / malformed payload → 0 entities (never guessed)", () => {
  assert.equal(normalizeResult("unknown-provider", [{}], INT).length, 0);
  assert.equal(normalizeResult("gmail", { not: "an array" }, INT).length, 0);
});

test("buildManifest: human-readable coverage summary from health report", () => {
  const report = {
    gmail: { ...emptyHealth(true), aiUsed: 2 },
    github: { ...emptyHealth(true), aiUsed: 1 },
  };
  const manifest = buildManifest(report);
  assert.ok(manifest.includes("gmail: 2 items"));
  assert.ok(manifest.includes("github: 1 item"));
});

test("buildCoverageItems: real items from normalized records, never placeholder", () => {
  const raw = [
    { id: "1", threadId: "t1", from: "a@x.com", to: "me", subject: "Hi", snippet: "body here", unread: true },
    { id: "2", threadId: "t1", from: "a@x.com", to: "me", subject: "Re: Hi", snippet: "follow up", unread: false },
  ];
  const entities = normalizeResult("gmail", raw, INT);
  const items = buildCoverageItems("gmail", entities);
  assert.equal(items.length, 2);
  assert.equal(items[0].platform, "gmail");
  assert.equal(items[0].category, "email");
  assert.equal(items[0].title, "Hi");
  assert.equal(items[0].sourceId, "1");
  assert.equal(items[0].from, "a@x.com");
  assert.equal(items[0].originalContent, "body here");
});

test("buildCoverageItems: message records map to messages category", () => {
  const raw = [{ id: "w1", from: "123@s.whatsapp.net", fromName: "Me", message: "see you at 5", timestamp: "2024-01-01T00:00:00Z", isGroup: false }];
  const entities = normalizeResult("whatsapp", raw, INT);
  const items = buildCoverageItems("whatsapp", entities);
  assert.equal(items.length, 1);
  assert.equal(items[0].category, "messages");
  assert.equal(items[0].originalContent, "see you at 5");
});

test("filterGroundedItems: drops items for platforms with no data (anti-hallucination)", () => {
  const context = {
    gmail: [{}, {}],
    slack: [{}],
  };
  // AI fabricated a GitHub and an over-count Slack item — both must be removed.
  const items = [
    { platform: "gmail", title: "real gmail" },
    { platform: "github", title: "PR #42" },
    { platform: "slack", title: "slack a" },
    { platform: "slack", title: "slack b" },
    { platform: "slack", title: "slack c" },
  ];
  const { grounded, droppedPlatforms } = filterGroundedItems(items, context);
  assert.deepEqual(droppedPlatforms, ["github"]);
  const platforms = grounded.map((i) => i.platform);
  assert.ok(!platforms.includes("github"), "fabricated platform removed");
  assert.equal(platforms.filter((p) => p === "slack").length, 1, "cannot exceed real record count per provider");
  assert.equal(platforms.filter((p) => p === "gmail").length, 1);
});

test("filterGroundedItems: keeps providers with data, drops placeholder-only", () => {
  const context = { gmail: [{}, {}] };
  const items = [
    { platform: "gmail", title: "real" },
    { platform: "notion", title: "Quarterly Financial Update" },
    { platform: "calendar", title: "Meeting Follow-Up" },
  ];
  const { grounded } = filterGroundedItems(items, context);
  assert.deepEqual(grounded.map((i) => i.platform), ["gmail"]);
});

test("filterGroundedItems (requireTraceable): drops AI items with no matching synchronized entity", () => {
  const context = {
    github: [{ providerId: "GH-1" }, { providerId: "GH-2" }],
    slack: [{ providerId: "S-1" }],
  };
  const items = [
    { platform: "github", title: "real issue", sourceId: "GH-1" },
    { platform: "github", title: "invented PR #99", sourceId: "PR-99" },
    { platform: "github", title: "no source id", sourceId: null },
    { platform: "slack", title: "real slack", sourceId: "S-1" },
  ];
  const { grounded, droppedUntraceable } = filterGroundedItems(items, context, { requireTraceable: true });
  assert.deepEqual(grounded.map((i) => i.title), ["real issue", "real slack"]);
  assert.equal(droppedUntraceable.length, 2, "invented + missing sourceId dropped");
});

test("filterGroundedItems (requireTraceable): correlationKey traces via metadata.threadId", () => {
  const context = { whatsapp: [{ providerId: "W-1", metadata: { threadId: "t-42" } }] };
  const items = [
    { platform: "whatsapp", title: "traceable via thread", sourceId: null, correlationKey: "t-42" },
    { platform: "whatsapp", title: "untraceable thread", sourceId: null, correlationKey: "t-999" },
  ];
  const { grounded, droppedUntraceable } = filterGroundedItems(items, context, { requireTraceable: true });
  assert.deepEqual(grounded.map((i) => i.title), ["traceable via thread"]);
  assert.equal(droppedUntraceable.length, 1);
});

test("classifyProviderStatus: stale-scope Slack token → Permission Missing + reconnect", () => {
  const s = classifyProviderStatus({ ...emptyHealth(true), error: "Slack API error: missing_scope" });
  assert.equal(s.status, "permission_missing");
  assert.equal(s.reconnect, true);
});

test("classifyProviderStatus: auth failures → Authentication Failed + reconnect", () => {
  for (const msg of ["token is corrupted. Please reconnect", "Token refresh failed: invalid_grant", "401 Unauthorized"]) {
    const s = classifyProviderStatus({ ...emptyHealth(true), error: msg });
    assert.equal(s.status, "authentication_failed", msg);
    assert.equal(s.reconnect, true, msg);
  }
});

test("classifyProviderStatus: rate limits → Rate Limited, no reconnect", () => {
  const s = classifyProviderStatus({ ...emptyHealth(true), error: "Rate limit exceeded: 429" });
  assert.equal(s.status, "rate_limited");
  assert.equal(s.reconnect, false);
});

test("classifyProviderStatus: stage counts derive healthy/partial/no-activity", () => {
  assert.equal(classifyProviderStatus({ ...emptyHealth(true), fetched: 5, normalized: 5, aiUsed: 5 }).status, "healthy");
  assert.equal(classifyProviderStatus({ ...emptyHealth(true), fetched: 5, normalized: 0 }).status, "partial");
  assert.equal(classifyProviderStatus(emptyHealth(true)).status, "no_recent_activity");
});
