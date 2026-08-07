import { schedules } from "@trigger.dev/sdk/v3";
import { sendNotification } from "./notification-send";
import { createAdminDb } from "@/lib/db";
import { NotificationPreferencesRepository } from "@/lib/repositories/notification-preferences-repository";
import { AISummaryCacheRepository } from "@/lib/repositories/ai-summary-cache-repository";
import { buildGroundedBriefNotification } from "@/lib/services/notification-briefs";

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
        let body = await aiCache.findCached(userId, "daily_brief", cacheKey);

        if (!body) {
          // Grounded: reads the canonical briefing pipeline (real synchronized
          // items). Never a free-form LLM call — no fabricated content.
          const brief = await buildGroundedBriefNotification(userId, {
            title: "Daily AI Brief",
            scope: "daily",
          });
          body = brief.body;
          await aiCache.upsert({
            user_id: userId,
            summary_type: "daily_brief",
            cache_key: cacheKey,
            content: body,
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          });
        }

        await sendNotification.trigger({
          userId,
          notificationType: "daily_ai_brief",
          title: "Daily AI Brief",
          body,
          provider: "telegram",
        });
      } catch (error) {
        console.error(`dailyBrief: failed for user ${userId}:`, error);
      }
    }
  },
});