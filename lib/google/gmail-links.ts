/**
 * Canonical Gmail deep-link resolver.
 *
 * The three identifiers are DIFFERENT things and must never be conflated:
 *   - threadId          Gmail thread id (opens the conversation).
 *   - messageId         Gmail message id (a message inside the thread).
 *   - rfc822MessageId   The RFC 822 `Message-ID:` header value (e.g.
 *                       "<abc@mail.gmail.com>"), used only for Gmail's
 *                       rfc822msgid: search. A Gmail messageId is NOT this,
 *                       so it must never be fed into `rfc822msgid:`.
 *
 * Priority (all real ids, never fabricated):
 *   threadId   → thread deep-link (#inbox/<threadId>).
 *   messageId  → message deep-link (requires thread context).
 *   rfc822MessageId → rfc822 search (genuine `Message-ID` header only).
 *   otherwise  → null (never a homepage/search guess).
 */
export function buildGmailThreadUrl(threadId: string): string {
  return `https://mail.google.com/mail/u/0/#inbox/${threadId}`;
}

/** Message deep-link. A Gmail message is only addressable within its thread
 *  (projector), so a messageId without a threadId has no Gmail URL. */
export function buildGmailMessageUrl(messageId: string, threadId?: string): string {
  if (threadId) {
    return `https://mail.google.com/mail/u/0/#inbox/${threadId}?projector=1&messageId=${messageId}`;
  }
  return `https://mail.google.com/mail/u/0/#inbox/${messageId}`;
}

/** RFC 822 `Message-ID` search — only reachable with a GENUINE `Message-ID`
 *  header value, never with a Gmail API message id. The header value is passed
 *  verbatim so the `<...>` form Gmail expects survives untouched. */
export function buildGmailRfc822SearchUrl(rfc822MessageId: string): string {
  return `https://mail.google.com/mail/u/0/#search/rfc822msgid:${rfc822MessageId}`;
}

export function getGmailDeepLink(
  threadId?: string,
  messageId?: string,
  rfc822MessageId?: string
): string | null {
  if (threadId && messageId) {
    return buildGmailMessageUrl(messageId, threadId);
  }
  if (threadId) {
    return buildGmailThreadUrl(threadId);
  }
  if (messageId) {
    return buildGmailMessageUrl(messageId);
  }
  if (rfc822MessageId) {
    return buildGmailRfc822SearchUrl(rfc822MessageId);
  }
  return null;
}

export function getGmailDeepLinkFromMetadata(
  metadata: Record<string, unknown>
): string | null {
  const threadId = metadata.threadId as string | undefined;
  const messageId = metadata.messageId as string | undefined;
  const rfc822MessageId = metadata.rfc822MessageId as string | undefined;
  return getGmailDeepLink(threadId, messageId, rfc822MessageId);
}