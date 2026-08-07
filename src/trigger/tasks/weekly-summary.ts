import { schedules } from "@trigger.dev/sdk/v3";
import { sendNotification } from "./notification-send";
import { createAdminDb } from "@/lib/db";
import { NotificationPreferencesRepository } from "@/lib/repositories/notification-preferences-repository";
import { buildGroundedBriefNotification } from "@/lib/services/notification-briefs";

export const weeklySummary = schedules.task({
  id: "weekly-summary",
  cron: "0 8 * * 1",
  run: async () => {
    const admin = createAdminDb();
    const prefs = new NotificationPreferencesRepository(admin);
    const userIds = await prefs.findUsersWithEnabledType("priority_items");

    for (const userId of userIds) {
      try {
        // Grounded: reads the canonical briefing pipeline (real synchronized
        // items). Never a free-form LLM call — no fabricated content.
        const brief = await buildGroundedBriefNotification(userId, {
          title: "Weekly Priority Summary",
          scope: "weekly",
        });

        await sendNotification.trigger({
          userId,
          notificationType: "priority_items",
          title: brief.title,
          body: brief.body,
          provider: "telegram",
        });
      } catch (error) {
        console.error(`weeklySummary: failed for user ${userId}:`, error);
      }
    }
  },
});