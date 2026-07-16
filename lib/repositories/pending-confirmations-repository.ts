import { createAdminDb } from "@/lib/db";

export interface PendingConfirmation {
  id?: string;
  user_id: string;
  tool_name: string;
  args: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
}

export class PendingConfirmationsRepository {
  private db() { return createAdminDb(); }

  async create(confirmation: Omit<PendingConfirmation, "id" | "created_at">): Promise<string | undefined> {
    const { data } = await this.db().database.from("pending_confirmations").insert({
      user_id: confirmation.user_id,
      tool_name: confirmation.tool_name,
      args: confirmation.args,
      status: "pending",
    }).select("id").single();
    return data?.id;
  }

  async get(id: string): Promise<PendingConfirmation | null> {
    const { data } = await this.db().database.from("pending_confirmations").select("*").eq("id", id).maybeSingle();
    return data as PendingConfirmation | null;
  }

  async updateStatus(id: string, status: "approved" | "rejected"): Promise<void> {
    await this.db().database.from("pending_confirmations").update({ status }).eq("id", id);
  }

  async getPendingForUser(userId: string): Promise<PendingConfirmation[]> {
    const { data } = await this.db().database.from("pending_confirmations").select("*").eq("user_id", userId).eq("status", "pending");
    return (data || []) as PendingConfirmation[];
  }
}
