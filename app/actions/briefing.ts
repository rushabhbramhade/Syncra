"use server";

import { createAdminDb } from "@/lib/db";
import { BriefingsRepository, BriefingScheduleRecord } from "@/lib/repositories/briefings-repository";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { BriefingService, calculateNextRun } from "@/lib/services/briefing-service";
import { getConnectionStatus } from "@/app/actions/integrations";
import { executeMCPAction } from "@/lib/integrations/actions-core";
import { getAuthenticatedUser, requireOwnership } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/rate-limiter";
import { DRAFT_RATE_LIMIT_ERROR } from "@/lib/rate-limit-config";
import { dedupeKey, singleFlight } from "@/lib/single-flight";
import { resolveGmailReplyContext } from "@/lib/briefing/pipeline";
import { llmGateway } from "@/lib/llm-gateway";
import { randomUUID } from "node:crypto";
import { z } from "zod";

// Helper to authenticate user from cookies
function createRequestId(): string {
  return randomUUID();
}

/** Extract a bare email address from a Gmail From/To header value. */
function extractGmailRecipientFromHeader(headerValue: string): string | null {
  const trimmed = headerValue.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/<([^>]+)>/);
  const candidate = (match ? match[1] : trimmed).trim();
  return /[^\s@]+@[^\s@]+/.test(candidate) ? candidate : null;
}

async function verifyUserAccess(userId: string) {
  const guard = await requireOwnership(userId);
  if ("error" in guard) {
    throw new Error("Unauthorized user access");
  }
  return guard;
}

const scheduleUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  goal: z.string().trim().max(1000).nullable().optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  integrations: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  categories: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  frequency: z.string().refine(
    value => ["every_15_min", "hourly", "morning_brief", "evening_brief", "daily", "weekly"].includes(value),
    "Unsupported briefing frequency",
  ).optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
}).strict();

type ScheduleUpdateInput = z.infer<typeof scheduleUpdateSchema>;

function metadataString(metadata: Record<string, unknown>, key: string): string {
  const value = metadata[key];
  return typeof value === "string" ? value : "";
}

export async function getSchedulesAction(userId: string) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);
  return await repo.findSchedulesByUserId(userId);
}

export async function createScheduleAction(
  userId: string,
  schedule: Omit<BriefingScheduleRecord, "id" | "user_id" | "created_at" | "updated_at">
) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);
  
  // Calculate first next run time
  const nextRun = calculateNextRun(schedule.frequency, schedule.timezone);
  
  return await repo.createSchedule({
    ...schedule,
    user_id: userId,
    next_run: nextRun,
  });
}

export async function updateScheduleAction(
  userId: string,
  id: string,
  updates: ScheduleUpdateInput
) {
  const access = await verifyUserAccess(userId);
  const parsedUpdates = scheduleUpdateSchema.parse(updates);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);

  const schedule = await repo.findScheduleById(id);
  if (!schedule || schedule.user_id !== access.userId) {
    throw new Error("Schedule not found or access denied");
  }

  const updatedFields: Partial<BriefingScheduleRecord> = { ...parsedUpdates };
  if (parsedUpdates.frequency || parsedUpdates.timezone) {
    updatedFields.next_run = calculateNextRun(
      parsedUpdates.frequency || schedule.frequency,
      parsedUpdates.timezone || schedule.timezone
    );
  }

  return await repo.updateSchedule(id, access.userId, updatedFields);
}

export async function deleteScheduleAction(userId: string, id: string) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);
  return await repo.deleteSchedule(id, userId);
}

export async function getBriefingsAction(
  userId: string,
  options?: { limit?: number; offset?: number; search?: string }
) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);
  return await repo.findBriefingsByUserId(userId, options);
}

export async function getBriefingHistoryAction(userId: string, limit = 10) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);
  return await repo.findHistoryByUserId(userId, limit);
}

