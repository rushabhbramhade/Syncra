import { NotificationProvider, FormattedNotification } from "../provider";
import { providerLogger } from "../logger";

export class EmailProvider implements NotificationProvider {
  id = "email";
  name = "Email";

  async send(
    recipientId: string,
    notification: FormattedNotification
  ): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    providerLogger.warn({ provider: this.id, recipientId }, "Email provider not implemented");
    return { success: false, error: "Email provider not implemented" };
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new EmailProvider());