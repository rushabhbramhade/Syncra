import { encrypt, decrypt } from "@/lib/crypto";

export interface IntegrationRecord {
  id?: string;
  user_id: string;
  provider: string;
  provider_account_id?: string;
  email?: string;
  encrypted_access_token: string;
  encrypted_refresh_token?: string;
  expires_at?: string;
  scopes?: string;
  status: string;
  last_sync_at?: string;
  created_at?: string;
  updated_at?: string;
}

export class IntegrationsRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async findAllByProvider(provider: string): Promise<IntegrationRecord[]> {
    const { data, error } = await this.db.database
      .from("user_integrations")
      .select("*")
      .eq("provider", provider)
      .eq("status", "active");

    if (error || !data) return [];
    return data as IntegrationRecord[];
  }

  async findByUserAndProvider(userId: string, provider: string): Promise<IntegrationRecord | null> {
    const { data, error } = await this.db.database
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();

    if (error || !data) return null;
    return data as IntegrationRecord;
  }

  async getConnectionStatus(userId: string, provider: string) {
    const { data, error } = await this.db.database
      .from("user_integrations")
      .select("email, created_at, last_sync_at, provider, status")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();

    if (error || !data) return null;

    return {
      connected: true,
      email: data.email,
      connectedAt: data.created_at,
      lastSyncAt: data.last_sync_at,
      provider: data.provider,
      status: data.status,
    };
  }

  async upsert(record: Partial<IntegrationRecord> & { user_id: string; provider: string }) {
    const now = new Date().toISOString();
    const upsertData: Record<string, unknown> = {
      user_id: record.user_id,
      provider: record.provider,
      provider_account_id: record.provider_account_id || record.email,
      email: record.email,
      encrypted_access_token: record.encrypted_access_token,
      expires_at: record.expires_at,
      scopes: record.scopes || "",
      status: record.status || "active",
      last_sync_at: now,
      updated_at: now,
    };

    if (record.encrypted_refresh_token) {
      upsertData.encrypted_refresh_token = record.encrypted_refresh_token;
    }

    const { error } = await this.db.database
      .from("user_integrations")
      .upsert(upsertData, { onConflict: "user_id,provider" });

    if (error) {
      throw new Error(`Failed to save connection: ${error.message}`);
    }

    return { success: true };
  }

  async delete(userId: string, provider: string) {
    const { error } = await this.db.database
      .from("user_integrations")
      .delete()
      .eq("user_id", userId)
      .eq("provider", provider);

    if (error) {
      throw new Error(`Failed to delete connection: ${error.message}`);
    }

    return { success: true };
  }

  async updateLastSync(userId: string, provider: string) {
    try {
      await this.db.database
        .from("user_integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("provider", provider);
    } catch {}
  }

  decryptToken(encrypted: string): string | null {
    try {
      return decrypt(encrypted);
    } catch {
      return null;
    }
  }

  encryptToken(plain: string): string {
    return encrypt(plain);
  }
}
