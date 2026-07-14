import { schedules } from "@trigger.dev/sdk/v3";
import { createAdminDb } from "@/lib/db";
import { NotificationHistoryRepository } from "@/lib/repositories/notification-history-repository";
import { sendNotification } from "./notification-send";

export const processQueue = schedules.task({
  id: "process-notification-queue",
  cron: "* * * * *",
  run: async () => {
    const admin = createAdminDb();
    const history = new NotificationHistoryRepository(admin);
    const due = await history.findDueForProcessing();

    for (const record of due) {
      if (!record.id) continue;

      try {
        await sendNotification.trigger({
          userId: record.user_id,
          notificationType: record.notification_type,
          title: record.title || "Notification",
          body: record.message,
          provider: record.provider,
          idempotencyKey: record.id,
        });
      } catch (error) {
        console.error(`processQueue: failed to trigger notification ${record.id}:`, error);
      }
    }
  },
});