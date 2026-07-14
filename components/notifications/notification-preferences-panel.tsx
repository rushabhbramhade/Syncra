"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Sparkles,
  Star,
  Mail,
  MessageSquare,
  Calendar,
  Repeat,
  AlertTriangle,
  Bot,
  LayoutDashboard,
  Settings2,
  Loader2,
  Clock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { NOTIFICATION_SCHEDULES } from "@/lib/repositories/notification-preferences-repository";
import type { NotificationType, NotificationSchedule, NotificationPreference } from "@/lib/repositories/notification-preferences-repository";

interface PrefPanelProps {
  preferences: NotificationPreference[];
  onToggle: (type: NotificationType, enabled: boolean) => void;
  onScheduleChange: (type: NotificationType, schedule: NotificationSchedule) => void;
  isLoading: boolean;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
}

const NOTIFICATION_CONFIG: { type: NotificationType; label: string; description: string; icon: React.ReactNode }[] = [
  { type: "daily_ai_brief", label: "Daily AI Brief", description: "AI-generated daily summary of your most important items", icon: <Sparkles className="w-4 h-4" /> },
  { type: "priority_items", label: "Priority Items", description: "Notifications about your top priority tasks", icon: <Star className="w-4 h-4" /> },
  { type: "important_emails", label: "Important Emails", description: "Critical email alerts from Gmail", icon: <Mail className="w-4 h-4" /> },
  { type: "gmail_summaries", label: "Gmail Summaries", description: "AI summaries of your Gmail inbox", icon: <MessageSquare className="w-4 h-4" /> },
  { type: "meeting_reminders", label: "Meeting Reminders", description: "Reminders for upcoming meetings", icon: <Calendar className="w-4 h-4" /> },
  { type: "follow_ups", label: "Follow-ups", description: "Follow-up reminders for pending actions", icon: <Repeat className="w-4 h-4" /> },
  { type: "telegram_alerts", label: "Telegram Alerts", description: "General alerts via Telegram", icon: <AlertTriangle className="w-4 h-4" /> },
  { type: "ai_workspace", label: "AI Workspace", description: "AI workspace activity notifications", icon: <Bot className="w-4 h-4" /> },
  { type: "dashboard_alerts", label: "Dashboard Alerts", description: "Alerts from your dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { type: "system_notifications", label: "System Notifications", description: "System updates and maintenance notices", icon: <Settings2 className="w-4 h-4" /> },
];

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function getPref(preferences: NotificationPreference[], type: NotificationType): NotificationPreference | undefined {
  return preferences.find((p) => p.notification_type === type);
}

export function NotificationPreferencesPanel({
  preferences,
  onToggle,
  onScheduleChange,
  isLoading,
  timezone,
  onTimezoneChange,
}: PrefPanelProps) {
  return (
    <div className="space-y-5">
      {/* Schedule & Timezone header */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            Default Schedule
          </label>
          <select
            value={NOTIFICATION_SCHEDULES[0].value}
            onChange={() => {}}
            className="w-full h-10 px-3 text-[13px] font-medium rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-600"
            disabled
          >
            {NOTIFICATION_SCHEDULES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
            Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => onTimezoneChange(e.target.value)}
            className="w-full h-10 px-3 text-[13px] font-medium rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-600"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Notification toggles */}
      <div className="space-y-2">
        {NOTIFICATION_CONFIG.map(({ type, label, description, icon }) => {
          const pref = getPref(preferences, type);
          const enabled = pref?.enabled ?? true;

          return (
            <div
              key={type}
              className={cn(
                "flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-200",
                enabled
                  ? "bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80"
                  : "bg-transparent border-transparent opacity-60"
              )}
            >
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                enabled ? "bg-sky-500/10 text-sky-600 dark:text-sky-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              )}>
                {icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-200">
                    {label}
                  </span>
                  <button
                    onClick={() => onToggle(type, enabled)}
                    role="switch"
                    aria-checked={enabled}
                    className={cn(
                      "w-10 h-[22px] rounded-full p-0.5 flex items-center transition-all duration-200 shrink-0",
                      enabled ? "bg-sky-500 justify-end" : "bg-slate-300 dark:bg-slate-700 justify-start"
                    )}
                  >
                    <span className="w-[18px] h-[18px] bg-white rounded-full shadow-sm transition-transform duration-200" />
                  </button>
                </div>
                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>

                {enabled && (
                  <div className="mt-2">
                    <select
                      value={pref?.schedule || "instant"}
                      onChange={(e) => onScheduleChange(type, e.target.value as NotificationSchedule)}
                      className="h-8 px-2.5 text-[12px] font-medium rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 outline-none"
                    >
                      {NOTIFICATION_SCHEDULES.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
