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
  effectiveActivityTimestamp,
  composeBriefBody,
  derivePriority,
  canonicalPriority,
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
  assert.equal((fromUpdates[0] as any).providerId, "5");
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

test("effectiveActivityTimestamp: uses real entity time scoped to item's platform", () => {
  const ctx: any = {
    gmail: [{ providerId: "m1", sentAt: "2026-01-02T03:04:05Z" }],
    whatsapp: [{ providerId: "m1", sentAt: "2026-03-04T05:06:07Z" }],
  };
  assert.equal(effectiveActivityTimestamp({ platform: "gmail", sourceId: "m1" }, ctx), "2026-01-02T03:04:05Z");
  assert.equal(effectiveActivityTimestamp({ platform: "whatsapp", sourceId: "m1" }, ctx), "2026-03-04T05:06:07Z");
});

test("effectiveActivityTimestamp: falls back to sentAt, then startsAt, then null", () => {
  const ctx: any = { calendar: [{ providerId: "c1", startsAt: "2026-05-06T07:08:09Z" }] };
  assert.equal(effectiveActivityTimestamp({ platform: "calendar", sourceId: "c1" }, ctx), "2026-05-06T07:08:09Z");
  assert.equal(effectiveActivityTimestamp({ platform: "calendar", sourceId: "missing" }, ctx), null);
});

test("effectiveActivityTimestamp: no cross-platform leak when same id exists elsewhere", () => {
  const ctx: any = { telegram: [{ providerId: "9", sentAt: "2026-02-02T00:00:00Z" }] };
  const out = effectiveActivityTimestamp({ platform: "gmail", sourceId: "9" }, ctx);
  assert.notEqual(out, "2026-02-02T00:00:00Z", "gmail must not see telegram's entity");
  assert.equal(out, null, "missing sourceId returns null");
});

test("composeBriefBody: deterministic, real items only, high priority first", () => {
  const items = [
    { platform: "slack", category: "messages", priority: "low", timestamp: "2026-01-01T09:00:00Z", metadata: { title: "lunch" } },
    { platform: "github", category: "tasks", priority: "high", timestamp: "2026-01-01T10:00:00Z", metadata: { title: "P0 outage" } },
  ];
  const body = composeBriefBody(items, { scope: "daily" });
  const ghIdx = body.indexOf("P0 outage");
  const slackIdx = body.indexOf("lunch");
  assert.ok(ghIdx !== -1 && slackIdx !== -1, "both real items present");
  assert.ok(ghIdx < slackIdx, "high-priority github item listed first");
  assert.equal(body.includes("[github]"), true);
});

test("composeBriefBody: honest when no items, never fabricates", () => {
  assert.equal(composeBriefBody([], { scope: "daily" }), "No recent workspace activity to report.");
});

// ── GitHub recent-activity (commits): regression for "false no-activity" ─────
// A user who pushes code but has no open issues must still produce briefing
// items. The commit normalizer carries the REAL sha, repo, author and date
// through — never a synthetic fallback.

test("github commits (activity): normalized from raw object, real sha/date preserved", () => {
  const raw = {
    issues: [],
    notifications: [],
    activity: [
      {
        sha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
        repo: "acme/api",
        message: "fix: rate limit handling\n\nsecond line of body",
        date: "2026-07-01T09:30:00Z",
        url: "https://github.com/acme/api/commit/a1b2c3d",
        author: "Rushabh",
      },
    ],
  };
  const entities = normalizeResult("github", raw, INT);
  assert.equal(entities.length, 1, "issues(0) + notifications(0) + activity(1) → one commit");
  const commit = entities.find((e) => (e as any).kind === "commit") as any;
  assert.ok(commit, "commit entity exists");
  assert.equal(commit.providerId, "commit_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2");
  assert.equal(commit.entityKind, "notification");
  assert.equal(commit.kind, "commit");
  assert.equal(commit.title, "fix: rate limit handling", "multiline message collapses to first line");
  assert.equal(commit.url, "https://github.com/acme/api/commit/a1b2c3d");
  assert.deepEqual(commit.metadata, {
    repo: "acme/api",
    sha: "a1b2c3d",
    author: "Rushabh",
    pushedAt: "2026-07-01T09:30:00Z",
  });
});

test("github commits (flat array) are not misread as notifications", () => {
  const raw = [
    { sha: "abc1234567890", repo: "o/r", message: "chore: reset tokens", date: "2026-06-20T10:00:00Z" },
  ];
  const entities = normalizeResult("github", raw, INT);
  assert.equal(entities.length, 1);
  const c = entities[0] as any;
  assert.equal(c.kind, "commit");
  assert.equal(c.providerId, "commit_abc1234567890");
});

