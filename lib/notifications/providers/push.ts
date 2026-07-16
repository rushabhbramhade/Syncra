import { NotificationProvider, FormattedNotification } from "../provider";
import { providerLogger } from "../logger";

export class PushProvider implements NotificationProvider {
  id = "push";
  name = "Push Notifications";

  async send(recipientId: string, notification: FormattedNotification): Promise<{ success: boolean; error?: string; providerResponse?: unknown }> {
    try {
      const { createAdminDb } = await import("@/lib/db");
      const db = createAdminDb();
      const { data: subs } = await db.database
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", recipientId);

      if (!subs || subs.length === 0) return { success: false, error: "No push subscriptions" };

      for (const sub of subs) {
        try {
          await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              Authorization: `key=${process.env.FCM_SERVER_KEY || ""}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: (sub.subscription as any)?.endpoint,
              notification: {
                title: notification.title,
                body: notification.body,
              },
            }),
          });
        } catch {}
      }
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send push notification";
      providerLogger.error({ recipientId, error: message }, "Push notification failed");
      return { success: false, error: message };
    }
  }
}

import { notificationProviderRegistry } from "../provider-registry";
notificationProviderRegistry.register(new PushProvider());
