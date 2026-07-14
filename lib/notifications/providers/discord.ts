import { NotificationProvider, FormattedNotification } from "../provider";
import { providerLogger } from "../logger";

export class DiscordProvider implements NotificationProvider {
  id = "discord";
  name = "Discord";

  async send(
    recipientId: string,
    notification: FormattedNotification
  ): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    providerLogger.warn({ provider: this.id, recipientId }, "Discord provider not implemented");
    return { success: false, error: "Discord provider not implemented" };
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new DiscordProvider());