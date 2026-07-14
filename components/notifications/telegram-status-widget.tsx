"use client";

import { MessageCircle, CheckCircle2, XCircle, Clock, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface TelegramStatusWidgetProps {
  connected: boolean;
  lastNotificationSent?: string | null;
  nextScheduled?: string | null;
  notificationCount?: number;
  failedCount?: number;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export function TelegramStatusWidget({
  connected,
  lastNotificationSent,
  nextScheduled,
  notificationCount = 0,
  failedCount = 0,
}: TelegramStatusWidgetProps) {
  return (
    <div className="bg-surface-white neo-border rounded-[24px] neo-shadow-md p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn(
          "p-2.5 rounded-xl",
          connected
            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
            : "bg-slate-100 dark:bg-slate-800 text-slate-400"
        )}>
          <MessageCircle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-[14px] text-slate-900 dark:text-slate-100">Telegram</h3>
          <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
            {connected ? "Notifications Active" : "Not Connected"}
          </p>
        </div>
        <div className="ml-auto">
          {connected ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <XCircle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Last Notification</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold">
            {formatDate(lastNotificationSent)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Next Scheduled</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold">
            {nextScheduled || "—"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Notifications Sent</span>
          <span className="text-slate-800 dark:text-slate-200 font-semibold">
            {notificationCount}
            {failedCount > 0 && (
              <span className="text-red-500 ml-1">({failedCount} failed)</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
