import { IntegrationRegistry } from "@/lib/integrations";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { createAdminDb } from "@/lib/db";
import { IntegrationEvents } from "@/lib/integration-events";
import { logger, getCorrelationId } from "@/lib/logger";
import { ToolPermissionsRepository } from "@/lib/repositories/tool-permissions-repository";
import { isSyncEvidenceAction, countResultItems, syncEvidenceMessage } from "@/lib/integrations/sync-evidence";

export function getRepo(): IntegrationsRepository {
  return new IntegrationsRepository(createAdminDb());
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

  IntegrationEvents.publish(userId, "connection.updated", providerId);

  // Initial sync: kick off automatically right after authentication completes.
  // WhatsApp is excluded — its session is only persisted once a verified socket
  // opens, and its initial sync runs inline (socket context has no request
  // cookies, so the cookie-guarded syncIntegration action would fail there).
  if (providerId !== "whatsapp") {
    void syncIntegration(userId, providerId).catch((err: unknown) => {
      console.warn(`[integration] initial sync failed for ${providerId}:`, err);
    });
  }

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

  try {
    const admin = createAdminDb();
    await admin.database.from("integration_scopes").delete().eq("user_id", userId).eq("provider", providerId);
  } catch (err) {
    console.warn(`Failed to clear integration scopes for ${providerId}:`, err);
  }

  try {
    const admin = createAdminDb();
    await admin.database.from("user_tool_permissions").delete().eq("user_id", userId).eq("provider", providerId);
  } catch (err) {
    console.warn(`Failed to clear tool permissions for ${providerId}:`, err);
  }

  if (providerId === "telegram") {
    try {
      const { disconnectTelegramWebhookAction } = await import("@/app/actions/integrations");
      await disconnectTelegramWebhookAction(userId);
    } catch (err) {
      console.warn(`Failed to delete Telegram webhook for ${userId}:`, err);
    }
  }

  if (providerId === "whatsapp") {
    try {
      const { WhatsAppClientManager } = await import("@/lib/whatsapp/client");
      await WhatsAppClientManager.disconnect(userId);
    } catch (err) {
      console.warn(`Failed to disconnect WhatsApp client for ${userId}:`, err);
    }
  }

  IntegrationEvents.publish(userId, "connection.updated", providerId);
  return repo.delete(userId, providerId);
}

export async function executeMCPAction(userId: string, providerId: string, actionName: string, args: Record<string, unknown>, opts?: { retries?: number }) {
  const correlationId = getCorrelationId() || `mcp_${Date.now().toString(36)}`;
  const log = logger.child({ correlationId, userId, providerId, actionName });
  const startTime = Date.now();
  const maxRetries = opts?.retries ?? 2;

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

    // Providers that use non-expiring tokens (Slack bot tokens, Discord bot tokens,
    // GitHub PATs/app tokens) declare tokensExpire = false.  Skip the expiry gate.
    if (provider.tokensExpire !== false) {
      const expiryTime = new Date(record.expires_at || "").getTime();
      const isExpired = expiryTime > 0 && Date.now() >= (expiryTime - 60000);

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

          // Use saveToken (UPDATE) to preserve scopes and all other metadata;
          // upsert would zero out scopes because the refresh caller never re-supplies them.
          await repo.saveToken(userId, providerId, refreshData.accessToken, undefined, refreshData.expiresIn);
        } catch (err: unknown) {
          const errorObj = err as { message?: string };
          return { status: "error", error: { code: -32001, message: `Token refresh failed: ${errorObj.message || ""}` } };
        }
      }
    }

    // Retry wrapper: transient provider failures (network, 5xx) get retried
    // with exponential backoff. Permanent errors (4xx, auth) fail immediately.
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await provider.executeTool(accessToken, actionName, args, { userId });
        repo.updateLastSync(userId, providerId);
        const duration = Date.now() - startTime;
        log.info(`MCP action completed in ${duration}ms`, { duration, status: "success", attempt: attempt || undefined });
        // Real data-fetch evidence → integration_sync_logs. Written once at the
        // single success point (never per retry attempt), so the Integration
        // Health card shows precisely this fetch outcome.
        if (isSyncEvidenceAction(actionName)) {
          await repo.addSyncLog({
            user_id: userId,
            provider: providerId,
            status: "success",
            message: syncEvidenceMessage({ actionName, status: "success", itemCount: countResultItems(result) }),
            metadata: { action: actionName, itemCount: countResultItems(result), source: "briefing" },
            duration_ms: duration,
          });
        }
        return { status: "success", result };
      } catch (err: unknown) {
        lastErr = err;
        const errorObj = err as { message?: string; status?: number; statusCode?: number; code?: number };
        const httpStatus = errorObj.status || errorObj.statusCode || 0;
        const isTransient = !httpStatus || httpStatus >= 500 || httpStatus === 429;
        if (!isTransient || attempt >= maxRetries) break;
        const delay = 1000 * Math.pow(2, attempt);
        log.warn(`MCP action transient failure, retrying in ${delay}ms`, { attempt: attempt + 1, delay, error: errorObj.message });
        await new Promise(r => setTimeout(r, delay));
      }
    }

    const errorObj = lastErr as { message?: string };
    const duration = Date.now() - startTime;
    log.error(`MCP action failed after ${duration}ms`, { duration, error: errorObj.message });
    if (isSyncEvidenceAction(actionName)) {
      await repo.addSyncLog({
        user_id: userId,
        provider: providerId,
        status: "error",
        message: syncEvidenceMessage({ actionName, status: "error", error: errorObj.message }),
        metadata: { action: actionName, error: errorObj.message || null },
        duration_ms: duration,
      });
    }
    return { status: "error", error: { code: -32003, message: errorObj.message || `Failed to execute action ${actionName}.` } };
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    const duration = Date.now() - startTime;
    log.error(`MCP action failed after ${duration}ms`, { duration, error: errorObj.message });
    return { status: "error", error: { code: -32003, message: errorObj.message || `Failed to execute action ${actionName}.` } };
  }
}

