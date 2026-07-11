"use server";

import { createAdminClient } from "@insforge/sdk";
import { createAuthActions, createServerClient } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function syncUserToDatabase(userData: {
  auth_user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  auth_provider: string;
  email_verified: boolean;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error("Missing InsForge configuration in environment variables.");
  }

  const admin = createAdminClient({
    baseUrl,
    apiKey,
  });

  const now = new Date().toISOString();

  // 1. Check if user already exists in the users table by auth_user_id
  let existingUser = null;
  const { data: userByAuthId, error: checkError } = await admin.database
    .from("users")
    .select("*")
    .eq("auth_user_id", userData.auth_user_id)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking user in DB:", checkError);
    throw new Error(`Database error: ${checkError.message}`);
  }
  
  existingUser = userByAuthId;

  if (!existingUser) {
    // Check if user exists by email
    const { data: userByEmail, error: emailCheckError } = await admin.database
      .from("users")
      .select("*")
      .eq("email", userData.email)
      .maybeSingle();

    if (emailCheckError) {
      console.error("Error checking user by email:", emailCheckError);
      throw new Error(`Database error: ${emailCheckError.message}`);
    }

    if (userByEmail) {
      // Link the account by updating auth_user_id
      const { data: updatedUser, error: updateIdError } = await admin.database
        .from("users")
        .update({
          auth_user_id: userData.auth_user_id,
          last_login_at: now,
          email_verified: userData.email_verified,
          full_name: userData.full_name === "New User" ? (userByEmail.full_name || "New User") : (userData.full_name || userByEmail.full_name || "New User"),
          avatar_url: userData.avatar_url || userByEmail.avatar_url,
        })
        .eq("email", userData.email)
        .select()
        .single();

      if (updateIdError) {
        console.error("Error updating user auth_user_id:", updateIdError);
        throw new Error(`Update failed: ${updateIdError.message}`);
      }

      return updatedUser;
    }

    // User not found in DB at all — inserting new record
    const { data: insertedUser, error: insertError } = await admin.database
      .from("users")
      .insert([
        {
          auth_user_id: userData.auth_user_id,
          email: userData.email,
          full_name: userData.full_name,
          avatar_url: userData.avatar_url || null,
          auth_provider: userData.auth_provider,
          email_verified: userData.email_verified,
          last_login_at: now,
        },
      ])
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting user:", insertError);
      throw new Error(`Insert failed: ${insertError.message}`);
    }

    return insertedUser;
  } else {
    // User found in DB — updating last_login_at
    // Update existing user record (preserving name if it was set)
    const { data: updatedUser, error: updateError } = await admin.database
      .from("users")
      .update({
        last_login_at: now,
        email_verified: userData.email_verified,
        full_name: userData.full_name === "New User" ? (existingUser.full_name || "New User") : (userData.full_name || existingUser.full_name || "New User"),
        avatar_url: userData.avatar_url || existingUser.avatar_url,
      })
      .eq("auth_user_id", userData.auth_user_id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating user:", updateError);
      throw new Error(`Update failed: ${updateError.message}`);
    }

    return updatedUser;
  }
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
  try {
    return await auth.signOut();
  } catch (err) {
    console.error("Sign out SDK error:", err);
    return { error: null };
  }
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

