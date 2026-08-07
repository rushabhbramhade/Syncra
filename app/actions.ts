"use server";

import { createAuthActions, createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { syncUserToDatabase as syncUserToDatabaseCore } from "@/lib/auth/user-sync";

const AUTH_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_INSFORGE_BASE_URL,
  anonKey: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
  timeout: 10000,
};

export async function syncCurrentUserToDatabase() {
  const cookieStore = await cookies();
  const client = createServerClient({ ...AUTH_CONFIG, cookies: cookieStore });
  const { data: session, error } = await client.auth.getCurrentUser();

  if (error || !session?.user) {
    throw new Error("Not authenticated");
  }

  const user = session.user;
  if (!user.email) {
    throw new Error("Authenticated user has no email address");
  }

  return syncUserToDatabaseCore({
    auth_user_id: user.id,
    email: user.email,
    full_name: (user.profile as { name?: string } | null)?.name || "New User",
    avatar_url: (user.profile as { avatar_url?: string } | null)?.avatar_url || null,
    auth_provider: user.providers?.[0] || "email",
    email_verified: user.emailVerified || false,
  });
}

export async function signInAction(email: string, password: string) {
  const auth = createAuthActions({
    ...AUTH_CONFIG,
    cookies: await cookies(),
  });
  return await auth.signInWithPassword({ email, password });
}

export async function signUpAction(userData: { email: string; password: string; name?: string; redirectTo?: string }) {
  const auth = createAuthActions({
    ...AUTH_CONFIG,
    cookies: await cookies(),
  });
  return await auth.signUp(userData);
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.set("insforge_access_token", "", { path: "/", maxAge: -1 });
  cookieStore.set("insforge_refresh_token", "", { path: "/", maxAge: -1 });
  
  const auth = createAuthActions({
    ...AUTH_CONFIG,
    cookies: cookieStore,
  });
  return await auth.signOut();
}

export async function verifyEmailAction(email: string, otp: string) {
  const auth = createAuthActions({
    ...AUTH_CONFIG,
    cookies: await cookies(),
  });
  return await auth.verifyEmail({ email, otp });
}

export async function resendVerificationEmailAction(email: string, redirectTo?: string) {
  const client = createServerClient({
    ...AUTH_CONFIG,
    cookies: await cookies(),
  });
  return await client.auth.resendVerificationEmail({ email, redirectTo });
}

export async function sendResetPasswordEmailAction(email: string) {
  const client = createServerClient({
    ...AUTH_CONFIG,
    cookies: await cookies(),
  });
  return await client.auth.sendResetPasswordEmail({ email });
}

export async function exchangeResetPasswordTokenAction(email: string, code: string) {
  const client = createServerClient({
    ...AUTH_CONFIG,
    cookies: await cookies(),
  });
  return await client.auth.exchangeResetPasswordToken({ email, code });
}

export async function resetPasswordAction(newPassword: string, otp: string) {
  const client = createServerClient({
    ...AUTH_CONFIG,
    cookies: await cookies(),
  });
  return await client.auth.resetPassword({ newPassword, otp });
}

export async function signInWithGoogleAction(redirectTo: string) {
  const auth = createAuthActions({
    ...AUTH_CONFIG,
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
    return { redirectUrl: data.url };
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
    ...AUTH_CONFIG,
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

