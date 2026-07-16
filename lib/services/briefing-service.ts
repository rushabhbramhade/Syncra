import { createAdminDb } from "@/lib/db";
import { BriefingsRepository, BriefingRecord, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { executeMCPAction } from "@/app/actions/integrations";
import { generateJsonResponse } from "@/lib/ai-service";
import { publishEvent } from "@/lib/notifications/events";
import { BRIEFING_CATEGORIES } from "@/lib/constants/briefing-categories";

export interface AIResponseBriefing {
  title: string;
  executiveSummary: string;
  priorityScore: number;
  totalImportantItems: number;
  highPriorityCount: number;
  readingTimeMinutes: number;
  categories: {
    email?: { totalImportant: number; summary: string; priority: string };
    meetings?: { summary: string; items: Array<{ title: string; time: string; participants: string[]; url?: string }> };
    messages?: { summary: string; items: Array<{ platform: string; sender: string; text: string; channel?: string }> };
    tasks?: { summary: string; items: Array<{ title: string; dueDate?: string; status: string; suggestion?: string }> };
    followUps?: { summary: string; items: Array<{ title: string; recommendedAction: string; dueDate?: string }> };
    activity?: { summary: string; items: Array<{ platform: string; type: string; title: string; url?: string }> };
  };
  recommendations: Array<{ text: string; type: string; platform?: string; sourceId?: string }>;
  items: Array<{
    platform: string;
    category: string;
    title: string;
    priority: "high" | "normal" | "low";
    shortSummary: string;
    originalContent: string;
    sourceId?: string;
    correlationKey?: string;
    from?: string;
    to?: string;
  }>;
}

function detectCorrelations(items: Array<{ platform: string; title: string; shortSummary: string; sourceId?: string; correlationKey?: string }>): Array<{ fromIndex: number; toIndex: number; text: string }> {
  const correlations: Array<{ fromIndex: number; toIndex: number; text: string }> = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].platform === items[j].platform) continue;
      const wordsI = new Set((items[i].shortSummary + " " + items[i].title).toLowerCase().split(/\s+/).filter(w => w.length > 4));
      const wordsJ = new Set((items[j].shortSummary + " " + items[j].title).toLowerCase().split(/\s+/).filter(w => w.length > 4));
      const overlap = [...wordsI].filter(w => wordsJ.has(w));
      if (overlap.length >= 3) {
        correlations.push({
          fromIndex: i,
          toIndex: j,
          text: `Related: mentioned in ${items[j].platform}`,
        });
      }
    }
  }
  return correlations;
}

function getCurrentDateInTz(tz: string): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric",
    hour12: false,
  }).formatToParts(new Date());
  const p = (t: string) => parseInt(parts.find(x => x.type === t)?.value || "0", 10);
  return { year: p("year"), month: p("month"), day: p("day"), hour: p("hour") };
}

/** Convert "YYYY-MM-DD HH:mm in timezone tz" to a UTC Date */
function localTimeInTzToUtc(tz: string, year: number, month: number, day: number, hour: number): Date {
  const now = new Date();
  const tzNow = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const offsetMs = now.getTime() - tzNow.getTime();
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0) + offsetMs);
}

export function calculateNextRun(frequency: string, timezone = "UTC"): string {
  const now = new Date();
  switch (frequency) {
    case "every_15_min":
      return new Date(now.getTime() + 15 * 60000).toISOString();
    case "hourly":
      return new Date(now.getTime() + 60 * 60000).toISOString();
    case "morning_brief": {
      const cur = getCurrentDateInTz(timezone);
      const day = cur.hour >= 8 ? cur.day + 1 : cur.day;
      const target = localTimeInTzToUtc(timezone, cur.year, cur.month, day, 8);
      return target <= now
        ? new Date(target.getTime() + 86400000).toISOString()
        : target.toISOString();
    }
    case "evening_brief": {
      const cur = getCurrentDateInTz(timezone);
      const day = cur.hour >= 18 ? cur.day + 1 : cur.day;
      const target = localTimeInTzToUtc(timezone, cur.year, cur.month, day, 18);
      return target <= now
        ? new Date(target.getTime() + 86400000).toISOString()
        : target.toISOString();
    }
    case "daily":
      return new Date(now.getTime() + 24 * 60 * 60000).toISOString();
    case "weekly":
      return new Date(now.getTime() + 7 * 24 * 60 * 60000).toISOString();
    default:
      return new Date(now.getTime() + 60 * 60000).toISOString();
  }
}

export class BriefingService {
  private static instance: BriefingService;

