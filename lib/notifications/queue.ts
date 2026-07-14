import { createAdminClient } from "@insforge/sdk";
import { notificationProviderRegistry } from "./provider-registry";
import { notificationLogger } from "./logger";

function createAdminDb() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Missing InsForge configuration: NEXT_PUBLIC_INSFORGE_BASE_URL and INSFORGE_API_KEY must be set.");
  }
  return createAdminClient({ baseUrl, apiKey });
}

const RETRY_DELAYS = [5_000, 30_000, 300_000];

interface QueuedNotification {
  id: string;
  userId: string;
  type: string;
  provider: string;
  title?: string;
  body: string;
  metadata?: Record<string, unknown>;
  status: string;
  retryCount: number;
  retryAt?: string | null;
  createdAt: string;
}

interface FormattedNotification {
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

interface TemplateContext {
  userId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "\u0026")
    .replace(/</g, "\u003C")
    .replace(/>/g, "\u003E")
    .replace(/"/g, "\u0022");
}

function renderDailyBrief(ctx: TemplateContext): FormattedNotification {
  const { summary, priorities, date } = ctx.data as {
    summary?: string;
    priorities?: Array<{ title: string; description?: string }>;
    date?: string;
  };
  const items = priorities?.slice(0, 5).map((p) => `\u2022 <b>${escapeHtml(p.title)}</b>${p.description ? `: ${escapeHtml(p.description)}` : ""}`).join("\n") || "No priorities for today.";
  return {
    title: "\uD83D\uDCCB Daily AI Brief",
    body: [`<b>${escapeHtml(date || new Date().toLocaleDateString())}</b>`, "", summary ? `${escapeHtml(summary)}` : "Here's your AI-generated summary for today.", "", "<b>Top Priorities:</b>", items].join("\n"),
    metadata: { type: "daily_ai_brief" },
  };
}

function renderBriefingGenerated(ctx: TemplateContext): FormattedNotification {
  const { title, executiveSummary, priorityScore, totalImportantItems } = ctx.data as {
    title?: string;
    executiveSummary?: string;
    priorityScore?: number;
    totalImportantItems?: number;
  };
  return {
    title: `📋 ${title || "AI Briefing Available"}`,
    body: [
      `<b>${escapeHtml(title || "Syncra Briefing")}</b>`,
      `Priority Score: <b>${priorityScore || 0}/100</b>`,
      `Important Items: <b>${totalImportantItems || 0}</b>`,
      "",
      executiveSummary ? `${escapeHtml(executiveSummary)}` : "A new AI-generated briefing is ready.",
      "",
      `🔗 <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/briefing">View on Dashboard</a>`
    ].join("\n"),
    metadata: { type: "briefing_generated" },
  };
}

function renderPriorityItems(ctx: TemplateContext): FormattedNotification {
  const { items, title } = ctx.data as { items?: Array<{ title: string; description?: string; dueDate?: string }>; title?: string };
  const list = items?.slice(0, 5).map((item) => {
    const due = item.dueDate ? ` <i>(${escapeHtml(item.dueDate)})</i>` : "";
    return `\u2022 <b>${escapeHtml(item.title)}</b>${item.description ? `: ${escapeHtml(item.description)}` : ""}${due}`;
  }).join("\n") || "No priority items.";
  return {
    title: "\u2B50 Priority Items",
    body: [title ? `<b>${escapeHtml(title)}</b>` : "Your top priorities:", "", list].join("\n"),
    metadata: { type: "priority_items" },
  };
}

function renderMeetingReminder(ctx: TemplateContext): FormattedNotification {
  const { meetingTitle, startTime, attendees, location, meetingUrl } = ctx.data as {
    meetingTitle: string;
    startTime: string;
    attendees?: string[];
    location?: string;
    meetingUrl?: string;
  };
  const attendeeList = attendees?.slice(0, 5).map((a) => `\u2022 ${escapeHtml(a)}`).join("\n") || "";
  const loc = location ? `\n\uD83D\uDCCD ${escapeHtml(location)}` : "";
  const url = meetingUrl ? `\n\uD83D\uDD17 <a href="${escapeHtml(meetingUrl)}">Join Meeting</a>` : "";
  return {
    title: "\uD83D\uDCC5 Meeting Reminder",
    body: [`<b>${escapeHtml(meetingTitle)}</b>`, `\u23F0 ${escapeHtml(startTime)}${loc}${url}`, attendeeList ? `\n<b>Attendees:</b>\n${attendeeList}` : ""].join("\n"),
    metadata: { type: "meeting_reminders" },
  };
}

function renderEmailAlert(ctx: TemplateContext): FormattedNotification {
  const { from, subject, snippet, receivedAt, emailId } = ctx.data as {
    from: string;
    subject: string;
    snippet: string;
    receivedAt: string;
    emailId?: string;
  };
  return {
    title: "\uD83D\uDCE7 Important Email",
    body: [`<b>${escapeHtml(subject)}</b>`, `From: ${escapeHtml(from)}`, `\uD83D\uDCC5 ${escapeHtml(receivedAt)}`, "", escapeHtml(snippet).substring(0, 500)].join("\n"),
    metadata: { type: "important_emails", emailId },
  };
}

function renderFollowUp(ctx: TemplateContext): FormattedNotification {
  const { taskTitle, description, dueDate, assignee } = ctx.data as {
    taskTitle: string;
    description?: string;
    dueDate?: string;
    assignee?: string;
  };
  const due = dueDate ? `\n\u23F0 Due: ${escapeHtml(dueDate)}` : "";
  const assigned = assignee ? `\n\uD83D\uDC64 ${escapeHtml(assignee)}` : "";
  return {
    title: "\uD83D\uDD04 Follow-up Reminder",
    body: [`<b>${escapeHtml(taskTitle)}</b>${due}${assigned}`, description ? `\n${escapeHtml(description)}` : ""].join("\n"),
    metadata: { type: "follow_ups" },
  };
}

function renderIntegrationAlert(ctx: TemplateContext): FormattedNotification {
  const { provider, status, message, connectedAt } = ctx.data as {
    provider: string;
    status: "connected" | "disconnected" | "error";
    message?: string;
    connectedAt?: string;
  };
  const icons = { connected: "\u2705", disconnected: "\u26A0\uFE0F", error: "\u274C" };
  return {
    title: `${icons[status]} ${provider.charAt(0).toUpperCase() + provider.slice(1)} ${status.charAt(0).toUpperCase() + status.slice(1)}`,
    body: [`Provider: <b>${escapeHtml(provider)}</b>`, `Status: <b>${status}</b>`, connectedAt ? `Time: ${escapeHtml(connectedAt)}` : "", message ? `\n${escapeHtml(message)}` : ""].filter(Boolean).join("\n"),
    metadata: { type: "integration_alert" },
  };
}

function renderSystemNotification(ctx: TemplateContext): FormattedNotification {
  const { title: customTitle, body, severity } = ctx.data as { title?: string; body: string; severity?: "info" | "warning" | "error" };
  const icons = { info: "\u2139\uFE0F", warning: "\u26A0\uFE0F", error: "\u274C" };
  const icon = icons[severity || "info"];
  return {
    title: `${icon} ${customTitle || "System Notification"}`,
    body: escapeHtml(body),
    metadata: { type: "system_notifications", severity },
  };
}

export class NotificationQueue {
  async enqueue(notification: {
    userId: string;
    type: string;
    title?: string;
    body: string;
    provider?: string;
    metadata?: Record<string, unknown>;
    sourceEvent?: string;
    template?: string;
    priority?: "high" | "normal" | "low";
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const admin = createAdminDb();
      const { NotificationHistoryRepository } = await import("@/lib/repositories/notification-history-repository");
      const prefsRepoModule = await import("@/lib/repositories/notification-preferences-repository");

      const history = new NotificationHistoryRepository(admin);
      const prefs = new prefsRepoModule.NotificationPreferencesRepository(admin);

      const pref = await prefs.findByType(notification.userId, notification.type as any);
      if (pref && !pref.enabled) {
        return { success: false, error: "Notification type disabled by user" };
      }

      const log = await history.insert({
        user_id: notification.userId,
        notification_type: notification.type,
        provider: notification.provider || "telegram",
        title: notification.title,
        message: notification.body,
        status: "queued",
        metadata: notification.metadata,
        source_event: notification.sourceEvent,
        template: notification.template,
      });

      if (log.id) {
        notificationLogger.info({ id: log.id, type: notification.type, userId: notification.userId }, "Notification enqueued");
      }
      return { success: true, id: log.id };
    } catch (error) {
      notificationLogger.error({ err: error }, "Failed to enqueue notification");
      return { success: false, error: error instanceof Error ? error.message : "Enqueue failed" };
    }
  }

