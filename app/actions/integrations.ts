"use server";

import { IntegrationRegistry } from "@/lib/integrations";
import { DiscordProvider } from "@/lib/integrations/discord-provider";
import { DiscordService } from "@/lib/discord/discord-service";
import { TelegramService, telegramWebhookSecret } from "@/lib/telegram/telegram-service";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import type { IntegrationRecord } from "@/lib/repositories/integrations-repository";
import { createAdminDb } from "@/lib/db";
import { requireOwnership } from "@/lib/auth-guard";
import { connectIntegrationSchema, disconnectIntegrationSchema, refreshTokenSchema } from "@/features/integrations/schemas";
import {
  executeMCPAction,
  saveConnection,
  disconnectConnection,
  refreshTokenInternal,
  syncIntegration as syncIntegrationCore,
} from "@/lib/integrations/actions-core";

function getRepo(): IntegrationsRepository {
  return new IntegrationsRepository(createAdminDb());
}

function mapToWorkspace(record: IntegrationRecord, name: string): WorkspaceIntegration {
  const settings = getRepo().getSettings(record);
  return {
    id: record.id || `${record.provider}_${record.user_id}`,
    provider: record.provider,
    name,
    email: record.email || record.provider_account_id || "",
    connected: record.status === "active",
    has_refresh_token: !!record.encrypted_refresh_token,
    status: record.status,
    sync_status: record.sync_status || "idle",
    last_error: record.last_error || null,
    scopes: record.scopes || "",
    last_sync_at: record.last_sync_at || "",
    connected_at: record.created_at || "",
    expires_at: record.expires_at || "",
    metadata: record.metadata || {},
    settings,
  };
}

export interface ConnectionStatus {
  connected: boolean;
  email: string;
  connectedAt: string;
  lastSyncAt: string;
  provider: string;
  status: string;
}

export async function getConnectionStatus(userId: string, providerId: string): Promise<ConnectionStatus | null> {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return null;
  try {
    // WhatsApp: the integration row in user_integrations is the source of truth
    // for "connected" — exactly like every other provider. A live socket is a
    // delivery detail, not the connection state: a transient drop or a cold
    // restart must NOT flip a linked account to "disconnected". Readiness (auth
    // + open socket + completed sync) is still enforced downstream by
    // getConnectionState when the briefing/tools need to fetch data. Only when
    // there is no integration row at all (never connected / explicitly
    // disconnected) do we report disconnected.
    if (providerId === "whatsapp") {
      const row = await getRepo().findByUserAndProvider(userId, "whatsapp");
      if (!row) return null;
    }
    return await getRepo().getConnectionStatus(userId, providerId);
  } catch (e) {
    console.error(`Error fetching connection status for ${providerId}:`, e);
    return null;
  }
}

export async function disconnectConnectionGuarded(userId: string, providerId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) throw new Error(guard.error);
  return disconnectConnection(userId, providerId);
}

// Browser-facing MCP executor with ownership verification. Server-side callers
// (briefing-service, search-service) must keep using the unguarded executeMCPAction.
export async function executeMCPActionGuarded(userId: string, providerId: string, actionName: string, args: Record<string, unknown>) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) {
    return { status: "error", error: { code: -32003, message: "Access denied" } };
  }
  // Use the verified auth UUID so that user_integrations rows are always found,
  // regardless of which ID format the caller supplied.
  return executeMCPAction(guard.authUserId, providerId, actionName, args);
}

// ── BACKWARD COMPATIBLE GMAIL SPECIFIC WRAPPERS ──

export async function getGmailConnectionStatus(userId: string) {
  return getConnectionStatus(userId, "gmail");
}

export async function saveGmailConnection(
  userId: string,
  email: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  return saveConnection(userId, "gmail", email, accessToken, refreshToken, expiresIn);
}

export async function disconnectGmailConnection(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  return disconnectConnection(userId, "gmail");
}

export async function executeGmailMCPAction(userId: string, actionName: string, args: Record<string, unknown>) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) {
    return { status: "error", error: { code: -32003, message: "Access denied" } };
  }
  return executeMCPAction(guard.authUserId, "gmail", actionName, args);
}

// Check if Google OAuth variables are set on the server
export async function checkGoogleApiConfig() {
  const isIdSet = !!process.env.GOOGLE_CLIENT_ID;
  const isSecretSet = !!process.env.GOOGLE_CLIENT_SECRET;
  return isIdSet && isSecretSet;
}

// ── TELEGRAM SPECIFIC WRAPPERS ──

export async function connectTelegramAction(userId: string, botToken: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    const provider = IntegrationRegistry.get("telegram");
    if (!provider) return { success: false, error: "Telegram provider not registered." };
    const botInfo = await provider.getProfile(botToken);
    await saveConnection(userId, "telegram", botInfo.email, botToken, undefined, 86400 * 365);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      if (baseUrl.startsWith("http://localhost")) {
        console.log("[Telegram] Dev mode — webhook skipped, using long polling");
      } else {
        const webhookUrl = `${baseUrl}/api/telegram-webhook?userId=${userId}`;
        const secret = telegramWebhookSecret(botToken, userId);
        await TelegramService.setWebhook(botToken, webhookUrl, secret);
      }
    } catch {
      console.warn("[Telegram] Webhook setup failed");
    }

    return { success: true, username: botInfo.email };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to connect Telegram.";
    return { success: false, error: msg };
  }
}