export async function getBriefingDetailsAction(userId: string, briefingId: string) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);

  // Direct single-row lookup — avoids fetching all briefings
  const briefing = await repo.findBriefingById(briefingId);
  if (!briefing || briefing.user_id !== userId) {
    throw new Error("Briefing not found or access denied");
  }

  const items = await repo.findItemsByBriefingId(briefingId);
  return { briefing, items };
}

export async function getBriefingItemsAction(userId: string, briefingId: string) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);

  const briefing = await repo.findBriefingById(briefingId);
  if (!briefing || briefing.user_id !== userId) {
    throw new Error("Briefing not found or access denied");
  }

  return await repo.findItemsByBriefingId(briefingId);
}

export async function generateBriefingAction(userId: string, scheduleId: string | null = null) {
  await verifyUserAccess(userId);
  const service = BriefingService.getInstance();
  return await service.generateBriefingForSchedule(userId, scheduleId, "manual");
}

export async function updateBriefingItemStatusAction(
  userId: string,
  itemId: string,
  status: "unread" | "read" | "completed" | "archived" | "snoozed",
  notes?: string | null,
  snoozedUntil?: string | null
) {
  const access = await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);

  // Verify item ownership
  const item = await repo.findItemById(itemId);
  if (!item) {
    throw new Error("Briefing item not found");
  }

  const briefing = await repo.findBriefingById(item.briefing_id);
  if (!briefing || briefing.user_id !== access.userId) {
    throw new Error("Access denied to briefing item");
  }

  return await repo.updateItemStatus(itemId, status, notes, snoozedUntil);
}

export async function getCorrelatedItemsAction(userId: string, itemId: string) {
  const access = await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);

  const item = await repo.findItemById(itemId);
  if (!item) return [];

  const meta = (item.metadata || {}) as Record<string, unknown>;
  const correlationKey = metadataString(meta, "correlationKey");
  if (!correlationKey) return [];

  const briefing = await repo.findBriefingById(item.briefing_id);
  if (!briefing || briefing.user_id !== access.userId) return [];

  const allItems = await repo.findItemsByBriefingId(item.briefing_id);
  return allItems
    .filter(i => i.id !== itemId)
    .filter(i => {
      const m = (i.metadata || {}) as Record<string, unknown>;
      return metadataString(m, "correlationKey") === correlationKey;
    })
    .map(i => ({
      id: i.id,
      platform: i.platform,
      title: metadataString((i.metadata || {}) as Record<string, unknown>, "title"),
      shortSummary: metadataString((i.metadata || {}) as Record<string, unknown>, "shortSummary"),
    }));
}

