import { createAdminDb } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * Worker-only credential store. No user RLS policy exists on
 * integration_credentials — access is exclusively via the admin client
 * (service role). Never expose these records to the client.
 */
export interface CredentialRecord {
  integration_id: string;
  provider: string;
  encrypted_access_token: string;
  encrypted_refresh_token?: string | null;
  access_expires_at?: string | null;
  scopes: string[];
  refresh_error_count: number;
  updated_at?: string;
}

export class CredentialsRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async save(
    integrationId: string,
    provider: string,
    accessToken: string,
    refreshToken: string | undefined,
    expiresAt: string | null,
    scopes: string[]
  ): Promise<void> {
    const record: Record<string, unknown> = {
      integration_id: integrationId,
      provider,
      encrypted_access_token: encrypt(accessToken),
      scopes,
      refresh_error_count: 0,
      updated_at: new Date().toISOString(),
    };
    if (refreshToken) record.encrypted_refresh_token = encrypt(refreshToken);
    if (expiresAt) record.access_expires_at = expiresAt;

    await this.db.database
      .from("integration_credentials")
      .upsert(record, { onConflict: "integration_id" });
  }

  async get(integrationId: string): Promise<CredentialRecord | null> {
    const { data, error } = await this.db.database
      .from("integration_credentials")
      .select("*")
      .eq("integration_id", integrationId)
      .maybeSingle();
    if (error || !data) return null;
    return data as CredentialRecord;
  }

  /** Decrypted access token for worker use. */
  async getAccessToken(integrationId: string): Promise<string | null> {
    const record = await this.get(integrationId);
    if (!record) return null;
    return decrypt(record.encrypted_access_token) || null;
  }

  async getRefreshToken(integrationId: string): Promise<string | null> {
    const record = await this.get(integrationId);
    if (!record?.encrypted_refresh_token) return null;
    return decrypt(record.encrypted_refresh_token) || null;
  }

  async updateAccessToken(integrationId: string, accessToken: string, expiresAt: string | null): Promise<void> {
    const patch: Record<string, unknown> = {
      encrypted_access_token: encrypt(accessToken),
      refresh_error_count: 0,
      updated_at: new Date().toISOString(),
    };
    if (expiresAt) patch.access_expires_at = expiresAt;
    await this.db.database.from("integration_credentials").update(patch).eq("integration_id", integrationId);
  }

  async incrementRefreshError(integrationId: string): Promise<number> {
    const record = await this.get(integrationId);
    const next = (record?.refresh_error_count ?? 0) + 1;
    await this.db.database
      .from("integration_credentials")
      .update({ refresh_error_count: next, updated_at: new Date().toISOString() })
      .eq("integration_id", integrationId);
    return next;
  }

  async resetRefreshErrors(integrationId: string): Promise<void> {
    await this.db.database
      .from("integration_credentials")
      .update({ refresh_error_count: 0, updated_at: new Date().toISOString() })
      .eq("integration_id", integrationId);
  }

  async delete(integrationId: string): Promise<void> {
    await this.db.database.from("integration_credentials").delete().eq("integration_id", integrationId);
  }
}

export function getCredentialsRepo(): CredentialsRepository {
  return new CredentialsRepository(createAdminDb());
}
