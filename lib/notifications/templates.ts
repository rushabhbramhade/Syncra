function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "\x26amp;")
    .replace(/</g, "\x26lt;")
    .replace(/>/g, "\x26gt;")
    .replace(/"/g, "\x26quot;");
}

export function renderDailyBrief(ctx: TemplateContext): string {
  const { summary, priorities, date } = ctx.data as {
    summary?: string;
    priorities?: Array<{ title: string; description?: string }>;
    date?: string;
  };
  const items = priorities?.slice(0, 5).map((p) => `\u2022 <b>${escapeHtml(p.title)}</b>${p.description ? `: ${escapeHtml(p.description)}` : ""}`).join("\n") || "No priorities for today.";
  return [
    `<b>${escapeHtml(date || new Date().toLocaleDateString())}</b>`,
    "",
    summary ? `${escapeHtml(summary)}` : "Here's your AI-generated summary for today.",
    "",
    "<b>Top Priorities:</b>",
    items,
  ].join("\n");
}

export function renderPriorityItems(ctx: TemplateContext): string {
  const { items, title } = ctx.data as { items?: Array<{ title: string; description?: string; dueDate?: string }>; title?: string };
  const list = items?.slice(0, 5).map((item) => {
    const due = item.dueDate ? ` <i>(${escapeHtml(item.dueDate)})</i>` : "";
    return `\u2022 <b>${escapeHtml(item.title)}</b>${item.description ? `: ${escapeHtml(item.description)}` : ""}${due}`;
  }).join("\n") || "No priority items.";
  return [
    title ? `<b>${escapeHtml(title)}</b>` : "Your top priorities:",
    "",
    list,
  ].join("\n");
}

export function renderMeetingReminder(ctx: TemplateContext): string {
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
  return [
    `<b>${escapeHtml(meetingTitle)}</b>`,
    `\u23F0 ${escapeHtml(startTime)}${loc}${url}`,
    attendeeList ? `\n<b>Attendees:</b>\n${attendeeList}` : "",
  ].join("\n");
}

export function renderEmailAlert(ctx: TemplateContext): string {
  const { from, subject, snippet, receivedAt, emailId } = ctx.data as {
    from: string;
    subject: string;
    snippet: string;
    receivedAt: string;
    emailId?: string;
  };
  return [
    `<b>${escapeHtml(subject)}</b>`,
    `From: ${escapeHtml(from)}`,
    `\uD83D\uDCC5 ${escapeHtml(receivedAt)}`,
    "",
    escapeHtml(snippet).substring(0, 500),
  ].join("\n");
}

export function renderFollowUp(ctx: TemplateContext): string {
  const { taskTitle, description, dueDate, assignee } = ctx.data as {
    taskTitle: string;
    description?: string;
    dueDate?: string;
    assignee?: string;
  };
  const due = dueDate ? `\n\u23F0 Due: ${escapeHtml(dueDate)}` : "";
  const assigned = assignee ? `\n\uD83D\uDC64 ${escapeHtml(assignee)}` : "";
  return [
    `<b>${escapeHtml(taskTitle)}</b>${due}${assigned}`,
    description ? `\n${escapeHtml(description)}` : "",
  ].join("\n");
}

export function renderIntegrationAlert(ctx: TemplateContext): string {
  const { provider, status, message, connectedAt } = ctx.data as {
    provider: string;
    status: "connected" | "disconnected" | "error";
    message?: string;
    connectedAt?: string;
  };
  const icons = { connected: "\u2705", disconnected: "\u26A0\uFE0F", error: "\u274C" };
  return [
    `Provider: <b>${escapeHtml(provider)}</b>`,
    `Status: <b>${status}</b>`,
    connectedAt ? `Time: ${escapeHtml(connectedAt)}` : "",
    message ? `\n${escapeHtml(message)}` : "",
  ].filter(Boolean).join("\n");
}

export function renderSystemNotification(ctx: TemplateContext): string {
  const { title: customTitle, body, severity } = ctx.data as { title?: string; body: string; severity?: "info" | "warning" | "error" };
  const icons = { info: "\u2139\uFE0F", warning: "\u26A0\uFE0F", error: "\u274C" };
  const icon = icons[severity || "info"];
  return `${icon} ${customTitle || "System Notification"}\n${escapeHtml(body)}`;
}

export interface TemplateContext {
  userId: string;
  data: Record<string, unknown>;
  timestamp: string;
}