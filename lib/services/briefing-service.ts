import { createAdminDb } from "@/lib/db";
import { BriefingsRepository } from "@/lib/repositories/briefings-repository";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { UsersRepository } from "@/lib/repositories/users-repository";
import { getUnifiedStoreRepo } from "@/lib/repositories/unified-store-repository";
import { executeMCPAction } from "@/lib/integrations/actions-core";
import { generateJsonResponse } from "@/lib/ai-service";
import { publishEvent } from "@/lib/notifications/events";
import { BRIEFING_CATEGORIES } from "@/lib/constants/briefing-categories";
import { logger, getCorrelationId } from "@/lib/logger";
import {
  normalizeResult,
  aiShapeForProvider,
  countItems,
  emptyHealth,
  computeQuality,
  buildManifest,
  buildCoverageItems,
  filterGroundedItems,
  classifyProviderStatus,
  effectiveActivityTimestamp,
  type ProviderHealth,
  type ProviderHealthReport,
} from "@/lib/briefing/pipeline";
import type { NormalizedEntity } from "@/lib/integrations/types";

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
  recommendations: Array<{
    text: string;
    type: string;
    platform?: string;
    sourceId?: string;
    priority?: "high" | "medium" | "low";
    reason?: string;
    confidence?: number;
    affectedPlatforms?: string[];
    relatedData?: string[];
  }>;
  goals?: Array<{
    text: string;
    priority: "high" | "medium" | "low";
    reason?: string;
  }>;
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
    reasoning?: string;
  }>;
  health?: {
    overall: number;
    breakdown: Array<{ name: string; score: number; reason: string }>;
    summary: string;
  };
  insights?: Array<{
    text: string;
    type: "pattern" | "warning" | "opportunity" | "concept";
    importance: "high" | "medium" | "low";
  }>;
  relationships?: Array<{
    title: string;
    summary: string;
    platforms: string[];
    items: Array<{ platform: string; title: string }>;
  }>;
  timeline?: Array<{
    time: string;
    title: string;
    platform?: string;
  }>;
  confidence?: {
    overall: number;
    reason: string;
    missingData: string[];
  };
  sourceStats?: Array<{
    platform: string;
    syncStatus: "ok" | "partial" | "error" | "skipped";
    itemsProcessed: number;
    lastSync?: string;
  }>;
}

