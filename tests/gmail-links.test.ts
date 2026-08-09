import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildGmailThreadUrl,
  buildGmailMessageUrl,
  buildGmailRfc822SearchUrl,
  getGmailDeepLink,
  getGmailDeepLinkFromMetadata,
} from "../lib/google/gmail-links.ts";

test("gmail link: thread+message → message deep-link (projector pins exact message)", () => {
  const link = getGmailDeepLink("thread_abc", "msg_1");
  assert.equal(link, "https://mail.google.com/mail/u/0/#inbox/thread_abc?projector=1&messageId=msg_1");
  assert.ok(link!.includes("messageId=msg_1"));
  assert.ok(link!.includes("projector=1"));
});

test("gmail link: messageId ONLY never fabricates an rfc822 search id", () => {
  // A Gmail API messageId is NOT an RFC 822 Message-ID — linking via
  // rfc822msgid: would open an empty search. Without thread context the honest
  // result is a Gmail inbox link at best, never a fake rfc822 query.
  const link = getGmailDeepLink(undefined, "msg_9");
  assert.ok(link!.includes("mail.google.com/mail/u/0/#inbox/"), "message-only deep links open the Gmail inbox view");
  assert.ok(!link!.includes("rfc822msgid"), "messageId must never be misused as an rfc822 Message-ID");
});

test("gmail link: genuine rfc822 Message-ID produces the search deep link", () => {
  const link = getGmailDeepLink(undefined, undefined, "<CAHfFgEXAMPLE@mail.gmail.com>");
  assert.equal(link, buildGmailRfc822SearchUrl("<CAHfFgEXAMPLE@mail.gmail.com>"));
  assert.ok(link!.includes("rfc822msgid:"));
});

test("gmail link: no ids → null (never link to a fake/generic page)", () => {
  assert.equal(getGmailDeepLink(), null);
  assert.equal(getGmailDeepLink("", ""), null);
  assert.equal(getGmailDeepLinkFromMetadata({}), null);
});

test("gmail link: metadata-driven helper preserves ids verbatim", () => {
  const meta = { threadId: "th_7", messageId: "m_7" };
  const link = getGmailDeepLinkFromMetadata(meta);
  assert.ok(link!.includes("th_7"));
  assert.equal(getGmailDeepLinkFromMetadata({}), null);
});

test("gmail link: metadata with only rfc822MessageId gives a search link", () => {
  const link = getGmailDeepLinkFromMetadata({ rfc822MessageId: "<rfc@example.com>" });
  assert.ok(link!.includes("rfc822msgid:<rfc@example.com>"));
});

test("gmail message link with thread embeds projector message id", () => {
  const link = buildGmailMessageUrl("m_3", "th_3");
  assert.ok(link.includes("th_3"));
  assert.ok(link.includes("messageId=m_3"));
});