  async process(id: string): Promise<{ success: boolean; error?: string }> {
    const admin = createAdminDb();
    const { NotificationHistoryRepository } = await import("@/lib/repositories/notification-history-repository");
    const { TelegramRepository } = await import("@/lib/repositories/telegram-repository");

    const history = new NotificationHistoryRepository(admin);
    const telegram = new TelegramRepository(admin);

    try {
      const records = await history.findByUserId("", 1);
      const record = records.find((r) => r.id === id) as QueuedNotification | undefined;
      if (!record) return { success: false, error: "Record not found" };

      if (record.status !== "queued" && record.status !== "retrying") {
        return { success: false, error: `Invalid status: ${record.status}` };
      }

      await history.updateStatus(id, "processing");

      const provider = notificationProviderRegistry.get(record.provider);
      if (!provider) {
        await history.updateStatus(id, "failed", `Provider ${record.provider} not found`);
        return { success: false, error: `Provider not found: ${record.provider}` };
      }

      let recipientId: string | null = null;
      if (record.provider === "telegram") {
        const conn = await telegram.getActive(record.userId);
        recipientId = conn?.chat_id || null;
      }
      if (!recipientId) {
        await history.updateStatus(id, "failed", `No ${record.provider} connection for user`);
        return { success: false, error: "No provider connection" };
      }

      const formatted = this.formatNotification(record);
      const result = await provider.send(recipientId, formatted);

      if (result.success) {
        await history.updateStatus(id, "sent", undefined, result.providerResponse as Record<string, unknown>);
        notificationLogger.info({ id, provider: record.provider }, "Notification sent");
        return { success: true };
      } else {
        return this.handleFailure(id, record, result.error || "Provider send failed");
      }
    } catch (error) {
      notificationLogger.error({ err: error, id }, "Queue processing error");
      return { success: false, error: error instanceof Error ? error.message : "Processing failed" };
    }
  }

