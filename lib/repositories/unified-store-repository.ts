import { createAdminDb } from "@/lib/db";
import type { NormalizedEntity } from "@/lib/integrations/types";

/**
 * Unified entity store — the single write path for all normalized entities.
 * Workers batch rows (≥10 per call, uses InsForge array insert); every entity
 * carries a unique constraint key so re-syncs upsert instead of duplicating.
 */
export class UnifiedStoreRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  private readonly tableMap: Record<NormalizedEntity["entityKind"], string> = {
    message: "unified_messages",
    thread: "unified_threads",
    conversation: "unified_conversations",
    contact: "unified_contacts",
    task: "unified_tasks",
    repo: "unified_repos",
    event: "unified_events",
    notification: "unified_notifications",
    attachment: "unified_attachments",
  };

  private readonly conflictMap: Record<NormalizedEntity["entityKind"], string> = {
    message: "integration_id,provider_message_id",
    thread: "integration_id,provider_thread_id",
    conversation: "integration_id,kind,channel_id",
    contact: "integration_id,email",
    task: "integration_id,provider_task_id",
    repo: "integration_id,provider_repo_id",
    event: "integration_id,provider_event_id",
    notification: "integration_id,provider_notification_id",
    attachment: "integration_id,provider_attachment_id",
  };

  /**
   * Upsert a batch of entities. Returns count of rows written.
   * Entities are grouped by table so each insert call targets one table.
   */
  async upsertBatch(userId: string, integrationId: string, entities: NormalizedEntity[]): Promise<number> {
    let written = 0;
    const grouped = new Map<NormalizedEntity["entityKind"], Record<string, unknown>[]>();

    for (const entity of entities) {
      const rows = grouped.get(entity.entityKind) ?? [];
      rows.push(this.toRow(userId, integrationId, entity));
      grouped.set(entity.entityKind, rows);
    }

    for (const [kind, rows] of grouped) {
      const table = this.tableMap[kind];
      const { error } = await this.db.database
        .from(table)
        .upsert(rows, { onConflict: this.conflictMap[kind] });
      if (error) {
        console.error(`[UnifiedStore] upsert failed on ${table}:`, error.message);
        continue;
      }
      written += rows.length;
    }
    return written;
  }

  private toRow(userId: string, integrationId: string, entity: NormalizedEntity): Record<string, unknown> {
    const row: Record<string, unknown> = {
      user_id: userId,
      integration_id: integrationId,
      provider_id: entity.providerId,
      entity_kind: entity.entityKind,
      metadata: entity.metadata ?? {},
    };

    switch (entity.entityKind) {
      case "message":
        row.provider_message_id = entity.providerId;
        row.thread_id = entity.threadId ?? null;
        row.conversation_id = entity.conversationId ?? null;
        row.channel_id = entity.channelId ?? null;
        row.author_contact_id = entity.authorContactId ?? null;
        row.body_text = entity.bodyText;
        row.body_html = entity.bodyHtml ?? null;
        row.content_hash = entity.contentHash;
        row.sent_at = entity.sentAt;
        row.direction = entity.direction;
        break;
      case "thread":
        row.provider_thread_id = entity.providerThreadId ?? null;
        row.subject = entity.subject ?? null;
        row.participant_ids = entity.participantIds;
        row.last_message_at = entity.lastMessageAt ?? null;
        break;
      case "conversation":
        row.kind = entity.kind;
        row.title = entity.title ?? null;
        row.channel_id = entity.channelId ?? null;
        row.participant_ids = entity.participantIds;
        break;
      case "task":
        row.provider_task_id = entity.providerTaskId ?? entity.providerId;
        row.kind = entity.kind;
        row.title = entity.title;
        row.status = entity.status ?? null;
        row.priority = entity.priority ?? null;
        row.assignee_contact_id = entity.assigneeContactId ?? null;
        row.repo_id = entity.repoId ?? null;
        row.url = entity.url ?? null;
        break;
      case "repo":
        row.provider_repo_id = entity.providerRepoId;
        row.full_name = entity.fullName;
        row.private = entity.private;
        break;
      case "event":
        row.provider_event_id = entity.providerEventId ?? entity.providerId;
        row.title = entity.title ?? null;
        row.starts_at = entity.startsAt ?? null;
        row.ends_at = entity.endsAt ?? null;
        row.attendees = entity.attendees;
        break;
      case "notification":
        row.provider_notification_id = entity.providerNotificationId ?? entity.providerId;
        row.kind = entity.kind ?? null;
        row.title = entity.title ?? null;
        row.read = entity.read;
        row.url = entity.url ?? null;
        break;
      case "attachment":
        row.provider_attachment_id = entity.providerAttachmentId ?? entity.providerId;
        row.storage_key = entity.storageKey ?? null;
        row.url = entity.url ?? null;
        row.filename = entity.filename ?? null;
        row.mime_type = entity.mimeType ?? null;
        row.size_bytes = entity.sizeBytes ?? null;
        row.extracted_text = entity.extractedText ?? null;
        break;
      case "contact":
        row.provider_contact_id = entity.providerContactId ?? entity.providerId;
        row.email = entity.email ?? null;
        row.name = entity.name ?? null;
        row.avatar_url = entity.avatarUrl ?? null;
        break;
    }
    return row;
  }
}

export function getUnifiedStoreRepo(): UnifiedStoreRepository {
  return new UnifiedStoreRepository(createAdminDb());
}

/** Most recent inbound messages for an integration — used by providers whose
 *  message ingress (webhook) lands here and whose native API has no history. */
export async function getRecentMessages(
  userId: string,
  integrationId: string,
  limit = 10
): Promise<Record<string, unknown>[]> {
  const db = createAdminDb();
  const { data, error } = await db.database
    .from("unified_messages")
    .select("*")
    .eq("user_id", userId)
    .eq("integration_id", integrationId)
    .order("sent_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[UnifiedStore] getRecentMessages failed:", error.message);
    return [];
  }
  return data ?? [];
}