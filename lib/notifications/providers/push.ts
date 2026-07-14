import { NotificationProvider, FormattedNotification } from "../provider";
import { providerLogger } from "../logger";

export class PushProvider implements NotificationProvider {
  id = "push";
  name = "Push Notifications";

  async send(
    recipientId: string,
    notification: FormattedNotification
  ): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    providerLogger.warn({ provider: this.id, recipientId }, "Push provider not implemented");
    return { success: false, error: "Push provider not implemented" };
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new PushProvider());