  async processDue(): Promise<number> {
    const admin = createAdminDb();
    const { NotificationHistoryRepository } = await import("@/lib/repositories/notification-history-repository");
    const history = new NotificationHistoryRepository(admin);
    const due = await history.findDueForProcessing();
    notificationLogger.info({ count: due.length }, "Processing due notifications");
    
    let processed = 0;
    for (const record of due) {
      if (record.id) {
        await this.process(record.id);
        processed++;
      }
    }
    return processed;
  }

  private formatNotification(record: QueuedNotification): FormattedNotification {
    const context: TemplateContext = {
      userId: record.userId,
      data: record.metadata as Record<string, unknown>,
      timestamp: record.createdAt,
    };

    switch (record.type) {
      case "daily_ai_brief":
        return renderDailyBrief(context);
      case "briefing_generated":
        return renderBriefingGenerated(context);
      case "priority_items":
        return renderPriorityItems(context);
      case "meeting_reminders":
        return renderMeetingReminder(context);
      case "important_emails":
      case "gmail_summaries":
        return renderEmailAlert(context);
      case "follow_ups":
        return renderFollowUp(context);
      case "telegram_alerts":
        return renderIntegrationAlert(context);
      case "system_notifications":
      case "ai_workspace":
      case "dashboard_alerts":
        return renderSystemNotification(context);
      default:
        return { title: record.title || "Notification", body: record.body, metadata: { type: record.type } };
    }
  }

  private async handleFailure(
    id: string,
    record: QueuedNotification,
    error: string
  ): Promise<{ success: boolean; error?: string }> {
    const admin = createAdminDb();
    const { NotificationHistoryRepository } = await import("@/lib/repositories/notification-history-repository");
    const history = new NotificationHistoryRepository(admin);

    const nextRetry = record.retryCount < RETRY_DELAYS.length;
    if (nextRetry) {
      const delay = RETRY_DELAYS[record.retryCount];
      const retryAt = new Date(Date.now() + delay).toISOString();
      await history.incrementRetry(id, record.retryCount + 1, retryAt, error);
      notificationLogger.warn({ id, retryCount: record.retryCount + 1, retryAt }, "Notification queued for retry");
      return { success: false, error: `Retry ${record.retryCount + 1} scheduled` };
    } else {
      await history.updateStatus(id, "failed", error);
      notificationLogger.error({ id }, "Notification failed after all retries");
      return { success: false, error: `Failed after ${RETRY_DELAYS.length} attempts` };
    }
  }
}

export const notificationQueue = new NotificationQueue();