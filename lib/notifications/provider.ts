export interface FormattedNotification {
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationProvider {
  id: string;
  name: string;
  send(recipientId: string, notification: FormattedNotification): Promise<{ success: boolean; error?: string; providerResponse?: unknown }>;
}