  static getInstance(): BriefingService {
    if (!BriefingService.instance) {
      BriefingService.instance = new BriefingService();
    }
    return BriefingService.instance;
  }

  async generateBriefingForSchedule(userId: string, scheduleId: string | null, triggerSource: "manual" | "schedule"): Promise<{ success: boolean; briefingId?: string; error?: string }> {
    const startTime = Date.now();
    const admin = createAdminDb();
    const repo = new BriefingsRepository(admin);
    const integrationsRepo = new IntegrationsRepository(admin);

    let schedule = null;
    let name = "Workspace Briefing";
    let goal = "General workspace update";
    let selectedIntegrations = ["gmail", "whatsapp", "slack", "telegram", "discord", "github", "linkedin", "calendar", "outlook", "notion", "linear"];
    let selectedCategories: string[] = [...BRIEFING_CATEGORIES];

    if (scheduleId) {
      schedule = await repo.findScheduleById(scheduleId);
      if (!schedule) {
        return { success: false, error: "Schedule not found" };
      }
      if (schedule.user_id !== userId) {
        return { success: false, error: "Access denied to briefing schedule" };
      }
      name = schedule.name;
      goal = schedule.goal || goal;
      selectedIntegrations = schedule.integrations;
      selectedCategories = schedule.categories;
    }

    try {
      // 1. Load user's connected integrations
      const connectionResults = await Promise.allSettled(
        selectedIntegrations.map(async (provider) => {
          const status = await integrationsRepo.getConnectionStatus(userId, provider);
          return { provider, conn: status };
        })
      );

      const activeIntegrations = connectionResults
        .filter((r) => r.status === "fulfilled" && r.value.conn?.status === "active")
        .map((r) => (r as PromiseFulfilledResult<{ provider: string; conn: any }>).value.provider);

      // 2. Fetch platform data via MCP — all in parallel
      const rawContext: Record<string, unknown> = {};

      const platformTasks = [
        { provider: "gmail", action: "gmail_search_emails", params: { query: "is:unread", limit: 5 } as Record<string, unknown>, categoryFilter: "email" },
        { provider: "whatsapp", action: "whatsapp_fetch_messages", params: { limit: 5 }, categoryFilter: "messages" },
        { provider: "slack", action: "slack_fetch_messages", params: { limit: 5 }, categoryFilter: "messages" },
        { provider: "telegram", action: "telegram_fetch_messages", params: { limit: 5 }, categoryFilter: "messages" },
        { provider: "discord", action: "discord_fetch_recent_messages", params: { limit: 3 }, categoryFilter: "messages" },
        { provider: "calendar", action: "calendar_list_events", params: { timeMin: new Date().toISOString(), maxResults: 10 }, categoryFilter: "meetings" },
        { provider: "outlook", action: "outlook_search_emails", params: { query: "is:unread", limit: 5 }, categoryFilter: "email" },
        { provider: "notion", action: "notion_search", params: { query: "", limit: 5 } },
        { provider: "linear", action: "linear_list_issues", params: { limit: 5 } },
        { provider: "linkedin", action: "linkedin_get_profile", params: {} },
      ];

      const githubPromise = activeIntegrations.includes("github")
        ? (async () => {
            const [issues, notifications] = await Promise.allSettled([
              executeMCPAction(userId, "github", "github_list_issues", {}),
              executeMCPAction(userId, "github", "github_get_notifications", {}),
            ]);
            const githubData: Record<string, unknown> = {};
            if (issues.status === "fulfilled" && issues.value.status === "success") githubData.issues = issues.value.result;
            if (notifications.status === "fulfilled" && notifications.value.status === "success") githubData.notifications = notifications.value.result;
            if (Object.keys(githubData).length > 0) rawContext.github = githubData;
          })().catch(e => console.warn("GitHub MCP action failed in briefing sync:", e))
        : Promise.resolve();

      const mcpResults = await Promise.allSettled(
        platformTasks
          .filter(p => activeIntegrations.includes(p.provider) && (!p.categoryFilter || selectedCategories.includes(p.categoryFilter)))
          .map(p => executeMCPAction(userId, p.provider, p.action, p.params).then(r => ({ provider: p.provider, result: r })))
      );
      for (const r of mcpResults) {
        if (r.status === "rejected") continue;
        const { provider, result } = r.value;
        if (result.status !== "success" || !result.result) continue;
        rawContext[provider] = provider === "linkedin" ? [result.result] : result.result;
      }
      // GitHub runs in parallel with all other platform calls
      await githubPromise;

      // 3. Prepare Prompt for central OpenRouter AI service
      const systemPrompt = `You are Syncra's central AI intelligence assistant.
Analyze the user's data context from connected integrations and generate a comprehensive production-ready Briefing JSON response.

The response must fit this exact JSON structure:
{
  "title": "A title for this briefing, e.g., 'Morning Briefing' or 'General Workspace Update'",
  "executiveSummary": "Executive summary of the day's main updates (2-4 sentences). Make it engaging and professional.",
  "priorityScore": (number between 0 and 100 assessing how busy/critical today is based on unread/pending items),
  "totalImportantItems": (number representing total critical items across all connected apps),
  "highPriorityCount": (number of high-priority items),
  "readingTimeMinutes": (number estimating reading time in minutes),
  "categories": {
    "email": {
      "totalImportant": (number),
      "summary": "Brief summary of important unread emails.",
      "priority": "high" | "normal" | "low"
    },
    "meetings": {
      "summary": "AI preparation summary for upcoming meetings.",
      "items": [
        { "title": "Meeting title", "time": "Time string e.g., 2:00 PM", "participants": ["Participant Name"], "url": "Join link or null" }
      ]
    },
    "messages": {
      "summary": "AI summary of important chats, mentions, and updates.",
      "items": [
        { "platform": "slack" | "whatsapp" | "telegram" | "discord", "sender": "Sender name", "text": "Message content", "channel": "Channel name or null" }
      ]
    },
    "tasks": {
      "summary": "Summary of pending and overdue tasks.",
      "items": [
        { "title": "Task title", "dueDate": "ISO Date or null", "status": "pending" | "overdue", "suggestion": "AI recommendation on when to do it" }
      ]
    },
    "followUps": {
      "summary": "Follow-ups required based on emails or messages.",
      "items": [
        { "title": "Brief topic", "recommendedAction": "Actionable task description", "dueDate": "ISO Date or null" }
      ]
    },
    "activity": {
      "summary": "Summary of GitHub and LinkedIn activity (releases, PRs, feed updates, connection requests).",
      "items": [
        { "platform": "github" | "linkedin", "type": "release" | "star" | "pr_review" | "feed_update" | "connection_request", "title": "Activity title", "url": "URL or null" }
      ]
    }
  },
  "recommendations": [
    {
      "text": "Actionable advice, e.g., 'Reply to Alice regarding PR review'",
      "type": "reply_email" | "prepare_meeting" | "finish_task" | "contact_client" | "schedule_follow_up",
      "platform": "gmail" | "outlook" | "slack" | "whatsapp" | "telegram" | "discord" | "github" | "linkedin" | "calendar" | "notion" | "linear",
      "sourceId": "unique ID of source item if any, or null"
    }
  ],
  "items": [
    {
      "platform": "gmail" | "outlook" | "slack" | "whatsapp" | "telegram" | "discord" | "github" | "linkedin" | "calendar" | "notion" | "linear",
      "category": "${BRIEFING_CATEGORIES.join(" | ")}",
      "title": "Brief title summarizing this specific item",
      "priority": "high" | "normal" | "low",
      "shortSummary": "1-sentence AI summary of this item",
      "originalContent": "Full text or excerpt of original content",
      "sourceId": "unique ID of source item if any, or null",
      "correlationKey": "optional key to group related items across platforms, e.g. project name or thread ID",
      "from": "For gmail/outlook items: the sender name and email, e.g. 'Alice Johnson <alice@example.com>'. For other platforms omit or set to null.",
      "to": "For gmail/outlook items: the recipient email address. For other platforms omit or set to null."
    }
  ]
}

Goal parameter of current briefing schedule: "${goal}".
Integrations requested: ${selectedIntegrations.join(", ")}.
Categories requested: ${selectedCategories.join(", ")}.
For each platform, provide relevant data: gmail/outlook→emails, slack/whatsapp/telegram/discord→messages, github→issues/PRs/notifications, linkedin→profile/feed, calendar→events, notion→pages, linear→issues.`;

      // 4. Generate AI summary
      const aiResult = await generateJsonResponse<AIResponseBriefing>(systemPrompt, rawContext);
      if (!aiResult) {
        throw new Error("Central AI service returned null response.");
      }

      // 5. Store generated briefing (with FK fallback)
      const createBriefingPayload = {
        user_id: userId,
        schedule_id: scheduleId,
        title: aiResult.title || name,
        executive_summary: aiResult.executiveSummary,
        full_content: aiResult as unknown as Record<string, unknown>,
        priority_score: aiResult.priorityScore || 50,
        generated_at: new Date().toISOString(),
        ai_model: process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3",
        status: "completed",
      };
      let briefingRecord;
      try {
        briefingRecord = await repo.createBriefing(createBriefingPayload);
      } catch (fkErr: any) {
        if (scheduleId && fkErr.message?.includes?.("schedule_id_fkey")) {
          console.warn("[Briefing] schedule_id FK violation, retrying with null");
          briefingRecord = await repo.createBriefing({ ...createBriefingPayload, schedule_id: null });
        } else {
          throw fkErr;
        }
      }

      const briefingId = briefingRecord.id!;

      // 6. Store briefing items with correlation data
      const storedItems = await Promise.all(
        aiResult.items.map(async (item) => {
          return repo.createBriefingItem({
            briefing_id: briefingId,
            platform: item.platform,
            category: item.category,
            source_id: item.sourceId || null,
            metadata: {
              title: item.title,
              shortSummary: item.shortSummary,
              originalContent: item.originalContent,
              correlationKey: (item as any).correlationKey || null,
              from: item.from || null,
              to: item.to || null,
            },
            priority: item.priority || "normal",
            status: "unread",
            notes: null,
            snoozed_until: null,
            timestamp: new Date().toISOString(),
          });
        })
      );

      // Detect cross-platform correlations and store in metadata
      const correlations = detectCorrelations(aiResult.items);
      for (const corr of correlations) {
        const fromItem = storedItems[corr.fromIndex];
        const toItem = storedItems[corr.toIndex];
        if (fromItem?.id && toItem?.id) {
          const fromMeta = (fromItem.metadata || {}) as Record<string, any>;
          const toMeta = (toItem.metadata || {}) as Record<string, any>;
          await repo.updateItemMetadata(fromItem.id, {
            ...fromMeta,
            correlation: { relatedItemId: toItem.id, text: corr.text, platform: aiResult.items[corr.toIndex].platform },
          });
          await repo.updateItemMetadata(toItem.id, {
            ...toMeta,
            correlation: { relatedItemId: fromItem.id, text: `Related: referenced in ${aiResult.items[corr.fromIndex].platform}`, platform: aiResult.items[corr.fromIndex].platform },
          });
        }
      }

      // 7. Update schedule next run
      if (scheduleId && schedule) {
        const nextRun = calculateNextRun(schedule.frequency, schedule.timezone);
        await repo.updateSchedule(scheduleId, {
          last_run: new Date().toISOString(),
          next_run: nextRun,
        });
      }

      // 8. Publish BriefingGenerated event to notification pipeline
      try {
        await publishEvent("daily_brief_generated", userId, {
          title: aiResult.title || name,
          executiveSummary: aiResult.executiveSummary,
          priorityScore: aiResult.priorityScore,
          totalImportantItems: aiResult.totalImportantItems,
          date: new Date().toLocaleDateString(),
        });
      } catch (err) {
        console.error("Failed to publish briefing notification event:", err);
      }

      // 9. Store briefing history record (linked to the generated briefing)
      const createHistoryPayload = {
        user_id: userId,
        schedule_id: scheduleId,
        briefing_id: briefingId,
        execution_time: new Date().toISOString(),
        duration: Date.now() - startTime,
        status: "success",
        errors: null,
        ai_tokens_used: 0,
        trigger_source: triggerSource,
      };
      try {
        await repo.createHistory(createHistoryPayload);
      } catch (histErr: any) {
        if (scheduleId && histErr.message?.includes?.("schedule_id_fkey")) {
          console.warn("[BriefingHistory] schedule_id FK violation, retrying with null");
          await repo.createHistory({ ...createHistoryPayload, schedule_id: null });
        } else {
          throw histErr;
        }
      }

      return { success: true, briefingId };
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Briefing generation failed";
      console.error(`Briefing generation failed for user ${userId}:`, error);

      // Store failed execution in history
      try {
        const failHistoryPayload = {
          user_id: userId,
          schedule_id: scheduleId,
          execution_time: new Date().toISOString(),
          duration: Date.now() - startTime,
          status: "failed",
          errors: errorMsg,
          ai_tokens_used: 0,
          trigger_source: triggerSource,
        };
        try {
          await repo.createHistory(failHistoryPayload);
        } catch (histErr: any) {
          if (scheduleId && histErr.message?.includes?.("schedule_id_fkey")) {
            console.warn("[BriefingHistory] schedule_id FK violation on failure, retrying with null");
            await repo.createHistory({ ...failHistoryPayload, schedule_id: null });
          } else {
            throw histErr;
          }
        }
      } catch (histErr) {
        console.error("Failed to write briefing failure history:", histErr);
      }

      return { success: false, error: errorMsg };
    }
  }
}
