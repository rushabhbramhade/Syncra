import { NormalizedEvent, Contact } from "../normalized-event";

// Boundary type for external API responses — matches RawEvent in normalizer.ts
type RawApiData = Record<string, unknown>;

// Safe coercion helpers to avoid repeated `as string` / `as boolean` casts
function s(v: unknown): string {
  return typeof v === "string" ? v : v != null ? String(v) : "";
}

function b(v: unknown): boolean {
  return Boolean(v);
}

function arr<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function obj(v: unknown): RawApiData {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as RawApiData) : {};
}

function createContact(name?: string, email?: string): Contact {
  return { id: email || name || "unknown", name: name || "Unknown", email };
}

function extractEmailDomain(email?: string): string {
  if (!email) return "";
  const parts = email.split("@");
  return parts.length > 1 ? parts[1].toLowerCase() : "";
}

export function normalizeGmailEvent(raw: RawApiData): NormalizedEvent | null {
  if (!raw) return null;
  const subject = s(raw.subject || raw.title) || "(no subject)";
  const fromStr = s(raw.from);
  const senderName = fromStr.split("<")[0]?.trim() || s(raw.fromName) || fromStr || "Unknown";
  const senderEmail = fromStr.match(/<([^>]+)>/)?.[1] || fromStr || "";
  const snippet = s(raw.snippet || raw.body);
  const toArr = arr<string>(raw.to);
  const labelsArr = arr<string>(raw.labels);
  const attachmentsArr = arr(raw.attachments);

  return {
    id: `gmail-${raw.id || raw.messageId || Date.now()}`,
    sourceEventId: s(raw.id || raw.messageId),
    platform: "gmail",
    category: "email",
    title: subject,
    summary: snippet.substring(0, 200),
    fullContent: s(raw.body || raw.snippet),
    sender: { ...createContact(senderName, senderEmail), domain: extractEmailDomain(senderEmail) },
    recipients: toArr.map((r) => createContact(r, r)),
    timestamp: s(raw.date || raw.timestamp) || new Date().toISOString(),
    receivedAt: s(raw.date || raw.timestamp) || new Date().toISOString(),
    isUnread: raw.isUnread !== false,
    isStarred: b(raw.isStarred),
    labels: labelsArr,
    priority: "medium",
    score: 50,
    confidence: 1,
    rulesMatched: [],
    explanation: "",
    metadata: {
      gmail: {
        threadId: s(raw.threadId),
        messageId: s(raw.id || raw.messageId),
        snippet,
        hasAttachments: b(raw.hasAttachments) || attachmentsArr.length > 0,
        isImportant: b(raw.isImportant),
        isPromo: labelsArr.includes("CATEGORY_PROMOTIONS"),
        labels: labelsArr,
      },
    },
    crossRefs: [],
    dedupHash: `gmail-${raw.threadId || raw.id || ""}-${subject}-${senderEmail}`,
  };
}

export function normalizeSlackEvent(raw: RawApiData): NormalizedEvent | null {
  if (!raw) return null;
  const tsStr = s(raw.ts);
  const tsNum = tsStr ? parseFloat(tsStr) : 0;
  const tsIso = tsNum ? new Date(tsNum * 1000).toISOString() : new Date().toISOString();
  const text = s(raw.text);
  const channel = s(raw.channel || raw.channelId);
  const reactionsArr = arr(raw.reactions);

  return {
    id: `slack-${raw.ts || raw.id || Date.now()}`,
    sourceEventId: s(raw.ts || raw.id),
    platform: "slack",
    category: "message",
    title: text.substring(0, 100) || "Slack message",
    summary: text,
    fullContent: text,
    sender: createContact(s(raw.sender || raw.user) || "Unknown", s(raw.senderEmail)),
    recipients: [],
    timestamp: s(raw.timestamp) || tsIso,
    receivedAt: s(raw.timestamp) || tsIso,
    isUnread: true,
    isStarred: false,
    labels: [],
    priority: "medium",
    score: 50,
    confidence: 1,
    rulesMatched: [],
    explanation: "",
    metadata: {
      slack: {
        channelId: s(raw.channelId || raw.channel),
        channelName: s(raw.channelName || raw.channel) || "general",
        isMention: text.includes("@"),
        isDM: channel.startsWith("D"),
        reactionCount: reactionsArr.length,
        threadTs: s(raw.threadTs),
      },
    },
    crossRefs: [],
    dedupHash: `slack-${raw.ts || raw.id}-${channel}-${text.substring(0, 50)}`,
  };
}

export function normalizeWhatsAppEvent(raw: RawApiData): NormalizedEvent | null {
  if (!raw) return null;
  const msg = s(raw.message || raw.text);
  return {
    id: `wa-${raw.id || Date.now()}`,
    sourceEventId: s(raw.id),
    platform: "whatsapp",
    category: "message",
    title: msg.substring(0, 100) || "WhatsApp message",
    summary: msg,
    fullContent: msg,
    sender: createContact(s(raw.fromName || raw.sender) || "Unknown", s(raw.from)),
    recipients: [],
    timestamp: s(raw.timestamp) || new Date().toISOString(),
    receivedAt: s(raw.timestamp) || new Date().toISOString(),
    isUnread: true,
    isStarred: false,
    labels: [],
    priority: "medium",
    score: 50,
    confidence: 1,
    rulesMatched: [],
    explanation: "",
    metadata: {
      whatsapp: {
        chatId: s(raw.chatId || raw.from),
        chatName: s(raw.chatName || raw.fromName) || "Chat",
        isGroup: b(raw.isGroup),
        isBusiness: b(raw.isBusiness),
      },
    },
    crossRefs: [],
    dedupHash: `wa-${raw.id || ""}-${msg.substring(0, 50)}`,
  };
}

