import { schedules } from "@trigger.dev/sdk/v3";
import { createAdminDb } from "@/lib/db";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { IntegrationRegistry } from "@/lib/integrations";

const SYNC_TOOL: Record<string, string> = {
  gmail: "gmail_search_emails",
  slack: "slack_fetch_messages",
  whatsapp: "whatsapp_fetch_messages",
  telegram: "telegram_fetch_messages",
  discord: "discord_fetch_recent_messages",
  github: "github_get_notifications",
  linkedin: "linkedin_get_profile",
};

const SYNC_ARGS: Record<string, Record<string, unknown>> = {
  gmail: { query: "is:unread", limit: 5 },
  slack: { limit: 5 },
  whatsapp: { limit: 10 },
  telegram: { limit: 5 },
  discord: { limit: 3 },
  github: {},
  linkedin: {},
};

// Hourly maintenance: refresh expired tokens, retry failed syncs, run auto-sync.
export const integrationMaintenance = schedules.task({
  id: "integration-maintenance",
  cron: "0 * * * *",
  run: async () => {
    const admin = createAdminDb();
    const repo = new IntegrationsRepository(admin);

    const { data } = await admin.database
      .from("user_integrations")
      .select("*")
      .eq("status", "active");

    const rows = (data || []) as Array<Record<string, unknown>>;

    let refreshed = 0;
    let synced = 0;
    let retried = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const userId = row.user_id as string;
      const providerId = row.provider as string;
      const provider = IntegrationRegistry.get(providerId);
      if (!provider) continue;

      const settings = (row.metadata as Record<string, unknown>) || {};
      const autoSync = settings.auto_sync !== false;
      const tokenRefresh = settings.token_refresh !== false;
      const syncStatus = row.sync_status as string | undefined;
      const expiresAt = row.expires_at ? new Date(row.expires_at as string).getTime() : 0;

      try {
        // 1. Refresh tokens that are expired or close to expiry. Skip
        // providers whose tokens don't expire (GitHub, bot tokens, etc.)
        const expired = !expiresAt || Date.now() >= expiresAt - 60_000;
        if (expired && tokenRefresh && provider.tokensExpire !== false) {
          if (row.encrypted_refresh_token) {
            const refreshTokenPlain = repo.decryptToken(row.encrypted_refresh_token as string);
            if (refreshTokenPlain) {
              const refreshedTokens = await provider.refreshAccess(refreshTokenPlain);
              await repo.saveToken(userId, providerId, refreshedTokens.accessToken, refreshTokenPlain, refreshedTokens.expiresIn);
              await repo.addSyncLog({ user_id: userId, provider: providerId, status: "refresh", message: "Auto-refreshed expired token." });
              refreshed++;
            }
          } else {
            await repo.setSyncStatus(userId, providerId, "expired", "Token expired with no refresh token.");
            await repo.addSyncLog({ user_id: userId, provider: providerId, status: "error", message: "Token expired, no refresh token available." });
            errors.push(`${providerId}: token expired (${userId})`);
            continue;
          }
        }

        // 2. Retry previously failed syncs.
        const wasError = syncStatus === "error" || syncStatus === "expired";
        if (wasError) retried++;

        // 3. Run auto-sync when enabled.
        if (!autoSync) continue;

        await repo.setSyncStatus(userId, providerId, "syncing");
        const accessToken = repo.decryptToken(row.encrypted_access_token as string);
        if (!accessToken) continue;

        const tool = SYNC_TOOL[providerId];
        const args = SYNC_ARGS[providerId] || {};
        const started = Date.now();
        const result = tool
          ? await provider.executeTool(accessToken, tool, args)
          : await provider.getProfile(accessToken);

        await repo.setSyncStatus(userId, providerId, "success");
        await repo.addSyncLog({
          user_id: userId,
          provider: providerId,
          status: "success",
          message: tool ? `Auto-sync completed via ${tool}.` : "Profile sync completed.",
          metadata: { itemCount: Array.isArray(result) ? result.length : undefined, auto: true },
          duration_ms: Date.now() - started,
        });
        synced++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Auto-sync failed.";
        await repo.setSyncStatus(userId, providerId, "error", message);
        await repo.addSyncLog({ user_id: userId, provider: providerId, status: "error", message });
        errors.push(`${providerId}: ${message}`);
      }
    }

    return { checked: rows.length, refreshed, synced, retried, errors: errors.slice(0, 20) };
  },
});
