import { createHash } from "node:crypto";
import type {
  NormalizedEntity,
  UnifiedMessage,
  UnifiedTask,
  UnifiedNotification,
  UnifiedEvent,
} from "../integrations/types";

/**
 * Briefing data pipeline — the single normalization + health path for every
 * connected integration. Pure module: no DB, no @/ aliases, node-testable.
 *
 * Flow per provider: fetch (executeTool) → normalizeResult → persist
 * (unified store) → aiShape → AI. Every stage is counted so a provider can
 * never disappear silently; any 0 stage with data upstream is a surfaced error.
 */

export interface ProviderHealth {
  connected: boolean;
  fetched: number;
  normalized: number;
  saved: number;
  aiUsed: number;
  error?: string;
  lastSync?: string;
  /** Backend-enforced coverage — was the provider referenced by the AI? */
  referenced?: boolean;
  /** Backend-enforced coverage — does the stored briefing render its items? */
  rendered?: boolean;
  /** Human-readable stage outcome ("no recent activity", fetch error, …). */
  reason?: string;
  /** Evidence-derived health status (see classifyProviderStatus). */
  status?: ProviderStatus;
  /** Human label for `status`, shown in Provider Health. */
  statusLabel?: string;
  /** True when the user must re-authorize (stale token / missing scopes). */
  reconnect?: boolean;
}

export type ProviderHealthReport = Record<string, ProviderHealth>;

export function emptyHealth(connected = false): ProviderHealth {
  return { connected, fetched: 0, normalized: 0, saved: 0, aiUsed: 0 };
}

/** Phase 11 — per-provider quality score from the stage counts. */
export function computeQuality(h: ProviderHealth): { score: number; label: string } {
  if (h.error) return { score: 0, label: "Error" };
  if (h.fetched === 0) return { score: 0, label: "No data" };
  const normalized = h.normalized > 0 ? 1 : 0;
  const saved = h.saved > 0 ? 1 : 0;
  const ai = h.aiUsed > 0 ? 1 : 0;
  const score = Math.round(((normalized + saved + ai) / 3) * 100);
  return { score, label: score >= 66 ? "Healthy" : score > 0 ? "Partial" : "Failed" };
}

/** Count real items in a raw or normalized payload (arrays + nested objects). */
/**
 * Resolve the true activity time (message sent / event start) of a briefing item
 * by looking up its sourceId within that item's own platform's entities — never
 * across platforms, so same-id collisions between providers can't cross-match.
 * Falls back to "now" when the source is untraceable.
 */
export function effectiveActivityTimestamp(
  item: { platform?: string; sourceId?: string },
  contextEntities: Record<string, Array<{ providerId?: unknown; sentAt?: string | null; startsAt?: string | null }>>,
): string {
  if (item.sourceId) {
    const entities = item.platform ? contextEntities[item.platform] : undefined;
    const match = (entities || []).find(
      (e) => String(e.providerId) === String(item.sourceId),
    );
    const ts = match ? match.sentAt ?? match.startsAt : undefined;
    if (ts) return ts;
  }
  return new Date().toISOString();
}

export function countItems(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    let total = 0;
    for (const v of Object.values(value as Record<string, unknown>)) total += countItems(v);
    return total;
  }
  return 0;
}

/** Evidence-derived health statuses (Phase: Provider Health). Every status maps
 *  to an observable cause in the fetch result — never inferred. */
export type ProviderStatus =
  | "healthy" | "partial" | "no_recent_activity"
  | "authentication_failed" | "permission_missing" | "rate_limited"
  | "reconnect_required" | "sync_failed";

export interface ProviderStatusInfo { status: ProviderStatus; label: string; reconnect: boolean; }

/**
 * Classify a provider's health from the stage counts + fetch error. Used to
 * surface "Reconnect Required" for stale OAuth tokens / missing scopes, instead
 * of a generic "no data" or opaque message.
 */
