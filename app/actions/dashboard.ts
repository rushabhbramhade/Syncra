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
    category?: string;
  }[];
  priorityItems: {
    platform: string;
    title: string;
    time: string;
    description: string;
    priority: "High" | "Medium" | "Low";
  }[];
}

const ALL_PROVIDERS = ["gmail", "outlook", "slack", "whatsapp", "telegram", "discord", "linkedin", "github", "calendar", "notion", "linear"] as const;

async function fetchPlatformData(userId: string, platform: string, timeoutMs = 10000): Promise<{ items: Record<string, unknown>[]; error?: string }> {
  try {
    const result = await Promise.race([
      (async () => {
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
          case "calendar": {
            const res = await executeMCPAction(userId, "calendar", "calendar_list_events", { timeMin: new Date().toISOString(), maxResults: 5 });
            if (res.status === "success" && Array.isArray(res.result)) {
              return { items: res.result };
            }
            return { items: [], error: "No events or fetch failed" };
          }
          case "outlook": {
            const res = await executeMCPAction(userId, "outlook", "outlook_search_emails", { query: "is:unread", limit: 5 });
            if (res.status === "success" && Array.isArray(res.result)) {
              return { items: res.result };
            }
            return { items: [], error: "No emails or fetch failed" };
          }
          case "notion": {
            const res = await executeMCPAction(userId, "notion", "notion_search", { query: "", limit: 5 });
            if (res.status === "success" && Array.isArray(res.result)) {
              return { items: res.result };
            }
            return { items: [], error: "No pages or fetch failed" };
          }
          case "linear": {
            const res = await executeMCPAction(userId, "linear", "linear_list_issues", { limit: 5 });
            if (res.status === "success" && Array.isArray(res.result)) {
              return { items: res.result };
            }
            return { items: [], error: "No issues or fetch failed" };
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
      })(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`[${platform}] timeout`)), timeoutMs)
      ),
    ]);
    return result;
  } catch (e) {
    if (e instanceof Error && e.message.includes(`[${platform}] timeout`)) {
      console.warn(`[Brief] ${platform} fetch timed out after ${timeoutMs}ms`);
    } else {
      console.warn(`Failed to fetch ${platform}:`, e);
    }
    return { items: [], error: `Failed to fetch ${platform}` };
  }
}

function extractText(item: Record<string, unknown>): string {
  const i = item as any;
  return i.text || i.snippet || i.message || i.subject || i.title || i.headline || i.body || i.summary || i.issue?.title || i.repository?.full_name || i.eventType || i.pageTitle || JSON.stringify(item).slice(0, 120);
}

function extractSender(item: Record<string, unknown>): string {
  return (item as any).from || (item as any).sender || (item as any).author || "Unknown";
}

function categorizePlatform(platform: string): string {
  if (platform === "gmail" || platform === "outlook") return "email";
  if (platform === "slack" || platform === "whatsapp" || platform === "telegram" || platform === "discord") return "messages";
  if (platform === "github" || platform === "linkedin" || platform === "notion" || platform === "linear") return "activity";
  if (platform === "calendar") return "meetings";
  return "tasks";
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
      const category = categorizePlatform(platform);

      briefItems.push({
        platform,
        text: text.length > 120 ? `${text.slice(0, 117)}...` : text,
        category,
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

    const results = await Promise.allSettled(
      activePlatforms.map(platform =>
        fetchPlatformData(userId, platform).then(data => ({ platform, data }))
      )
    );
    for (const result of results) {
      if (result.status === "fulfilled") {
        platformData[result.value.platform] = result.value.data;
      }
    }

    const hasAiKey = !!process.env.OPENROUTER_API_KEY;
    if (hasAiKey && Object.values(platformData).some(d => d.items.length > 0)) {
      try {
        const systemPrompt = `Based on data from ${activePlatforms.join(", ")}. Summarize each platform's items concisely. Output JSON:
{
  "importantCount": (number),
  "priorityCount": (number),
  "followUpsCount": (number),
  "briefItems": [{"platform": "gmail|slack|whatsapp|telegram|discord|linkedin|github", "text": "summary string", "category": "email|messages|tasks|meetings|followUps|activity"}],
  "priorityItems": [{"platform": "gmail|slack|whatsapp|telegram|discord|linkedin|github", "title": "short title", "time": "time string", "description": "brief description", "priority": "High|Medium|Low"}]
}`;
        const parsed = await generateJsonResponse<DashboardBriefData>(systemPrompt, platformData as any);
        if (parsed) return parsed;
      } catch (e) {
        console.warn("AI brief summarization failed, falling back to raw data:", e);
      }
    }

    return buildBriefFromData(platformData);
  } catch (error) {
    console.error("Error generating dashboard brief:", error);
    return null;
  }
}
