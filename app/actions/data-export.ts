"use server";

import { createAdminDb } from "@/lib/db";

export async function exportUserDataAction(userId: string) {
  const db = createAdminDb();

  const [integrations, conversations, toolCalls, briefings, notifications] = await Promise.all([
    db.database.from("user_integrations").select("provider, email, status, created_at, last_sync_at").eq("user_id", userId),
    db.database.from("ai_conversations").select("id, title, model, created_at").eq("user_id", userId),
    db.database.from("ai_tool_calls").select("*").eq("user_id", userId),
    db.database.from("briefings").select("*").eq("user_id", userId),
    db.database.from("notification_history").select("*").eq("user_id", userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    integrations: integrations.data || [],
    conversations: conversations.data || [],
    toolCalls: toolCalls.data || [],
    briefings: briefings.data || [],
    notifications: notifications.data || [],
  };
}

export async function disconnectAndDeleteAction(userId: string, provider: string) {
  const db = createAdminDb();

  await Promise.all([
    db.database.from("user_integrations").delete().eq("user_id", userId).eq("provider", provider),
    db.database.from("ai_tool_calls").delete().eq("user_id", userId).eq("provider", provider),
  ]);

  return { success: true, message: `All data for ${provider} has been deleted.` };
}
