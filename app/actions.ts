"use server";

import { createAdminClient } from "@insforge/sdk";

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

  // 1. Check if user already exists in the users table
  const { data: existingUser, error: checkError } = await admin.database
    .from("users")
    .select("*")
    .eq("auth_user_id", userData.auth_user_id)
    .maybeSingle();

  if (checkError) {
    console.error("Error checking user in DB:", checkError);
    throw new Error(`Database error: ${checkError.message}`);
  }

  if (!existingUser) {
    console.log(`User ${userData.email} not found in DB. Inserting...`);
    // Insert new user record
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
    console.log(`User ${userData.email} found in DB. Updating last_login_at...`);
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
