"use server";

import { createAdminDb } from "@/lib/db";
import { generateJsonResponse } from "@/lib/ai-service";
import { notificationQueue } from "@/lib/notifications/queue";

interface DigestData {
  summary: string;
  topItems: { platform: string; text: string }[];
  priorityCount: number;
}

export class DigestService {
  async generateDailyDigest(userId: string): Promise<DigestData | null> {
    const db = createAdminDb();
    const { data: briefings } = await db.database
      .from("briefings")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!briefings || briefings.length === 0) return null;

    const latest = briefings[0];
    const { data: items } = await db.database
      .from("briefing_items")
      .select("*")
      .eq("briefing_id", latest.id)
      .limit(5);

    return {
      summary: latest.executive_summary || "No summary available.",
      topItems: (items || []).map((i: any) => ({ platform: i.platform, text: i.text })),
      priorityCount: latest.priority_score || 0,
    };
  }

  async sendDigest(userId: string, channels: string[]): Promise<void> {
    const digest = await this.generateDailyDigest(userId);
    if (!digest) return;

    for (const channel of channels) {
      await notificationQueue.enqueue({
        userId,
        type: "daily_ai_brief",
        title: "Daily AI Brief",
        body: JSON.stringify(digest),
        provider: channel,
        metadata: { ...digest, date: new Date().toISOString() },
        sourceEvent: "daily_brief_generated",
        template: "daily_ai_brief",
      });
    }
  }
}

export async function sendDailyDigestAction(userId: string, channels: string[]): Promise<{ success: boolean }> {
  const service = new DigestService();
  await service.sendDigest(userId, channels);
  return { success: true };
}
