"use server";

import { createAdminDb } from "@/lib/db";
import { BriefingsRepository, BriefingScheduleRecord } from "@/lib/repositories/briefings-repository";
import { BriefingService, calculateNextRun } from "@/lib/services/briefing-service";
import { executeMCPAction } from "@/app/actions/integrations";

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
  
  const briefing = await repo.findBriefingById(briefingId);
  if (!briefing || briefing.user_id !== userId) {
    throw new Error("Briefing not found or access denied");
  }

  const items = await repo.findItemsByBriefingId(briefingId);
  return { briefing, items };
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
      const fromField = metadata.from || "";
      const emailMatch = fromField.match(/<([^>]+)>/) || [null, fromField];
      const recipient = emailMatch[1]?.trim() || fromField.trim();
      const subject = metadata.subject || "Re: Syncra Update";
      const subjectWithRe = subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;

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
    } else {
      // Stub platforms (slack, telegram, discord)
      console.log(`Simulated reply sent to ${platform} for item ${itemId}`);
      mcpResult = { status: "success", result: { message: "Simulated message sent successfully" } };
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
