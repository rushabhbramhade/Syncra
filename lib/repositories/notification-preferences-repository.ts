export type NotificationType =
  | "daily_ai_brief"
  | "priority_items"
  | "important_emails"
  | "gmail_summaries"
  | "meeting_reminders"
  | "follow_ups"
  | "telegram_alerts"
  | "ai_workspace"
  | "dashboard_alerts"
  | "system_notifications";

export type NotificationSchedule =
  | "instant"
  | "every_15_min"
  | "hourly"
  | "morning_brief"
  | "evening_brief"
  | "daily"
  | "weekly";

export interface NotificationPreference {
  id?: string;
  user_id: string;
  notification_type: NotificationType;
  enabled: boolean;
  schedule: NotificationSchedule;
  timezone: string;
  created_at?: string;
  updated_at?: string;
}

export const NOTIFICATION_TYPES: NotificationType[] = [
  "daily_ai_brief",
  "priority_items",
  "important_emails",
  "gmail_summaries",
  "meeting_reminders",
  "follow_ups",
  "telegram_alerts",
  "ai_workspace",
  "dashboard_alerts",
  "system_notifications",
];

export const NOTIFICATION_SCHEDULES: { value: NotificationSchedule; label: string }[] = [
  { value: "instant", label: "Instant" },
  { value: "every_15_min", label: "Every 15 Minutes" },
  { value: "hourly", label: "Hourly Digest" },
  { value: "morning_brief", label: "Morning Brief" },
  { value: "evening_brief", label: "Evening Brief" },
  { value: "daily", label: "Daily Summary" },
  { value: "weekly", label: "Weekly Summary" },
];

export class NotificationPreferencesRepository {
  constructor(private db: { database: { from(table: string): any } }) {}

  async findByUserId(userId: string): Promise<NotificationPreference[]> {
    const { data, error } = await this.db.database
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId);
    if (error || !data) return [];
    return data as NotificationPreference[];
  }

  async findByType(userId: string, type: NotificationType): Promise<NotificationPreference | null> {
    const { data, error } = await this.db.database
      .from("notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .eq("notification_type", type)
      .maybeSingle();
    if (error || !data) return null;
    return data as NotificationPreference;
  }

  async upsert(
    userId: string,
    type: NotificationType,
    updates: { enabled?: boolean; schedule?: NotificationSchedule; timezone?: string }
  ): Promise<{ success: boolean }> {
    const existing = await this.findByType(userId, type);

    if (existing) {
      const { error } = await this.db.database
        .from("notification_preferences")
        .update({
          enabled: updates.enabled ?? existing.enabled,
          schedule: updates.schedule ?? existing.schedule,
          timezone: updates.timezone ?? existing.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (error) throw new Error(`Failed to update notification preference: ${error.message}`);
      return { success: true };
    }

    const { error } = await this.db.database
      .from("notification_preferences")
      .insert({
        user_id: userId,
        notification_type: type,
        enabled: updates.enabled ?? true,
        schedule: updates.schedule ?? "instant",
        timezone: updates.timezone ?? "UTC",
      });
    if (error) throw new Error(`Failed to create notification preference: ${error.message}`);
    return { success: true };
  }

  async toggle(userId: string, type: NotificationType): Promise<{ success: boolean; enabled: boolean }> {
    const existing = await this.findByType(userId, type);
    const newEnabled = existing ? !existing.enabled : false;
    await this.upsert(userId, type, { enabled: newEnabled });
    return { success: true, enabled: newEnabled };
  }

  async findUsersWithEnabledType(type: NotificationType): Promise<string[]> {
    const { data, error } = await this.db.database
      .from("notification_preferences")
      .select("user_id")
      .eq("notification_type", type)
      .eq("enabled", true);
    if (error || !data) return [];
    const userIds: string[] = data.map((r: { user_id: string }) => r.user_id);
    return [...new Set(userIds)];
  }

  async bulkInit(userId: string): Promise<void> {
    const existing = await this.findByUserId(userId);
    const existingTypes = new Set(existing.map((p) => p.notification_type));

    for (const type of NOTIFICATION_TYPES) {
      if (!existingTypes.has(type)) {
        await this.upsert(userId, type, { enabled: true });
      }
    }
  }
}
