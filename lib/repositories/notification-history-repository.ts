export interface NotificationHistoryRecord {
  id?: string;
  user_id: string;
  notification_type: string;
  provider: string;
  title?: string | null;
  message: string;
  status: "queued" | "sent" | "delivered" | "failed" | "cancelled" | "retrying" | "read" | "acknowledged" | "processing";
  sent_at: string;
  delivered_at?: string | null;
  error_message?: string | null;
  metadata?: Record<string, unknown>;
  retry_count?: number;
  retry_at?: string | null;
  provider_response?: Record<string, unknown> | null;
  source_event?: string | null;
  template?: string | null;
  created_at?: string;
}

export class NotificationHistoryRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async findByUserId(userId: string, limit = 50): Promise<NotificationHistoryRecord[]> {
    const { data, error } = await this.db.database
      .from("notification_history")
      .select("*")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as NotificationHistoryRecord[];
  }

  async findRecent(userId: string, type?: string): Promise<NotificationHistoryRecord | null> {
    let query = this.db.database
      .from("notification_history")
      .select("*")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(1);

    if (type) {
      query = query.eq("notification_type", type);
    }

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;
    return data[0] as NotificationHistoryRecord;
  }

  async findDueForProcessing(): Promise<NotificationHistoryRecord[]> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("notification_history")
      .select("*")
      .or(`status.eq.queued,and(status.eq.retrying,retry_at.lte.${now})`)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error || !data) return [];
    return data as NotificationHistoryRecord[];
  }

  async insert(record: {
    user_id: string;
    notification_type: string;
    provider?: string;
    title?: string;
    message: string;
    status?: "queued" | "sent" | "delivered" | "failed" | "cancelled" | "retrying" | "read" | "acknowledged" | "processing";
    error_message?: string;
    metadata?: Record<string, unknown>;
    retry_count?: number;
    retry_at?: string | null;
    provider_response?: Record<string, unknown> | null;
    source_event?: string | null;
    template?: string | null;
  }): Promise<{ success: boolean; id?: string }> {
    const { data, error } = await this.db.database
      .from("notification_history")
      .insert({
        user_id: record.user_id,
        notification_type: record.notification_type,
        provider: record.provider || "telegram",
        title: record.title,
        message: record.message,
        status: record.status || "queued",
        error_message: record.error_message,
        metadata: record.metadata || {},
        retry_count: record.retry_count || 0,
        retry_at: record.retry_at,
        provider_response: record.provider_response,
        source_event: record.source_event,
        template: record.template,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to log notification: ${error.message}`);
    return { success: true, id: data.id };
  }

  async updateStatus(
    id: string,
    status: "sent" | "delivered" | "failed" | "cancelled" | "processing" | "retrying" | "read" | "acknowledged",
    errorMessage?: string,
    providerResponse?: Record<string, unknown>
  ): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (status === "delivered") {
      update.delivered_at = new Date().toISOString();
    }
    if (errorMessage) {
      update.error_message = errorMessage;
    }
    if (providerResponse) {
      update.provider_response = providerResponse;
    }
    try {
      await this.db.database.from("notification_history").update(update).eq("id", id);
    } catch (error) {
      console.error(`Failed to update status for notification ${id}:`, error);
    }
  }

  async incrementRetry(id: string, retryCount: number, retryAt: string, errorMessage?: string): Promise<void> {
    const update: Record<string, unknown> = {
      status: "retrying",
      retry_count: retryCount,
      retry_at: retryAt,
    };
    if (errorMessage) {
      update.error_message = errorMessage;
    }
    try {
      await this.db.database.from("notification_history").update(update).eq("id", id);
    } catch (error) {
      console.error(`Failed to increment retry for notification ${id}:`, error);
    }
  }

  async getStats(userId: string): Promise<{
    total: number;
    sent: number;
    failed: number;
    delivered: number;
    lastSentAt: string | null;
  }> {
    const db = this.db.database;
    const { count: total } = await db
      .from("notification_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);
    const { count: sent } = await db
      .from("notification_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .in("status", ["sent", "delivered"]);
    const { count: failed } = await db
      .from("notification_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "failed");
    const { count: delivered } = await db
      .from("notification_history")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "delivered");

    const { data: last } = await db
      .from("notification_history")
      .select("sent_at")
      .eq("user_id", userId)
      .in("status", ["sent", "delivered"])
      .order("sent_at", { ascending: false })
      .limit(1);
    const lastSentAt = last && last.length > 0 ? last[0].sent_at : null;

    return {
      total: total || 0,
      sent: sent || 0,
      failed: failed || 0,
      delivered: delivered || 0,
      lastSentAt,
    };
  }
}