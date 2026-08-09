/* eslint-disable @typescript-eslint/no-explicit-any -- raw provider payload builders */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeResult,
  buildCoverageItems,
  enrichItemsWithRealEntity,
  resolveGmailReplyContext,
  extractGmailRecipient,
} from "../lib/briefing/pipeline.ts";
import {
  getGmailDeepLink,
  getGmailDeepLinkFromMetadata,
  buildGmailThreadUrl,
  buildGmailMessageUrl,
} from "../lib/google/gmail-links.ts";
import { RATE_LIMIT_BUCKETS, DRAFT_RATE_LIMIT_ERROR } from "../lib/rate-limit-config";
import { singleFlight, dedupeKey, isInFlight } from "../lib/single-flight";

const INT = "gmail-contract";
const RAW = {
  id: "msg-1042",
  threadId: "thread-8821",
  from: "Alice Zhang <alice@example.com>",
  to: "me@example.com",
  cc: "bob@example.com",
  subject: "Q3 Planning",
  snippet: "Let's finalize the roadmap.",
  body: "Attached is the Q3 plan draft.",
  rawDate: "2026-08-01T10:30:00Z",
  internalDate: "1780000000000",
  labels: ["IMPORTANT", "INBOX"],
  unread: true,
};

// ─── 1-6. Gmail normalization preserves real identifiers ────────────────────

test("gmail: normalization preserves messageId", () => {
  const [e] = normalizeResult("gmail", [RAW], INT) as any[];
  assert.equal(e.providerId, "msg-1042", "providerId is the provider's real message id");
  assert.equal(e.metadata.messageId, "msg-1042");
});

test("gmail: normalization preserves threadId", () => {
  const [e] = normalizeResult("gmail", [RAW], INT) as any[];
  assert.equal(e.channelId, "gmail:thread-8821");
  assert.equal(e.metadata.threadId, "thread-8821");
});

test("gmail: normalization preserves correlationKey when a thread exists (coverage item)", () => {
  const [e] = normalizeResult("gmail", [RAW], INT);
  const [item] = buildCoverageItems("gmail", [e]);
  assert.equal(item.correlationKey, "thread-8821", "coverage exposes threadId as correlationKey");
});

test("gmail: normalization preserves subject", () => {
  const [e] = normalizeResult("gmail", [RAW], INT) as any[];
  assert.equal(e.metadata.subject, "Q3 Planning");
});

test("gmail: normalization preserves sender/from", () => {
  const [e] = normalizeResult("gmail", [RAW], INT) as any[];
  assert.equal(e.metadata.from, "Alice Zhang <alice@example.com>");
  const [cover] = buildCoverageItems("gmail", [e]);
  assert.equal(cover.from, "Alice Zhang <alice@example.com>");
});

test("gmail: normalization preserves real timestamp (Date header wins over internalDate)", () => {
  const [e] = normalizeResult("gmail", [RAW], INT) as any[];
  assert.equal(e.sentAt, new Date("2026-08-01T10:30:00Z").toISOString());
  assert.equal(e.metadata.timestampMissing, false);
});

test("gmail: internalDate millis is used when rawDate is absent (still real)", () => {
  const [e] = normalizeResult("gmail", [{ ...RAW, rawDate: undefined }], INT) as any[];
  assert.equal(e.sentAt, new Date(1780000000000).toISOString());
  assert.equal(e.metadata.timestampMissing, false);
});

// ─── 7-9. Source URL from real identifiers only ──────────────────────────────

test("gmail: valid source URL when threadId exists (message deep-link)", () => {
  const [e] = normalizeResult("gmail", [RAW], INT);
  const [item] = buildCoverageItems("gmail", [e]);
  assert.equal(item.sourceUrl, buildGmailMessageUrl("msg-1042", "thread-8821"));
  assert.ok(item.sourceUrl!.includes("thread-8821"));
  assert.ok(item.sourceUrl!.includes("messageId=msg-1042"));
  assert.ok(getGmailDeepLinkFromMetadata(e.metadata as Record<string, unknown>)!.includes("thread-8821"));
});

