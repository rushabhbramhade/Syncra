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

      // Atomically claim this row so only one tick (and no second cron run)
      // owns it. Rows already claimed as "processing" are skipped.
      const claimed = await history.claimForProcessing(record.id);
      if (!claimed) continue;

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
        // Release the claim so a later tick can retry.
        await history.releaseForProcessing(record.id);
        console.error(`processQueue: failed to trigger notification ${record.id}:`, error);
      }
    }
  },
});