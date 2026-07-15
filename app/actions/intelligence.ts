"use server";

import { generateDashboardBrief } from "@/app/actions/dashboard";
import { runIntelligencePipeline, IntelligenceResult } from "@/lib/intelligence/pipeline";

export async function getIntelligenceData(userId: string, authUserId: string, connectedPlatforms?: string[]): Promise<IntelligenceResult | null> {
  try {
    const platforms = connectedPlatforms && connectedPlatforms.length > 0 ? connectedPlatforms : ["gmail", "slack", "whatsapp", "telegram"];
    const brief = await generateDashboardBrief(authUserId, platforms);
    if (!brief) return null;
    const result = await runIntelligencePipeline(brief);
    return result;
  } catch {
    return null;
  }
}
