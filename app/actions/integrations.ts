"use server";

import { IntegrationRegistry } from "@/lib/integrations";
import { DiscordProvider } from "@/lib/integrations/discord-provider";
import { DiscordService } from "@/lib/discord/discord-service";
import { TelegramService } from "@/lib/telegram/telegram-service";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { createAdminDb } from "@/lib/db";

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
  const provider = IntegrationRegistry.get(providerId);
  if (!provider) {
    return { status: "error", error: { code: -32002, message: `Provider ${providerId} not found.` } };
  }

  try {
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

    if (isExpired && refreshToken) {
      try {
        const refreshData = await provider.refreshAccess(refreshToken);
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

    return { status: "success", result };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    console.error(`Error executing action ${actionName}:`, err);
    return { status: "error", error: { code: -32003, message: errorObj.message || `Failed to execute action ${actionName}.` } };
  }
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
        await TelegramService.setWebhook(botToken, webhookUrl);
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
  return disconnectConnection(userId, "linkedin");
}

// ── GITHUB SPECIFIC WRAPPERS ──

export async function disconnectGithubAction(userId: string) {
  return disconnectConnection(userId, "github");
}

// Dynamically retrieve exposed MCP capabilities from the provider registry
export async function getProviderTools(providerId: string) {
  const provider = IntegrationRegistry.get(providerId);
  if (!provider) return [];
  // Return tool metadata safely
  return provider.getTools();
}