export function classifyProviderStatus(h: ProviderHealth): ProviderStatusInfo {
  if (h.error) {
    const msg = h.error.toLowerCase();
    if (/\b(rate.?limit|429|too many)/.test(msg)) {
      return { status: "rate_limited", label: "Rate Limited", reconnect: false };
    }
    // Scope / permission mistakes mean the granted OAuth token is stale —
    // the user must re-authorize to grant the new scopes. Reconnect Required.
    if (/scope|permission|forbidden|insufficient|denied|403/i.test(msg)) {
      return { status: "permission_missing", label: "Permission Missing", reconnect: true };
    }
    if (/\b(token|unauthor|invalid|expired|refresh|corrupted|not connected|reconnect|401)\b/.test(msg)) {
      return { status: "authentication_failed", label: "Authentication Failed", reconnect: true };
    }
    return { status: "sync_failed", label: "Sync Failed", reconnect: false };
  }
  if (h.fetched > 0 && h.normalized > 0 && h.aiUsed > 0) {
    return { status: "healthy", label: "Healthy", reconnect: false };
  }
  if (h.fetched > 0) {
    return { status: "partial", label: "Partial", reconnect: false };
  }
  return { status: "no_recent_activity", label: "No Recent Activity", reconnect: false };
}

function hash(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

function isoOrNow(value: unknown): string {
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

// ─── Per-provider normalizers → UnifiedEntity[] ─────────────────────────────

function normalizeMessages(
  providerId: string,
  integrationId: string,
  raw: unknown,
  map: (item: any) => Omit<UnifiedMessage, "entityKind" | "integrationId"> | null
): NormalizedEntity[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedEntity[] = [];
  for (const item of raw) {
    const m = map(item);
    if (!m) continue;
    out.push({ entityKind: "message", integrationId, ...m });
  }
  return out;
}

function normalizeGmail(integrationId: string, raw: unknown): NormalizedEntity[] {
  return normalizeMessages("gmail", integrationId, raw, (e) => {
    const subject = e.subject || "(No Subject)";
    const snippet = e.snippet || "";
    return {
      providerId: String(e.id),
      channelId: e.threadId ? `gmail:${e.threadId}` : null,
      bodyText: snippet,
      contentHash: hash("gmail", String(e.id), subject, snippet),
      sentAt: new Date().toISOString(),
      direction: "inbound",
      metadata: { subject, from: e.from, to: e.to, unread: e.unread !== false },
    };
  });
}

function normalizeSlack(integrationId: string, raw: unknown): NormalizedEntity[] {
  return normalizeMessages("slack", integrationId, raw, (m) => {
    const text = typeof m.text === "string" ? m.text : "";
    if (!text) return null;
    return {
      providerId: String(m.ts ?? m.client_msg_id ?? `${Date.now()}_${Math.random()}`),
      channelId: m.channel || null,
      bodyText: text,
      contentHash: hash("slack", String(m.ts), text),
      sentAt: m.ts ? new Date(Number(m.ts) * 1000).toISOString() : new Date().toISOString(),
      direction: "inbound",
      metadata: { user: m.user || null },
    };
  });
}

function normalizeTelegram(integrationId: string, raw: unknown): NormalizedEntity[] {
  // Raw input is either getUpdates payloads or unified_messages rows (webhook).
  return normalizeMessages("telegram", integrationId, raw, (m) => {
    if (m.body_text != null) {
      // Already a stored row — carry through unchanged.
      const text = String(m.body_text);
      if (!text) return null;
      return {
        providerId: String(m.provider_message_id),
        channelId: m.channel_id || null,
        bodyText: text,
        contentHash: hash("telegram", String(m.provider_message_id), text),
        sentAt: m.sent_at || new Date().toISOString(),
        direction: "inbound",
        metadata: (m.metadata as Record<string, unknown>) || {},
      };
    }
    const text = typeof m.text === "string" ? m.text : "";
    if (!text) return null;
    const from = (m.from as Record<string, unknown>) || {};
    return {
      providerId: `msg_${m.message_id ?? Date.now()}`,
      channelId: m.chat?.id != null ? String(m.chat.id) : null,
      bodyText: text,
      contentHash: hash("telegram", String(m.message_id), text),
      sentAt: m.date ? new Date(Number(m.date) * 1000).toISOString() : new Date().toISOString(),
      direction: "inbound",
      metadata: { from: (from.username || from.first_name) ?? null },
    };
  });
}

function normalizeDiscord(integrationId: string, raw: unknown): NormalizedEntity[] {
  return normalizeMessages("discord", integrationId, raw, (d) => {
    const content = typeof d.content === "string" ? d.content : "";
    if (!content && !d.embeds) return null;
    const embeds = Array.isArray(d.embeds) ? d.embeds : [];
    const embedText = embeds
      .map((em: any) => [em.title, em.description].filter(Boolean).join(" — "))
      .filter(Boolean)
      .join("\n");
    const bodyText = [content, embedText].filter(Boolean).join("\n");
    return {
      providerId: String(d.id),
      channelId: d.channelId || null,
      bodyText,
      contentHash: hash("discord", String(d.id), bodyText),
      sentAt: d.timestamp ? isoOrNow(d.timestamp) : new Date().toISOString(),
      direction: "inbound",
      metadata: {
        author: d.author,
        guildName: d.guildName,
        channelName: d.channelName,
        mentions: d.mentions ?? [],
        replyTo: d.replyTo ?? null,
        embeds: embeds.length,
      },
    };
  });
}

function normalizeWhatsApp(integrationId: string, raw: unknown): NormalizedEntity[] {
  return normalizeMessages("whatsapp", integrationId, raw, (w) => {
    const text = typeof w.message === "string" ? w.message : "";
    if (!text) return null;
    return {
      providerId: String(w.id),
      channelId: w.from || null,
      bodyText: text,
      contentHash: hash("whatsapp", String(w.id), text),
      sentAt: w.timestamp ? isoOrNow(w.timestamp) : new Date().toISOString(),
      direction: "inbound",
      metadata: { fromName: w.fromName, isGroup: !!w.isGroup, groupName: w.senderName || null },
    };
  });
}

function normalizeGitHub(integrationId: string, raw: unknown): NormalizedEntity[] {
  const r = (raw as Record<string, unknown>) || {};
  const out: NormalizedEntity[] = [];
  if (Array.isArray(r.issues)) {
    for (const i of r.issues as any[]) {
      out.push({
        entityKind: "task",
        integrationId,
        providerId: String(i.id),
        providerTaskId: String(i.number),
        kind: "issue",
        title: `#${i.number} ${i.title}`,
        status: i.state || "open",
        repoId: null,
        url: i.html_url || null,
        metadata: {
          repo: i.repository?.full_name || i.repository_url || null,
          comments: i.comments ?? 0,
          createdAt: i.created_at ?? null,
        },
      } satisfies UnifiedTask);
    }
  }
  if (Array.isArray(r.notifications)) {
    for (const n of r.notifications as any[]) {
      out.push({
        entityKind: "notification",
        integrationId,
        providerId: String(n.id),
        providerNotificationId: String(n.id),
        kind: n.subject?.type || "notification",
        title: n.subject?.title || "GitHub notification",
        read: n.unread === false,
        url: n.subject?.url || n.html_url || null,
        metadata: { repo: n.repository?.full_name || null, reason: n.reason || null },
      } satisfies UnifiedNotification);
    }
  }
  return out;
}

function normalizeLinkedIn(integrationId: string, raw: unknown): NormalizedEntity[] {
  const p = Array.isArray(raw) ? (raw as any[])[0] : raw;
  if (!p || typeof p !== "object") return [];
  const profile = p as Record<string, unknown>;
  if (!profile.sub && !profile.name && !profile.email) return [];
  return [
    {
      entityKind: "notification",
      integrationId,
      providerId: `linkedin_profile_${String(profile.sub ?? "static")}`,
      providerNotificationId: `linkedin_profile_${String(profile.sub ?? "static")}`,
      kind: "profile",
      title: `LinkedIn profile: ${profile.name || profile.email || "connected"}`,
      read: true,
      url: profile.picture ? String(profile.picture) : null,
      metadata: { name: profile.name, email: profile.email, givenName: profile.given_name },
    } satisfies UnifiedNotification,
  ];
}

function normalizeCalendar(integrationId: string, raw: unknown): NormalizedEntity[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedEntity[] = [];
  for (const e of raw as any[]) {
    if (!e?.id) continue;
    out.push({
      entityKind: "event",
      integrationId,
      providerId: String(e.id),
      providerEventId: String(e.id),
      title: e.summary || "Calendar event",
      startsAt: e.start?.dateTime || e.start?.date || null,
      endsAt: e.end?.dateTime || e.end?.date || null,
      attendees: Array.isArray(e.attendees) ? e.attendees.map((a: any) => a.email || a) : [],
      metadata: { description: e.description || null, link: e.htmlLink || null },
    } satisfies UnifiedEvent);
  }
  return out;
}

const NORMALIZERS: Record<string, (integrationId: string, raw: unknown) => NormalizedEntity[]> = {
  gmail: normalizeGmail,
  slack: normalizeSlack,
  telegram: normalizeTelegram,
  discord: normalizeDiscord,
  whatsapp: normalizeWhatsApp,
  github: normalizeGitHub,
  linkedin: normalizeLinkedIn,
  calendar: normalizeCalendar,
};

/** Normalize a provider's raw fetch result into unified entities. */
export function normalizeResult(providerId: string, raw: unknown, integrationId: string): NormalizedEntity[] {
  const fn = NORMALIZERS[providerId];
  if (!fn) return [];
  return fn(integrationId, raw);
}

// ─── AI shape — uniform, priority-friendly view the model consumes ──────────

function messageAiShape(e: UnifiedMessage): Record<string, unknown> {
  const meta = (e.metadata || {}) as Record<string, unknown>;
  const sender =
    meta.fromName || meta.author || meta.user || meta.from || "unknown";
  const subject = meta.subject ? `[${meta.subject}] ` : "";
  return {
    id: e.providerId,
    sender,
    text: `${subject}${e.bodyText}`,
    channel: e.channelId || meta.channelName || meta.guildName || null,
    timestamp: e.sentAt,
    isGroup: meta.isGroup || null,
    unread: meta.unread ?? null,
  };
}

/** Convert normalized entities to the AI input shape, keyed like the provider raw payload. */
export function aiShapeForProvider(providerId: string, entities: NormalizedEntity[]): unknown {
  switch (providerId) {
    case "gmail":
    case "slack":
    case "telegram":
    case "discord":
    case "whatsapp":
      return entities.map((e) => messageAiShape(e as UnifiedMessage));
    case "github": {
      const issues: Record<string, unknown>[] = [];
      const notifications: Record<string, unknown>[] = [];
      for (const e of entities) {
        if (e.entityKind === "task") {
          const t = e as UnifiedTask;
          issues.push({ id: t.providerId, title: t.title, state: t.status, url: t.url, repo: t.metadata?.repo });
        } else if (e.entityKind === "notification") {
          const n = e as UnifiedNotification;
          notifications.push({ id: n.providerId, title: n.title, kind: n.kind, url: n.url, read: n.read });
        }
      }
      return { issues, notifications };
    }
    case "linkedin":
      return entities.map((e) => {
        const n = e as UnifiedNotification;
        return { id: n.providerId, title: n.title, kind: n.kind, url: n.url, metadata: n.metadata };
      });
    case "calendar":
      return entities.map((e) => {
        const ev = e as UnifiedEvent;
        return { id: ev.providerId, title: ev.title, startsAt: ev.startsAt, endsAt: ev.endsAt, attendees: ev.attendees };
      });
    default:
      return entities;
  }
}

/** Build a human-readable per-provider manifest for the AI prompt. */
export function buildManifest(health: ProviderHealthReport): string {
  return Object.entries(health)
    .map(([provider, h]) => `${provider}: ${h.aiUsed} item${h.aiUsed === 1 ? "" : "s"}`)
    .join(", ");
}

/**
 * Anti-hallucination provenance gate (Phase 13). The AI is NOT allowed to emit
 * an item for a platform that produced no normalized records in this run
 * ("fabricated"), nor more items per platform than the number of real records
 * it was handed ("over-count"). With `requireTraceable`, every surviving AI
 * item must additionally trace to a real synchronized entity by `sourceId`
 * (or `correlationKey` → metadata.threadId). Untraceable items are dropped —
 * they cannot be verified, so they are never rendered.
 */
export function filterGroundedItems<T extends { platform?: string }>(
  items: T[],
  contextEntities: Record<string, unknown[]>,
  opts: { requireTraceable?: boolean } = {}
): { grounded: T[]; droppedPlatforms: string[]; droppedUntraceable: { platform: string; title: string }[] } {
  const grounded: T[] = [];
  const droppedPlatforms = new Set<string>();
  const droppedUntraceable: { platform: string; title: string }[] = [];
  for (const item of items) {
    const ents = contextEntities[item.platform as string] || [];
    if (ents.length === 0) {
      if (item.platform) droppedPlatforms.add(item.platform);
      continue;
    }
    if (opts.requireTraceable && !tracesToEntity(item, ents)) {
      droppedUntraceable.push({ platform: item.platform as string, title: (item as { title?: string }).title ?? "" });
      continue;
    }
    grounded.push(item);
  }
  // Per-provider budget — no more items than real records exist.
  const budget = new Map<string, number>();
  const clamped: T[] = [];
  for (const item of grounded) {
    const remaining = budget.get(item.platform as string) ?? (contextEntities[item.platform as string] || []).length;
    if (remaining <= 0) continue;
    clamped.push(item);
    budget.set(item.platform as string, remaining - 1);
  }
  return { grounded: clamped, droppedPlatforms: [...droppedPlatforms], droppedUntraceable };
}

/** True when an AI item references a real synchronized entity. */
function tracesToEntity<T>(item: T, ents: unknown[]): boolean {
  const { sourceId, correlationKey } = item as { sourceId?: string; correlationKey?: string };
  if (sourceId) {
    return ents.some((e) => String((e as { providerId?: unknown }).providerId) === String(sourceId));
  }
  if (correlationKey) {
    return ents.some(
      (e) =>
        (e as { metadata?: Record<string, unknown> }).metadata?.threadId !== undefined &&
        String((e as { metadata?: Record<string, unknown> }).metadata?.threadId) === String(correlationKey)
    );
  }
  return false;
}

// ─── Backend-enforced coverage ──────────────────────────────────────────────

/** A real briefing item built from a normalized record — never placeholder. */
export interface CoverageItem {
  platform: string;
  category: string;
  title: string;
  priority: "high" | "normal" | "low";
  shortSummary: string;
  originalContent: string;
  sourceId?: string;
  correlationKey?: string;
  from?: string;
  to?: string;
}

function coverageCategory(entityKind: string, providerId: string): string {
  if (providerId === "gmail" || providerId === "outlook") return "email";
  if (entityKind === "event") return "meetings";
  if (entityKind === "task") return "tasks";
  if (entityKind === "notification") return "followUps";
  return "messages";
}

/**
 * Backend-enforced provider coverage. The AI may summarize, prioritize and
 * group, but the BACKEND guarantees every provider with real records is
 * represented in the briefing. If the AI skipped a provider, real items are
 * built from its fetched records here — every field traces to a real record.
 */
export function buildCoverageItems(providerId: string, entities: NormalizedEntity[]): CoverageItem[] {
  const out: CoverageItem[] = [];
  for (const e of entities.slice(0, 3)) {
    const rec = e as NormalizedEntity & { bodyText?: string; metadata?: Record<string, unknown>; providerId?: string };
    const meta = rec.metadata || {};
    const body = typeof rec.bodyText === "string" ? rec.bodyText.trim() : "";
    const subject = meta.subject ?? meta.title;
    const title = subject
      ? String(subject)
      : (body.split("\n")[0] || `${providerId} update`).slice(0, 160);
    const category = coverageCategory(e.entityKind, providerId);
    out.push({
      platform: providerId,
      category,
      title,
      priority: "normal",
      shortSummary: body.slice(0, 140) || title,
      originalContent: body || title,
      sourceId: rec.providerId || undefined,
      correlationKey: meta.threadId ? String(meta.threadId) : undefined,
      from: category === "email" ? String(meta.from || "") || undefined : undefined,
    });
  }
  return out;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, normal: 2, low: 3 };

/**
 * Build a Telegram-friendly brief body from REAL persisted briefing items only.
 * Deterministic — never invokes the LLM, so nothing fabricated can slip in.
 * High-priority items first; every line references an actual synchronized item.
 */
export function composeBriefBody(
  items: Array<{ platform: string; priority: string; timestamp?: string; metadata?: { title?: unknown } | null }>,
  opts: { scope: "daily" | "weekly"; limit?: number } = { scope: "daily" }
): string {
  const limit = opts.limit ?? (opts.scope === "daily" ? 5 : 8);
  const lines: string[] = [];
  const sorted = [...items].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
  );
  for (const it of sorted.slice(0, limit)) {
    const meta = (it.metadata ?? {}) as Record<string, unknown>;
    const title = String(meta.title || "Untitled item");
    const time = it.timestamp ? new Date(it.timestamp).toISOString().slice(11, 16) : "";
    lines.push(`• <b>[${it.platform}]</b> ${title}${time ? ` (${time})` : ""}`);
  }
  if (lines.length === 0) return "No recent workspace activity to report.";
  const header = opts.scope === "daily" ? "Here is what's happening today" : "Your weekly priority summary";
  return `<b>${header}:</b>\n` + lines.join("\n");
}
