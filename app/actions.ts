"use server";

import { createAuthActions, createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UsersRepository } from "@/lib/repositories/users-repository";
import { createAdminDb } from "@/lib/db";

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

export async function syncUserToDatabase(userData: {
  auth_user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  auth_provider: string;
  email_verified: boolean;
}) {
  const now = new Date().toISOString();
  const admin = createAdminDb();
  const repo = new UsersRepository(admin);

  return retry(async () => {
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
}

export async function signInAction(email: string, password: string) {
  const auth = createAuthActions({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: await cookies(),
  });
  return await auth.signInWithPassword({ email, password });
}

export async function signUpAction(userData: { email: string; password: string; name?: string; redirectTo?: string }) {
  const auth = createAuthActions({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: await cookies(),
  });
  return await auth.signUp(userData);
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.set("insforge_access_token", "", { path: "/", maxAge: -1 });
  cookieStore.set("insforge_refresh_token", "", { path: "/", maxAge: -1 });
  
  const auth = createAuthActions({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: cookieStore,
  });
  return await auth.signOut();
}

export async function verifyEmailAction(email: string, otp: string) {
  const auth = createAuthActions({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: await cookies(),
  });
  return await auth.verifyEmail({ email, otp });
}

export async function resendVerificationEmailAction(email: string, redirectTo?: string) {
  const client = createServerClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: await cookies(),
  });
  return await client.auth.resendVerificationEmail({ email, redirectTo });
}

export async function signInWithGoogleAction(redirectTo: string) {
  const auth = createAuthActions({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: await cookies(),
  });

  const { data, error } = await auth.signInWithOAuth("google", {
    redirectTo,
    additionalParams: { prompt: "select_account" },
    skipBrowserRedirect: true,
  });

  if (error) {
    return { error };
  }

  if (data?.url && data?.codeVerifier) {
    const cookieStore = await cookies();
    cookieStore.set("insforge_code_verifier", data.codeVerifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10, // 10 minutes
    });
    redirect(data.url);
  } else {
    return { error: { message: "Invalid OAuth response from server", statusCode: 500, error: "OAUTH_INIT_ERROR" } };
  }
}

export async function getCurrentUserAction() {
  const cookieStore = await cookies();

  // E2E Test Mock Auth Bypass — development/test only
  if (process.env.NODE_ENV !== "production") {
    const token = cookieStore.get("insforge_access_token")?.value;
    if (token) {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
          if (payload.email === "testuser@example.com") {
            return {
              data: {
                user: {
                  id: payload.sub,
                  email: payload.email,
                  emailVerified: true,
                  providers: ["email"],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  profile: {
                    name: "Test User",
                    avatar_url: null
                  }
                }
              },
              error: null
            };
          }
        }
      } catch {}
    }
  }

  const client = createServerClient({
    baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
    anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    cookies: cookieStore,
  });

  try {
    const { data, error } = await client.auth.getCurrentUser();
    if (error) {
      return {
        data: null,
        error: {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error,
        },
      };
    }
    return { data, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to get current user";
    return {
      data: null,
      error: {
        message: errorMsg,
        statusCode: 500,
        error: "INTERNAL_ERROR",
      },
    };
  }
}

