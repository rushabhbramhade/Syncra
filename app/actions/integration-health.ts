"use server";

import { createAdminDb } from "@/lib/db";

interface ToolCallRecord {
  tool_name: string;
  status: string;
  duration: number | null;
  created_at: string;
}

interface HealthActivity {
  lastSync: string | null;
  recentActivity: ToolCallRecord[];
  errorCount: number;
  totalCalls: number;
  successRate: number;
}

export async function getIntegrationHealthAction(userId: string, provider: string): Promise<HealthActivity> {
  const db = createAdminDb();

  const { data: integration } = await db.database
    .from("user_integrations")
    .select("last_sync_at, created_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  const { data: calls } = await db.database
    .from("ai_tool_calls")
    .select("tool_name, status, duration, created_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(20);

  const toolCalls = (calls || []) as ToolCallRecord[];
  const totalCalls = toolCalls.length;
  const errorCount = toolCalls.filter(c => c.status === "failed").length;

  return {
    lastSync: integration?.last_sync_at || null,
    recentActivity: toolCalls.slice(0, 10),
    errorCount,
    totalCalls,
    successRate: totalCalls > 0 ? Math.round(((totalCalls - errorCount) / totalCalls) * 100) : 100,
  };
}
