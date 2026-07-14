export interface NotificationEvent {
  userId: string;
  data: Record<string, unknown>;
  timestamp: string;
  idempotencyKey?: string;
}

export type NotificationEventType =
  | "daily_brief_generated"
  | "briefing_generated"
  | "priority_items_generated"
  | "important_email_detected"
  | "meeting_reminder"
  | "follow_up_reminder"
  | "integration_connected"
  | "integration_disconnected"
  | "ai_workspace_alert"
  | "system_notification";

interface EventSubscription {
  type: NotificationEventType;
  handler: (event: NotificationEvent) => Promise<void>;
}

class EventEmitter {
  private subscriptions = new Map<NotificationEventType, EventSubscription[]>();

  subscribe(type: NotificationEventType, handler: (event: NotificationEvent) => Promise<void>): () => void {
    const subs = this.subscriptions.get(type) || [];
    const sub: EventSubscription = { type, handler };
    subs.push(sub);
    this.subscriptions.set(type, subs);
    return () => this.unsubscribe(type, handler);
  }

  unsubscribe(type: NotificationEventType, handler: (event: NotificationEvent) => Promise<void>): void {
    const subs = this.subscriptions.get(type) || [];
    const index = subs.findIndex((s) => s.handler === handler);
    if (index > -1) subs.splice(index, 1);
  }

  async publish(type: NotificationEventType, event: NotificationEvent): Promise<void> {
    const subs = this.subscriptions.get(type) || [];
    await Promise.all(
      subs.map((s) =>
        s.handler(event).catch((err) => {
          console.error(`Event handler error for ${type}:`, err);
        })
      )
    );
  }
}

export const publishNotificationEvent = new EventEmitter();

export async function publishEvent(type: NotificationEventType, userId: string, data: Record<string, unknown>, idempotencyKey?: string): Promise<void> {
  await publishNotificationEvent.publish(type, { userId, data, timestamp: new Date().toISOString(), idempotencyKey });
}