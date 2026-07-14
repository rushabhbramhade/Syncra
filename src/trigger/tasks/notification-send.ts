import { task } from "@trigger.dev/sdk/v3";
import { createAdminDb } from "@/lib/db";
import { notificationProviderRegistry } from "@/lib/notifications/provider-registry";
import { NotificationHistoryRepository } from "@/lib/repositories/notification-history-repository";
import { NotificationCenterRepository } from "@/lib/repositories/notification-center-repository";
import { TelegramRepository } from "@/lib/repositories/telegram-repository";

export const sendNotification = task({
  id: "notification-send",
  retry: {
    maxAttempts: 4,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 300_000,
  },
  run: async (payload: {
    userId: string;
    notificationType: string;
    title: string;
    body: string;
    provider?: string;
    idempotencyKey?: string;
  }) => {
    const admin = createAdminDb();
    const history = new NotificationHistoryRepository(admin);
    const center = new NotificationCenterRepository(admin);
    const telegram = new TelegramRepository(admin);
    const providerId = payload.provider || "telegram";

    const provider = notificationProviderRegistry.get(providerId);
    if (!provider) {
      throw new Error(`Provider "${providerId}" not registered`);
    }

    let recipientId: string | null = null;
    if (providerId === "telegram") {
      const conn = await telegram.getActive(payload.userId);
      recipientId = conn?.chat_id || null;
    }

    if (!recipientId) {
      throw new Error(`No ${providerId} connection for user`);
    }

    const historyRecord = await history.insert({
      user_id: payload.userId,
      notification_type: payload.notificationType,
      provider: providerId,
      title: payload.title,
      message: payload.body,
      status: "queued",
    });

    const result = await provider.send(recipientId, {
      title: payload.title,
      body: payload.body,
      metadata: { type: payload.notificationType },
    });

    if (historyRecord.id) {
      await history.updateStatus(
        historyRecord.id,
        result.success ? "sent" : "failed",
        result.error,
        result.providerResponse as Record<string, unknown>
      );
    }

    await center.insert({
      user_id: payload.userId,
      notification_type: payload.notificationType,
      title: payload.title,
      body: payload.body,
      provider: providerId,
      external_history_id: historyRecord.id,
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to send notification");
    }

    return { success: true, historyId: historyRecord.id };
  },
});