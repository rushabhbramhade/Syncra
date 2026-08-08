import type { SyncLogRecord } from "@/lib/repositories/integrations-repository";

/**
 * Sync-evidence helpers for the integration fetch path. Pure module — no DB,
 * no provider imports — so the briefing-originated sync-log contract can be
 * unit-tested in isolation (actions-core itself pulls heavy provider deps).
 */

/**
 * Actions that represent a real fetch of provider data — the ones underlying
 * both the briefing pipeline and the sync engine. Only these MCP calls write
 * to integration_sync_logs, so the Integration Health card reflects genuine
 * data-fetch evidence. Transitive calls (send message, edit issue, …) are
 * NOT sync evidence and must never appear as "recent activity".
 */
export const SYNC_EVIDENCE_ACTIONS: ReadonlySet<string> = new Set([
  "gmail_search_emails",
  "outlook_search_emails",
  "slack_fetch_messages",
  "whatsapp_fetch_messages",
  "telegram_fetch_messages",
  "discord_fetch_recent_messages",
  "calendar_list_events",
  "notion_search",
  "linear_list_issues",
  "linkedin_get_profile",
  "github_list_issues",
  "github_get_notifications",
  "github_get_recent_activity",
]);

export function isSyncEvidenceAction(actionName: string): boolean {
  return SYNC_EVIDENCE_ACTIONS.has(actionName);
}

/** Count real items in a raw fetch result (arrays + nested array fields). */
export function countResultItems(value: unknown): number {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === "object") {
    let total = 0;
    for (const v of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(v)) total += v.length;
    }
    return total;
  }
  return 0;
}

export interface SyncEvidenceParams {
  userId: string;
  providerId: string;
  actionName: string;
  status: "success" | "error";
  message: string;
  itemCount?: number;
  error?: string | null;
  durationMs?: number;
}

/**
 * Build the integration_sync_logs row for a briefing-originated provider fetch.
 * Carries the canonical auth id, the real provider, the action, accurate status
 * and — when present — the fetched item count. Failure never reports healthy.
 */
export function buildSyncEvidenceEntry(p: SyncEvidenceParams): SyncLogRecord {
  const metadata: Record<string, unknown> = { action: p.actionName, source: "briefing" };
  if (p.itemCount != null) metadata.itemCount = p.itemCount;
  if (p.error) metadata.error = p.error;
  return {
    user_id: p.userId,
    provider: p.providerId,
    status: p.status,
    message: p.message,
    metadata,
    duration_ms: p.durationMs,
  };
}

/** Human message for a real fetch outcome. */
export function syncEvidenceMessage(p: {
  actionName: string;
  status: "success" | "error";
  itemCount?: number;
  error?: string | null;
}): string {
  return p.status === "success"
    ? `Fetch completed via ${p.actionName}${p.itemCount != null ? ` (${p.itemCount} items).` : "."}`
    : `Fetch failed via ${p.actionName}: ${p.error || "unknown error"}`;
}