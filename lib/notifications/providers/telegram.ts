import { NotificationProvider, FormattedNotification } from "../provider";
import { TelegramService } from "@/lib/services/telegram-service";
import { providerLogger } from "../logger";

export class TelegramProvider implements NotificationProvider {
  id = "telegram";
  name = "Telegram";

  async send(
    recipientId: string,
    notification: FormattedNotification
  ): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    const type = notification.metadata?.type as string | undefined;
    try {
      providerLogger.debug({ recipientId, type }, "Sending Telegram notification");
      const result = await TelegramService.sendNotification(recipientId, notification.title, notification.body, type);
      providerLogger.info({ recipientId, messageId: result.message_id }, "Telegram notification sent");
      return { success: true, providerResponse: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send Telegram notification";
      providerLogger.error({ recipientId, error: message }, "Telegram notification failed");
      return { success: false, error: message };
    }
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new TelegramProvider());