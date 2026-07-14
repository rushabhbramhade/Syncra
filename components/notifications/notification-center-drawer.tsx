"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  X,
  Loader2,
  CheckCircle2,
  Archive,
  Trash2,
  MessageCircle,
  Sparkles,
  Star,
  Mail,
  Calendar,
  Repeat,
  AlertTriangle,
  Bot,
  LayoutDashboard,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  daily_ai_brief: <Sparkles className="w-4 h-4" />,
  priority_items: <Star className="w-4 h-4" />,
  important_emails: <Mail className="w-4 h-4" />,
  meeting_reminders: <Calendar className="w-4 h-4" />,
  follow_ups: <Repeat className="w-4 h-4" />,
  telegram_alerts: <AlertTriangle className="w-4 h-4" />,
  ai_workspace: <Bot className="w-4 h-4" />,
  dashboard_alerts: <LayoutDashboard className="w-4 h-4" />,
  system_notifications: <Settings2 className="w-4 h-4" />,
};

interface NotificationItem {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  provider: string;
  status: string;
  created_at: string;
}

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatTime(dateStr: string): string {
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
    return "";
  }
}

export function NotificationCenterDrawer({ isOpen, onClose }: DrawerProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { getNotificationsAction } = await import("@/app/actions/notification-center");
      const result = await getNotificationsAction(user.id, { limit: 20, status: "unread" });
      if (result.success) setNotifications(result.notifications as NotificationItem[] || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  const handleMarkRead = async (ids: string[]) => {
    if (!user?.id) return;
    try {
      const { markAsReadAction } = await import("@/app/actions/notification-center");
      await markAsReadAction(user.id, ids);
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
    } catch {}
  };

  const handleArchive = async (ids: string[]) => {
    if (!user?.id) return;
    try {
      const { markAsArchivedAction } = await import("@/app/actions/notification-center");
      await markAsArchivedAction(user.id, ids);
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-950/20 dark:bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-[#0B1120] border-l border-slate-200 dark:border-slate-800 shadow-2xl animate-in slide-in-from-right duration-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="font-semibold text-[15px] text-slate-900 dark:text-slate-100">
              Notifications
            </span>
            {notifications.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-full">
                {notifications.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 dark:bg-slate-900/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Bell className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-[13px] font-medium text-slate-500 dark:text-slate-400">
                No new notifications
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "flex items-start gap-3 px-5 py-4 transition-colors",
                    "hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  )}
                >
                  <div className={cn(
                    "p-1.5 rounded-lg shrink-0 mt-0.5",
                    "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                  )}>
                    {TYPE_ICONS[notification.notification_type] || <Bell className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {notification.title}
                    </p>
                    <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                      {formatTime(notification.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => handleMarkRead([notification.id])}
                      className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      title="Mark as read"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleArchive([notification.id])}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Archive"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {notifications.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800/80 flex gap-2">
            <button
              onClick={() => handleMarkRead(notifications.map((n) => n.id))}
              className="flex-1 h-9 text-[12px] font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
            >
              Mark All Read
            </button>
            <a
              href="/dashboard/notifications"
              className="flex-1 h-9 text-[12px] font-semibold rounded-lg bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center transition-all"
              onClick={onClose}
            >
              View All
            </a>
          </div>
        )}
      </div>
    </div>
  );
}