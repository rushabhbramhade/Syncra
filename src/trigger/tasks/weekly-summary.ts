import { schedules } from "@trigger.dev/sdk/v3";
import { sendNotification } from "./notification-send";
import { createAdminDb } from "@/lib/db";
import { NotificationPreferencesRepository } from "@/lib/repositories/notification-preferences-repository";
import { generateJsonResponse } from "@/lib/ai-service";

function getWeekNumber(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

export const weeklySummary = schedules.task({
  id: "weekly-summary",
  cron: "0 8 * * 1",
  run: async () => {
    const admin = createAdminDb();
    const prefs = new NotificationPreferencesRepository(admin);
    const userIds = await prefs.findUsersWithEnabledType("priority_items");

    for (const userId of userIds) {
      try {
        const result = await generateJsonResponse<{ content: string }>(
          "You are Syncra's AI notification assistant. Generate a weekly priority summary. Format as JSON with a 'content' field. Keep it under 1000 characters.",
          { userId, week: getWeekNumber() }
        );

        await sendNotification.trigger({
          userId,
          notificationType: "priority_items",
          title: "Weekly Priority Summary",
          body: result?.content || "No summary available.",
          provider: "telegram",
        });
      } catch (error) {
        console.error(`weeklySummary: failed for user ${userId}:`, error);
      }
    }
  },
});