export async function replyToBriefingItemAction(
  userId: string,
  itemId: string,
  replyText: string
) {
  const access = await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);

  // 1. Fetch briefing item
  const item = await repo.findItemById(itemId);
  if (!item) {
    return { success: false, error: "Briefing item not found" };
  }

  const briefing = await repo.findBriefingById(item.briefing_id);
  if (!briefing || briefing.user_id !== access.userId) {
    return { success: false, error: "Access denied" };
  }

  const normalizedReply = replyText.trim();
  if (!normalizedReply || normalizedReply.length > 10000) {
    return { success: false, error: "Reply must be between 1 and 10000 characters" };
  }

  const platform = item.platform.toLowerCase();
  const metadata = (item.metadata || {}) as Record<string, unknown>;
  
  try {
    let mcpResult = null;

    // 2. Route reply to corresponding MCP action based on platform
    if (platform === "gmail") {
      // Real thread context — preserved from the provider through enrichment.
      // Never send to a guessed recipient, never break the thread chain.
      const ctx = resolveGmailReplyContext(metadata as Record<string, unknown>);

      // If metadata lacks the real sender, fetch it from the actual Gmail
      // thread headers — never invent a recipient.
      let recipient = ctx.recipient;
      if (ctx.needsHeaderLookup && ctx.lookupThreadId) {
        try {
          const integrationsRepo = new IntegrationsRepository(db);
          const record =
            await integrationsRepo.findByUserAndProvider(access.authUserId, "gmail") ||
            await integrationsRepo.findByUserAndProvider(access.userId, "gmail");
          if (record) {
            const token = integrationsRepo.decryptToken(record.encrypted_access_token);
            if (token) {
              const { GmailService } = await import("@/lib/google/gmail");
              const headers = await GmailService.getThreadHeaders(token, ctx.lookupThreadId);
              if (headers?.from) recipient = extractGmailRecipientFromHeader(headers.from);
            }
          }
        } catch {
          // keep the metadata-derived sender (may remain null → honest error)
        }
      }

      if (!recipient) {
        throw new Error("Could not extract a real sender to reply to — connect a fresh sync for full email context.");
      }
      if (!ctx.threadId && !ctx.messageId) {
        throw new Error("This email is missing its Gmail thread context — re-sync the integration to reply in-thread.");
      }

      console.log(`Sending Gmail reply in-thread to ${recipient}${ctx.threadId ? ` (thread ${ctx.threadId})` : ""}`);
      mcpResult = await executeMCPAction(access.authUserId, "gmail", "gmail_send_email", {
        to: recipient,
        subject: ctx.subject,
        body: normalizedReply,
        threadId: ctx.threadId || ctx.messageId || undefined,
      });
    } else if (platform === "whatsapp") {
      const contact = metadataString(metadata, "chatId") || metadataString(metadata, "fromName") || item.source_id;
      if (!contact) {
        throw new Error("Could not extract chat recipient from metadata.");
      }

      console.log(`Sending WhatsApp message to ${contact}...`);
      mcpResult = await executeMCPAction(access.authUserId, "whatsapp", "whatsapp_send_message", {
        to: contact,
        message: normalizedReply,
      });
    } else if (platform === "slack") {
      const channel = metadataString(metadata, "channel") || metadataString(metadata, "channelId") || "#general";
      console.log(`Sending Slack message to ${channel}...`);
      mcpResult = await executeMCPAction(access.authUserId, "slack", "slack_post_message", {
        channel,
        text: normalizedReply,
      });
    } else if (platform === "telegram") {
      const chatId = metadataString(metadata, "chatId") || metadataString(metadata, "from");
      if (!chatId) {
        throw new Error("Could not extract Telegram chat ID from metadata.");
      }
      console.log(`Sending Telegram message to ${chatId}...`);
      mcpResult = await executeMCPAction(access.authUserId, "telegram", "telegram_send_message", {
        chatId,
        text: normalizedReply,
      });
    } else if (platform === "discord") {
      const channelId = metadataString(metadata, "channelId") || item.source_id;
      if (!channelId) {
        throw new Error("Could not extract Discord channel ID from metadata.");
      }
      console.log(`Sending Discord message to channel ${channelId}...`);
      mcpResult = await executeMCPAction(access.authUserId, "discord", "discord_send_message", {
        channelId,
        content: normalizedReply,
      });
    } else {
      throw new Error(`Platform "${platform}" does not support direct replies via MCP.`);
    }

    if (mcpResult && mcpResult.status === "success") {
      // 3. Mark briefing item as completed
      const note = `Replied: "${normalizedReply.substring(0, 60)}${normalizedReply.length > 60 ? '...' : ''}"`;
      await repo.updateItemStatus(itemId, "completed", note);
      return { success: true };
    } else {
      throw new Error(mcpResult?.error?.message || "MCP action execution returned non-success status");
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Failed to execute reply action";
    console.error(`Reply failed for item ${itemId}:`, err);
    return { success: false, error: errMsg };
  }
}

