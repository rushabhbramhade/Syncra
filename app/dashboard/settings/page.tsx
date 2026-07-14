"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, MessageCircle, Bell, Loader2, History, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TelegramConnectDialog } from "@/components/notifications/telegram-connect-dialog";
import { NotificationPreferencesPanel } from "@/components/notifications/notification-preferences-panel";
import { TelegramStatusWidget } from "@/components/notifications/telegram-status-widget";
import { cn } from "@/lib/utils";
import type { NotificationType, NotificationSchedule, NotificationPreference } from "@/lib/repositories/notification-preferences-repository";

export default function SettingsPage() {
  const { user } = useAuth();
  const dbUserId = user?.id || "";

  const [activeTab, setActiveTab] = useState<"notifications" | "telegram">("notifications");
  const [showTelegramDialog, setShowTelegramDialog] = useState(false);
  const [telegramConnection, setTelegramConnection] = useState<any>(null);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [timezone, setTimezone] = useState("UTC");
  const [historyStats, setHistoryStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isTestSending, setIsTestSending] = useState(false);

  const loadData = useCallback(async () => {
    if (!dbUserId) return;
    setIsLoading(true);

    try {
      const { getTelegramConnectionAction, getNotificationPreferencesAction, getNotificationHistoryAction } = await import("@/app/actions/telegram");

      const [connRes, prefRes, histRes] = await Promise.all([
        getTelegramConnectionAction(dbUserId),
        getNotificationPreferencesAction(dbUserId),
        getNotificationHistoryAction(dbUserId, 5),
      ]);

      if (connRes.success) setTelegramConnection(connRes.connection);
      if (prefRes.success && prefRes.preferences) {
        setPreferences(prefRes.preferences);
        const tz = prefRes.preferences.find((p: NotificationPreference) => p.timezone);
        if (tz) setTimezone(tz.timezone);
      }
      if (histRes.success) setHistoryStats(histRes.stats);
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setIsLoading(false);
    }
  }, [dbUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleVerify = async () => {
    if (!dbUserId) return;
    setIsVerifying(true);
    try {
      const { verifyTelegramConnectionAction } = await import("@/app/actions/telegram");
      const result = await verifyTelegramConnectionAction(dbUserId);
      if (result.success && result.verified) {
        setTelegramConnection(result.connection);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    if (!dbUserId) return;
    setIsVerifying(true);
    try {
      const { disconnectTelegramAction } = await import("@/app/actions/telegram");
      await disconnectTelegramAction(dbUserId);
      setTelegramConnection(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSendTest = async () => {
    if (!dbUserId) return;
    setIsTestSending(true);
    try {
      const { sendTestNotificationAction } = await import("@/app/actions/telegram");
      await sendTestNotificationAction(dbUserId);
    } finally {
      setIsTestSending(false);
    }
  };

  const handleToggle = async (type: NotificationType, currentEnabled: boolean) => {
    if (!dbUserId) return;
    const { updateNotificationPreferenceAction } = await import("@/app/actions/telegram");
    const result = await updateNotificationPreferenceAction(dbUserId, type, { enabled: !currentEnabled });
    if (result.success) {
      setPreferences((prev) =>
        prev.map((p) =>
          p.notification_type === type ? { ...p, enabled: !currentEnabled } : p
        )
      );
    }
  };

  const handleScheduleChange = async (type: NotificationType, schedule: NotificationSchedule) => {
    if (!dbUserId) return;
    const { updateNotificationPreferenceAction } = await import("@/app/actions/telegram");
    const result = await updateNotificationPreferenceAction(dbUserId, type, { schedule });
    if (result.success) {
      setPreferences((prev) =>
        prev.map((p) =>
          p.notification_type === type ? { ...p, schedule } : p
        )
      );
    }
  };

  const handleTimezoneChange = async (tz: string) => {
    setTimezone(tz);
    if (!dbUserId) return;
    const { updateNotificationPreferenceAction } = await import("@/app/actions/telegram");
    await updateNotificationPreferenceAction(dbUserId, "system_notifications" as NotificationType, { timezone: tz });
  };

  const tabs = [
    { id: "notifications" as const, label: "Notifications", icon: Bell },
    { id: "telegram" as const, label: "Telegram", icon: MessageCircle },
  ];

  if (!dbUserId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-[22px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">Settings</h1>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
          Manage your notification preferences and connected services.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-900/60 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-[13px] font-semibold rounded-lg transition-all duration-200",
              activeTab === tab.id
                ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm"
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-slate-100 dark:bg-slate-900/40 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <Card className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-semibold text-[16px] text-slate-900 dark:text-slate-100">Notification Preferences</h2>
                  <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Choose what notifications you receive and how often.</p>
                </div>
              </div>

              <NotificationPreferencesPanel
                preferences={preferences}
                onToggle={handleToggle}
                onScheduleChange={handleScheduleChange}
                isLoading={isLoading}
                timezone={timezone}
                onTimezoneChange={handleTimezoneChange}
              />
            </Card>
          )}

          {/* Telegram Tab */}
          {activeTab === "telegram" && (
            <Card className="p-6 md:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-xl">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-[16px] text-slate-900 dark:text-slate-100">Telegram Bot</h2>
                  <p className="text-[12.5px] text-slate-500 dark:text-slate-400">Receive AI notifications directly in Telegram.</p>
                </div>
                <Button
                  onClick={() => setShowTelegramDialog(true)}
                  variant={telegramConnection ? "secondary" : "primary"}
                  size="sm"
                >
                  {telegramConnection ? "Manage" : "Connect Telegram"}
                </Button>
              </div>

              {telegramConnection && (
                <TelegramStatusWidget
                  connected={true}
                  lastNotificationSent={telegramConnection.lastNotificationSent}
                  notificationCount={historyStats?.sent || 0}
                  failedCount={historyStats?.failed || 0}
                />
              )}

              {!telegramConnection && (
                <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/80 p-8 text-center">
                  <MessageCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <h3 className="font-semibold text-[14px] text-slate-700 dark:text-slate-300">No Telegram Connection</h3>
                  <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Connect your Telegram account to receive AI-generated notifications, daily briefs, and important alerts.
                  </p>
                  <Button
                    onClick={() => setShowTelegramDialog(true)}
                    variant="primary"
                    size="md"
                    className="mt-4"
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Connect Telegram
                  </Button>
                </div>
              )}
            </Card>
          )}

          {/* Notification History Summary */}
          {historyStats && historyStats.total > 0 && (
            <Card className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-400" />
                  <h3 className="font-semibold text-[13px] text-slate-700 dark:text-slate-300">Notification History</h3>
                </div>
                <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{historyStats.total} total</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-[18px] font-bold text-emerald-600 dark:text-emerald-400">{historyStats.sent}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Sent</div>
                </div>
                <div>
                  <div className="text-[18px] font-bold text-amber-600 dark:text-amber-400">{historyStats.delivered}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Delivered</div>
                </div>
                <div>
                  <div className={cn("text-[18px] font-bold", historyStats.failed > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400")}>
                    {historyStats.failed}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Failed</div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Telegram Connect Dialog */}
      <TelegramConnectDialog
        isOpen={showTelegramDialog}
        onClose={() => setShowTelegramDialog(false)}
        connection={telegramConnection}
        onVerify={handleVerify}
        onDisconnect={handleDisconnect}
        onSendTest={handleSendTest}
        isLoading={isVerifying}
        testLoading={isTestSending}
      />
    </div>
  );
}
