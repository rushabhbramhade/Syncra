"use server";

import { executeMCPAction } from "./integrations";
import { generateJsonResponse } from "@/lib/ai-service";

export interface DashboardBriefData {
  importantCount: number;
  priorityCount: number;
  followUpsCount: number;
  briefItems: {
    platform: string;
    text: string;
  }[];
  priorityItems: {
    platform: string;
    title: string;
    time: string;
    description: string;
    priority: "High" | "Medium" | "Low";
  }[];
}

const ALL_PROVIDERS = ["gmail", "slack", "whatsapp", "telegram", "discord", "linkedin", "github"] as const;

async function fetchPlatformData(userId: string, platform: string): Promise<{ items: Record<string, unknown>[]; error?: string }> {
  try {
    switch (platform) {
      case "gmail": {
        const res = await executeMCPAction(userId, "gmail", "gmail_search_emails", { query: "is:unread", limit: 5 });
        if (res.status === "success" && Array.isArray(res.result)) {
          return { items: res.result };
        }
        return { items: [], error: "No emails or fetch failed" };
      }
      case "whatsapp": {
        const res = await executeMCPAction(userId, "whatsapp", "whatsapp_fetch_messages", { limit: 5 });
        if (res.status === "success" && Array.isArray(res.result)) {
          return { items: res.result };
        }
        return { items: [], error: "No messages or fetch failed" };
      }
      case "slack": {
        const res = await executeMCPAction(userId, "slack", "slack_fetch_messages", { limit: 5 });
        if (res.status === "success" && Array.isArray(res.result)) {
          return { items: res.result };
        }
        return { items: [], error: "No messages or fetch failed" };
      }
      case "telegram": {
        const res = await executeMCPAction(userId, "telegram", "telegram_fetch_messages", { limit: 5 });
        if (res.status === "success" && Array.isArray(res.result)) {
          return { items: res.result };
        }
        return { items: [], error: "No messages or fetch failed" };
      }
      case "discord": {
        const res = await executeMCPAction(userId, "discord", "discord_fetch_recent_messages", { limit: 3 });
        if (res.status === "success" && Array.isArray(res.result)) {
          return { items: res.result };
        }
        return { items: [], error: "No messages or fetch failed" };
      }
      case "linkedin": {
        const res = await executeMCPAction(userId, "linkedin", "linkedin_get_profile", {});
        if (res.status === "success" && res.result) {
          return { items: [res.result as Record<string, unknown>] };
        }
        return { items: [], error: "No profile data or fetch failed" };
      }
      case "github": {
        const [issues, notifications] = await Promise.allSettled([
          executeMCPAction(userId, "github", "github_list_issues", {}),
          executeMCPAction(userId, "github", "github_get_notifications", {}),
        ]);
        const items: Record<string, unknown>[] = [];
        if (issues.status === "fulfilled" && issues.value.status === "success" && Array.isArray(issues.value.result)) {
          items.push(...(issues.value.result as Record<string, unknown>[]).slice(0, 3));
        }
        if (notifications.status === "fulfilled" && notifications.value.status === "success" && Array.isArray(notifications.value.result)) {
          items.push(...(notifications.value.result as Record<string, unknown>[]).slice(0, 3));
        }
        return { items };
      }
      default:
        return { items: [], error: `No fetcher for ${platform}` };
    }
  } catch {
    return { items: [], error: `Failed to fetch ${platform}` };
  }
}

function extractText(item: Record<string, unknown>): string {
  return (item as any).text || (item as any).snippet || (item as any).message || (item as any).subject || JSON.stringify(item).slice(0, 120);
}

function extractSender(item: Record<string, unknown>): string {
  return (item as any).from || (item as any).sender || (item as any).author || "Unknown";
}

function buildBriefFromData(platformData: Record<string, { items: Record<string, unknown>[]; error?: string }>): DashboardBriefData {
  const briefItems: DashboardBriefData["briefItems"] = [];
  const priorityItems: DashboardBriefData["priorityItems"] = [];
  let totalImportant = 0;

  for (const [platform, data] of Object.entries(platformData)) {
    if (!data.items || data.items.length === 0) continue;

    for (const item of data.items) {
      const text = extractText(item);
      const sender = extractSender(item);
      totalImportant++;

      briefItems.push({
        platform,
        text: text.length > 120 ? `${text.slice(0, 117)}...` : text,
      });

      priorityItems.push({
        platform,
        title: text.slice(0, 60) || `New ${platform} item`,
        time: (item as any).date || (item as any).receivedAt || (item as any).time || new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        description: text.length > 100 ? `${text.slice(0, 97)}...` : text,
        priority: "Medium",
      });
    }
  }

  return {
    importantCount: totalImportant,
    priorityCount: Math.min(priorityItems.length, 5),
    followUpsCount: Math.max(0, Math.floor(totalImportant / 3)),
    briefItems: briefItems.slice(0, 5),
    priorityItems: priorityItems.slice(0, 5),
  };
}

export async function generateDashboardBrief(userId: string, connectedPlatforms: string[]): Promise<DashboardBriefData | null> {
  try {
    const platformData: Record<string, { items: Record<string, unknown>[]; error?: string }> = {};
    const activePlatforms = connectedPlatforms.filter(p => ALL_PROVIDERS.includes(p as any));

    for (const platform of activePlatforms) {
      platformData[platform] = await fetchPlatformData(userId, platform);
    }

    if (Object.values(platformData).every(d => d.items.length === 0)) {
      return {
        importantCount: 0,
        priorityCount: 0,
        followUpsCount: 0,
        briefItems: [],
        priorityItems: [],
      };
    }

    const hasAiKey = !!process.env.OPENROUTER_API_KEY;
    if (hasAiKey) {
      try {
        const systemPrompt = `Based on data from ${activePlatforms.join(", ")}. Summarize each platform's items concisely. Output JSON:
{
  "importantCount": (number),
  "priorityCount": (number),
  "followUpsCount": (number),
  "briefItems": [{"platform": "gmail|slack|whatsapp|telegram|discord|linkedin|github", "text": "summary string"}],
  "priorityItems": [{"platform": "gmail|slack|whatsapp|telegram|discord|linkedin|github", "title": "short title", "time": "time string", "description": "brief description", "priority": "High|Medium|Low"}]
}`;
        const parsed = await generateJsonResponse<DashboardBriefData>(systemPrompt, platformData as any);
        if (parsed) return parsed;
      } catch {
      }
    }

    return buildBriefFromData(platformData);
  } catch (error) {
    console.error("Error generating dashboard brief:", error);
    return null;
  }
}
