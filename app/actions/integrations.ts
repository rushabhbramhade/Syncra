"use server";

import { IntegrationRegistry } from "@/lib/integrations";
import { DiscordProvider } from "@/lib/integrations/discord-provider";
import { DiscordService } from "@/lib/discord/discord-service";
import { TelegramService, telegramWebhookSecret } from "@/lib/telegram/telegram-service";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import type { IntegrationRecord } from "@/lib/repositories/integrations-repository";
import { createAdminDb } from "@/lib/db";
import { requireOwnership } from "@/lib/auth-guard";
import { logger, getCorrelationId } from "@/lib/logger";
import { ToolPermissionsRepository } from "@/lib/repositories/tool-permissions-repository";
import {
  connectIntegrationSchema,
  disconnectIntegrationSchema,
  refreshTokenSchema,
} from "@/features/integrations/schemas";

function getRepo(): IntegrationsRepository {
  return new IntegrationsRepository(createAdminDb());
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
    return await getRepo().getConnectionStatus(userId, providerId);
  } catch (e) {
    console.error(`Error fetching connection status for ${providerId}:`, e);
    return null;
  }
}

export async function saveConnection(
  userId: string,
  providerId: string,
  email: string,
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number,
  scopes?: string
) {
  const repo = getRepo();
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await repo.upsert({
    user_id: userId,
    provider: providerId,
    provider_account_id: email,
    email,
    encrypted_access_token: repo.encryptToken(accessToken),
    encrypted_refresh_token: refreshToken ? repo.encryptToken(refreshToken) : undefined,
    expires_at: expiresAt,
    scopes: scopes || "",
    status: "active",
  });

  return { success: true };
}

export async function disconnectConnection(userId: string, providerId: string) {
  const repo = getRepo();
  const provider = IntegrationRegistry.get(providerId);
  if (!provider) throw new Error(`Provider ${providerId} not found.`);

  const record = await repo.findByUserAndProvider(userId, providerId);
  if (record) {
    const accessToken = repo.decryptToken(record.encrypted_access_token);
    const providerWithRevoke = provider as unknown as { revokeAccess?: (token: string) => Promise<void> };
    if (accessToken && typeof providerWithRevoke.revokeAccess === "function") {
      try {
        await providerWithRevoke.revokeAccess(accessToken);
      } catch (err) {
        console.warn(`Failed to revoke token for ${providerId}:`, err);
      }
    }
  }

  return repo.delete(userId, providerId);
}

export async function executeMCPAction(userId: string, providerId: string, actionName: string, args: Record<string, unknown>) {
  const correlationId = getCorrelationId() || `mcp_${Date.now().toString(36)}`;
  const log = logger.child({ correlationId, userId, providerId, actionName });
  const startTime = Date.now();

  const provider = IntegrationRegistry.get(providerId);
  if (!provider) {
    log.warn(`Provider ${providerId} not found`);
    return { status: "error", error: { code: -32002, message: `Provider ${providerId} not found.` } };
  }

  try {
    log.info("Executing MCP action");

    const permRepo = new ToolPermissionsRepository();
    const isToolEnabled = await permRepo.isToolEnabled(userId, actionName);
    if (!isToolEnabled) {
      log.warn(`Tool ${actionName} is disabled by user`);
      return { status: "error", error: { code: -32005, message: `The tool "${actionName}" is currently disabled. Enable it in Integrations settings.` } };
    }

    const repo = getRepo();
    const record = await repo.findByUserAndProvider(userId, providerId);

    if (!record) {
      return { status: "error", error: { code: -32002, message: `${provider.name} account not connected.` } };
    }

    let accessToken = repo.decryptToken(record.encrypted_access_token);
    const refreshToken = record.encrypted_refresh_token ? repo.decryptToken(record.encrypted_refresh_token) : null;

    if (!accessToken) {
      return { status: "error", error: { code: -32004, message: `${provider.name} token is corrupted. Please reconnect your account.` } };
    }

    const expiryTime = new Date(record.expires_at || "").getTime();
    const isExpired = Date.now() >= (expiryTime - 60000);

    if (isExpired) {
      if (!refreshToken) {
        return { status: "error", error: { code: -32004, message: `${provider.name} token has expired. Please reconnect your account.` } };
      }
      try {
        const refreshData = await provider.refreshAccess(refreshToken);
        if (!refreshData.accessToken) {
          return { status: "error", error: { code: -32001, message: `${provider.name} token refresh returned empty. Please reconnect your account.` } };
        }
        accessToken = refreshData.accessToken;

        await repo.upsert({
          user_id: userId,
          provider: providerId,
          email: record.email,
          encrypted_access_token: repo.encryptToken(refreshData.accessToken),
          expires_at: new Date(Date.now() + refreshData.expiresIn * 1000).toISOString(),
          status: "active",
        });
      } catch (err: unknown) {
        const errorObj = err as { message?: string };
        return { status: "error", error: { code: -32001, message: `Token refresh failed: ${errorObj.message || ""}` } };
      }
    }


    const result = await provider.executeTool(accessToken, actionName, args);
    repo.updateLastSync(userId, providerId);

    const duration = Date.now() - startTime;
    log.info(`MCP action completed in ${duration}ms`, { duration, status: "success" });
    return { status: "success", result };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    const duration = Date.now() - startTime;
    log.error(`MCP action failed after ${duration}ms`, { duration, error: errorObj.message });
    return { status: "error", error: { code: -32003, message: errorObj.message || `Failed to execute action ${actionName}.` } };
  }
}

