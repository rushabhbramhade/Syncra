import { createAdminDb } from "@/lib/db";

export interface ToolPermission {
  id?: string;
  user_id: string;
  provider: string;
  tool_name: string;
  enabled: boolean;
  write_confirmed?: boolean;
  created_at?: string;
  updated_at?: string;
}

export class ToolPermissionsRepository {
  private db() {
    return createAdminDb();
  }

  async get(userId: string, toolName: string): Promise<ToolPermission | null> {
    const { data, error } = await this.db().database
      .from("user_tool_permissions")
      .select("*")
      .eq("user_id", userId)
      .eq("tool_name", toolName)
      .maybeSingle();
    if (error || !data) return null;
    return data as ToolPermission;
  }

  async getAllForUser(userId: string): Promise<ToolPermission[]> {
    const { data, error } = await this.db().database
      .from("user_tool_permissions")
      .select("*")
      .eq("user_id", userId);
    if (error || !data) return [];
    return data as ToolPermission[];
  }

  async getAllForProvider(userId: string, provider: string): Promise<ToolPermission[]> {
    const { data, error } = await this.db().database
      .from("user_tool_permissions")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider);
    if (error || !data) return [];
    return data as ToolPermission[];
  }

  async setEnabled(userId: string, toolName: string, provider: string, enabled: boolean): Promise<void> {
    const existing = await this.get(userId, toolName);
    if (existing) {
      await this.db().database
        .from("user_tool_permissions")
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await this.db().database
        .from("user_tool_permissions")
        .insert({
          user_id: userId,
          provider,
          tool_name: toolName,
          enabled,
        });
    }
  }

  async isToolEnabled(userId: string, toolName: string): Promise<boolean> {
    const perm = await this.get(userId, toolName);
    if (perm === null) return true;
    return perm.enabled;
  }

  async initializeDefaults(userId: string, tools: { name: string; provider: string }[]): Promise<void> {
    for (const tool of tools) {
      const existing = await this.get(userId, tool.name);
      if (!existing) {
        await this.db().database.from("user_tool_permissions").insert({
          user_id: userId,
          provider: tool.provider,
          tool_name: tool.name,
          enabled: true,
        });
      }
    }
  }

  async isWriteConfirmed(userId: string, toolName: string): Promise<boolean> {
    const perm = await this.get(userId, toolName);
    if (perm === null) return false;
    return (perm as any).write_confirmed === true;
  }

  async setWriteConfirmed(userId: string, toolName: string, provider?: string): Promise<void> {
    const existing = await this.get(userId, toolName);
    if (existing) {
      await this.db().database.from("user_tool_permissions").update({ write_confirmed: true, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await this.db().database.from("user_tool_permissions").insert({
        user_id: userId,
        provider: provider || "gmail",
        tool_name: toolName,
        enabled: true,
        write_confirmed: true,
      });
    }
  }
}
