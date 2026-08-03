import { encrypt, decrypt } from "@/lib/crypto";

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "expired";

export interface IntegrationSettings {
  auto_sync: boolean;
  notifications: boolean;
  background_sync: boolean;
  token_refresh: boolean;
}

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
  sync_status?: SyncStatus;
  last_error?: string | null;
  metadata?: Record<string, unknown>;
  connected?: boolean;
  last_sync_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SyncLogRecord {
  id?: string;
  user_id: string;
  provider: string;
  status: "success" | "error" | "refresh" | "reconnect";
  message?: string;
  metadata?: Record<string, unknown>;
  duration_ms?: number;
  created_at?: string;
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

  async findAllByUser(userId: string): Promise<IntegrationRecord[]> {
    const { data, error } = await this.db.database
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active");
    if (error || !data) return [];
    return data as IntegrationRecord[];
  }

  async findByUserAndProviderAndAccount(userId: string, provider: string, accountId: string): Promise<IntegrationRecord | null> {
    const { data, error } = await this.db.database
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("provider_account_id", accountId)
      .maybeSingle();
    if (error || !data) return null;
    return data as IntegrationRecord;
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

  async setSyncStatus(userId: string, provider: string, syncStatus: SyncStatus, lastError?: string | null) {
    const patch: Record<string, unknown> = { sync_status: syncStatus, updated_at: new Date().toISOString() };
    if (lastError !== undefined) patch.last_error = lastError;
    if (syncStatus === "success") patch.last_sync_at = new Date().toISOString();
    await this.db.database
      .from("user_integrations")
      .update(patch)
      .eq("user_id", userId)
      .eq("provider", provider);
  }

  async saveToken(userId: string, provider: string, accessToken: string, refreshToken: string | undefined, expiresIn: number) {
    const patch: Record<string, unknown> = {
      encrypted_access_token: this.encryptToken(accessToken),
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      sync_status: "success",
      last_error: null,
      connected: true,
      updated_at: new Date().toISOString(),
    };
    if (refreshToken) patch.encrypted_refresh_token = this.encryptToken(refreshToken);
    await this.db.database
      .from("user_integrations")
      .update(patch)
      .eq("user_id", userId)
      .eq("provider", provider);
  }

  async updateSettings(userId: string, provider: string, settings: Partial<IntegrationSettings>) {
    const record = await this.findByUserAndProvider(userId, provider);
    if (!record) return { success: false, error: "Connection not found." };
    const merged = { ...(record.metadata || {}), ...settings };
    await this.db.database
      .from("user_integrations")
      .update({ metadata: merged, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("provider", provider);
    return { success: true };
  }

  getSettings(record: IntegrationRecord | null): IntegrationSettings {
    const meta = record?.metadata || {};
    return {
      auto_sync: typeof meta.auto_sync === "boolean" ? meta.auto_sync : true,
      notifications: typeof meta.notifications === "boolean" ? meta.notifications : true,
      background_sync: typeof meta.background_sync === "boolean" ? meta.background_sync : true,
      token_refresh: typeof meta.token_refresh === "boolean" ? meta.token_refresh : true,
    };
  }

  async addSyncLog(log: SyncLogRecord) {
    try {
      await this.db.database.from("integration_sync_logs").insert([log]);
    } catch {}
  }

  async getSyncLogs(userId: string, provider: string, limit = 15): Promise<SyncLogRecord[]> {
    const { data, error } = await this.db.database
      .from("integration_sync_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("provider", provider)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as SyncLogRecord[];
  }
}
