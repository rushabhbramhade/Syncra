import { NormalizedEvent, PlatformType } from "./normalized-event";
import {
  normalizeGmailEvent,
  normalizeSlackEvent,
  normalizeWhatsAppEvent,
  normalizeTelegramEvent,
  normalizeCalendarEvent,
  normalizeGitHubEvent,
} from "./providers/normalizers";

export type RawEvent = Record<string, unknown>;
export type NormalizerFn = (raw: RawEvent) => NormalizedEvent | null;

const normalizerRegistry: Record<string, NormalizerFn> = {
  gmail: normalizeGmailEvent,
  slack: normalizeSlackEvent,
  whatsapp: normalizeWhatsAppEvent,
  telegram: normalizeTelegramEvent,
  calendar: normalizeCalendarEvent,
  github: normalizeGitHubEvent,
};

export function registerNormalizer(platform: string, fn: NormalizerFn): void {
  normalizerRegistry[platform] = fn;
}

export function normalizeEvent(platform: string, raw: RawEvent): NormalizedEvent | null {
  const fn = normalizerRegistry[platform];
  if (!fn) return wrapUnknown(platform, raw);
  return fn(raw);
}

export function normalizeAll(platformData: Record<string, unknown[]>): NormalizedEvent[] {
  const results: NormalizedEvent[] = [];
  for (const [platform, events] of Object.entries(platformData)) {
    for (const raw of events) {
      const normalized = normalizeEvent(platform, raw as RawEvent);
      if (normalized) results.push(normalized);
    }
  }
  return results;
}

function wrapUnknown(platform: string, raw: RawEvent): NormalizedEvent {
  return {
    id: `${platform}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sourceEventId: (raw.id as string) || "",
    platform: platform as PlatformType,
    category: "message",
    title: (raw.title as string) || (raw.text as string)?.substring(0, 100) || "Unknown event",
    summary: (raw.text as string) || (raw.body as string) || "",
    fullContent: JSON.stringify(raw),
    sender: { id: "unknown", name: "Unknown" },
    recipients: [],
    timestamp: (raw.timestamp as string) || new Date().toISOString(),
    receivedAt: (raw.timestamp as string) || new Date().toISOString(),
    isUnread: true,
    isStarred: false,
    labels: [],
    priority: "medium",
    score: 50,
    confidence: 0.5,
    rulesMatched: [],
    explanation: "No normalizer registered for this platform",
    metadata: {},
    crossRefs: [],
    dedupHash: `${platform}-${raw.id || ""}-${(raw.title || raw.text || "").toString().substring(0, 50)}`,
  };
}

export { normalizeGmailEvent, normalizeSlackEvent, normalizeWhatsAppEvent, normalizeTelegramEvent, normalizeCalendarEvent, normalizeGitHubEvent };