export function normalizeTelegramEvent(raw: RawApiData): NormalizedEvent | null {
  if (!raw) return null;
  const text = s(raw.text);
  return {
    id: `tg-${raw.id || Date.now()}`,
    sourceEventId: s(raw.id),
    platform: "telegram",
    category: "alert",
    title: text.substring(0, 100) || "Telegram message",
    summary: text,
    fullContent: text,
    sender: createContact(s(raw.sender || raw.from) || "Telegram Bot"),
    recipients: [],
    timestamp: s(raw.timestamp) || new Date().toISOString(),
    receivedAt: s(raw.timestamp) || new Date().toISOString(),
    isUnread: true,
    isStarred: false,
    labels: [],
    priority: "medium",
    score: 50,
    confidence: 1,
    rulesMatched: [],
    explanation: "",
    metadata: {
      telegram: {
        chatId: s(raw.chatId),
        chatTitle: s(raw.chatTitle) || "Chat",
        isGroup: b(raw.isGroup),
        isBot: b(raw.isBot ?? false),
      },
    },
    crossRefs: [],
    dedupHash: `tg-${raw.id || ""}-${text.substring(0, 50)}`,
  };
}

export function normalizeCalendarEvent(raw: RawApiData): NormalizedEvent | null {
  if (!raw) return null;
  const attendeesArr = arr<RawApiData>(raw.attendees);
  const recurrenceArr = arr(raw.recurrence);
  const startRaw = obj(raw.start);
  const endRaw = obj(raw.end);
  const organizerRaw = obj(raw.organizer);

  return {
    id: `cal-${raw.id || Date.now()}`,
    sourceEventId: s(raw.id),
    platform: "calendar",
    category: "meeting",
    title: s(raw.title || raw.summary) || "Meeting",
    summary: s(raw.description),
    fullContent: s(raw.description),
    sender: createContact(s(organizerRaw.name || raw.organizer) || "Calendar", s(raw.organizerEmail)),
    recipients: attendeesArr.map((a) =>
      typeof a === "string" ? createContact(a, a) : createContact(s(a.name), s(a.email))
    ),
    timestamp: s(raw.startTime || startRaw.dateTime) || new Date().toISOString(),
    receivedAt: s(raw.created) || new Date().toISOString(),
    isUnread: false,
    isStarred: false,
    labels: [],
    priority: "medium",
    score: 50,
    confidence: 1,
    rulesMatched: [],
    explanation: "",
    metadata: {
      calendar: {
        meetingId: s(raw.id),
        startTime: s(raw.startTime || startRaw.dateTime),
        endTime: s(raw.endTime || endRaw.dateTime),
        attendees: attendeesArr.map((a) => (typeof a === "string" ? a : s(a.email || a.name))),
        meetingUrl: s(raw.meetingUrl || raw.hangoutLink || raw.htmlLink),
        isRecurring: recurrenceArr.length > 0,
        hasActionItems: false,
      },
    },
    crossRefs: [],
    dedupHash: `cal-${raw.id || ""}-${raw.title || ""}-${raw.startTime || ""}`,
  };
}

export function normalizeGitHubEvent(raw: RawApiData): NormalizedEvent | null {
  if (!raw) return null;
  const reviewersArr = arr<RawApiData>(raw.requestedReviewers);
  const labelsArr = arr<RawApiData>(raw.labels);
  const repoRaw = obj(raw.repository);
  const ownerRaw = obj(repoRaw.owner);
  const userRaw = obj(raw.user);
  const prRaw = obj(raw.pr);

  return {
    id: `gh-${raw.id || Date.now()}`,
    sourceEventId: s(raw.id),
    platform: "github",
    category: raw.type === "pull_request" ? "code" : "task",
    title: s(raw.title || prRaw.title) || `PR #${raw.number}` || "GitHub event",
    summary: s(raw.body || raw.description),
    fullContent: s(raw.body || raw.description),
    sender: createContact(s(userRaw.login || raw.sender) || "GitHub", s(userRaw.email)),
    recipients: reviewersArr.map((r) => createContact(s(r.login), s(r.email))),
    timestamp: s(raw.created_at || raw.updated_at) || new Date().toISOString(),
    receivedAt: s(raw.created_at) || new Date().toISOString(),
    isUnread: raw.state === "open",
    isStarred: false,
    labels: labelsArr.map((l) => s(l.name) || s(l)),
    priority: "medium",
    score: 50,
    confidence: 1,
    rulesMatched: [],
    explanation: "",
    metadata: {
      github: {
        repo: s(repoRaw.name || raw.repo),
        owner: s(ownerRaw.login || raw.owner),
        prNumber: (raw.number || prRaw.number) as number | undefined,
        issueNumber: raw.type === "issue" ? (raw.number as number | undefined) : undefined,
        isReviewRequested: raw.type === "pull_request" && reviewersArr.length > 0,
        isReviewedByMe: false,
        status: s(raw.state || raw.status) || "open",
      },
    },
    crossRefs: [],
    dedupHash: `gh-${repoRaw.name || raw.repo}-${raw.number || raw.id}`,
  };
}
