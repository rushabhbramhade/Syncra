export interface UserRecord {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  auth_provider: string;
  email_verified: boolean;
  created_at: string | null;
  last_login_at: string | null;
}

export interface UserInput {
  auth_user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  auth_provider: string;
  email_verified: boolean;
}

export class UsersRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async findByAuthId(authUserId: string): Promise<UserRecord | null> {
    const { data, error } = await this.db.database
      .from("users")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle();

    if (error || !data) return null;
    return data as UserRecord;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const { data, error } = await this.db.database
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (error || !data) return null;
    return data as UserRecord;
  }

  async create(input: UserInput): Promise<UserRecord> {
    const now = new Date().toISOString();
    const { data, error } = await this.db.database
      .from("users")
      .insert([{
        auth_user_id: input.auth_user_id,
        email: input.email,
        full_name: input.full_name,
        avatar_url: input.avatar_url || null,
        auth_provider: input.auth_provider,
        email_verified: input.email_verified,
        last_login_at: now,
      }])
      .select()
      .single();

    if (error) throw new Error(`Insert failed: ${error.message}`);
    return data as UserRecord;
  }

  async updateByAuthId(authUserId: string, updates: Partial<UserRecord>): Promise<UserRecord> {
    const { data, error } = await this.db.database
      .from("users")
      .update(updates)
      .eq("auth_user_id", authUserId)
      .select()
      .single();

    if (error) throw new Error(`Update failed: ${error.message}`);
    return data as UserRecord;
  }

  async updateByEmail(email: string, updates: Partial<UserRecord>): Promise<UserRecord> {
    const { data, error } = await this.db.database
      .from("users")
      .update(updates)
      .eq("email", email)
      .select()
      .single();

    if (error) throw new Error(`Update failed: ${error.message}`);
    return data as UserRecord;
  }

  async upsertByAuthId(input: UserInput & { last_login_at: string }): Promise<UserRecord> {
    const { data, error } = await this.db.database
      .from("users")
      .upsert({
        auth_user_id: input.auth_user_id,
        email: input.email,
        full_name: input.full_name,
        avatar_url: input.avatar_url || null,
        auth_provider: input.auth_provider,
        email_verified: input.email_verified,
        last_login_at: input.last_login_at,
      }, { onConflict: "auth_user_id" })
      .select()
      .single();

    if (error) throw new Error(`Upsert failed: ${error.message}`);
    return data as UserRecord;
  }
}