export async function disconnectTelegramWebhookAction(userId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    const repo = getRepo();
    const record = await repo.findByUserAndProvider(userId, "telegram");
    if (!record) return { success: true };
    const token = repo.decryptToken(record.encrypted_access_token);
    if (token) {
      try {
        await TelegramService.deleteWebhook(token);
      } catch {}
    }
    return { success: true };
  } catch {
    return { success: true };
  }
}

// ── DISCORD SPECIFIC WRAPPERS ──

export async function connectDiscordAction(userId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    const provider = IntegrationRegistry.get("discord") as DiscordProvider | undefined;
    if (!provider) return { success: false, error: "Discord provider not registered." };

    const botToken = provider.getBotToken();
    const botInfo = await provider.getProfile(botToken);
    const guilds = await DiscordService.getGuilds(botToken);
    if (!guilds.length) {
      return { success: false, error: "Bot hasn't been added to any Discord server yet. Use the invite link first.", inviteUrl: provider.getInviteUrl() };
    }

    await saveConnection(userId, "discord", botInfo.email, botToken, undefined, 86400 * 365);
    return { success: true, username: botInfo.email, guildCount: guilds.length };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to connect Discord.";
    return { success: false, error: msg };
  }
}

export async function getDiscordInviteUrlAction() {
  const provider = IntegrationRegistry.get("discord") as DiscordProvider | undefined;
  if (!provider) return null;
  try {
    return provider.getInviteUrl();
  } catch {
    return null;
  }
}

// ── LINKEDIN SPECIFIC WRAPPERS ──

export async function disconnectLinkedinAction(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  return disconnectConnection(userId, "linkedin");
}

// ── GITHUB SPECIFIC WRAPPERS ──

export async function disconnectGithubAction(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  return disconnectConnection(userId, "github");
}

// Dynamically retrieve exposed MCP capabilities from the provider registry
export async function getProviderTools(providerId: string) {
  const provider = IntegrationRegistry.get(providerId);
  if (!provider) return [];
  // Return tool metadata safely
  return provider.getTools();
}

// ── INTEGRATION WORKSPACE ACTIONS ──

export interface WorkspaceIntegration {
  id: string;
  provider: string;
  name: string;
  email: string;
  connected: boolean;
  has_refresh_token: boolean;
  status: string;
  sync_status: string;
  last_error: string | null;
  scopes: string;
  last_sync_at: string;
  connected_at: string;
  expires_at: string;
  metadata: Record<string, unknown>;
  settings: {
    auto_sync: boolean;
    notifications: boolean;
    background_sync: boolean;
    token_refresh: boolean;
  };
}

export async function getAllIntegrations(userId: string): Promise<WorkspaceIntegration[]> {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return [];
    const repo = getRepo();
    const records = await repo.findAllByUser(userId);
    return records.map((r) => mapToWorkspace(r, IntegrationRegistry.get(r.provider)?.name || r.provider));
  } catch (e) {
    console.error("Failed to load all integrations:", e);
    return [];
  }
}

export async function getIntegration(userId: string, providerId: string): Promise<WorkspaceIntegration | null> {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return null;
    const record = await getRepo().findByUserAndProvider(userId, providerId);
    if (!record) return null;
    return mapToWorkspace(record, IntegrationRegistry.get(providerId)?.name || providerId);
  } catch (e) {
    console.error(`Failed to load integration ${providerId}:`, e);
    return null;
  }
}

export async function refreshToken(userId: string, providerId: string): Promise<{ success: boolean; error?: string; expiresAt?: string }> {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  return refreshTokenInternal(userId, providerId);
}

export async function syncIntegration(userId: string, providerId: string): Promise<{ success: boolean; error?: string; syncedAt?: string; result?: unknown }> {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  return syncIntegrationCore(userId, providerId);
}

export async function reconnectIntegration(userId: string, providerId: string) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    await disconnectConnection(userId, providerId);
    return { success: true, needsOAuth: !!IntegrationRegistry.get(providerId)?.scopes.length, provider: providerId };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Reconnect failed.";
    return { success: false, error: msg };
  }
}

export async function updateIntegrationSettings(
  userId: string,
  providerId: string,
  settings: { auto_sync?: boolean; notifications?: boolean; background_sync?: boolean; token_refresh?: boolean }
) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    return await getRepo().updateSettings(userId, providerId, settings);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to update settings.";
    return { success: false, error: msg };
  }
}

export async function getIntegrationLogs(userId: string, providerId: string, limit = 15) {
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return [];
    return await getRepo().getSyncLogs(userId, providerId, limit);
  } catch {
    return [];
  }
}

// ── ZOD-VALIDATED ACTION NAMES ──
// Thin, validated facades over the shared logic above. Keep the action
// surface the UI imports from, validate untrusted client input.

export async function connectIntegration(userId: string, providerId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  const parsed = connectIntegrationSchema.safeParse({ userId, providerId });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  return { success: true, provider: parsed.data.providerId };
}

export async function disconnectIntegration(userId: string, providerId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  const parsed = disconnectIntegrationSchema.safeParse({ userId, providerId });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  try {
    return await disconnectConnection(parsed.data.userId, parsed.data.providerId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Disconnect failed.";
    return { success: false, error: msg };
  }
}

export async function deleteIntegration(userId: string, providerId: string) {
  return disconnectIntegration(userId, providerId);
}

export async function refreshIntegrationToken(userId: string, providerId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  const parsed = refreshTokenSchema.safeParse({ userId, providerId });
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message || "Invalid input." };
  return refreshToken(parsed.data.userId, parsed.data.providerId);
}

