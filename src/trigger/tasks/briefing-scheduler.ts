import { schedules } from "@trigger.dev/sdk/v3";
import { createAdminDb } from "@/lib/db";
import { BriefingsRepository } from "@/lib/repositories/briefings-repository";
import { BriefingService } from "@/lib/services/briefing-service";

export const briefingScheduler = schedules.task({
  id: "briefing-scheduler",
  cron: "*/15 * * * *", // Run every 15 minutes
  run: async () => {
    console.log("Starting briefing scheduler run...");
    const admin = createAdminDb();
    const repo = new BriefingsRepository(admin);
    const briefingService = BriefingService.getInstance();

    const now = new Date().toISOString();
    try {
      // 1. Fetch all briefing schedules that are due
      const dueSchedules = await repo.findDueSchedules(now);
      console.log(`Found ${dueSchedules.length} due briefing schedules.`);

      // 2. Process each due schedule
      for (const schedule of dueSchedules) {
        if (!schedule.id) continue;
        console.log(`Processing due schedule ${schedule.id} for user ${schedule.user_id}...`);
        
        try {
          const result = await briefingService.generateBriefingForSchedule(
            schedule.user_id,
            schedule.id,
            "schedule"
          );
          
          if (result.success) {
            console.log(`Successfully generated briefing ${result.briefingId} for schedule ${schedule.id}.`);
          } else {
            console.error(`Failed to generate briefing for schedule ${schedule.id}: ${result.error}`);
          }
        } catch (scheduleErr) {
          console.error(`Error processing schedule ${schedule.id}:`, scheduleErr);
        }
      }
      
      console.log("Briefing scheduler run completed.");
    } catch (error) {
      console.error("Error in briefing scheduler task:", error);
    }
  },
});