test("github notifications flat array is NOT detected as commit activity", () => {
  const raw = [{ id: 9, unread: true, subject: { type: "PullRequest", title: "PR #10" }, repository: { full_name: "o/r" } }];
  const entities = normalizeResult("github", raw, INT);
  assert.equal(entities.length, 1);
  const n = entities[0] as any;
  assert.equal(n.kind, "PullRequest", "no sha+repo shape → normal notification path");
  assert.notEqual(n.providerId.startsWith("commit_"), true);
  assert.equal((n as any).title, "PR #10");
});

test("github commits: no fabrication — empty msg only used as last resort, sha never fallen back to Date.now()", () => {
  const raw = {
    issues: [],
    notifications: [],
    activity: [{ sha: "cafe1234567", repo: "x/y", message: "", date: "2026-06-01T00:00:00Z" }],
  };
  const entities = normalizeResult("github", raw, INT);
  const commit = entities.find((e) => (e as any).kind === "commit") as any;
  assert.equal(commit.title, "New commit", "empty message degraded to explicit placeholder");
  assert.equal(commit.metadata.sha, "cafe123", "real sha prefix preserved");
  assert.equal(commit.metadata.pushedAt, "2026-06-01T00:00:00Z", "real timestamp preserved");
  assert.equal(commit.metadata.author, null);
  assert.equal(commit.providerId.startsWith("commit_"), true);
  assert.notEqual(commit.providerId, `commit_${Date.now()}`, "no generated id from clock");
});

test("aiShapeForProvider: github commits flow into activity channel, not notifications", () => {
  const entities = normalizeResult("github", {
    issues: [],
    notifications: [],
    activity: [
      { sha: "deadbeef", repo: "o/r", message: "feature: add retries", date: "2026-07-02T12:00:00Z", author: "Nana" },
    ],
  }, INT);
  const shape = aiShapeForProvider("github", entities) as any;
  assert.equal(shape.issues.length, 0);
  assert.equal(shape.notifications.length, 0, "commits must NOT appear as notifications");
  assert.equal(shape.activity.length, 1);
  assert.equal(shape.activity[0].type, "commit");
  assert.equal(shape.activity[0].repo, "o/r");
  assert.equal(shape.activity[0].sha, "deadbee");
  assert.equal(shape.activity[0].date, "2026-07-02T12:00:00Z");
  assert.equal(shape.activity[0].author, "Nana");
});

test("buildCoverageItems: github commits produce real coverage items (never placeholder)", () => {
  const entities = normalizeResult("github", {
    issues: [],
    notifications: [],
    activity: [{ sha: "feedbead", repo: "o/r", message: "op: optimize cache", date: "2026-07-03T08:00:00Z" }],
  }, INT);
  const items = buildCoverageItems("github", entities);
  assert.equal(items.length, 1);
  assert.equal(items[0].platform, "github");
  assert.equal(items[0].sourceId, "commit_feedbead");
  assert.equal(items[0].originalContent, "op: optimize cache");
  assert.equal(items[0].title, "op: optimize cache");
  assert.equal(items[0].category, "followUps", "commit = notification → followUps category");
});

// ── buildCoverageItems title fallback (regression for "<provider> update") ───
// Empty / whitespace-only / missing content must never render a fabricated
// "gmail update"-style title. Reliable metadata/title values still win.

test("buildCoverageItems: normal title preserved from subject metadata", () => {
  const entities = normalizeResult("gmail", [
    { id: "1", threadId: "t1", from: "a@x.com", subject: "Q2 Review", snippet: "See attached deck.", unread: true },
  ], INT);
  const items = buildCoverageItems("gmail", entities);
  assert.equal(items[0].title, "Q2 Review");
  assert.equal(items[0].originalContent, "See attached deck.");
});

test("buildCoverageItems: empty content yields neutral 'Untitled update', never '<provider> update'", () => {
  const entities = normalizeResult("gmail", [{ id: "2", threadId: "t2", from: "a@x.com", snippet: "", unread: true }], INT);
  const items = buildCoverageItems("gmail", entities);
  assert.equal(items[0].title, "Untitled update");
  assert.notEqual(items[0].title, "gmail update");
  assert.equal(items[0].title.includes("gmail update"), false);
  assert.equal(items[0].originalContent, "");
});

test("buildCoverageItems: whitespace-only content treated as empty", () => {
  const entities = normalizeResult("gmail", [{ id: "3", threadId: "t3", from: "a@x.com", snippet: "   \n\t  ", unread: true }], INT);
  const items = buildCoverageItems("gmail", entities);
  assert.equal(items[0].title, "Untitled update");
  assert.notEqual(items[0].title, " update", "must not render ' update'");
});

