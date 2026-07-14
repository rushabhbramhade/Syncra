import { NotificationEvent, NotificationEventType, publishNotificationEvent } from "./events";
import { notificationQueue } from "./queue";
import { notificationLogger } from "./logger";
import { eventLogger } from "./logger";

class NotificationEventHandler {
  private unsubscribers: (() => void)[] = [];

  async initialize(): Promise<void> {
    this.unsubscribers.push(
      publishNotificationEvent.subscribe("daily_brief_generated", this.handleDailyBrief.bind(this)),
      publishNotificationEvent.subscribe("briefing_generated", this.handleBriefingGenerated.bind(this)),
      publishNotificationEvent.subscribe("priority_items_generated", this.handlePriorityItems.bind(this)),
      publishNotificationEvent.subscribe("important_email_detected", this.handleImportantEmail.bind(this)),
      publishNotificationEvent.subscribe("meeting_reminder", this.handleMeetingReminder.bind(this)),
      publishNotificationEvent.subscribe("follow_up_reminder", this.handleFollowUp.bind(this)),
      publishNotificationEvent.subscribe("integration_connected", this.handleIntegrationConnected.bind(this)),
      publishNotificationEvent.subscribe("integration_disconnected", this.handleIntegrationDisconnected.bind(this)),
      publishNotificationEvent.subscribe("ai_workspace_alert", this.handleAIWorkspaceAlert.bind(this)),
      publishNotificationEvent.subscribe("system_notification", this.handleSystemNotification.bind(this))
    );

    notificationLogger.info("Notification event handlers initialized");
  }

  private async enqueueFromEvent(event: NotificationEvent, type: string, title: string, templateData: Record<string, unknown>): Promise<void> {
    const result = await notificationQueue.enqueue({
      userId: event.userId,
      type,
      title,
      body: JSON.stringify(templateData),
      provider: "telegram",
      metadata: { ...event.data, eventType: type },
      sourceEvent: type,
      template: type,
    });
    if (!result.success) {
      eventLogger.error({ eventId: event.idempotencyKey, error: result.error }, "Failed to enqueue from event");
    }
  }

  private async handleDailyBrief(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "daily_ai_brief", "Daily AI Brief", event.data);
  }

  private async handleBriefingGenerated(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "briefing_generated", event.data.title as string || "Workspace AI Briefing", event.data);
  }

  private async handlePriorityItems(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "priority_items", "Priority Items", event.data);
  }

  private async handleImportantEmail(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "important_emails", "Important Email", event.data);
  }

  private async handleMeetingReminder(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "meeting_reminders", "Meeting Reminder", event.data);
  }

  private async handleFollowUp(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "follow_ups", "Follow-up Reminder", event.data);
  }

  private async handleIntegrationConnected(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "telegram_alerts", "Integration Connected", { ...event.data, status: "connected" });
  }

  private async handleIntegrationDisconnected(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "telegram_alerts", "Integration Disconnected", { ...event.data, status: "disconnected" });
  }

  private async handleAIWorkspaceAlert(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "ai_workspace", "AI Workspace Alert", event.data);
  }

  private async handleSystemNotification(event: NotificationEvent): Promise<void> {
    await this.enqueueFromEvent(event, "system_notifications", "System Notification", event.data);
  }
}

export const notificationEventHandler = new NotificationEventHandler();