test("gmail: valid source URL when only messageId exists", () => {
  const raw = { id: "only-msg", from: "a@x.com", subject: "Hi", snippet: "body", unread: true };
  const [e] = normalizeResult("gmail", [raw], INT);
  const [item] = buildCoverageItems("gmail", [e]);
  // messageId alone must never fabricate an rfc822 Message-ID search.
  assert.ok(item.sourceUrl!.includes("mail.google.com/mail/u/0/#inbox/"));
  assert.ok(!item.sourceUrl!.includes("rfc822msgid"));
});

test("gmail: no source URL when neither identifier exists — no fabricated link", () => {
  const raw: any = { from: "a@x.com", subject: "Hi", snippet: "b", unread: true };
  const [e] = normalizeResult("gmail", [raw], INT);
  const [item] = buildCoverageItems("gmail", [e]);
  assert.equal(item.sourceUrl, undefined);
  assert.equal(getGmailDeepLink(), null, "getGmailDeepLink with no ids returns null");
  assert.equal(getGmailDeepLinkFromMetadata({}), null);
});

// ─── 10-12. Empty body behavior ─────────────────────────────────────────────

test("gmail: empty body is NOT dropped — the provider record is still real", () => {
  const raw = { id: "g-empty", threadId: "t-empty", from: "x@y.com", snippet: "", unread: true };
  const entities = normalizeResult("gmail", [raw], INT);
  assert.equal(entities.length, 1, "a real Gmail message with empty content is kept");
  const [item] = buildCoverageItems("gmail", entities);
  assert.equal(item.title, "Untitled update", "exactly the neutral deterministic fallback");
  assert.equal(item.title.includes("gmail"), false);
  assert.notEqual(item.title, "gmail update");
});

test("gmail: empty body uses ONLY neutral 'Untitled update', never provider-derived titles", () => {
  for (const snippet of ["", "   ", undefined]) {
    const [e] = normalizeResult("gmail", [{ id: "gx", threadId: "tx", from: "a@b.co", snippet, unread: true }], INT);
    const [item] = buildCoverageItems("gmail", [e]);
    assert.equal(item.title, "Untitled update", `snippet=${JSON.stringify(snippet)}`);
    assert.equal(item.originalContent, "", "no fabricated original content");
  }
  const forbidden = ["gmail update", "gmail message", "email update"];
  for (const f of forbidden) {
    assert.notEqual(buildFallbackTitle(), f);
  }
});

function buildFallbackTitle(): string {
  const [e] = normalizeResult("gmail", [{ id: "z", from: "a@b.com", snippet: "", unread: true }], INT);
  return buildCoverageItems("gmail", [e])[0].title;
}

// ─── 13-18. Quick reply + Open in Gmail use the real identifiers ────────────

test("quick-reply: uses the actual threadId (threadId over correlationKey)", () => {
  const ctx = resolveGmailReplyContext({ threadId: "th-1", correlationKey: "th-correlation", from: "a@b.com", subject: "Hi" });
  assert.equal(ctx.threadId, "th-1");
  assert.equal(ctx.lookupThreadId, "th-1");
});

test("quick-reply: falls back to correlationKey when threadId is absent", () => {
  const ctx = resolveGmailReplyContext({ correlationKey: "th-77", from: "a@b.com", subject: "Hi" });
  assert.equal(ctx.threadId, "th-77");
});

test("quick-reply: uses metadata.from when available (gets bare email)", () => {
  const ctx = resolveGmailReplyContext({ from: "Alice Zhang <alice@example.com>", threadId: "t" });
  assert.equal(ctx.recipient, "alice@example.com");
  assert.equal(ctx.needsHeaderLookup, false);
});

test("quick-reply: falls back to getThreadHeaders only when metadata.from is unavailable", () => {
  const ctx = resolveGmailReplyContext({ messageId: "m1", subject: "Hi" }); // no from
  assert.equal(ctx.recipient, null);
  assert.equal(ctx.needsHeaderLookup, true);
  assert.equal(ctx.lookupThreadId, "m1", "lookup targets the real stored id");
  // with from present, lookup is NOT needed:
  const withFrom = resolveGmailReplyContext({ from: "a@b.com", messageId: "m1" });
  assert.equal(withFrom.needsHeaderLookup, false);
});