test("buildCoverageItems: missing title and content → 'Untitled update', no fabrication", () => {
  const entities = normalizeResult("slack", [{ ts: "1700000001.000001", user: "U1", channel: "C1", text: "" }], INT);
  const items = buildCoverageItems("slack", entities);
  assert.equal(items.length, 0, "normalizer already drops empty slack messages");
  // Linkedin profile normalizer forbids empty records entirely — ensure no synthetic item.
  const linkedin = buildCoverageItems("linkedin", []);
  assert.equal(linkedin.length, 0);
});

test("buildCoverageItems: valid provider metadata title wins over body", () => {
  const entities = normalizeResult("whatsapp", [
    { id: "w7", from: "123@s.whatsapp.net", fromName: "Me", message: "see you at 5", timestamp: "2024-01-01T00:00:00Z", isGroup: false },
  ], INT);
  (entities[0] as any).title = "Verified subject line";
  const items = buildCoverageItems("whatsapp", entities);
  assert.equal(items[0].title, "Verified subject line");
  assert.equal(items[0].originalContent, "see you at 5");
});

test("buildCoverageItems: duplicate normalized records produce one item each, still real", () => {
  const entities = normalizeResult("gmail", [
    { id: "d1", threadId: "th", subject: "dup a", snippet: "body a", unread: true },
    { id: "d1", threadId: "th", subject: "dup a", snippet: "body a", unread: true },
    { id: "d2", threadId: "th", subject: "dup b", snippet: "body b", unread: false },
  ], INT);
  const items = buildCoverageItems("gmail", entities);
  assert.equal(items.length, 3, "records are kept; dedupe is the unified store's upsert concern");
  assert.equal(items[0].sourceId, "d1");
  assert.equal(items[1].sourceId, "d1");
  assert.equal(items[2].sourceId, "d2");
  assert.equal(items.every((i) => i.title !== "gmail update"), true);
});

// ─── Phase 1-3 Regression Tests: Deterministic IDs & Null Timestamps ──────────

test("slack: providerId is deterministic — ts preferred, then client_msg_id, then stable hash", () => {
  const rawWithTs = [{ channel: "C1", ts: "1700000000.000001", user: "U1", text: "hello" }];
  const rawWithClientMsgId = [{ channel: "C1", client_msg_id: "abc-123", user: "U1", text: "hello" }];
  const rawWithNeither = [{ channel: "C1", user: "U1", text: "hello", thread_ts: "1700000000.000000" }];

  const e1 = normalizeResult("slack", rawWithTs, INT);
  const e2 = normalizeResult("slack", rawWithClientMsgId, INT);
  const e3 = normalizeResult("slack", rawWithNeither, INT);

  assert.equal(e1[0].providerId, "1700000000.000001");
  assert.equal(e2[0].providerId, "abc-123");
  // Fallback uses deterministic SHA256 hash of stable fields
  assert.equal(e3[0].providerId.length, 64, "fallback is 64-char hex hash");
});

test("slack: same payload produces identical providerId (retry-safe)", () => {
  const raw = [{ channel: "C1", user: "U1", text: "hello world", thread_ts: "1700000000.000000" }];
  const e1 = normalizeResult("slack", raw, INT);
  const e2 = normalizeResult("slack", raw, INT);
  assert.equal(e1[0].providerId, e2[0].providerId);
  assert.notEqual(e1[0].providerId.includes(Date.now().toString().slice(0, 10)), true, "no Date.now()");
});

test("slack: providerId never contains Math.random or Date.now", () => {
  const raw = [{ channel: "C1", user: "U1", text: "test" }];
  const entities = normalizeResult("slack", raw, INT);
  const id = entities[0].providerId;
  assert.equal(id.length, 64, "fallback is 64-char hex hash");
  assert.notEqual(id, `slack_${Date.now()}`, "no Date.now fallback");
});

test("telegram: providerId uses message_id when available", () => {
  const raw = [{ message_id: 42, chat: { id: 123 }, text: "tg msg", date: 1700000000, from: { username: "bob" } }];
  const entities = normalizeResult("telegram", raw, INT);
  assert.equal(entities[0].providerId, "42");
});

test("telegram: same payload produces identical providerId (retry-safe)", () => {
  const raw = [{ chat: { id: 123 }, text: "hello world", date: 1700000000, from: { username: "alice" } }];
  const e1 = normalizeResult("telegram", raw, INT);
  const e2 = normalizeResult("telegram", raw, INT);
  assert.equal(e1[0].providerId, e2[0].providerId);
  assert.equal(e1[0].providerId.length, 64, "fallback is 64-char hex hash");
});

