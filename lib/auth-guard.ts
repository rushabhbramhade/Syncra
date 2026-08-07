import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { createAdminDb } from "@/lib/db";
import { UsersRepository } from "@/lib/repositories/users-repository";

export interface AuthUser {
  id: string;
  email?: string;
}

export async function getAuthenticatedUser(): Promise<{ user: AuthUser } | { error: string }> {
  try {
    const cookieStore = await cookies();
    const client = createServerClient({
      baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL || "",
      anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY || "",
      cookies: cookieStore,
    });
    const { data, error } = await client.auth.getCurrentUser();
    if (error || !data?.user) {
      return { error: "Not authenticated" };
    }
    return { user: { id: data.user.id, email: data.user.email } };
  } catch (err) {
    console.error("Authentication check failed:", err);
    return { error: "Authentication check failed" };
  }
}

export async function requireOwnership(userId: string): Promise<{ userId: string; authUserId: string } | { error: string }> {
  const result = await getAuthenticatedUser();
  if ("error" in result) return result;

  // Resolve the auth user id to the public users.id (DB primary key), which is
  // what child tables (notification_preferences, telegram_connections, etc.)
  // reference via their foreign keys.
  let dbUserId = result.user.id;
  try {
    const repo = new UsersRepository(createAdminDb());
    const user = await repo.findByAuthId(result.user.id);
    if (user) dbUserId = user.id;
  } catch (err) {
    console.error("Failed to resolve auth user to DB user:", err);
  }

  // Accept either the auth id or the DB id as the caller-provided identifier.
  if (userId !== result.user.id && userId !== dbUserId) {
    return { error: "Access denied" };
  }

  return { userId: dbUserId, authUserId: result.user.id };
}