/** True when the fetched raw context contains at least one real data item. */
function hasRealData(raw: Record<string, unknown>): boolean {
  for (const value of Object.values(raw)) {
    if (Array.isArray(value)) {
      if (value.length > 0) return true;
    } else if (value && typeof value === "object") {
      if (hasRealData(value as Record<string, unknown>)) return true;
    }
  }
  return false;
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

  async generateBriefingForSchedule(userId: string, scheduleId: string | null, triggerSource: "manual" | "schedule", opts?: { demoMode?: boolean }): Promise<{ success: boolean; briefingId?: string; empty?: boolean; error?: string; demo?: { ai_tokens_used?: number; elapsed_ms: number; items_count: number; platforms: string[] } }> {
    const demoMode = opts?.demoMode ?? false;
    const startTime = Date.now();
    const correlationId = getCorrelationId() || `brief_${startTime.toString(36)}`;
    const log = logger.child({ correlationId, userId, scheduleId, triggerSource });
    const admin = createAdminDb();
    const repo = new BriefingsRepository(admin);
    const integrationsRepo = new IntegrationsRepository(admin);

    // userId is the DB primary key (users.id), which every briefing table
    // references. The integration layer (user_integrations, whatsapp_sessions,
    // user_tool_permissions) is keyed by the InsForge auth id instead, so
    // resolve that mapping here and use the auth id for every integration call.
    let authUserId = userId;
    try {
      const usersRepo = new UsersRepository(admin);
      const dbUser = await usersRepo.findByDbId(userId);
      if (dbUser?.auth_user_id) authUserId = dbUser.auth_user_id;
    } catch (err) {
      log.warn("Failed to resolve DB user id to auth id, falling back to provided id", { err: err instanceof Error ? err.message : err });
    }
    if (authUserId !== userId) log.info("Resolved DB user id to auth id for integration lookups");

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

    let runId: string | undefined;

    try {
      // 0. Claim schedule lock + create run row (idempotency guard). Prevents a
      // manual trigger and the cron from generating the same schedule twice, and
      // makes every run auditable. Manual+schedule duplicates are impossible.
      // Shared only when a null scheduleId (ad-hoc run) is supplied.
      // Demo mode skips lock + run creation (read-only verification).
      const workerId = String(process.pid ?? 0) + ":" + correlationId;
      if (scheduleId && !demoMode) {
        const claimed = await repo.claimSchedule(scheduleId, workerId);
        if (!claimed) {
          log.warn("Schedule is locked by another worker; skipping to avoid duplicate generation", { scheduleId });
          return { success: false, error: "Briefing generation already in progress for this schedule" };
        }
        const run = await repo.createRun({
          user_id: userId,
          schedule_id: scheduleId,
          status: "running",
          attempt_number: 1,
          started_at: new Date().toISOString(),
          trigger_source: triggerSource,
        });
        runId = run.id;
      }

      // 1. Load connected integrations — the source of truth for participation.
      // An active row in user_integrations is the ONLY gate a provider needs to
      // enter the briefing (health seat + fetch + AI request list). A connected
      // provider is never silently hidden.
      let connectedRecords: Array<Record<string, unknown>> = [];
      try {
        connectedRecords = await integrationsRepo.findAllByUser(authUserId) as unknown as Array<Record<string, unknown>>;
      } catch (err) {
        log.warn("Failed to load connected integrations", { error: err instanceof Error ? err.message : err });
      }
      const connectedProviders = connectedRecords.map((r) => r.provider as string).filter(Boolean);
      const integrationIds = new Map<string, string>();
      const lastSyncAt = new Map<string, string>();
      for (const rec of connectedRecords) {
        const p = rec.provider as string;
        if (rec?.id && p) integrationIds.set(p, rec.id as string);
        if (p && rec.last_sync_at) lastSyncAt.set(p, rec.last_sync_at as string);
      }
      log.info("Connected integrations", { providers: connectedProviders, requested: selectedIntegrations });

      // Respect the schedule's integration selection (defaulted to full list).
      // WhatsApp must additionally reach full readiness (auth + open socket +
      // valid session + completed sync) to contribute data; a row with a
      // not-ready socket keeps its health seat but contributes no fetched items.
      const selectedConnected = connectedProviders.filter((p) => selectedIntegrations.includes(p));
      let whatsappReady = true;
      if (selectedConnected.includes("whatsapp")) {
        const { WhatsAppClientManager } = await import("@/lib/whatsapp/client");
        whatsappReady = (await WhatsAppClientManager.getConnectionState(authUserId)).ready;
      }
      const activeIntegrations = whatsappReady
        ? selectedConnected
        : selectedConnected.filter((p) => p !== "whatsapp");
      log.info("Fetchable active integrations", { activeIntegrations, whatsappReady });

      // 2. Fetch platform data via MCP — all in parallel. Every provider runs
      // through ONE pipeline: fetch → normalize → unified store → aiShape → AI.
      const rawContext: Record<string, unknown> = {};
      // Normalized records per provider, retained for backend-enforced coverage:
      // if the AI omits a provider with real data, these build the real items.
      const contextEntities: Record<string, NormalizedEntity[]> = {};
      const health: ProviderHealthReport = {};
      const store = getUnifiedStoreRepo();

      // Provider Health seat for EVERY connected integration up front — zero
      // data, an error, or an unsupported fetch is reported, never hidden.
      for (const p of connectedProviders) {
        health[p] = { ...emptyHealth(true), lastSync: lastSyncAt.get(p) || undefined };
      }
      // WhatsApp that is connected but not ready (auth/socket/sync incomplete)
      // is excluded from fetch — but it must never read as "no recent activity".
      // Surface the reconnect reason explicitly.
      if (connectedProviders.includes("whatsapp") && !whatsappReady) {
        health.whatsapp = {
          ...(health.whatsapp || emptyHealth(true)),
          error: "WhatsApp is not fully in sync — reconnect to complete",
        };
        log.warn("WhatsApp connected but not ready; marked reconnect", { whatsappReady });
      }

      const ingest = async (provider: string, result: { status: string; result?: unknown; error?: { message?: string } }): Promise<void> => {
        const h: ProviderHealth = health[provider] ? { ...health[provider] } : emptyHealth(true);
        if (result.status !== "success" || result.result == null) {
          h.error = result.error?.message || "fetch failed";
          log.warn("MCP fetch returned no data", { provider, error: result.error?.message });
          health[provider] = { ...h, ...classifyProviderStatus(h) };
          return;
        }
        // Partial failure (e.g. GitHub notifications 403 while issues succeeded):
        // captured up front so it is never overwritten by the zero-gate below —
        // data still flows, but the reason is never hidden.
        if (result.error?.message) {
          h.error = result.error.message;
          log.warn("Briefing partial provider failure (data retained)", { provider, error: result.error.message });
        }
        const integrationId = integrationIds.get(provider) || "";
        const entities = normalizeResult(provider, result.result, integrationId);
        h.normalized = entities.length;
        // Fetched count of the normalized records (not raw payload): for payloads
        // that carry a single record object (e.g. a LinkedIn profile), the raw
        // object counts as 0 via countItems, but it normalizes to 1 real entity —
        // so the data gate must key off normalized count, never raw count.
        h.fetched = countItems(result.result) > 0 ? countItems(result.result) : entities.length;
        if (h.normalized === 0) {
          // Fail fast (Phase 12): data upstream but normalization dropped it —
          // never silently continue. Truly-empty payloads read as "no recent
          // activity"; payloads that had data but dropped read as sync failure.
          const rawEmpty = countItems(result.result) === 0;
          if (!h.error && !rawEmpty) h.error = "normalization returned 0 items";
          health[provider] = { ...h, ...classifyProviderStatus(h) };
          log[rawEmpty ? "warn" : "error"]("Briefing normalization result", {
            provider, fetched: countItems(result.result), normalized: h.normalized, rawEmpty, error: h.error,
          });
          return;
        }
        if (integrationId) {
          try {
            h.saved = await store.upsertBatch(authUserId, integrationId, entities);
          } catch (err) {
            h.error = `persist failed: ${err instanceof Error ? err.message : err}`;
            log.error("Briefing persist failure", { provider, error: h.error });
          }
        }
        rawContext[provider] = aiShapeForProvider(provider, entities);
        h.aiUsed = countItems(rawContext[provider]);
        contextEntities[provider] = entities;
        health[provider] = { ...h, ...classifyProviderStatus(h) };
        log.info("Briefing provider ingested", { provider, ...h });
      };

      const fetchedProviders: string[] = [];

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

      // Create githubPromise BEFORE awaiting platformTasks so all providers run in parallel.
      const githubPromise = activeIntegrations.includes("github")
        ? (async () => {
            const [issues, notifications, activity] = await Promise.allSettled([
              executeMCPAction(authUserId, "github", "github_list_issues", {}),
              executeMCPAction(authUserId, "github", "github_get_notifications", {}),
              executeMCPAction(authUserId, "github", "github_get_recent_activity", {}),
            ]);
            const combined: Record<string, unknown> = {};
            let lastError: string | undefined;
            if (issues.status === "fulfilled" && issues.value.status === "success" && issues.value.result != null) {
              combined.issues = issues.value.result;
            } else if (issues.status === "fulfilled") {
              lastError = issues.value.error?.message;
            } else {
              lastError = issues.reason instanceof Error ? issues.reason.message : String(issues.reason);
            }
            if (notifications.status === "fulfilled" && notifications.value.status === "success" && notifications.value.result != null) {
              combined.notifications = notifications.value.result;
            } else if (notifications.status === "fulfilled") {
              lastError = notifications.value.error?.message;
            } else {
              lastError = notifications.reason instanceof Error ? notifications.reason.message : String(notifications.reason);
            }
            if (activity.status === "fulfilled" && activity.value.status === "success" && activity.value.result != null) {
              combined.activity = activity.value.result;
            } else if (activity.status === "fulfilled") {
              lastError = activity.value.error?.message;
            } else {
              lastError = activity.reason instanceof Error ? activity.reason.message : String(activity.reason);
            }
            if (Object.keys(combined).length > 0) {
              // Partial success: report the error too so a failed sub-request is
              // never hidden behind "no recent activity".
              fetchedProviders.push("github");
              await ingest("github", lastError
                ? { status: "success", result: combined, error: { message: lastError } }
                : { status: "success", result: combined });
            } else {
              // All GitHub requests failed — surface the reason, never pretend
              // "no recent activity".
              await ingest("github", { status: "error", error: { message: lastError || "GitHub returned no issues, notifications, or activity" } });
            }
          })().catch(e => console.warn("GitHub MCP action failed in briefing sync:", e))
        : Promise.resolve();

      await Promise.allSettled([
        ...platformTasks
          .filter(p => activeIntegrations.includes(p.provider) && (!p.categoryFilter || selectedCategories.includes(p.categoryFilter)))
          .map(async (p) => {
            const r = await executeMCPAction(authUserId, p.provider, p.action, p.params);
            if (r.status === "success") fetchedProviders.push(p.provider);
            await ingest(p.provider, r);
          }),
        githubPromise,
      ]);

      const perProviderCounts = Object.fromEntries(
        Object.entries(rawContext).map(([provider, value]) => [provider, countItems(value)])
      );
      const healthReport = Object.fromEntries(
        Object.entries(health).map(([provider, h]) => [provider, { ...h, quality: computeQuality(h) }])
      );
      log.info("Fetched platform data", { fetchedProviders, perProviderCounts });
      log.info("Briefing provider health", { health: healthReport });

      // Per-provider pipeline report — the observable audit trail for every
      // connected integration. A provider is shown regardless of outcome.
      log.info("Briefing provider report", {
        report: connectedProviders.map((p) => {
          const h = health[p] || { ...emptyHealth(true) };
          return {
            provider: p,
            connected: true,
            fetched: h.fetched,
            normalized: h.normalized,
            saved: h.saved,
            aiUsed: h.aiUsed,
            status: classifyProviderStatus(h).status,
            statusLabel: classifyProviderStatus(h).label,
            reconnectRequired: classifyProviderStatus(h).reconnect,
            lastSync: h.lastSync || null,
            quality: computeQuality(h).label,
            reason: h.error || (h.fetched === 0 ? "no recent activity" : null),
          };
        }),
      });

      // 2.5 Data gate: never fabricate. If no connected integration returned real
      // data, do NOT call the AI — return an explicit empty so the UI shows the
      // "no data / connect integrations" state instead of a hallucinated briefing.
      log.info("AI input size", {
        rawContextBytes: JSON.stringify(rawContext).length,
        estimatedTokens: Math.ceil(JSON.stringify(rawContext).length / 4),
        sources: fetchedProviders,
      });
      if (!hasRealData(rawContext)) {
        log.warn("No real data from any integration; skipping AI to avoid hallucination", { elapsedMs: Date.now() - startTime });
        if (scheduleId && schedule) {
          const nextRun = calculateNextRun(schedule.frequency, schedule.timezone);
          await repo.releaseSchedule(scheduleId, {
            last_run: new Date().toISOString(),
            next_run: nextRun,
          });
        }
        // Connected providers still deserve a visible health seat even when none
        // returned data. Store a zero-item briefing carrying provider_health so
        // the UI shows "no recent activity" per provider instead of hiding them.
        if (connectedProviders.length > 0) {
          const emptyBriefing = await repo.createBriefing({
            user_id: userId,
            schedule_id: scheduleId,
            title: `${name} — No recent activity`,
            executive_summary: "No recent activity from any connected integration.",
            full_content: { title: name, items: [], executiveSummary: "No recent activity from any connected integration." },
            priority_score: 0,
            source_freshness: {},
            provider_health: healthReport as Record<string, unknown>,
            generated_at: new Date().toISOString(),
            ai_model: "none",
            status: "completed",
          });
          log.info("Briefing generated with zero data (health-only)", { briefingId: emptyBriefing.id });
          if (runId) await repo.completeRun(runId, emptyBriefing.id ?? "", Date.now() - startTime);
          return { success: true, briefingId: emptyBriefing.id, empty: true };
        }
        if (runId) await repo.completeRun(runId, "", Date.now() - startTime);
        return { success: true, empty: true };
      }

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
      "text": "Actionable advice, e.g. 'Reply to Alice regarding PR review'",
      "type": "reply_email" | "prepare_meeting" | "finish_task" | "contact_client" | "schedule_follow_up",
      "platform": "gmail" | "outlook" | "slack" | "whatsapp" | "telegram" | "discord" | "github" | "linkedin" | "calendar" | "notion" | "linear",
      "sourceId": "unique ID of source item if any, or null",
      "priority": "high" | "medium" | "low",
      "reason": "1-2 sentences explaining why this action matters, referencing actual items in the context",
      "confidence": (0 to 100, how sure you are this is the right action),
      "affectedPlatforms": ["platforms involved in this decision"],
      "relatedData": ["short references to the source items / threads / projects that motivated this recommendation"]
    }
  ],
  "health": {
    "overall": (0 to 100 workspace health score),
    "breakdown": [
      { "name": "dimension name (e.g. Communication, Development, Meetings, etc. — ONLY include dimensions with real evidence from data)", "score": (0 to 100), "reason": "why this score — MUST reference actual data items; omit dimension entirely if no evidence exists" }
    ],
    "summary": "1-2 sentence health summary"
  },
  "insights": [
    { "text": "observational insight drawn ONLY from actual items", "type": "pattern" | "warning" | "opportunity" | "concept", "importance": "high" | "medium" | "low" }
  ],
  "relationships": [
    {
      "title": "name of the grouped topic, e.g. 'Deployment Discussion'",
      "summary": "how the items relate",
      "platforms": ["platform names involved"],
      "items": [ { "platform": "platform", "title": "the specific item title" } ]
    }
  ],
  "timeline": [
    { "time": "HH:MM or date-time string", "title": "event description", "platform": "name" }
  ],
  "confidence": {
    "overall": (0 to 100),
    "reason": "brief statement of how certain the summary is given available data",
    "missingData": ["what integrations/steps are caches"],
  },
  "goals": [
    { "text": "a concrete goal for today derived from actual items, e.g. 'Reply to 4 clients'", "priority": "high" | "medium" | "low", "reason": "why this goal matters today" }
  ],
  "sourceStats": [
    {
      "platform": "name",
      "syncStatus": "ok" | "partial" | "error" | "skipped",
      "itemsProcessed": (number of items actually provided by that platform in the context),
      "lastSync": "timestamp from the item data or omit"
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
Connected integrations (the ONLY sources with data available): ${activeIntegrations.join(", ") || "(none)"}.
Do NOT report any platform as missing, and do NOT emit items for platforms outside this list — they are simply not connected.
Categories requested: ${selectedCategories.join(", ")}.
For each platform, provide relevant data: gmail/outlook→emails, slack/whatsapp/telegram/discord→messages, github→issues/PRs/notifications/recent commits, linkedin→profile/feed, calendar→events, notion→pages, linear→issues.

CRITICAL: Only report data actually present in <data_context>. Never invent items, summaries, counts, or metrics for any platform or category that has no data. If a requested platform or category returned nothing, omit it entirely (no fabricated placeholders).

ANTI-HALLUCINATION: every priority assignment, health score, insight, relationship, recommendation, goal, timeline entry, and confidence statement must be derivable from the actual items in <data_context>. Never claim something happened that is not in the data. Health breakdown dimensions MUST ONLY be included when there is real supporting evidence from the data — do not create dimensions for "Communication", "Development", "Meetings", "Productivity", "Response Time", "Pending Work" or any other dimension unless actual data items exist to support them. If no evidence exists for a dimension, omit it entirely (do not include with score 0 or "insufficient data"). Never fabricate lastSync timestamps — only set them if present in the item data. Goals must only be things the data actually supports — never invent pending tasks or waiting counts that are not present in the items.`;

      // Phase 9 — balance by importance, not volume. One urgent GitHub issue
      // outweighs 50 routine emails; every provider with data keeps a seat.
      const coveragePrompt = `
COVERAGE REQUIREMENT:
For EVERY provider in the manifest below, you MUST emit at least one corresponding entry in "items" (and reflect it in the relevant "categories" section). Do NOT leave a provider that has data out of "items" — this is the primary user requirement. Providers with 0 items have no data and must be omitted entirely.
BALANCE: When sizing "items", prioritize by IMPORTANCE and urgency across providers — never by message volume. A single high-priority GitHub issue or urgent direct message must appear even if a provider has many more routine items. Keep at least one item per provider with data, then allocate remaining slots by priority, not count.
Source manifest (real item counts delivered to the AI from each integration):
${buildManifest(healthReport)}`;

      // 4. Generate AI summary
      const aiResult = await generateJsonResponse<AIResponseBriefing>(systemPrompt + coveragePrompt, rawContext, { temperature: 0.2 });
      if (!aiResult) {
        throw new Error("Central AI service returned null response.");
      }

      // 4.5 Backend-enforced provider coverage. The AI summarizes and
      // prioritizes, but the BACKEND guarantees every provider with real data
      // is represented. If the AI skipped a provider that has normalized
      // records, inject real items built from those records — never a
      // placeholder. `referencedByAI` = AI's original platforms; `rendered` =
      // final platforms after backfill (what gets stored).
      // 4.5b Provenance gate — Anti-hallucination, enforced by the BACKEND.
      // The AI may not emit an item for a platform unless that platform actually
      // produced normalized records in THIS run, nor more items than it has
      // records. Any AI item for a platform with no data is fabricated (e.g. a
      // "PR #42" from nothing) and dropped — so every rendered item originates
      // from a real connected integration.
      const rawAIItems = aiResult.items || [];
      const { grounded: aiItems, droppedPlatforms, droppedUntraceable } = filterGroundedItems(rawAIItems, contextEntities, { requireTraceable: true });
      if (droppedPlatforms.length > 0) {
        log.warn("Briefing dropped fabricated items", {
          droppedPlatforms,
          droppedTitles: rawAIItems.filter((i) => droppedPlatforms.includes(i.platform)).map((i) => i.title).slice(0, 10),
        });
      }
      if (droppedUntraceable.length > 0) {
        log.warn("Briefing dropped untraceable items (no matching synchronized entity)", {
          droppedCount: droppedUntraceable.length,
          dropped: droppedUntraceable.slice(0, 10),
        });
      }

      const referencedByAI = new Set<string>(aiItems.map((i) => i.platform));
      const backfilledPlatforms = new Set<string>();
      const backfilledItems: typeof aiItems = [];
      for (const [provider, entities] of Object.entries(contextEntities)) {
        if (entities.length === 0 || referencedByAI.has(provider)) continue;
        const items = buildCoverageItems(provider, entities);
        if (items.length === 0) continue;
        backfilledItems.push(...items);
        backfilledPlatforms.add(provider);
        log.warn("Briefing coverage backfill", { provider, items: items.length, reason: "AI omitted a provider with normalized data" });
      }
      if (backfilledItems.length > 0) {
        aiResult.items = [...aiItems, ...backfilledItems];
        log.info("Briefing coverage reconciled", {
          backfilledProviders: [...backfilledPlatforms],
          backfilledItems: backfilledItems.length,
          aiItems: aiItems.length,
        });
      } else {
        aiResult.items = aiItems;
      }
      const renderedPlatforms = new Set<string>((aiResult.items || []).map((i) => i.platform));

      log.info("AI briefing response generated", {
        aiTitle: aiResult.title,
        itemCount: aiResult.items?.length,
        aiPlatformDistribution: (aiResult.items || []).reduce((acc, item) => {
          acc[item.platform] = (acc[item.platform] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        backfilled: [...backfilledPlatforms],
        elapsedMs: Date.now() - startTime,
      });

      // Per-provider pipeline result (post-AI) — the audit trail. A provider
      // with data must be `referencedBy` and `rendered`; any gap is surfaced.
      log.info("Briefing provider pipeline result", {
        report: connectedProviders.map((p) => {
          const h = health[p] || { ...emptyHealth(true) };
          return {
            provider: p,
            connected: true,
            fetched: h.fetched,
            normalized: h.normalized,
            saved: h.saved,
            passedToAI: (rawContext[p] !== undefined) && countItems(rawContext[p]) > 0,
            referencedByAI: referencedByAI.has(p),
            rendered: renderedPlatforms.has(p),
            quality: computeQuality(h).label,
            reason: h.error || (h.fetched === 0 ? "no recent activity" : null),
          };
        }),
      });

      // Persist referenced/rendered into the stored health report so the UI and
      // any downstream audit can see AI coverage per provider.
      for (const p of connectedProviders) {
        const h = healthReport[p] || { ...emptyHealth(true) };
        h.referenced = referencedByAI.has(p);
        h.rendered = renderedPlatforms.has(p);
        h.reason = h.error || (h.fetched === 0 ? "no recent activity" : undefined);
        Object.assign(h, classifyProviderStatus(h));
        healthReport[p] = h;
      }

      // 5. Store generated briefing (with FK fallback)
      // Demo mode: skip all persistence, return result for verification.
      if (demoMode) {
        const platforms = [...renderedPlatforms];
        return {
          success: true,
          empty: false,
          demo: {
            ai_tokens_used: 0, // generateJsonResponse doesn't expose token count
            elapsed_ms: Date.now() - startTime,
            items_count: (aiResult.items || []).length,
            platforms,
          },
        };
      }

      const createBriefingPayload = {
        user_id: userId,
        schedule_id: scheduleId,
        title: aiResult.title || name,
        executive_summary: aiResult.executiveSummary,
        full_content: aiResult as unknown as Record<string, unknown>,
        priority_score: aiResult.priorityScore || 50,
        source_freshness: Object.fromEntries(
          Object.entries(rawContext).map(([provider, value]) => [
            provider,
            Array.isArray(value) ? `synced:${value.length}` : "synced",
          ])
        ),
        provider_health: healthReport as Record<string, unknown>,
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
      const briefingGeneratedAt = createBriefingPayload.generated_at;

      // Map an AI/backfilled item to the real synchronized entity's timestamp
      // by its sourceId (scoped to the item's own platform). Storing the true
      // activity time (message sent / event start) instead of generation time
      // keeps dashboard "time" labels grounded. Returns null when no trustworthy
      // activity timestamp exists — caller handles fallback.
      const entityTimestamp = (item: AIResponseBriefing["items"][number]): string | null =>
        effectiveActivityTimestamp(item, contextEntities);

      // 6. Store briefing items with correlation data
      const storedItems = await Promise.all(
        (aiResult.items || []).map(async (item) => {
          const activityTs = entityTimestamp(item);
          const timestamp = activityTs ?? briefingGeneratedAt;
          const timestampSource = activityTs ? "activity" : "fallback_generated";
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
              coverage_backfilled: backfilledPlatforms.has(item.platform) || null,
              timestamp_source: timestampSource,
            },
            priority: item.priority || "normal",
            status: "unread",
            notes: null,
            snoozed_until: null,
            timestamp,
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

      // 7. Update schedule next run + release lock
      if (scheduleId && schedule) {
        const nextRun = calculateNextRun(schedule.frequency, schedule.timezone);
        await repo.releaseSchedule(scheduleId, {
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

      log.info("Briefing generation completed", { briefingId, elapsedMs: Date.now() - startTime });
      if (runId) await repo.completeRun(runId, briefingId ?? "", Date.now() - startTime);
      return { success: true, briefingId };
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : "Briefing generation failed";
      log.error("Briefing generation failed", { error: errorMsg, elapsedMs: Date.now() - startTime });

      // Alert via notification system so failures are never silent.
      try {
        await publishEvent("briefing_generation_failed", userId, {
          scheduleId,
          triggerSource,
          error: errorMsg,
          duration_ms: Date.now() - startTime,
        });
      } catch (eventErr) {
        log.warn("Failed to publish briefing failure event", { err: eventErr instanceof Error ? eventErr.message : eventErr });
      }

      if (runId) {
        await repo.failRun(runId, errorMsg, Date.now() - startTime);
      }
      // Release the schedule lock on failure so the next tick can retry.
      if (scheduleId) {
        try {
          await repo.releaseScheduleTransient(scheduleId);
        } catch (lockErr) {
          log.warn("Failed to release schedule lock after failure", { err: lockErr instanceof Error ? lockErr.message : lockErr });
        }
      }

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
