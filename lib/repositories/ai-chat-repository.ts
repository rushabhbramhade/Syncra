export interface AIConversationRecord {
  id: string;
  user_id: string;
  title: string;
  model: string;
  pinned: boolean;
  favorite: boolean;
  archived: boolean;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AIMessageRecord {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  latency?: number | null;
  tokens_used?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface AIMessageFileRecord {
  id: string;
  conversation_id: string;
  message_id?: string | null;
  name: string;
  size: number;
  type: string;
  url: string;
  content?: string | null;
  created_at: string;
}

export interface AIToolCallRecord {
  id: string;
  message_id: string;
  tool_name: string;
  provider: string;
  arguments: Record<string, unknown>;
  status: "running" | "success" | "failed";
  duration?: number | null;
  output?: string | null;
  error?: string | null;
  created_at: string;
}

export interface AIWorkspaceMemoryRecord {
  id: string;
  user_id: string;
  key: string;
  value: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export class AIChatRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  // ── AI CONVERSATIONS ──

  async createConversation(
    record: Omit<AIConversationRecord, "id" | "created_at" | "updated_at">
  ): Promise<AIConversationRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("ai_conversations")
      .insert([
        {
          ...record,
          created_at: now,
          updated_at: now,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    return data as AIConversationRecord;
  }

  async getConversationsByUserId(
    userId: string,
    options?: { archived?: boolean }
  ): Promise<AIConversationRecord[]> {
    let query = this.db.database
      .from("ai_conversations")
      .select("*")
      .eq("user_id", userId);

    if (options?.archived !== undefined) {
      query = query.eq("archived", options.archived);
    }

    // Default sorting: pinned first, then updated_at descending
    const { data, error } = await query
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return data as AIConversationRecord[];
  }

  async getConversationById(id: string, userId: string): Promise<AIConversationRecord | null> {
    const { data, error } = await this.db.database
      .from("ai_conversations")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return data as AIConversationRecord;
  }

  async updateConversation(
    id: string,
    userId: string,
    updates: Partial<Omit<AIConversationRecord, "id" | "user_id" | "created_at" | "updated_at">>
  ): Promise<AIConversationRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("ai_conversations")
      .update({
        ...updates,
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update conversation: ${error.message}`);
    return data as AIConversationRecord;
  }

  async deleteConversation(id: string, userId: string): Promise<boolean> {
    const { error } = await this.db.database
      .from("ai_conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
    return true;
  }

  // ── AI MESSAGES ──

  async createMessage(record: Omit<AIMessageRecord, "id" | "created_at">): Promise<AIMessageRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("ai_messages")
      .insert([
        {
          ...record,
          created_at: now,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`Failed to create message: ${error.message}`);
    return data as AIMessageRecord;
  }

  async getMessagesByConversationId(conversationId: string): Promise<AIMessageRecord[]> {
    const { data, error } = await this.db.database
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data as AIMessageRecord[];
  }

  // ── AI MESSAGE FILES ──

  async createFileMetadata(
    record: Omit<AIMessageFileRecord, "id" | "created_at">
  ): Promise<AIMessageFileRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("ai_message_files")
      .insert([
        {
          ...record,
          created_at: now,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`Failed to save file metadata: ${error.message}`);
    return data as AIMessageFileRecord;
  }

  async getFilesByConversationId(conversationId: string): Promise<AIMessageFileRecord[]> {
    const { data, error } = await this.db.database
      .from("ai_message_files")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data as AIMessageFileRecord[];
  }

  async getFilesByMessageId(messageId: string): Promise<AIMessageFileRecord[]> {
    const { data, error } = await this.db.database
      .from("ai_message_files")
      .select("*")
      .eq("message_id", messageId);

    if (error || !data) return [];
    return data as AIMessageFileRecord[];
  }

  async associateFileWithMessage(id: string, messageId: string): Promise<boolean> {
    const { error } = await this.db.database
      .from("ai_message_files")
      .update({ message_id: messageId })
      .eq("id", id);

    if (error) throw new Error(`Failed to associate file with message: ${error.message}`);
    return true;
  }

  async deleteFile(id: string): Promise<boolean> {
    const { error } = await this.db.database
      .from("ai_message_files")
      .delete()
      .eq("id", id);

    if (error) throw new Error(`Failed to delete file metadata: ${error.message}`);
    return true;
  }

  // ── AI TOOL CALLS ──

  async createToolCall(record: Omit<AIToolCallRecord, "id" | "created_at">): Promise<AIToolCallRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("ai_tool_calls")
      .insert([
        {
          ...record,
          created_at: now,
        },
      ])
      .select()
      .single();

    if (error) throw new Error(`Failed to create tool call: ${error.message}`);
    return data as AIToolCallRecord;
  }

  async updateToolCall(id: string, updates: Partial<Omit<AIToolCallRecord, "id" | "created_at">>): Promise<AIToolCallRecord> {
    const { data, error } = await this.db.database
      .from("ai_tool_calls")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update tool call: ${error.message}`);
    return data as AIToolCallRecord;
  }

  async getToolCallsByMessageId(messageId: string): Promise<AIToolCallRecord[]> {
    const { data, error } = await this.db.database
      .from("ai_tool_calls")
      .select("*")
      .eq("message_id", messageId)
      .order("created_at", { ascending: true });

    if (error || !data) return [];
    return data as AIToolCallRecord[];
  }

  // ── AI WORKSPACE MEMORY ──

  async upsertMemory(
    record: Omit<AIWorkspaceMemoryRecord, "id" | "created_at" | "updated_at">
  ): Promise<AIWorkspaceMemoryRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("ai_workspace_memory")
      .upsert(
        {
          ...record,
          created_at: now,
          updated_at: now,
        },
        { onConflict: "user_id,key" }
      )
      .select()
      .single();

    if (error) throw new Error(`Failed to upsert memory: ${error.message}`);
    return data as AIWorkspaceMemoryRecord;
  }

  async getMemoryByUserId(userId: string): Promise<AIWorkspaceMemoryRecord[]> {
    const { data, error } = await this.db.database
      .from("ai_workspace_memory")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return data as AIWorkspaceMemoryRecord[];
  }

  async deleteMemory(id: string, userId: string): Promise<boolean> {
    const { error } = await this.db.database
      .from("ai_workspace_memory")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw new Error(`Failed to delete memory: ${error.message}`);
    return true;
  }

  async deleteMemoryByKey(userId: string, key: string): Promise<boolean> {
    const { error } = await this.db.database
      .from("ai_workspace_memory")
      .delete()
      .eq("user_id", userId)
      .eq("key", key);

    if (error) throw new Error(`Failed to delete memory key: ${error.message}`);
    return true;
  }
}
