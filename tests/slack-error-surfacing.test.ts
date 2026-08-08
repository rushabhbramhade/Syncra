/* eslint-disable @typescript-eslint/no-explicit-any -- node test stubs */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SlackApiService } from "../lib/integrations/slack-provider";
import { classifyProviderStatus, emptyHealth } from "../lib/briefing/pipeline";

/**
 * Regression: Slack failures must be SURFACED as real errors, never swallowed
 * into a fake "no recent activity". `not_in_channel` / `missing_scope` /
 * unreachable channels must throw with a human-readable cause, and the thrown
 * message must map to a reconnect / permission health state downstream.
 */

function installStub(stub: (url: string) => Response) {
  const prev = globalThis.fetch;
  globalThis.fetch = (async (input: any) => stub(String(input))) as typeof fetch;
  return () => { globalThis.fetch = prev; };
}

function jsonResponse(body: any, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

test("not_in_channel anywhere → thrown error names the cause + invite action (never empty)", async () => {
  const restore = installStub((url) => {
    if (url.includes("conversations.list")) return jsonResponse({ ok: true, channels: [{ id: "C1" }, { id: "C2" }] });
    if (url.includes("conversations.history")) return jsonResponse({ ok: false, error: "not_in_channel" });
    return jsonResponse({ ok: false, error: "unknown" });
  });
  try {
    await assert.rejects(
      () => SlackApiService.fetchMessages("token", 5),
      (err: any) => {
        assert.match(err.message, /not_in_channel/);
        assert.match(err.message, /Invite the bot/);
        return true;
      },
    );
  } finally { restore(); }
});

test("missing_scope → names the missing scopes + reconnect action", async () => {
  const restore = installStub((url) => {
    if (url.includes("conversations.list")) return jsonResponse({ ok: true, channels: [{ id: "C1" }] });
    if (url.includes("conversations.history")) return jsonResponse({ ok: false, error: "missing_scope" });
    return jsonResponse({ ok: false, error: "unknown" });
  });
  try {
    await assert.rejects(
      () => SlackApiService.fetchMessages("token", 5),
      (err: any) => {
        assert.match(err.message, /missing_scope/);
        assert.match(err.message, /history/);
        return true;
      },
    );
  } finally { restore(); }
});

test("every channel HTTP failure → throws real cause, never reports healthy", async () => {
  const restore = installStub((url) => {
    if (url.includes("conversations.list")) return jsonResponse({ ok: true, channels: [{ id: "C1" }, { id: "C2" }] });
    if (url.includes("conversations.history")) return jsonResponse({ ok: false, error: "not_in_channel" }, 403);
    return jsonResponse({ ok: false, error: "unknown" });
  });
  try {
    await assert.rejects(
      () => SlackApiService.fetchMessages("token", 5),
      (err: any) => {
        assert.equal(/not_in_channel|Slack: could not read any/.test(err.message), true);
        return true;
      },
    );
  } finally { restore(); }
});

test("partial success (some channels readable) still returns the real messages", async () => {
  const restore = installStub((url) => {
    if (url.includes("conversations.list")) return jsonResponse({ ok: true, channels: [{ id: "C1" }, { id: "C2" }] });
    if (url.includes("channel=C1")) return jsonResponse({ ok: true, messages: [{ ts: "1700000000.000001", user: "U1", text: "hello", channel: "C1" }] });
    if (url.includes("channel=C2")) return jsonResponse({ ok: false, error: "not_in_channel" });
    return jsonResponse({ ok: false, error: "unknown" });
  });
  try {
    const messages = await SlackApiService.fetchMessages("token", 5);
    assert.equal(messages.length, 1);
    assert.equal((messages[0] as any).text, "hello");
  } finally { restore(); }
});

test("classifyProviderStatus: Slack surfaced errors reach health (never healthy)", async () => {
  // missing_scope → Permission Missing + reconnect (this is the briefing seat).
  const permission = classifyProviderStatus({ ...emptyHealth(true), error: "Slack: token is missing channel history scopes (missing_scope). Reconnect Slack to grant channels:history, im:history, groups:history, mpim:history." });
  assert.equal(permission.status, "permission_missing");
  assert.equal(permission.reconnect, true);
  assert.equal(permission.label, "Permission Missing");

  // not_in_channel surfaces as a sync failure with reconnect = false but is an
  // ERROR, never "no recent activity" / healthy.
  const notInChannel = classifyProviderStatus({ ...emptyHealth(true), error: "Slack: the Syncra bot is not a member of any channel it can read (not_in_channel). Invite the bot to a channel (e.g. #general) to capture messages." });
  assert.equal(notInChannel.status, "sync_failed");
  assert.equal(notInChannel.reconnect, false);
  assert.notEqual(notInChannel.label, "Healthy");

  // Generic all-failed message also lands as sync_failed, not "no activity".
  const generic = classifyProviderStatus({ ...emptyHealth(true), error: "Slack: could not read any message from the connected channels — C1: HTTP 500" });
  assert.equal(generic.status, "sync_failed");
  assert.notEqual(generic.label, "Healthy");
});