import { schedules } from "@trigger.dev/sdk/v3";
import { sendNotification } from "./notification-send";
import { createAdminDb } from "@/lib/db";
import { NotificationPreferencesRepository } from "@/lib/repositories/notification-preferences-repository";
import { AISummaryCacheRepository } from "@/lib/repositories/ai-summary-cache-repository";
import { generateJsonResponse } from "@/lib/ai-service";

export const dailyBrief = schedules.task({
  id: "daily-brief",
  cron: "0 7 * * *",
  run: async () => {
    const admin = createAdminDb();
    const prefs = new NotificationPreferencesRepository(admin);
    const aiCache = new AISummaryCacheRepository(admin);

    const userIds = await prefs.findUsersWithEnabledType("daily_ai_brief");
    const cacheKey = new Date().toISOString().split("T")[0];

    for (const userId of userIds) {
      try {
        let briefContent = await aiCache.findCached(userId, "daily_brief", cacheKey);

        if (!briefContent) {
          const result = await generateJsonResponse<{ content: string }>(
            "You are Syncra's AI notification assistant. Generate a concise daily brief notification. Format the response as a JSON object with a 'content' field. Keep it under 800 characters.",
            { userId, date: cacheKey }
          );
          briefContent = result?.content || "No brief generated.";
          await aiCache.upsert({
            user_id: userId,
            summary_type: "daily_brief",
            cache_key: cacheKey,
            content: briefContent,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }

        await sendNotification.trigger({
          userId,
          notificationType: "daily_ai_brief",
          title: "Daily AI Brief",
          body: briefContent,
          provider: "telegram",
        });
      } catch (error) {
        console.error(`dailyBrief: failed for user ${userId}:`, error);
      }
    }
  },
});