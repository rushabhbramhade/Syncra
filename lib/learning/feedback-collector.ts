"use server";

import { createAdminDb } from "@/lib/db";

export interface FeedbackSignal {
  userId: string;
  eventId: string;
  action: 'dismiss' | 'open' | 'reply' | 'snooze' | 'complete' | 'override_priority' | 'mark_not_important' | 'mark_critical' | 'dont_show_again';
  previousPriority?: string;
  newPriority?: string;
  timestamp: string;
}

export async function recordFeedback(signal: Omit<FeedbackSignal, 'timestamp'>): Promise<void> {
  const entry: FeedbackSignal = { ...signal, timestamp: new Date().toISOString() };
  try {
    const db = createAdminDb();
    await db.database.from("user_feedback").insert(entry);
  } catch {
    console.log("[FeedbackCollector]", entry);
  }
}
