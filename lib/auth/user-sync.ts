import "server-only";

import { createAdminDb } from "@/lib/db";
import { UsersRepository } from "@/lib/repositories/users-repository";

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`syncUserToDatabase attempt ${i + 1} failed, retrying...`, err);
      await new Promise((r) => setTimeout(r, delay * (i + 1)));
    }
  }
  throw new Error("retry exhausted");
}

export interface SyncUserInput {
  auth_user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  auth_provider: string;
  email_verified: boolean;
}

/** Privileged user provisioning. Only trusted server callers may invoke this
 * after deriving the input from a freshly verified authentication session. */
export async function syncUserToDatabase(userData: SyncUserInput) {
  const now = new Date().toISOString();
  const admin = createAdminDb();
  const repo = new UsersRepository(admin);

  const userRecord = await retry(async () => {
    const existingUser = await repo.findByAuthId(userData.auth_user_id);

    if (!existingUser) {
      const userByEmail = await repo.findByEmail(userData.email);

      if (userByEmail) {
        return repo.updateByEmail(userData.email, {
          auth_user_id: userData.auth_user_id,
          last_login_at: now,
          email_verified: userData.email_verified,
          full_name: userData.full_name === "New User" ? (userByEmail.full_name || "New User") : (userData.full_name || userByEmail.full_name || "New User"),
          avatar_url: userData.avatar_url || userByEmail.avatar_url,
        });
      }

      return repo.upsertByAuthId({
        auth_user_id: userData.auth_user_id,
        email: userData.email,
        full_name: userData.full_name,
        avatar_url: userData.avatar_url || null,
        auth_provider: userData.auth_provider,
        email_verified: userData.email_verified,
        last_login_at: now,
      });
    }

    return repo.updateByAuthId(userData.auth_user_id, {
      last_login_at: now,
      email_verified: userData.email_verified,
      full_name: userData.full_name === "New User" ? (existingUser.full_name || "New User") : (userData.full_name || existingUser.full_name || "New User"),
      avatar_url: userData.avatar_url || existingUser.avatar_url,
    });
  });

  return userRecord;
}