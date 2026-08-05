import { createAdminDb } from "@/lib/db";

export interface AuditLogInput {
  user_id: string;
  integration_id?: string | null;
  actor: "user" | "ai" | "system" | "worker";
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown>;
}

export class AuditLogRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async record(input: AuditLogInput): Promise<void> {
    try {
      await this.db.database.from("audit_logs").insert([{ ...input, metadata: input.metadata ?? {} }]);
    } catch (err) {
      // Audit must never break the calling flow — log and continue.
      console.error("[Audit] failed to record:", err);
    }
  }

  async listForUser(userId: string, limit = 50): Promise<AuditLogInput[]> {
    const { data, error } = await this.db.database
      .from("audit_logs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as AuditLogInput[];
  }

  async listForIntegration(integrationId: string, limit = 50): Promise<AuditLogInput[]> {
    const { data, error } = await this.db.database
      .from("audit_logs")
      .select("*")
      .eq("integration_id", integrationId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as AuditLogInput[];
  }
}

export function getAuditRepo(): AuditLogRepository {
  return new AuditLogRepository(createAdminDb());
}
