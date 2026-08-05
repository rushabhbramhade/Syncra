import { createAdminDb } from "@/lib/db";

export interface SyncStateRecord {
  integration_id: string;
  user_id: string;
  provider: string;
  cursor: Record<string, unknown>;
  last_full_sync_at?: string | null;
  last_incremental_at?: string | null;
  next_backfill_after?: string | null;
  updated_at?: string;
}

export class SyncStateRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async get(integrationId: string): Promise<SyncStateRecord | null> {
    const { data, error } = await this.db.database
      .from("sync_state")
      .select("*")
      .eq("integration_id", integrationId)
      .maybeSingle();
    if (error || !data) return null;
    return data as SyncStateRecord;
  }

  /** Get-or-create with default cursor; returns the record. */
  async getOrCreate(
    integrationId: string,
    userId: string,
    provider: string
  ): Promise<SyncStateRecord> {
    const existing = await this.get(integrationId);
    if (existing) return existing;
    await this.db.database.from("sync_state").insert([
      {
        integration_id: integrationId,
        user_id: userId,
        provider,
        cursor: {},
      },
    ]);
    return (await this.get(integrationId)) as SyncStateRecord;
  }

  /** Advance the watermark after a batch commits — crash-safe: update only after upsert. */
  async advanceCursor(integrationId: string, cursor: Record<string, unknown>): Promise<void> {
    await this.db.database
      .from("sync_state")
      .update({ cursor, updated_at: new Date().toISOString() })
      .eq("integration_id", integrationId);
  }

  async markFullSync(integrationId: string): Promise<void> {
    await this.db.database
      .from("sync_state")
      .update({
        last_full_sync_at: new Date().toISOString(),
        next_backfill_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("integration_id", integrationId);
  }

  async markIncremental(integrationId: string): Promise<void> {
    await this.db.database
      .from("sync_state")
      .update({ last_incremental_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("integration_id", integrationId);
  }
}

export function getSyncStateRepo(): SyncStateRepository {
  return new SyncStateRepository(createAdminDb());
}
