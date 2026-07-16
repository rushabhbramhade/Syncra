import { BufferJSON } from "@whiskeysockets/baileys";
import { createAdminDb } from "@/lib/db";

interface WhatsAppAuthCreds {
  creds: Record<string, unknown>;
  keys: Record<string, unknown>;
}

export class WhatsAppSessionsRepository {
  constructor() {}

  private db() {
    return createAdminDb();
  }

  async saveSession(userId: string, session: WhatsAppAuthCreds): Promise<void> {
    // session is already BufferJSON.replacer-serialized by the caller
    await this.db().database.from("whatsapp_sessions").upsert({
      user_id: userId,
      session_data: session,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  }

  async getSession(userId: string): Promise<WhatsAppAuthCreds | null> {
    const { data } = await this.db().database
      .from("whatsapp_sessions")
      .select("session_data")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data?.session_data) return null;
    // session_data was stored as replacer output; reviver restores Buffer instances
    const raw = typeof data.session_data === "string" ? data.session_data : JSON.stringify(data.session_data);
    return JSON.parse(raw, BufferJSON.reviver);
  }

  async deleteSession(userId: string): Promise<void> {
    await this.db().database.from("whatsapp_sessions").delete().eq("user_id", userId);
  }

  async sessionExists(userId: string): Promise<boolean> {
    const session = await this.getSession(userId);
    return session !== null;
  }
}
