import { NotificationProvider, FormattedNotification } from "../provider";
import { providerLogger } from "../logger";

export class WhatsAppProvider implements NotificationProvider {
  id = "whatsapp";
  name = "WhatsApp";

  async send(
    recipientId: string,
    notification: FormattedNotification
  ): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    providerLogger.warn({ provider: this.id, recipientId }, "WhatsApp provider not implemented");
    return { success: false, error: "WhatsApp provider not implemented" };
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new WhatsAppProvider());