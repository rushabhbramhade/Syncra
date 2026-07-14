export interface AISummaryCacheRecord {
  id?: string;
  user_id: string;
  summary_type: "daily_brief" | "priority_summary";
  cache_key: string;
  content: string;
  expires_at: string;
  created_at?: string;
}

export class AISummaryCacheRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async findCached(userId: string, summaryType: "daily_brief" | "priority_summary", cacheKey: string): Promise<string | null> {
    const { data, error } = await this.db.database
      .from("ai_summary_cache")
      .select("content, expires_at")
      .eq("user_id", userId)
      .eq("summary_type", summaryType)
      .eq("cache_key", cacheKey)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    return data.content;
  }

  async upsert(record: {
    user_id: string;
    summary_type: "daily_brief" | "priority_summary";
    cache_key: string;
    content: string;
    expires_at: string;
  }): Promise<{ success: boolean }> {
    const { error } = await this.db.database
      .from("ai_summary_cache")
      .upsert({
        user_id: record.user_id,
        summary_type: record.summary_type,
        cache_key: record.cache_key,
        content: record.content,
        expires_at: record.expires_at,
      }, { onConflict: "user_id,summary_type,cache_key" });
    if (error) throw new Error(`Failed to upsert AI summary cache: ${error.message}`);
    return { success: true };
  }

  async cleanupExpired(): Promise<number> {
    const { data, error } = await this.db.database
      .from("ai_summary_cache")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");
    if (error) return 0;
    return data?.length || 0;
  }
}