"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Loader2,
  CheckCircle2,
  Archive,
  Trash2,
  Search,
  Sparkles,
  Star,
  Mail,
  Calendar,
  Repeat,
  AlertTriangle,
  Bot,
  LayoutDashboard,
  Settings2,
  ChevronDown,
  Filter,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { TelegramStatusWidget } from "@/components/notifications/telegram-status-widget";

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
  read_at?: string;
  archived_at?: string;
  created_at: string;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "read" | "archived">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { getNotificationsAction, getUnreadCountAction, getNotificationStatsAction } = await import("@/app/actions/notification-center");
      
      const statusMap: Record<string, "unread" | "read" | "archived" | undefined> = {
        all: undefined,
        unread: "unread",
        read: "read",
        archived: "archived",
      };

      const [notifRes, countRes, statsRes] = await Promise.all([
        getNotificationsAction(user.id, { limit: 100, status: statusMap[filter] }),
        getUnreadCountAction(user.id),
        getNotificationStatsAction(user.id),
      ]);

      if (notifRes.success) setNotifications(notifRes.notifications);
      if (countRes.success) setUnreadCount(countRes.count);
      if (statsRes.success) setStats(statsRes.stats);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [user?.id, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMarkRead = async (ids: string[]) => {
    if (!user?.id) return;
    try {
      const { markAsReadAction } = await import("@/app/actions/notification-center");
      await markAsReadAction(user.id, ids);
      setNotifications((prev) => prev.map((n) => ids.includes(n.id) ? { ...n, status: "read", read_at: new Date().toISOString() } : n));
      setSelectedIds(new Set());
    } catch {}
  };

  const handleArchive = async (ids: string[]) => {
    if (!user?.id) return;
    try {
      const { markAsArchivedAction } = await import("@/app/actions/notification-center");
      await markAsArchivedAction(user.id, ids);
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      setSelectedIds(new Set());
    } catch {}
  };

  const handleDelete = async (ids: string[]) => {
    if (!user?.id) return;
    try {
      const { deleteNotificationsAction } = await import("@/app/actions/notification-center");
      await deleteNotificationsAction(user.id, ids);
      setNotifications((prev) => prev.filter((n) => !ids.includes(n.id)));
      setSelectedIds(new Set());
    } catch {}
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = searchQuery
    ? notifications.filter(
        (n) =>
          n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          n.body.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : notifications;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Notification Center
        </h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          View and manage all your notifications.
          {unreadCount > 0 && (
            <span className="ml-2 text-sky-600 dark:text-sky-400 font-semibold">
              {unreadCount} unread
            </span>
          )}
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notifications..."
            className="w-full h-10 pl-10 pr-4 text-[13px] rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 outline-none focus:border-slate-300 dark:focus:border-slate-600"
          />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl w-fit">
          {(["all", "unread", "read", "archived"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all",
                filter === f
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-700">
          <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-1 ml-auto">
            <button
              onClick={() => handleMarkRead(Array.from(selectedIds))}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200"
            >
              <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
              Mark Read
            </button>
            <button
              onClick={() => handleArchive(Array.from(selectedIds))}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
            >
              <Archive className="w-3.5 h-3.5 inline mr-1" />
              Archive
            </button>
            <button
              onClick={() => handleDelete(Array.from(selectedIds))}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1" />
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
            <div className="text-[22px] font-bold text-emerald-600 dark:text-emerald-400">{stats.sent}</div>
            <div className="text-[11px] font-medium text-emerald-600/70 dark:text-emerald-400/70">Sent</div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
            <div className="text-[22px] font-bold text-amber-600 dark:text-amber-400">{stats.delivered}</div>
            <div className="text-[11px] font-medium text-amber-600/70 dark:text-amber-400/70">Delivered</div>
          </div>
          <div className={cn(
            "rounded-xl p-4 text-center",
            stats.failed > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-50 dark:bg-slate-900/40"
          )}>
            <div className={cn("text-[22px] font-bold", stats.failed > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400")}>
              {stats.failed}
            </div>
            <div className={cn("text-[11px] font-medium", stats.failed > 0 ? "text-red-600/70 dark:text-red-400/70" : "text-slate-400")}>
              Failed
            </div>
          </div>
        </div>
      )}

      {/* Notifications list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-900/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="font-semibold text-[15px] text-slate-700 dark:text-slate-300">
            {searchQuery ? "No matching notifications" : "No notifications yet"}
          </h3>
          <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1">
            {searchQuery ? "Try a different search term." : "Notifications will appear here when you receive them."}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer",
                notification.status === "unread"
                  ? "bg-sky-50/50 dark:bg-sky-900/10 border-sky-100 dark:border-sky-900/30"
                  : "bg-white dark:bg-[#0B1120] border-slate-100 dark:border-slate-800/80"
              )}
              onClick={() => toggleSelect(notification.id)}
            >
              <div className={cn(
                "p-2 rounded-lg shrink-0",
                notification.status === "unread"
                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              )}>
                {TYPE_ICONS[notification.notification_type] || <Bell className="w-4 h-4" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={cn(
                      "text-[13px]",
                      notification.status === "unread"
                        ? "font-bold text-slate-900 dark:text-slate-100"
                        : "font-semibold text-slate-700 dark:text-slate-300"
                    )}>
                      {notification.title}
                    </span>
                    {notification.status === "unread" && (
                      <span className="ml-2 w-2 h-2 bg-sky-500 rounded-full inline-block" />
                    )}
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap">
                    {formatDate(notification.created_at)}
                  </span>
                </div>

                <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {notification.body}
                </p>

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 uppercase">
                    {notification.provider}
                  </span>
                  {notification.status === "read" && notification.read_at && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      Read {formatDate(notification.read_at)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-1 shrink-0 self-center">
                {notification.status === "unread" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMarkRead([notification.id]); }}
                    className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); handleArchive([notification.id]); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Archive className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete([notification.id]); }}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}