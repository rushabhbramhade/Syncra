import { NotificationProvider, FormattedNotification } from "../provider";
import { providerLogger } from "../logger";

export class SlackProvider implements NotificationProvider {
  id = "slack";
  name = "Slack";

  async send(
    recipientId: string,
    notification: FormattedNotification
  ): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    providerLogger.warn({ provider: this.id, recipientId }, "Slack provider not implemented");
    return { success: false, error: "Slack provider not implemented" };
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new SlackProvider());