import { schedules } from "@trigger.dev/sdk/v3";
import { createAdminDb } from "@/lib/db";
import { BriefingsRepository } from "@/lib/repositories/briefings-repository";
import { BriefingService } from "@/lib/services/briefing-service";

export const briefingScheduler = schedules.task({
  id: "briefing-scheduler",
  cron: "*/15 * * * *", // Run every 15 minutes
  run: async () => {
    const runId = process.env.TRIGGER_RUN_ID || `manual-${Date.now()}`;
    const startedAt = Date.now();
    console.log("Starting briefing scheduler run...", { runId });

    const admin = createAdminDb();
    const repo = new BriefingsRepository(admin);
    const briefingService = BriefingService.getInstance();

    const now = new Date().toISOString();
    try {
      // 1. Fetch all briefing schedules that are due
      const dueSchedules = await repo.findDueSchedules(now);
      console.log(`Found ${dueSchedules.length} due briefing schedules.`, { runId, count: dueSchedules.length });

      if (dueSchedules.length === 0) {
        console.log("Briefing scheduler run completed (nothing due).", {
          runId, elapsedMs: Date.now() - startedAt, processed: 0, succeeded: 0, failed: 0,
        });
        return;
      }

      // 2. Process each due schedule CONCURRENTLY (bounded by the run window).
      //    Each schedule is independent (its own user + ATOMIC claim), so
      //    parallelism shortens total wall-time instead of queueing serially.
      const results = await Promise.allSettled(
        dueSchedules.map(async (schedule) => {
          if (!schedule.id) return { schedule, ok: false as const, reason: "no schedule id" };
          const scheduleStart = Date.now();
          const logBase = {
            runId,
            scheduleId: schedule.id,
            userId: schedule.user_id,
            elapsedMs: 0,
          };

          console.log("Processing due schedule...", logBase);
          try {
            const result = await briefingService.generateBriefingForSchedule(
              schedule.user_id,
              schedule.id,
              "schedule"
            );
            logBase.elapsedMs = Date.now() - scheduleStart;
            if (result.success) {
              console.log("Briefing generated for schedule.", {
                ...logBase,
                briefingId: result.briefingId,
                ok: true,
              });
              return { scheduleId: schedule.id, ok: true as const, briefingId: result.briefingId };
            }
            console.error("Briefing generation failed for schedule.", { ...logBase, ok: false, error: result.error });
            return { scheduleId: schedule.id, ok: false as const, error: result.error };
          } catch (scheduleErr) {
            logBase.elapsedMs = Date.now() - scheduleStart;
            console.error("Briefing schedule errored.", { ...logBase, ok: false, err: scheduleErr });
            return { scheduleId: schedule.id, ok: false as const, error: scheduleErr };
          }
        })
      );

      const succeeded = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
      const failed = results.length - succeeded;
      const totalMs = Date.now() - startedAt;
      console.log(`Briefing scheduler run completed.`, {
        runId,
        processed: dueSchedules.length,
        succeeded,
        failed,
        elapsedMs: totalMs,
        perScheduleMs: results.length > 0 ? Math.round(totalMs / results.length) : 0,
      });
      if (failed > 0) {
        for (const r of results) {
          if (r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)) {
            console.error("Briefing schedule failure detail.", { runId, result: r });
          }
        }
      }
    } catch (error) {
      console.error("Error in briefing scheduler task:", { runId, error });
    }
  },
});