test("quick-reply: never invents a recipient — no from and no id to look up ⇒ null", () => {
  const ctx = resolveGmailReplyContext({});
  assert.equal(ctx.recipient, null);
  assert.equal(ctx.threadId, null);
  assert.equal(ctx.messageId, null);
  assert.equal(ctx.lookupThreadId, "");
  assert.equal(extractGmailRecipient(""), null);
  assert.equal(extractGmailRecipient("   "), null);
  assert.equal(extractGmailRecipient("not-an-email"), null, "garbage is never promoted to a recipient");
});

test("quick-reply: subject keeps real thread subject with Re: semantics", () => {
  assert.equal(resolveGmailReplyContext({ subject: "Quarterly Planning", from: "a@b.com" }).subject, "Re: Quarterly Planning");
  assert.equal(resolveGmailReplyContext({ subject: "re: Quarterly Planning", from: "a@b.com" }).subject, "re: Quarterly Planning");
  assert.equal(resolveGmailReplyContext({ subject: "Re: Quarterly Planning", from: "a@b.com" }).subject, "Re: Quarterly Planning");
  assert.equal(resolveGmailReplyContext({ from: "a@b.com" }).subject, "Re:");
});

test("Open in Gmail uses the same real source identifiers as the item shown", () => {
  const raw = { id: "g-888", threadId: "th-888", from: "a@b.com", subject: "S", snippet: "b", unread: true };
  const [entity] = normalizeResult("gmail", [raw], INT) as any[];
  const [coverage] = buildCoverageItems("gmail", [entity]);
  const enriched = enrichItemsWithRealEntity([coverage], { gmail: [entity] });
  const enrichedAny = enriched[0] as any;
  const meta = enrichedAny.metadata || {};
  assert.equal(coverage.sourceUrl, getGmailDeepLink("th-888", "g-888"));
  assert.equal(meta.sourceUrl, getGmailDeepLink("th-888", "g-888"));
  assert.equal(meta.threadId, "th-888");
  assert.equal(meta.messageId, "g-888");
  assert.ok(getGmailDeepLinkFromMetadata(meta) === meta.sourceUrl);
});

// ─── 19-24. Rate-limit + single-flight contract ─────────────────────────────

test("rate-limit: drafts use the dedicated ai-draft bucket (distinct from ai-agent)", () => {
  assert.ok(RATE_LIMIT_BUCKETS["ai-draft"], "ai-draft bucket is registered");
  assert.equal(RATE_LIMIT_BUCKETS["ai-draft"].maxRequests, 6);
  assert.notEqual(RATE_LIMIT_BUCKETS["ai-draft"], RATE_LIMIT_BUCKETS["ai-agent"]);
  assert.equal(DRAFT_RATE_LIMIT_ERROR.length > 0, true);
  assert.match(DRAFT_RATE_LIMIT_ERROR, /Rate limit/);
});

test("single-flight: concurrent identical drafts share one in-flight promise", async () => {
  let calls = 0;
  const key = dedupeKey(["draft", "u1", "gmail", "reply hi"]);
  const work = async () => { calls += 1; await new Promise((r) => setTimeout(r, 15)); return "draft"; };
  const results = await Promise.all(new Array(5).fill(null).map(() => singleFlight(key, work)));
  assert.deepEqual(results, new Array(5).fill("draft"));
  assert.equal(calls, 1);
  assert.equal(isInFlight(key), false, "key released after success");
});

test("single-flight: different users never share the same request", async () => {
  const k1 = dedupeKey(["draft", "user-a", "gmail", "hi"]);
  const k2 = dedupeKey(["draft", "user-b", "gmail", "hi"]);
  assert.notEqual(k1, k2);
  let active = 0; let max = 0;
  const work = async () => { active++; max = Math.max(max, active); await new Promise((r) => setTimeout(r, 10)); active--; };
  await Promise.all([singleFlight(k1, work), singleFlight(k2, work)]);
  assert.equal(max, 2, "two users run independently, never serialized/shared");
});

test("single-flight: key is released after failure too", async () => {
  const key = dedupeKey(["draft", "u1", "gmail", "boom"]);
  const work = async () => { throw new Error("nope"); };
  await assert.rejects(() => singleFlight(key, work), /nope/);
  assert.equal(isInFlight(key), false);
});

test("rate-limit: errors remain explicit and actionable via the shared constant", () => {
  assert.match(DRAFT_RATE_LIMIT_ERROR, /Please wait/);
});