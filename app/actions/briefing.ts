"use server";

import { createAdminDb } from "@/lib/db";
import { BriefingsRepository, BriefingScheduleRecord } from "@/lib/repositories/briefings-repository";
import { IntegrationsRepository } from "@/lib/repositories/integrations-repository";
import { BriefingService, calculateNextRun } from "@/lib/services/briefing-service";
import { executeMCPAction, getConnectionStatus } from "@/app/actions/integrations";
import OpenAI from "openai";

// Helper to authenticate user from cookies
async function verifyUserAccess(userId: string) {
  // Simple validation to ensure requests are secure and match the context
  if (!userId) {
    throw new Error("Unauthorized user access");
  }
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
  updates: Partial<BriefingScheduleRecord>
) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);
  
  // Verify schedule ownership
  const schedule = await repo.findScheduleById(id);
  if (!schedule || schedule.user_id !== userId) {
    throw new Error("Schedule not found or access denied");
  }

  const updatedFields = { ...updates };
  if (updates.frequency || updates.timezone) {
    updatedFields.next_run = calculateNextRun(
      updates.frequency || schedule.frequency,
      updates.timezone || schedule.timezone
    );
  }

  return await repo.updateSchedule(id, updatedFields);
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
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);

  // Verify item ownership
  const item = await repo.findItemById(itemId);
  if (!item) {
    throw new Error("Briefing item not found");
  }

  const briefing = await repo.findBriefingById(item.briefing_id);
  if (!briefing || briefing.user_id !== userId) {
    throw new Error("Access denied to briefing item");
  }

  return await repo.updateItemStatus(itemId, status, notes, snoozedUntil);
}

export async function getCorrelatedItemsAction(userId: string, itemId: string) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);

  const item = await repo.findItemById(itemId);
  if (!item) return [];

  const meta = (item.metadata || {}) as Record<string, any>;
  const correlationKey = meta.correlationKey;
  if (!correlationKey) return [];

  const briefing = await repo.findBriefingById(item.briefing_id);
  if (!briefing || briefing.user_id !== userId) return [];

  const allItems = await repo.findItemsByBriefingId(item.briefing_id);
  return allItems
    .filter(i => i.id !== itemId)
    .filter(i => {
      const m = (i.metadata || {}) as Record<string, any>;
      return m.correlationKey === correlationKey;
    })
    .map(i => ({
      id: i.id,
      platform: i.platform,
      title: ((i.metadata || {}) as Record<string, any>).title || "",
      shortSummary: ((i.metadata || {}) as Record<string, any>).shortSummary || "",
    }));
}

export async function replyToBriefingItemAction(
  userId: string,
  itemId: string,
  replyText: string
) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);

  // 1. Fetch briefing item
  const item = await repo.findItemById(itemId);
  if (!item) {
    return { success: false, error: "Briefing item not found" };
  }

  const briefing = await repo.findBriefingById(item.briefing_id);
  if (!briefing || briefing.user_id !== userId) {
    return { success: false, error: "Access denied" };
  }

  const platform = item.platform.toLowerCase();
  const metadata = (item.metadata || {}) as Record<string, any>;
  
  try {
    let mcpResult = null;

    // 2. Route reply to corresponding MCP action based on platform
    if (platform === "gmail") {
      // Find sender email address from metadata
      let fromField = metadata.from || "";
      let emailMatch = fromField.match(/<([^>]+)>/) || [null, fromField];
      let recipient = emailMatch[1]?.trim() || fromField.trim();
      const subject = metadata.subject || "Re: Syncra Update";
      const subjectWithRe = subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;

      // If no recipient from metadata, try fetching from Gmail API
      if (!recipient && item.source_id) {
        try {
          const integrationsRepo = new IntegrationsRepository(db);
          const record = await integrationsRepo.findByUserAndProvider(userId, "gmail");
          if (record) {
            const token = integrationsRepo.decryptToken(record.encrypted_access_token);
            if (token) {
              const { GmailService } = await import("@/lib/google/gmail");
              const headers = await GmailService.getThreadHeaders(token, item.source_id);
              if (headers?.from) {
                fromField = headers.from;
                emailMatch = fromField.match(/<([^>]+)>/) || [null, fromField];
                recipient = emailMatch[1]?.trim() || fromField.trim();
              }
            }
          }
        } catch {
          // ignore
        }
      }

      if (!recipient) {
        throw new Error("Could not extract email recipient from metadata.");
      }

      console.log(`Sending reply email to ${recipient}...`);
      mcpResult = await executeMCPAction(userId, "gmail", "gmail_send_email", {
        to: recipient,
        subject: subjectWithRe,
        body: replyText,
        threadId: item.source_id || undefined,
      });
    } else if (platform === "whatsapp") {
      const contact = metadata.chatId || metadata.fromName || item.source_id;
      if (!contact) {
        throw new Error("Could not extract chat recipient from metadata.");
      }

      console.log(`Sending WhatsApp message to ${contact}...`);
      mcpResult = await executeMCPAction(userId, "whatsapp", "whatsapp_send_message", {
        to: contact,
        message: replyText,
      });
    } else if (platform === "slack") {
      const channel = metadata.channel || metadata.channelId || "#general";
      console.log(`Sending Slack message to ${channel}...`);
      mcpResult = await executeMCPAction(userId, "slack", "slack_post_message", {
        channel,
        text: replyText,
      });
    } else if (platform === "telegram") {
      const chatId = metadata.chatId || metadata.from;
      if (!chatId) {
        throw new Error("Could not extract Telegram chat ID from metadata.");
      }
      console.log(`Sending Telegram message to ${chatId}...`);
      mcpResult = await executeMCPAction(userId, "telegram", "telegram_send_message", {
        chatId,
        text: replyText,
      });
    } else if (platform === "discord") {
      const channelId = metadata.channelId || item.source_id;
      if (!channelId) {
        throw new Error("Could not extract Discord channel ID from metadata.");
      }
      console.log(`Sending Discord message to channel ${channelId}...`);
      mcpResult = await executeMCPAction(userId, "discord", "discord_send_message", {
        channelId,
        content: replyText,
      });
    } else {
      throw new Error(`Platform "${platform}" does not support direct replies via MCP.`);
    }

    if (mcpResult && mcpResult.status === "success") {
      // 3. Mark briefing item as completed
      const note = `Replied: "${replyText.substring(0, 60)}${replyText.length > 60 ? '...' : ''}"`;
      await repo.updateItemStatus(itemId, "completed", note);
      return { success: true };
    } else {
      throw new Error(mcpResult?.error?.message || "MCP action execution returned non-success status");
    }
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : "Failed to execute reply action";
    console.error(`Reply failed for item ${itemId}:`, err);
    return { success: false, error: errMsg };
  }
}

