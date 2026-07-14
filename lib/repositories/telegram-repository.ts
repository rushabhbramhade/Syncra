export interface TelegramConnection {
  id?: string;
  user_id: string;
  chat_id: string;
  telegram_username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  connected_at?: string;
  last_verified?: string;
  status: "active" | "disconnected" | "revoked";
  created_at?: string;
  updated_at?: string;
}

export class TelegramRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async findByUserId(userId: string): Promise<TelegramConnection | null> {
    const { data, error } = await this.db.database
      .from("telegram_connections")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return data as TelegramConnection;
  }

  async findByChatId(chatId: string): Promise<TelegramConnection | null> {
    const { data, error } = await this.db.database
      .from("telegram_connections")
      .select("*")
      .eq("chat_id", chatId)
      .maybeSingle();
    if (error || !data) return null;
    return data as TelegramConnection;
  }

  async getActive(userId: string): Promise<TelegramConnection | null> {
    const { data, error } = await this.db.database
      .from("telegram_connections")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (error || !data) return null;
    return data as TelegramConnection;
  }

  async upsert(record: {
    user_id: string;
    chat_id: string;
    telegram_username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    status?: "active" | "disconnected" | "revoked";
  }): Promise<{ success: boolean; id?: string }> {
    const now = new Date().toISOString();
    const existing = await this.findByUserId(record.user_id);

    if (existing) {
      const { error } = await this.db.database
        .from("telegram_connections")
        .update({
          chat_id: record.chat_id,
          telegram_username: record.telegram_username ?? existing.telegram_username,
          first_name: record.first_name ?? existing.first_name,
          last_name: record.last_name ?? existing.last_name,
          status: record.status ?? existing.status,
          last_verified: now,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (error) throw new Error(`Failed to update telegram connection: ${error.message}`);
      return { success: true, id: existing.id };
    }

    const { data, error } = await this.db.database
      .from("telegram_connections")
      .insert({
        user_id: record.user_id,
        chat_id: record.chat_id,
        telegram_username: record.telegram_username,
        first_name: record.first_name,
        last_name: record.last_name,
        status: record.status || "active",
        connected_at: now,
        last_verified: now,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Failed to create telegram connection: ${error.message}`);
    return { success: true, id: data.id };
  }

  async disconnect(userId: string): Promise<{ success: boolean }> {
    const { error } = await this.db.database
      .from("telegram_connections")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(`Failed to disconnect telegram: ${error.message}`);
    return { success: true };
  }

  async delete(userId: string): Promise<{ success: boolean }> {
    const { error } = await this.db.database
      .from("telegram_connections")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(`Failed to delete telegram connection: ${error.message}`);
    return { success: true };
  }

  async updateVerified(userId: string): Promise<void> {
    try {
      await this.db.database
        .from("telegram_connections")
        .update({ last_verified: new Date().toISOString() })
        .eq("user_id", userId);
    } catch {}
  }
}
