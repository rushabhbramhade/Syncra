import { NotificationProvider, FormattedNotification } from "../provider";
import { WhatsAppClientManager } from "@/lib/whatsapp/client";
import { providerLogger } from "../logger";

export class WhatsAppProvider implements NotificationProvider {
  id = "whatsapp";
  name = "WhatsApp";

  async send(recipientId: string, notification: FormattedNotification): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    try {
      const sock = await WhatsAppClientManager.getClient(recipientId);
      const jid = `${recipientId}@s.whatsapp.net`;
      const result = await sock.sendMessage(jid, { text: `${notification.title}\n${notification.body}` });
      return { success: true, providerResponse: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send WhatsApp notification";
      providerLogger.error({ recipientId, error: message }, "WhatsApp notification failed");
      return { success: false, error: message };
    }
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new WhatsAppProvider());