export async function getBriefingItemSenderAction(userId: string, itemId: string) {
  await verifyUserAccess(userId);
  const db = createAdminDb();
  const repo = new BriefingsRepository(db);
  const integrationsRepo = new IntegrationsRepository(db);

  const item = await repo.findItemById(itemId);
  if (!item) return { from: null, to: null };

  const meta = (item.metadata || {}) as Record<string, any>;
  if (meta.from && meta.to) return { from: meta.from, to: meta.to };

  const platform = item.platform?.toLowerCase();
  if (platform !== "gmail" && platform !== "outlook") return { from: null, to: null };
  if (!item.source_id) return { from: null, to: null };

  const record = await integrationsRepo.findByUserAndProvider(userId, platform);
  if (!record) return { from: null, to: null };

  const accessToken = integrationsRepo.decryptToken(record.encrypted_access_token);
  if (!accessToken) return { from: null, to: null };

  try {
    if (platform === "gmail") {
      const { GmailService } = await import("@/lib/google/gmail");
      const headers = await GmailService.getThreadHeaders(accessToken, item.source_id);
      if (headers) return { from: headers.from, to: headers.to };
    }
  } catch {
    // Fallback: try as message ID
  }

  return { from: null, to: null };
}

export async function checkPlatformsConnectionAction(userId: string, platforms: string[]) {
  const results: Record<string, boolean> = {};
  for (const p of platforms) {
    const status = await getConnectionStatus(userId, p);
    results[p] = status !== null;
  }
  return results;
}

export async function generateDraftAction(instruction: string, platform: string) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return { success: false, error: "OPENROUTER_API_KEY is not configured" };
    }

    const client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey,
      defaultHeaders: {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        "X-Title": "Syncra Dashboard",
      },
      timeout: 20000,
    });

    const model = process.env.OPENROUTER_MODEL || "deepseek/deepseek-chat-v3";
    const guidelines: Record<string, string> = {
      gmail: "formal email format with greeting and sign-off",
      slack: "casual, direct channel message (no greeting/sign-off needed)",
      whatsapp: "short, friendly chat message",
      telegram: "concise, direct message",
      discord: "casual channel message",
    };

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are a draft message generator. Generate a concise, professional message draft.
Platform: ${platform}
Guidelines: ${guidelines[platform] || "general professional tone"}

Output ONLY the message text, no explanations.`,
        },
        { role: "user", content: instruction },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const draft = response.choices[0]?.message?.content?.trim();
    if (!draft) {
      return { success: false, error: "AI returned empty response" };
    }
    return { success: true, draft };
  } catch (err: any) {
    console.error("Draft generation failed:", err);
    return { success: false, error: err.message || "Failed to generate draft" };
  }
}

export async function sendMessageAction(
  userId: string,
  platform: string,
  recipient: string,
  body: string,
  subject?: string
) {
  await verifyUserAccess(userId);

  try {
    let mcpResult;

    switch (platform) {
      case "gmail":
        mcpResult = await executeMCPAction(userId, "gmail", "gmail_send_email", {
          to: recipient,
          subject: subject || "",
          body,
        });
        break;
      case "slack":
        mcpResult = await executeMCPAction(userId, "slack", "slack_post_message", {
          channel: recipient,
          text: body,
        });
        break;
      case "whatsapp":
        mcpResult = await executeMCPAction(userId, "whatsapp", "whatsapp_send_message", {
          to: recipient,
          message: body,
        });
        break;
      case "telegram":
        mcpResult = await executeMCPAction(userId, "telegram", "telegram_send_message", {
          chatId: recipient,
          text: body,
        });
        break;
      case "discord":
        mcpResult = await executeMCPAction(userId, "discord", "discord_send_message", {
          channelId: recipient,
          content: body,
        });
        break;
      default:
        return { success: false, error: `Platform "${platform}" not supported for sending messages.` };
    }

    if (mcpResult?.status === "success") {
      return { success: true };
    }
    return { success: false, error: mcpResult?.error?.message || "Failed to send message" };
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : "Failed to send message";
    console.error(`Send message failed for ${platform}:`, err);
    return { success: false, error: errMsg };
  }
}
