import { createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";

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

export async function requireOwnership(userId: string): Promise<{ userId: string } | { error: string }> {
  const result = await getAuthenticatedUser();
  if ("error" in result) return result;
  if (result.user.id !== userId) {
    return { error: "Access denied" };
  }
  return { userId: result.user.id };
}
