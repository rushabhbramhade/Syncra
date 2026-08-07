import { createAdminClient } from "@insforge/sdk";
import { TelegramRepository } from "@/lib/repositories/telegram-repository";
import { NotificationPreferencesRepository, NotificationType } from "@/lib/repositories/notification-preferences-repository";
import { NotificationHistoryRepository } from "@/lib/repositories/notification-history-repository";
import { NotificationCenterRepository } from "@/lib/repositories/notification-center-repository";
import { notificationProviderRegistry } from "@/lib/notifications/provider-registry";
import { notificationLogger } from "@/lib/notifications/logger";

function getAdmin() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Missing InsForge configuration: NEXT_PUBLIC_INSFORGE_BASE_URL and INSFORGE_API_KEY must be set.");
  }
  return createAdminClient({ baseUrl, apiKey });
}

function getRepos() {
  const admin = getAdmin();
  return {
    telegram: new TelegramRepository(admin),
    preferences: new NotificationPreferencesRepository(admin),
    history: new NotificationHistoryRepository(admin),
    center: new NotificationCenterRepository(admin),
  };
}

export interface SendNotificationParams {
  userId: string;
  type: string;
  title: string;
  body: string;
  provider?: string;
  metadata?: Record<string, unknown>;
  sourceEvent?: string;
  template?: string;
}

export class NotificationService {
  private static instance: NotificationService;
  private initialized = false;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    notificationLogger.info("NotificationService initialized");
  }

  getAvailableProviders(): string[] {
    return notificationProviderRegistry.list().map((p) => p.id);
  }

  getProvider(id: string) {
    return notificationProviderRegistry.get(id);
  }

  async send(params: SendNotificationParams): Promise<{ success: boolean; error?: string }> {
    const repos = getRepos();
    const providerId = params.provider || "telegram";
    const provider = notificationProviderRegistry.get(providerId);

    if (!provider) {
      return { success: false, error: `Provider "${providerId}" not available` };
    }

    const pref = await repos.preferences.findByType(params.userId, params.type as NotificationType);
    if (pref && !pref.enabled) {
      return { success: false, error: "Notification type is disabled" };
    }

    const log = await repos.history.insert({
      user_id: params.userId,
      notification_type: params.type,
      provider: providerId,
      title: params.title,
      message: params.body,
      status: "queued",
      metadata: params.metadata,
      source_event: params.sourceEvent,
      template: params.template,
    });

    await repos.center.insert({
      user_id: params.userId,
      notification_type: params.type,
      title: params.title,
      body: params.body,
      provider: providerId,
      external_history_id: log.id,
    });

    const result = await provider.send(params.userId, { title: params.title, body: params.body, metadata: { ...params.metadata, type: params.type } });

    if (log.id) {
      await repos.history.updateStatus(log.id, result.success ? "sent" : "failed", result.error, result.providerResponse as Record<string, unknown>);
    }

    return result;
  }

  async sendTest(userId: string): Promise<{ success: boolean; error?: string }> {
    return this.send({
      userId,
      type: "system_notifications",
      title: "Test Notification",
      body: "✅ Your Telegram notifications are working! This is a test message from Syncra.",
      provider: "telegram",
    });
  }

  static sendTest(userId: string): Promise<{ success: boolean; error?: string }> {
    return getNotificationService().sendTest(userId);
  }
}

let _instance: NotificationService | null = null;
export function getNotificationService(): NotificationService {
  if (!_instance) {
    _instance = new NotificationService();
  }
  return _instance;
}

export async function notify(
  userId: string,
  notificationType: string,
  title: string,
  body: string,
  provider: string = "telegram"
): Promise<{ success: boolean; error?: string }> {
  return getNotificationService().send({ userId, type: notificationType, title, body, provider });
}

export async function sendTest(userId: string): Promise<{ success: boolean; error?: string }> {
  return getNotificationService().sendTest(userId);
}