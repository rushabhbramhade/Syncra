import { NormalizedEvent, PlatformType, EventCategory, Contact } from "../normalized-event";

function createContact(name?: string, email?: string): Contact {
  return { id: email || name || "unknown", name: name || "Unknown", email };
}

function extractEmailDomain(email?: string): string {
  if (!email) return "";
  const parts = email.split("@");
  return parts.length > 1 ? parts[1].toLowerCase() : "";
}

export function normalizeGmailEvent(raw: any): NormalizedEvent | null {
  if (!raw) return null;
  const subject = raw.subject || raw.title || "(no subject)";
  const senderName = raw.from?.split("<")[0]?.trim() || raw.fromName || raw.from || "Unknown";
  const senderEmail = raw.from?.match(/<([^>]+)>/)?.[1] || raw.from || "";
  const snippet = raw.snippet || raw.body || "";

  return {
    id: `gmail-${raw.id || raw.messageId || Date.now()}`,
    sourceEventId: raw.id || raw.messageId || "",
    platform: "gmail",
    category: "email",
    title: subject,
    summary: snippet.substring(0, 200),
    fullContent: raw.body || raw.snippet || "",
    sender: { ...createContact(senderName, senderEmail), domain: extractEmailDomain(senderEmail) },
    recipients: (raw.to || []).map((r: string) => createContact(r, r)),
    timestamp: raw.date || raw.timestamp || new Date().toISOString(),
    receivedAt: raw.date || raw.timestamp || new Date().toISOString(),
    isUnread: raw.isUnread !== false,
    isStarred: raw.isStarred || false,
    labels: raw.labels || [],
    priority: "medium",
    score: 50,
    confidence: 1,
    rulesMatched: [],
    explanation: "",
    metadata: {
      gmail: {
        threadId: raw.threadId || "",
        messageId: raw.id || raw.messageId || "",
        snippet,
        hasAttachments: raw.hasAttachments || (raw.attachments?.length > 0) || false,
        isImportant: raw.isImportant || false,
        isPromo: (raw.labels || []).includes("CATEGORY_PROMOTIONS"),
        labels: raw.labels || [],
      },
    },
    crossRefs: [],
    dedupHash: `gmail-${raw.threadId || raw.id || ""}-${subject}-${senderEmail}`,
  };
}

export function normalizeSlackEvent(raw: any): NormalizedEvent | null {
  if (!raw) return null;
  return {
    id: `slack-${raw.ts || raw.id || Date.now()}`,
    sourceEventId: raw.ts || raw.id || "",
    platform: "slack",
    category: "message",
    title: raw.text?.substring(0, 100) || "Slack message",
    summary: raw.text || "",
    fullContent: raw.text || "",
    sender: createContact(raw.sender || raw.user || "Unknown", raw.senderEmail),
    recipients: [],
    timestamp: raw.timestamp || raw.ts ? new Date(parseFloat(raw.ts) * 1000).toISOString() : new Date().toISOString(),
    receivedAt: raw.timestamp || raw.ts ? new Date(parseFloat(raw.ts) * 1000).toISOString() : new Date().toISOString(),
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
        channelId: raw.channelId || raw.channel || "",
        channelName: raw.channelName || raw.channel || "general",
        isMention: raw.text?.includes("@") || false,
        isDM: raw.channel?.startsWith("D") || false,
        reactionCount: raw.reactions?.length || 0,
        threadTs: raw.threadTs,
      },
    },
    crossRefs: [],
    dedupHash: `slack-${raw.ts || raw.id}-${raw.channel || ""}-${(raw.text || "").substring(0, 50)}`,
  };
}

export function normalizeWhatsAppEvent(raw: any): NormalizedEvent | null {
  if (!raw) return null;
  return {
    id: `wa-${raw.id || Date.now()}`,
    sourceEventId: raw.id || "",
    platform: "whatsapp",
    category: "message",
    title: raw.message?.substring(0, 100) || raw.text?.substring(0, 100) || "WhatsApp message",
    summary: raw.message || raw.text || "",
    fullContent: raw.message || raw.text || "",
    sender: createContact(raw.fromName || raw.sender || "Unknown", raw.from),
    recipients: [],
    timestamp: raw.timestamp || new Date().toISOString(),
    receivedAt: raw.timestamp || new Date().toISOString(),
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
        chatId: raw.chatId || raw.from || "",
        chatName: raw.chatName || raw.fromName || "Chat",
        isGroup: raw.isGroup || false,
        isBusiness: raw.isBusiness || false,
      },
    },
    crossRefs: [],
    dedupHash: `wa-${raw.id || ""}-${(raw.message || raw.text || "").substring(0, 50)}`,
  };
}