// Browser-facing MCP executor with ownership verification. Server-side callers
// (briefing-service, search-service) must keep using the unguarded executeMCPAction.
export async function executeMCPActionGuarded(userId: string, providerId: string, actionName: string, args: Record<string, unknown>) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) {
    return { status: "error", error: { code: -32003, message: "Access denied" } };
  }
  return executeMCPAction(userId, providerId, actionName, args);
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
  return saveConnection(userId, "gmail", email, accessToken, refreshToken, expiresIn);
}

export async function disconnectGmailConnection(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  return disconnectConnection(userId, "gmail");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeGmailMCPAction(userId: string, actionName: string, args: Record<string, any>) {
  return executeMCPAction(userId, "gmail", actionName, args);
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

const DEFAULT_SYNC_TOOL: Record<string, string> = {
  gmail: "gmail_search_emails",
  slack: "slack_fetch_messages",
  whatsapp: "whatsapp_fetch_messages",
  telegram: "telegram_fetch_messages",
  discord: "discord_fetch_recent_messages",
  github: "github_get_notifications",
  linkedin: "linkedin_get_profile",
};

const DEFAULT_SYNC_ARGS: Record<string, Record<string, unknown>> = {
  gmail: { query: "is:unread", limit: 5 },
  slack: { limit: 5 },
  whatsapp: { limit: 10 },
  telegram: { limit: 5 },
  discord: { limit: 3 },
  github: {},
  linkedin: {},
};

function mapToWorkspace(record: IntegrationRecord, name: string): WorkspaceIntegration {
  const settings = getRepo().getSettings(record);
  return {
    id: record.id || `${record.provider}_${record.user_id}`,
    provider: record.provider,
    name,
    email: record.email || record.provider_account_id || "",
    connected: record.connected !== false && record.status === "active",
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

export async function refreshToken(userId: string, providerId: string) {
  const repo = getRepo();
  const started = Date.now();
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    const provider = IntegrationRegistry.get(providerId);
    if (!provider) return { success: false, error: `Provider ${providerId} not found.` };

    const record = await repo.findByUserAndProvider(userId, providerId);
    if (!record) return { success: false, error: "Connection not found. Reconnect first." };
    if (!record.encrypted_refresh_token) return { success: false, error: "No refresh token stored for this provider." };

    const refreshTokenPlain = repo.decryptToken(record.encrypted_refresh_token);
    if (!refreshTokenPlain) return { success: false, error: "Refresh token is corrupted. Reconnect your account." };

    await repo.setSyncStatus(userId, providerId, "syncing");
    const refreshed = await provider.refreshAccess(refreshTokenPlain);
    if (!refreshed.accessToken) return { success: false, error: "Token refresh returned empty. Reconnect your account." };

    await repo.saveToken(userId, providerId, refreshed.accessToken, refreshTokenPlain, refreshed.expiresIn);
    await repo.addSyncLog({
      user_id: userId,
      provider: providerId,
      status: "refresh",
      message: "Access token refreshed successfully.",
      duration_ms: Date.now() - started,
    });

    return { success: true, expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString() };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Token refresh failed.";
    await repo.setSyncStatus(userId, providerId, "error", msg);
    await repo.addSyncLog({ user_id: userId, provider: providerId, status: "error", message: msg, duration_ms: Date.now() - started });
    return { success: false, error: msg };
  }
}

export async function syncIntegration(userId: string, providerId: string) {
  const repo = getRepo();
  const started = Date.now();
  try {
    const guard = await requireOwnership(userId);
    if ("error" in guard) return { success: false, error: guard.error };
    const provider = IntegrationRegistry.get(providerId);
    if (!provider) return { success: false, error: `Provider ${providerId} not found.` };

    const record = await repo.findByUserAndProvider(userId, providerId);
    if (!record) return { success: false, error: "Connection not found. Reconnect first." };

    await repo.setSyncStatus(userId, providerId, "syncing");

    // Refresh token first if close to expiry.
    const expiresAt = new Date(record.expires_at || "").getTime();
    if (expiresAt && Date.now() >= expiresAt - 60_000 && record.encrypted_refresh_token) {
      await refreshToken(userId, providerId);
    }

    const refreshedRecord = await repo.findByUserAndProvider(userId, providerId);
    const accessToken = refreshedRecord ? repo.decryptToken(refreshedRecord.encrypted_access_token) : null;
    if (!accessToken) return { success: false, error: "Access token is corrupted. Reconnect your account." };

    const tool = DEFAULT_SYNC_TOOL[providerId];
    const args = DEFAULT_SYNC_ARGS[providerId] || {};

    const result = tool
      ? await provider.executeTool(accessToken, tool, args)
      : await provider.getProfile(accessToken);

    await repo.setSyncStatus(userId, providerId, "success");
    await repo.addSyncLog({
      user_id: userId,
      provider: providerId,
      status: "success",
      message: tool ? `Sync completed via ${tool}.` : "Profile sync completed.",
      metadata: { itemCount: Array.isArray(result) ? result.length : undefined },
      duration_ms: Date.now() - started,
    });

    return { success: true, syncedAt: new Date().toISOString(), result };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Sync failed.";
    await repo.setSyncStatus(userId, providerId, "error", msg);
    await repo.addSyncLog({ user_id: userId, provider: providerId, status: "error", message: msg, duration_ms: Date.now() - started });
    return { success: false, error: msg };
  }
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

