import { NotificationProvider, FormattedNotification } from "../provider";
import { SlackApiService } from "@/lib/integrations/slack-provider";
import { providerLogger } from "../logger";

export class SlackProvider implements NotificationProvider {
  id = "slack";
  name = "Slack";

  async send(recipientId: string, notification: FormattedNotification): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    try {
      const token = process.env.SLACK_BOT_TOKEN;
      if (!token) throw new Error("SLACK_BOT_TOKEN not configured");
      const result = await SlackApiService.postMessage(token, recipientId, `${notification.title}\n\n${notification.body}`);
      return { success: true, providerResponse: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send Slack notification";
      providerLogger.error({ recipientId, error: message }, "Slack notification failed");
      return { success: false, error: message };
    }
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new SlackProvider());
