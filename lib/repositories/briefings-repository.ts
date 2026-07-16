export interface BriefingScheduleRecord {
  id?: string;
  user_id: string;
  name: string;
  goal?: string | null;
  description?: string | null;
  integrations: string[];
  categories: string[];
  frequency: string;
  timezone: string;
  enabled: boolean;
  last_run?: string | null;
  next_run?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BriefingRecord {
  id?: string;
  user_id: string;
  schedule_id?: string | null;
  title: string;
  executive_summary: string;
  full_content?: Record<string, unknown> | null;
  priority_score: number;
  generated_at: string;
  ai_model?: string | null;
  status: string;
  created_at?: string;
}

export interface BriefingItemRecord {
  id?: string;
  briefing_id: string;
  platform: string;
  category: string;
  source_id?: string | null;
  metadata?: Record<string, unknown> | null;
  priority: string;
  status: "unread" | "read" | "completed" | "archived" | "snoozed";
  notes?: string | null;
  snoozed_until?: string | null;
  timestamp: string;
  created_at?: string;
}

export interface BriefingHistoryRecord {
  id?: string;
  user_id: string;
  schedule_id?: string | null;
  briefing_id?: string | null;
  execution_time: string;
  duration?: number | null;
  status: string;
  errors?: string | null;
  ai_tokens_used?: number | null;
  trigger_source: string;
}

export class BriefingsRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  // ── BRIEFING SCHEDULES ──

  async findScheduleById(id: string): Promise<BriefingScheduleRecord | null> {
    const { data, error } = await this.db.database
      .from("briefing_schedules")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return data as BriefingScheduleRecord;
  }

  async findSchedulesByUserId(userId: string): Promise<BriefingScheduleRecord[]> {
    const { data, error } = await this.db.database
      .from("briefing_schedules")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error || !data) return [];
    return data as BriefingScheduleRecord[];
  }

  async findDueSchedules(now: string = new Date().toISOString()): Promise<BriefingScheduleRecord[]> {
    const { data, error } = await this.db.database
      .from("briefing_schedules")
      .select("*")
      .eq("enabled", true)
      .lte("next_run", now);

    if (error || !data) return [];
    return data as BriefingScheduleRecord[];
  }

  async createSchedule(schedule: Omit<BriefingScheduleRecord, "id" | "created_at" | "updated_at">): Promise<BriefingScheduleRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("briefing_schedules")
      .insert([{
        ...schedule,
        created_at: now,
        updated_at: now,
      }])
      .select()
      .single();

    if (error) throw new Error(`Failed to create schedule: ${error.message}`);
    return data as BriefingScheduleRecord;
  }

  async updateSchedule(id: string, updates: Partial<BriefingScheduleRecord>): Promise<BriefingScheduleRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("briefing_schedules")
      .update({
        ...updates,
        updated_at: now,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update schedule: ${error.message}`);
    return data as BriefingScheduleRecord;
  }

  async deleteSchedule(id: string, userId: string): Promise<boolean> {
    const { error } = await this.db.database
      .from("briefing_schedules")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to delete schedule: ${error.message}`);
    return true;
  }

  // ── BRIEFINGS ──

  async findBriefingById(id: string): Promise<BriefingRecord | null> {
    const { data, error } = await this.db.database
      .from("briefings")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return data as BriefingRecord;
  }

  async findBriefingsByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      scheduleId?: string;
      status?: string;
      search?: string;
      id?: string;
    }
  ): Promise<BriefingRecord[]> {
    let query = this.db.database
      .from("briefings")
      .select("*")
      .eq("user_id", userId)
      .order("generated_at", { ascending: false });

    if (options?.id) {
      query = query.eq("id", options.id);
    }
    if (options?.scheduleId) {
      query = query.eq("schedule_id", options.scheduleId);
    }
    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.search) {
      query = query.or(`title.ilike.%${options.search}%,executive_summary.ilike.%${options.search}%`);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as BriefingRecord[];
  }

  async createBriefing(briefing: Omit<BriefingRecord, "id" | "created_at">): Promise<BriefingRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("briefings")
      .insert([{
        ...briefing,
        created_at: now,
      }])
      .select()
      .single();

    if (error) throw new Error(`Failed to create briefing: ${error.message}`);
    return data as BriefingRecord;
  }

  // ── BRIEFING ITEMS ──

  async findItemById(id: string): Promise<BriefingItemRecord | null> {
    const { data, error } = await this.db.database
      .from("briefing_items")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;
    return data as BriefingItemRecord;
  }

  async findItemsByBriefingId(briefingId: string): Promise<BriefingItemRecord[]> {
    const { data, error } = await this.db.database
      .from("briefing_items")
      .select("*")
      .eq("briefing_id", briefingId)
      .order("timestamp", { ascending: false });

    if (error || !data) return [];
    return data as BriefingItemRecord[];
  }

  async queryItems(
    userId: string,
    options?: {
      briefingId?: string;
      platform?: string;
      category?: string;
      priority?: string;
      status?: string;
      search?: string;
      limit?: number;
      offset?: number;
      sortBy?: "latest" | "oldest" | "priority";
    }
  ): Promise<BriefingItemRecord[]> {
    // Standard JOIN query simulation via PostgREST
    let query = this.db.database
      .from("briefing_items")
      .select("*, briefings!inner(user_id)")
      .eq("briefings.user_id", userId);

    if (options?.briefingId) {
      query = query.eq("briefing_id", options.briefingId);
    }
    if (options?.platform) {
      query = query.eq("platform", options.platform);
    }
    if (options?.category) {
      query = query.eq("category", options.category);
    }
    if (options?.priority) {
      query = query.eq("priority", options.priority.toLowerCase());
    }
    if (options?.status) {
      query = query.eq("status", options.status);
    }
    if (options?.search) {
      query = query.or(`metadata->>'title'.ilike.%${options.search}%,metadata->>'snippet'.ilike.%${options.search}%,notes.ilike.%${options.search}%`);
    }

    // Sort order
    if (options?.sortBy === "oldest") {
      query = query.order("timestamp", { ascending: true });
    } else if (options?.sortBy === "priority") {
      // Sort priority: High -> Normal -> Low
      query = query.order("priority", { ascending: true }).order("timestamp", { ascending: false });
    } else {
      query = query.order("timestamp", { ascending: false });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as BriefingItemRecord[];
  }

  async createBriefingItem(item: Omit<BriefingItemRecord, "id" | "created_at">): Promise<BriefingItemRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("briefing_items")
      .insert([{
        ...item,
        created_at: now,
      }])
      .select()
      .single();

    if (error) throw new Error(`Failed to create briefing item: ${error.message}`);
    return data as BriefingItemRecord;
  }

  async updateItemStatus(id: string, status: string, notes?: string | null, snoozedUntil?: string | null): Promise<BriefingItemRecord> {
    const updates: Record<string, unknown> = { status };
    if (notes !== undefined) {
      updates.notes = notes;
    }
    if (snoozedUntil !== undefined) {
      updates.snoozed_until = snoozedUntil;
    }

    const { data, error } = await this.db.database
      .from("briefing_items")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update item status: ${error.message}`);
    return data as BriefingItemRecord;
  }

  async updateItemMetadata(id: string, metadata: Record<string, unknown>): Promise<BriefingItemRecord> {
    const { data, error } = await this.db.database
      .from("briefing_items")
      .update({ metadata })
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update item metadata: ${error.message}`);
    return data as BriefingItemRecord;
  }

  // ── BRIEFING HISTORY ──

  async createHistory(record: Omit<BriefingHistoryRecord, "id">): Promise<BriefingHistoryRecord> {
    const { data, error } = await this.db.database
      .from("briefing_history")
      .insert([record])
      .select()
      .single();

    if (error) throw new Error(`Failed to create briefing history: ${error.message}`);
    return data as BriefingHistoryRecord;
  }

  async findHistoryByUserId(userId: string, limit = 20): Promise<BriefingHistoryRecord[]> {
    const { data, error } = await this.db.database
      .from("briefing_history")
      .select("*")
      .eq("user_id", userId)
      .order("execution_time", { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data as BriefingHistoryRecord[];
  }
}
