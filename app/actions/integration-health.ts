"use server";

import { createAdminDb } from "@/lib/db";
import { requireOwnership } from "@/lib/auth-guard";

interface SyncLogRecord {
  status: string;
  message: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface HealthActivity {
  lastSync: string | null;
  recentActivity: SyncLogRecord[];
  errorCount: number;
  totalCalls: number;
  successRate: number;
}

export async function getIntegrationHealthAction(userId: string, provider: string): Promise<HealthActivity> {
  const guard = await requireOwnership(userId);
  if ("error" in guard) throw new Error("Unauthorized user access");
  const db = createAdminDb();

  const { data: integration } = await db.database
    .from("user_integrations")
    .select("last_sync_at, created_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  // Evidence source: integration_sync_logs carries every real sync/refresh
  // outcome written by the sync path (success/error/refresh/reconnect), so the
  // health card reflects actual synchronization evidence — never an empty
  // ai_tool_calls (which only AI-chat writes and the sync path never touches).
  const { data: logs, error: logsError } = await db.database
    .from("integration_sync_logs")
    .select("status, message, duration_ms, created_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .order("created_at", { ascending: false })
    .limit(20);

  if (logsError) {
    console.error("[IntegrationHealth] failed to read sync evidence:", logsError.message);
  }

  const syncLogs = (logs || []) as SyncLogRecord[];
  const totalCalls = syncLogs.length;
  const errorCount = syncLogs.filter(c => c.status === "error").length;

  return {
    lastSync: integration?.last_sync_at || null,
    recentActivity: syncLogs.slice(0, 10),
    errorCount,
    totalCalls,
    successRate: totalCalls > 0 ? Math.round(((totalCalls - errorCount) / totalCalls) * 100) : 100,
  };
}
