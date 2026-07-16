import { NotificationProvider, FormattedNotification } from "../provider";
import { providerLogger } from "../logger";

export class EmailProvider implements NotificationProvider {
  id = "email";
  name = "Email";

  async send(recipientId: string, notification: FormattedNotification): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.NOTIFICATIONS_EMAIL_FROM || "notifications@syncra.app",
          to: recipientId,
          subject: notification.title,
          text: notification.body,
        }),
      });
      if (!res.ok) throw new Error(`Email API error: ${res.statusText}`);
      const result = await res.json();
      return { success: true, providerResponse: result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send email notification";
      providerLogger.error({ recipientId, error: message }, "Email notification failed");
      return { success: false, error: message };
    }
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new EmailProvider());