export async function getBriefingItemSenderAction(userId: string, itemId: string) {
  const access = await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);
  const integrationsRepo = new IntegrationsRepository(db);

  const item = await repo.findItemById(itemId);
  if (!item) return { from: null, to: null };

  const briefing = await repo.findBriefingById(item.briefing_id);
  if (!briefing || briefing.user_id !== access.userId) {
    throw new Error("Briefing item not found or access denied");
  }

  const meta = (item.metadata || {}) as Record<string, unknown>;
  if (typeof meta.from === "string" && typeof meta.to === "string") {
    return { from: meta.from, to: meta.to };
  }

  const platform = item.platform?.toLowerCase();
  if (platform !== "gmail" && platform !== "outlook") return { from: null, to: null };
  if (!item.source_id) return { from: null, to: null };

  const record =
    await integrationsRepo.findByUserAndProvider(access.userId, platform) ||
    await integrationsRepo.findByUserAndProvider(access.authUserId, platform);
  if (!record) return { from: null, to: null };

  const accessToken = integrationsRepo.decryptToken(record.encrypted_access_token);
  if (!accessToken) return { from: null, to: null };

  try {
    if (platform === "gmail") {
      const { GmailService } = await import("@/lib/google/gmail");
      // Prefer the real thread id (preserved from the provider), fall back to
      // the stored message id when only that exists.
      const threadId = typeof meta.threadId === "string"
        ? meta.threadId
        : (item.source_id ?? null);
      if (threadId) {
        const headers = await GmailService.getThreadHeaders(accessToken, threadId);
        if (headers) return { from: headers.from, to: headers.to };
      }
    }
  } catch {
    // Fallback: try as message ID
  }

  return { from: null, to: null };
}

export async function checkPlatformsConnectionAction(userId: string, platforms: string[]) {
  const results: Record<string, boolean> = {};
  const statuses = await Promise.all(platforms.map(p => getConnectionStatus(userId, p)));
  platforms.forEach((p, i) => {
    results[p] = statuses[i] !== null;
  });
  return results;
}

export type DraftActionResult =
  | { success: true; draft: string }
  | { success: false; error: string };

export async function generateDraftAction(instruction: string, platform: string): Promise<DraftActionResult> {
  const requestId = createRequestId();
  const startedAt = Date.now();

  const auth = await getAuthenticatedUser();
  if ("error" in auth) {
    return { success: false, error: "Unauthorized" };
  }

  const normalizedInstruction = instruction.trim();
  const supportedPlatforms = new Set(["gmail", "slack", "whatsapp", "telegram", "discord"]);
  if (!normalizedInstruction || normalizedInstruction.length > 4000) {
    return { success: false, error: "Draft instructions must be between 1 and 4000 characters" };
  }
  if (!supportedPlatforms.has(platform)) {
    return { success: false, error: "Unsupported messaging platform" };
  }

  // Single-flight: an identical instruction+platform from the same user while a
  // generation is already in flight shares that one request — a double click or
  // React double-invoke can never burn two AI calls (the source of the
  // "Rate limit exceeded" spikes under single-click usage).
  const dedupe = dedupeKey(["draft", auth.user.id, platform, normalizedInstruction]);
  return singleFlight(dedupe, async () => {
    const attempt = 1;
    const provider = "llm-gateway";
    try {
      const rateLimit = await checkRateLimit(auth.user.id, "ai-draft", "free");
      if (rateLimit.allowed) {
        // proceed
      } else if (rateLimit.unavailable) {
        // The limiter infra failed — NOT the user hitting a limit. Never present
        // this as "rate limit exceeded"; it is a temporary service problem.
        console.error("Rate limiter unreachable during draft generation", {
          requestId, userId: auth.user.id, operation: "generateDraft", bucket: "ai-draft",
        });
        return { success: false, error: "Draft generation is temporarily unavailable. Please try again in a moment." };
      } else {
        console.log(JSON.stringify({
          event: "ai_draft.rate_limited", requestId, userId: auth.user.id, operation: "generateDraft",
          provider, bucket: "ai-draft", attempt, result: "denied", timestamp: new Date().toISOString(),
        }));
        return { success: false, error: DRAFT_RATE_LIMIT_ERROR };
      }

      const guidelines: Record<string, string> = {
        gmail: "formal email format with greeting and sign-off",
        slack: "casual, direct channel message (no greeting/sign-off needed)",
        whatsapp: "short, friendly chat message",
        telegram: "concise, direct message",
        discord: "casual channel message",
      };

      const served = await llmGateway.complete({
        task: "fast",
        temperature: 0.7,
        maxTokens: 500,
        messages: [
          {
            role: "system",
            content: `You are a draft message generator. Generate a concise, professional message draft.
Platform: ${platform}
Guidelines: ${guidelines[platform] || "general professional tone"}

Output ONLY the message text, no explanations.`,
          },
          { role: "user", content: normalizedInstruction },
        ],
      });

      const draft = served.content.trim();
      if (!draft) {
        return { success: false, error: "AI returned empty response" };
      }
      console.log(JSON.stringify({
        event: "ai_draft.generated", requestId, userId: auth.user.id, operation: "generateDraft",
        provider: served.provider, model: served.model, bucket: "ai-draft", attempt, result: "success",
        durationMs: Date.now() - startedAt, timestamp: new Date().toISOString(),
      }));
      return { success: true, draft };
    } catch (err: unknown) {
      console.error("ai_draft.failed", JSON.stringify({
        event: "ai_draft.failed", requestId, userId: auth.user.id, operation: "generateDraft",
        provider, bucket: "ai-draft", attempt, result: "error", durationMs: Date.now() - startedAt,
        timestamp: new Date().toISOString(),
      }));
      return { success: false, error: err instanceof Error ? err.message : "Failed to generate draft" };
    }
  });
}

