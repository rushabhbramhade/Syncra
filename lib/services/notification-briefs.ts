"use server";

import { createAdminDb } from "@/lib/db";
import { BriefingsRepository, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { BriefingService } from "@/lib/services/briefing-service";
import { composeBriefBody } from "@/lib/briefing/pipeline";

/**
 * Produce a grounded notification brief. Reads the latest persisted briefing for
 * the user; only if none exists for today does it call the canonical pipeline
 * (briefing-service) to generate one. Never fabricates: if no real items
 * come back, it says so honestly.
 */
export async function buildGroundedBriefNotification(
  userId: string,
  opts: { title: string; scope: "daily" | "weekly"; limit?: number }
): Promise<{ title: string; body: string }> {
  const admin = createAdminDb();
  const repo = new BriefingsRepository(admin);
  const today = new Date().toISOString().split("T")[0];

  const latest = await repo.findBriefingsByUserId(userId, { limit: 1 });
  let items: BriefingItemRecord[] = [];
  let briefingId: string | null = latest && latest.length > 0 ? (latest[0].id as string) : null;
  let isToday =
    latest.length > 0 && (latest[0].generated_at || "").startsWith(today);

  if (!isToday || !briefingId) {
    const res = await BriefingService.getInstance().generateBriefingForSchedule(
      userId,
      null,
      "schedule"
    );
    if (res.success && res.briefingId) {
      briefingId = res.briefingId;
      isToday = true;
    }
  }

  if (isToday && briefingId) {
    items = await repo.findItemsByBriefingId(briefingId);
  }

  return {
    title: opts.title,
    body: composeBriefBody(items, opts),
  };
}