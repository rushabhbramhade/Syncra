"use server";

import { requireOwnership } from "@/lib/auth-guard";
import { BriefingService } from "@/lib/services/briefing-service";
import { BriefingsRepository, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { createAdminDb } from "@/lib/db";
import type { BriefingIntelligenceContent } from "@/lib/briefing-intelligence";

export interface DashboardBriefData {
  importantCount: number;
  priorityCount: number;
  followUpsCount: number;
  briefItems: {
    platform: string;
    text: string;
    category?: string;
  }[];
  priorityItems: {
    platform: string;
    title: string;
    time: string;
    description: string;
    priority: "High" | "Medium" | "Low";
  }[];
  intelligence?: BriefingIntelligenceContent;
}

const EMPTY: DashboardBriefData = {
  importantCount: 0,
  priorityCount: 0,
  followUpsCount: 0,
  briefItems: [],
  priorityItems: [],
};

// map a persisted canonical briefing_item (real, grounded data — never
// fabricated) onto the dashboard card shape.
function mapGroundedItems(items: BriefingItemRecord[]): Pick<DashboardBriefData, "importantCount" | "priorityCount" | "followUpsCount" | "briefItems" | "priorityItems"> {
  const briefItems: DashboardBriefData["briefItems"] = [];
  const priorityItems: DashboardBriefData["priorityItems"] = [];
  let followUpCount = 0;

  for (const it of items) {
    const meta = (it.metadata ?? {}) as Record<string, unknown>;
    const title = String(meta.title || meta.shortSummary || "Untitled item");
    const summary = String(meta.shortSummary || meta.originalContent || title);
    const category = it.category;

    briefItems.push({
      platform: it.platform,
      text: summary.length > 120 ? `${summary.slice(0, 117)}...` : summary,
      category,
    });

    const time = it.timestamp ? new Date(it.timestamp).toLocaleString([], { hour: "2-digit", minute: "2-digit" }) : "";
    // Canonical stored vocabulary is high|normal|low (normal == medium). Map
    // both "normal" and "medium" to the Medium label so a normal item is never
    // shown (or counted) as Low.
    const prio = it.priority === "high" ? "High" : it.priority === "normal" || it.priority === "medium" ? "Medium" : it.priority === "low" ? "Low" : "Medium";
    priorityItems.push({
      platform: it.platform,
      title: title.length > 60 ? `${title.slice(0, 57)}...` : title,
      time,
      description: summary.length > 100 ? `${summary.slice(0, 97)}...` : summary,
      priority: prio,
    });
    if (category === "followUps") followUpCount++;
  }

  return {
    importantCount: items.length,
    priorityCount: priorityItems.filter((p) => p.priority !== "Low").length,
    followUpsCount: followUpCount,
    briefItems: briefItems.slice(0, 5),
    priorityItems: priorityItems.slice(0, 5),
  };
}

// Single canonical pipeline. Before the first real briefing exists this is the
// dashboard's bootstrap: it runs the SAME grounded briefing service (fetch →
// normalize → ground → coverage → persist) used everywhere else, then maps the
// persisted, source-verified items onto the card shape. There is no second AI
// path here and no derived-from-nothing data.
export async function generateDashboardBrief(userId: string, _connectedPlatforms: string[]): Promise<DashboardBriefData | null> {
  try {
    void _connectedPlatforms; // canonical pipeline gates on connected providers internally
    const guard = await requireOwnership(userId);
    if ("error" in guard) return null;

    const res = await BriefingService.getInstance().generateBriefingForSchedule(
      userId,
      null,
      "manual"
    );
    if (!res.success || !res.briefingId) return { ...EMPTY, followUpsCount: 0 };

    const admin = createAdminDb();
    const repo = new BriefingsRepository(admin);
    const items = await repo.findItemsByBriefingId(res.briefingId);
    return mapGroundedItems(items);
  } catch (error) {
    console.error("Error generating dashboard brief:", error);
    return null;
  }
}