export function normalizeTelegramEvent(raw: any): NormalizedEvent | null {
  if (!raw) return null;
  return {
    id: `tg-${raw.id || Date.now()}`,
    sourceEventId: raw.id || "",
    platform: "telegram",
    category: "alert",
    title: raw.text?.substring(0, 100) || "Telegram message",
    summary: raw.text || "",
    fullContent: raw.text || "",
    sender: createContact(raw.sender || raw.from || "Telegram Bot"),
    recipients: [],
    timestamp: raw.timestamp || new Date().toISOString(),
    receivedAt: raw.timestamp || new Date().toISOString(),
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
        chatId: raw.chatId || "",
        chatTitle: raw.chatTitle || "Chat",
        isGroup: raw.isGroup || false,
        isBot: raw.isBot || true,
      },
    },
    crossRefs: [],
    dedupHash: `tg-${raw.id || ""}-${(raw.text || "").substring(0, 50)}`,
  };
}

export function normalizeCalendarEvent(raw: any): NormalizedEvent | null {
  if (!raw) return null;
  return {
    id: `cal-${raw.id || Date.now()}`,
    sourceEventId: raw.id || "",
    platform: "calendar",
    category: "meeting",
    title: raw.title || raw.summary || "Meeting",
    summary: raw.description || "",
    fullContent: raw.description || "",
    sender: createContact(raw.organizer?.name || raw.organizer || "Calendar", raw.organizerEmail),
    recipients: (raw.attendees || []).map((a: any) => typeof a === "string" ? createContact(a, a) : createContact(a.name, a.email)),
    timestamp: raw.startTime || raw.start?.dateTime || new Date().toISOString(),
    receivedAt: raw.created || new Date().toISOString(),
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
        meetingId: raw.id || "",
        startTime: raw.startTime || raw.start?.dateTime || "",
        endTime: raw.endTime || raw.end?.dateTime || "",
        attendees: (raw.attendees || []).map((a: any) => typeof a === "string" ? a : a.email || a.name),
        meetingUrl: raw.meetingUrl || raw.hangoutLink || raw.htmlLink,
        isRecurring: raw.recurrence?.length > 0 || false,
        hasActionItems: false,
      },
    },
    crossRefs: [],
    dedupHash: `cal-${raw.id || ""}-${raw.title || ""}-${raw.startTime || ""}`,
  };
}

export function normalizeGitHubEvent(raw: any): NormalizedEvent | null {
  if (!raw) return null;
  return {
    id: `gh-${raw.id || Date.now()}`,
    sourceEventId: raw.id?.toString() || "",
    platform: "github",
    category: raw.type === "pull_request" ? "code" : "task",
    title: raw.title || raw.pr?.title || `PR #${raw.number}` || "GitHub event",
    summary: raw.body || raw.description || "",
    fullContent: raw.body || raw.description || "",
    sender: createContact(raw.user?.login || raw.sender || "GitHub", raw.user?.email),
    recipients: (raw.requestedReviewers || []).map((r: any) => createContact(r.login || r, r.email)),
    timestamp: raw.created_at || raw.updated_at || new Date().toISOString(),
    receivedAt: raw.created_at || new Date().toISOString(),
    isUnread: raw.state === "open",
    isStarred: false,
    labels: (raw.labels || []).map((l: any) => l.name || l),
    priority: "medium",
    score: 50,
    confidence: 1,
    rulesMatched: [],
    explanation: "",
    metadata: {
      github: {
        repo: raw.repository?.name || raw.repo || "",
        owner: raw.repository?.owner?.login || raw.owner || "",
        prNumber: raw.number || raw.pr?.number,
        issueNumber: raw.type === "issue" ? raw.number : undefined,
        isReviewRequested: raw.type === "pull_request" && (raw.requestedReviewers?.length > 0 || false),
        isReviewedByMe: false,
        status: raw.state || raw.status || "open",
      },
    },
    crossRefs: [],
    dedupHash: `gh-${raw.repository?.name || raw.repo}-${raw.number || raw.id}`,
  };
}