export async function sendMessageAction(
  userId: string,
  platform: string,
  recipient: string,
  body: string,
  subject?: string
) {
  const access = await verifyUserAccess(userId);
  const normalizedRecipient = recipient.trim();
  const normalizedBody = body.trim();

  if (!normalizedRecipient || normalizedRecipient.length > 500) {
    return { success: false, error: "Recipient must be between 1 and 500 characters" };
  }
  if (!normalizedBody || normalizedBody.length > 10000) {
    return { success: false, error: "Message must be between 1 and 10000 characters" };
  }
  if (subject && subject.length > 300) {
    return { success: false, error: "Subject must not exceed 300 characters" };
  }

  // Single-flight: an identical send while one is in flight shares that request,
  // preventing a double-click from sending the message twice.
  const dedupe = dedupeKey(["send", access.userId, platform, normalizedRecipient, normalizedBody, subject ?? ""]);
  return singleFlight(dedupe, async () => {
  try {
    let mcpResult;

    switch (platform) {
      case "gmail":
        mcpResult = await executeMCPAction(access.authUserId, "gmail", "gmail_send_email", {
          to: normalizedRecipient,
          subject: subject || "",
          body: normalizedBody,
        });
        break;
      case "slack":
        mcpResult = await executeMCPAction(access.authUserId, "slack", "slack_post_message", {
          channel: normalizedRecipient,
          text: normalizedBody,
        });
        break;
      case "whatsapp":
        mcpResult = await executeMCPAction(access.authUserId, "whatsapp", "whatsapp_send_message", {
          to: normalizedRecipient,
          message: normalizedBody,
        });
        break;
      case "telegram":
        mcpResult = await executeMCPAction(access.authUserId, "telegram", "telegram_send_message", {
          chatId: normalizedRecipient,
          text: normalizedBody,
        });
        break;
      case "discord":
        mcpResult = await executeMCPAction(access.authUserId, "discord", "discord_send_message", {
          channelId: normalizedRecipient,
          content: normalizedBody,
        });
        break;
      default:
        return { success: false, error: `Platform "${platform}" not supported for sending messages.` };
    }

    if (mcpResult?.status === "success") {
      return { success: true };
    }
    return { success: false, error: mcpResult?.error?.message || "Failed to send message" };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "Failed to send message";
    console.error(`Send message failed for ${platform}:`, err);
    return { success: false, error: errMsg };
  }
  });
}