export async function syncIntegration(userId: string, providerId: string) {
  const repo = getRepo();
  const started = Date.now();
  try {
    const provider = IntegrationRegistry.get(providerId);
    if (!provider) return { success: false, error: `Provider ${providerId} not found.` };

    const record = await repo.findByUserAndProvider(userId, providerId);
    if (!record) return { success: false, error: "Connection not found. Reconnect first." };

    await repo.setSyncStatus(userId, providerId, "syncing");

    // Refresh token first if close to expiry.
    const expiresAt = new Date(record.expires_at || "").getTime();
    if (expiresAt && Date.now() >= expiresAt - 60_000 && record.encrypted_refresh_token) {
      await refreshTokenInternal(userId, providerId);
    }

    const refreshedRecord = await repo.findByUserAndProvider(userId, providerId);
    const accessToken = refreshedRecord ? repo.decryptToken(refreshedRecord.encrypted_access_token) : null;
    if (!accessToken) return { success: false, error: "Access token is corrupted. Reconnect your account." };

    const tool = DEFAULT_SYNC_TOOL[providerId];
    const args = DEFAULT_SYNC_ARGS[providerId] || {};

    const result = tool
      ? await provider.executeTool(accessToken, tool, args, { userId })
      : await provider.getProfile(accessToken);

    let savedCount = 0;
    if (result != null && refreshedRecord?.id) {
      try {
        const { normalizeResult } = await import("@/lib/briefing/pipeline");
        const { getUnifiedStoreRepo } = await import("@/lib/repositories/unified-store-repository");
        const entities = normalizeResult(providerId, result, refreshedRecord.id);
        if (entities.length > 0) {
          const store = getUnifiedStoreRepo();
          savedCount = await store.upsertBatch(userId, refreshedRecord.id, entities);
        }
      } catch (err) {
        console.warn(`[syncIntegration] Unified store upsert failed for ${providerId}:`, err);
      }
    }

    await repo.setSyncStatus(userId, providerId, "success");
    await repo.addSyncLog({
      user_id: userId,
      provider: providerId,
      status: "success",
      message: tool ? `Sync completed via ${tool}.` : "Profile sync completed.",
      metadata: { itemCount: Array.isArray(result) ? result.length : undefined, savedCount },
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

export async function refreshTokenInternal(userId: string, providerId: string) {
  const repo = getRepo();
  const started = Date.now();
  try {
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

const DEFAULT_SYNC_TOOL: Record<string, string> = {
  gmail: "gmail_search_emails",
  slack: "slack_fetch_messages",
  whatsapp: "whatsapp_fetch_messages",
  telegram: "telegram_fetch_messages",
  discord: "discord_fetch_recent_messages",
  github: "github_get_recent_activity",
  linkedin: "linkedin_get_profile",
};

const DEFAULT_SYNC_ARGS: Record<string, Record<string, unknown>> = {
  gmail: { query: "is:unread", limit: 5 },
  slack: { limit: 5 },
  whatsapp: { limit: 10 },
  telegram: { limit: 5 },
  discord: { limit: 3 },
  github: { limit: 24 },
  linkedin: {},
};