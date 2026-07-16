import { NotificationProvider, FormattedNotification } from "../provider";
import { DiscordService } from "@/lib/discord/discord-service";
import { providerLogger } from "../logger";

export class DiscordProvider implements NotificationProvider {
  id = "discord";
  name = "Discord";

  async send(recipientId: string, notification: FormattedNotification): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    try {
      const token = process.env.DISCORD_BOT_TOKEN;
      if (!token) throw new Error("DISCORD_BOT_TOKEN not configured");
      const result = await DiscordService.sendMessage(token, recipientId, `${notification.title}\n\n${notification.body}`);
      return { success: true, providerResponse: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send Discord notification";
      providerLogger.error({ recipientId, error: message }, "Discord notification failed");
      return { success: false, error: message };
    }
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new DiscordProvider());