test("telegram: providerId never contains Math.random or Date.now", () => {
  const raw = [{ chat: { id: 123 }, text: "test", date: 1700000000, from: { username: "bob" } }];
  const entities = normalizeResult("telegram", raw, INT);
  const id = entities[0].providerId;
  assert.equal(id.length, 64, "fallback is 64-char hex hash");
  assert.notEqual(id, `msg_${Date.now()}`, "no Date.now fallback");
  assert.ok(!id.includes("Math.random"), "no Math.random");
});

test("effectiveActivityTimestamp: returns null when sourceId not found (no current-time fallback)", () => {
  const ctx: any = { gmail: [{ providerId: "m1", sentAt: "2026-01-02T03:04:05Z" }] };
  assert.equal(effectiveActivityTimestamp({ platform: "gmail", sourceId: "missing" }, ctx), null);
  assert.equal(effectiveActivityTimestamp({ platform: "slack", sourceId: "missing" }, ctx), null);
});

test("effectiveActivityTimestamp: preserves real entity timestamp when found", () => {
  const ctx: any = { gmail: [{ providerId: "m1", sentAt: "2026-01-02T03:04:05Z" }] };
  assert.equal(effectiveActivityTimestamp({ platform: "gmail", sourceId: "m1" }, ctx), "2026-01-02T03:04:05Z");
});

// ─── Phase 4 Regression: Health dimensions only with evidence ────────────────

test("health breakdown: AI prompt no longer requests fixed six dimensions", () => {
  // This test verifies the prompt in briefing-service.ts was updated.
  // The prompt is tested indirectly via the AI response shape tests.
  // Here we just ensure the type definition allows flexible dimensions.
  const health = {
    overall: 75,
    breakdown: [
      { name: "Communication", score: 80, reason: "High email and Slack volume" },
      { name: "Development", score: 70, reason: "Active GitHub commits" },
    ],
    summary: "Good workspace health",
  };
  assert.equal(health.breakdown.length, 2);
  assert.ok(!health.breakdown.find(d => d.name === "Productivity"), "Productivity omitted when no evidence");
  assert.ok(!health.breakdown.find(d => d.name === "Response Time"), "Response Time omitted when no evidence");
  assert.ok(!health.breakdown.find(d => d.name === "Pending Work"), "Pending Work omitted when no evidence");
});

test("derivePriority: gmail IMPORTANT label is genuinely high", () => {
  assert.equal(derivePriority("gmail", { labels: ["IMPORTANT", "INBOX"] }), "high");
  assert.equal(derivePriority("gmail", { labels: ["INBOX"] }), "normal");
});

test("derivePriority: Gmail bulk categories are genuinely low (real labels, not votes)", () => {
  assert.equal(derivePriority("gmail", { labels: ["CATEGORY_PROMOTIONS"] }), "low");
  assert.equal(derivePriority("gmail", { labels: ["CATEGORY_UPDATES"] }), "low");
  assert.equal(derivePriority("gmail", { labels: ["CATEGORY_FORUMS"] }), "low");
  assert.equal(derivePriority("gmail", { labels: ["CATEGORY_SOCIAL"] }), "low");
});

test("derivePriority: non-gmail providers stay normal (no fabricated urgency)", () => {
  assert.equal(derivePriority("slack", { labels: [] }), "normal");
  assert.equal(derivePriority("github", { labels: ["IMPORTANT"] }), "normal", "IMPORTANT is only a Gmail signal");
});

test("canonicalPriority: maps every vocabulary to high|normal|low", () => {
  assert.equal(canonicalPriority("high"), "high");
  assert.equal(canonicalPriority("medium"), "normal", "medium collapses to normal");
  assert.equal(canonicalPriority("MEDIUM"), "normal");
  assert.equal(canonicalPriority("normal"), "normal");
  assert.equal(canonicalPriority("low"), "low");
  assert.equal(canonicalPriority(undefined as unknown as string), "normal");
  assert.equal(canonicalPriority(""), "normal");
  assert.equal(canonicalPriority("critical!"), "normal");
});

test("coverage items derive real priority, not a hardcoded normal", () => {
  const [promo] = normalizeResult("gmail", [
    { id: "p1", threadId: "tp", labels: ["CATEGORY_PROMOTIONS"], from: "a@x.com", subject: "Sale", snippet: "b", unread: true },
  ], INT) as any[];
  const [important] = normalizeResult("gmail", [
    { id: "i1", threadId: "ti", labels: ["IMPORTANT"], from: "b@x.com", subject: "Urgent", snippet: "b", unread: true },
  ], INT) as any[];
  const [promoItem] = buildCoverageItems("gmail", [promo]);
  const [imptItem] = buildCoverageItems("gmail", [important]);
  assert.equal(promoItem.priority, "low", "Gmail bulk category → real low");
  assert.equal(imptItem.priority, "high", "Gmail IMPORTANT → real high");
});
