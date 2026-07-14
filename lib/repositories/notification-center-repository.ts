export interface NotificationCenterRecord {
  id?: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  provider: string;
  status: "unread" | "read" | "archived";
  external_history_id?: string | null;
  read_at?: string | null;
  archived_at?: string | null;
  created_at?: string;
}

export class NotificationCenterRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; status?: "unread" | "read" | "archived"; type?: string }
  ): Promise<NotificationCenterRecord[]> {
    let query = this.db.database
      .from("notification_center")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.type) {
      query = query.eq("notification_type", options.type);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as NotificationCenterRecord[];
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count, error } = await this.db.database
      .from("notification_center")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "unread");
    if (error) return 0;
    return count || 0;
  }

  async insert(record: {
    user_id: string;
    notification_type: string;
    title: string;
    body: string;
    provider: string;
    external_history_id?: string;
  }): Promise<{ success: boolean; id?: string }> {
    const { data, error } = await this.db.database
      .from("notification_center")
      .insert({
        user_id: record.user_id,
        notification_type: record.notification_type,
        title: record.title,
        body: record.body,
        provider: record.provider,
        status: "unread",
        external_history_id: record.external_history_id || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to insert notification center record: ${error.message}`);
    return { success: true, id: data.id };
  }

  async markAsRead(userId: string, ids: string[]): Promise<{ success: boolean }> {
    const { error } = await this.db.database
      .from("notification_center")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", ids);
    if (error) throw new Error(`Failed to mark as read: ${error.message}`);
    return { success: true };
  }

  async markAsArchived(userId: string, ids: string[]): Promise<{ success: boolean }> {
    const { error } = await this.db.database
      .from("notification_center")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", ids);
    if (error) throw new Error(`Failed to archive: ${error.message}`);
    return { success: true };
  }

  async delete(userId: string, ids: string[]): Promise<{ success: boolean }> {
    const { error } = await this.db.database
      .from("notification_center")
      .delete()
      .eq("user_id", userId)
      .in("id", ids);
    if (error) throw new Error(`Failed to delete: ${error.message}`);
    return { success: true };
  }

  async search(userId: string, query: string, limit = 20): Promise<NotificationCenterRecord[]> {
    const { data, error } = await this.db.database
      .from("notification_center")
      .select("*")
      .eq("user_id", userId)
      .or(`title.ilike.%${query}%,body.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as NotificationCenterRecord[];
  }
}