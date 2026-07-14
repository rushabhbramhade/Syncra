"use server";

import { createAdminDb } from "@/lib/db";
import { requireOwnership } from "@/lib/auth-guard";
import { TelegramRepository } from "@/lib/repositories/telegram-repository";
import { NotificationPreferencesRepository } from "@/lib/repositories/notification-preferences-repository";
import { NotificationHistoryRepository } from "@/lib/repositories/notification-history-repository";
import { TelegramService } from "@/lib/services/telegram-service";
import { NotificationService } from "@/lib/services/notification-service";
import type { NotificationType, NotificationSchedule } from "@/lib/repositories/notification-preferences-repository";

function getTelegramRepo(): TelegramRepository {
  return new TelegramRepository(createAdminDb());
}

function getPrefsRepo(): NotificationPreferencesRepository {
  return new NotificationPreferencesRepository(createAdminDb());
}

function getHistoryRepo(): NotificationHistoryRepository {
  return new NotificationHistoryRepository(createAdminDb());
}

export async function getTelegramConnectionAction(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    const repo = getTelegramRepo();
    const connection = await repo.getActive(guard.userId);
    if (!connection) {
      return { success: true, connection: null };
    }

    const historyRepo = getHistoryRepo();
    const history = await historyRepo.findRecent(guard.userId);

    return {
      success: true,
      connection: {
        id: connection.id,
        chatId: connection.chat_id,
        username: connection.telegram_username,
        firstName: connection.first_name,
        lastName: connection.last_name,
        connectedAt: connection.connected_at,
        lastVerified: connection.last_verified,
        status: connection.status,
        lastNotificationSent: history?.sent_at || null,
        lastNotificationStatus: history?.status || null,
      },
    };
  } catch (error) {
    console.error("getTelegramConnectionAction failed:", error);
    return { success: false, error: "Failed to get Telegram connection." };
  }
}

export async function verifyTelegramConnectionAction(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    const repo = getTelegramRepo();

    const existing = await repo.getActive(guard.userId);
    if (existing) {
      return {
        success: true,
        verified: true,
        connection: {
          chatId: existing.chat_id,
          username: existing.telegram_username,
          firstName: existing.first_name,
          lastName: existing.last_name,
          connectedAt: existing.connected_at,
          lastVerified: existing.last_verified,
        },
      };
    }

    const result = await TelegramService.getChatIdAfterStart(guard.userId);

    if (!result.success || !result.chat_id) {
      return {
        success: true,
        verified: false,
        error: result.error || "Could not verify. Make sure you pressed Start in Telegram.",
      };
    }

    await repo.upsert({
      user_id: guard.userId,
      chat_id: String(result.chat_id),
      telegram_username: result.username,
      first_name: result.first_name,
      last_name: result.last_name,
    });

    const prefsRepo = getPrefsRepo();
    await prefsRepo.bulkInit(guard.userId);

    return {
      success: true,
      verified: true,
      connection: {
        chatId: String(result.chat_id),
        username: result.username,
        firstName: result.first_name,
        lastName: result.last_name,
        connectedAt: new Date().toISOString(),
        lastVerified: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error("verifyTelegramConnectionAction failed:", error);
    return { success: false, error: "Failed to verify Telegram connection." };
  }
}

export async function disconnectTelegramAction(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    const repo = getTelegramRepo();
    await repo.disconnect(guard.userId);
    return { success: true };
  } catch (error) {
    console.error("disconnectTelegramAction failed:", error);
    return { success: false, error: "Failed to disconnect Telegram." };
  }
}

export async function sendTestNotificationAction(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    const result = await NotificationService.sendTest(guard.userId);
    return result;
  } catch (error) {
    console.error("sendTestNotificationAction failed:", error);
    return { success: false, error: "Failed to send test notification." };
  }
}

export async function getNotificationPreferencesAction(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error, preferences: [] };
  try {
    const repo = getPrefsRepo();
    const prefs = await repo.findByUserId(guard.userId);

    if (prefs.length === 0) {
      await repo.bulkInit(guard.userId);
      const initialized = await repo.findByUserId(guard.userId);
      return { success: true, preferences: initialized };
    }

    return { success: true, preferences: prefs };
  } catch (error) {
    console.error("getNotificationPreferencesAction failed:", error);
    return { success: false, error: "Failed to load notification preferences.", preferences: [] };
  }
}

export async function updateNotificationPreferenceAction(
  userId: string,
  type: NotificationType,
  updates: { enabled?: boolean; schedule?: NotificationSchedule; timezone?: string }
) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    const repo = getPrefsRepo();
    await repo.upsert(guard.userId, type, updates);
    return { success: true };
  } catch (error) {
    console.error("updateNotificationPreferenceAction failed:", error);
    return { success: false, error: "Failed to update notification preference." };
  }
}

export async function getNotificationHistoryAction(userId: string, limit = 50) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error, history: [], stats: { total: 0, sent: 0, failed: 0, delivered: 0 } };
  try {
    const repo = getHistoryRepo();
    const history = await repo.findByUserId(guard.userId, limit);
    const stats = await repo.getStats(guard.userId);
    return { success: true, history, stats };
  } catch (error) {
    console.error("getNotificationHistoryAction failed:", error);
    return { success: false, error: "Failed to load notification history.", history: [], stats: { total: 0, sent: 0, failed: 0, delivered: 0 } };
  }
}

export async function generateAndSendBriefAction(
  userId: string,
  type: "daily_ai_brief" | "priority_items",
  userData?: Record<string, unknown>
) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) return { success: false, error: guard.error };
  try {
    if (type === "daily_ai_brief") {
      return await NotificationService.sendDailyBrief(guard.userId, userData);
    }
    return await NotificationService.sendPrioritySummary(guard.userId, userData);
  } catch (error) {
    console.error("generateAndSendBriefAction failed:", error);
    return { success: false, error: "Failed to generate and send brief." };
  }
}
