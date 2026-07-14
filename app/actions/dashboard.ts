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

export async function generateDashboardBrief(userId: string, connectedPlatforms: string[]): Promise<DashboardBriefData | null> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.warn("OPENROUTER_API_KEY is missing. Returning mock dashboard brief.");
    return getMockDashboardData();
  }

  try {
    // 1. Gather context from connected platforms
    const rawContext: Record<string, unknown> = {};
    
    // Attempt to fetch some real or mock data based on connected platforms
    if (connectedPlatforms.includes("gmail")) {
      const res = await executeMCPAction(userId, "gmail", "gmail_search_emails", { query: "is:unread", limit: 3 });
      rawContext.gmail = res.status === "success" ? res.result : "Failed to fetch or no recent emails.";
    }

    if (connectedPlatforms.includes("whatsapp")) {
      const res = await executeMCPAction(userId, "whatsapp", "whatsapp_fetch_messages", { limit: 3 });
      rawContext.whatsapp = res.status === "success" ? res.result : "No new messages in WhatsApp.";
    }

    if (connectedPlatforms.includes("slack")) {
      rawContext.slack = [
        { from: "Team #general", message: "Deploying the new changes to staging..." },
        { from: "Alice", message: "Can you review my PR when you have a moment?" }
      ];
    }
    
    if (connectedPlatforms.includes("telegram")) {
      rawContext.telegram = [
        { from: "Alerts Bot", message: "Server usage spike at 9:00 AM." }
      ];
    }

    // 2. Separate data from instructions
    const systemPrompt = `Based on data from the user's connected platforms: ${connectedPlatforms.join(", ")}. If data is missing or empty, invent realistic placeholder summaries for those platforms.

Output JSON:
{
  "importantCount": (number),
  "priorityCount": (number),
  "followUpsCount": (number),
  "briefItems": [
    { "platform": ("gmail"|"whatsapp"|"slack"|"telegram"|"outlook"), "text": (string) }
  ],
  "priorityItems": [
    { "platform": (string), "title": (string), "time": (string, e.g. "10:30 AM"), "description": (string), "priority": "High"|"Medium"|"Low" }
  ]
}`;

    const parsed = await generateJsonResponse<DashboardBriefData>(systemPrompt, rawContext);

    if (parsed) {
      return parsed;
    }
    
    return getMockDashboardData();
  } catch (error) {
    console.error("Error generating dashboard brief:", error);
    return getMockDashboardData();
  }
}

function getMockDashboardData(): DashboardBriefData {
  return {
    importantCount: 12,
    priorityCount: 3,
    followUpsCount: 5,
    briefItems: [
      { platform: "gmail", text: "You have 4 new emails from the marketing team regarding the Q3 campaign." },
      { platform: "slack", text: "Alice requested a review on the new feature PR in #engineering." },
      { platform: "whatsapp", text: "Client message from Acme Corp waiting for a reply." }
    ],
    priorityItems: [
      {
        platform: "slack",
        title: "Review Feature PR",
        time: "1h ago",
        description: "Alice needs a code review before deploying to staging.",
        priority: "High"
      },
      {
        platform: "gmail",
        title: "Approve Q3 Budget",
        time: "3h ago",
        description: "Finance department needs final approval on the campaign budget.",
        priority: "High"
      },
      {
        platform: "whatsapp",
        title: "Reply to Acme Corp",
        time: "4h ago",
        description: "They asked about the timeline for the new deliverables.",
        priority: "Medium"
      }
    ]
  };
}
