"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  RefreshCw,
  Unlink,
  KeyRound,
  ShieldCheck,
  Globe,
  User,
  Clock,
  Activity,
  Mail,
} from "lucide-react";
import type { WorkspaceIntegration } from "@/app/actions/integrations";
import { getProviderMeta } from "@/features/integrations/constants/providers";
import { getIntegrationLogs } from "@/app/actions/integrations";
import type { SyncLogRecord } from "@/lib/repositories/integrations-repository";
import type { IntegrationSettingsPatch } from "@/hooks/useIntegrations";

export interface IntegrationDrawerProps {
  integration: WorkspaceIntegration | null;
  userId: string | undefined;
  isOperating: boolean;
  operatingAction: "sync" | "refresh" | null;
  onClose: () => void;
  onSync: () => void;
  onRefreshToken: () => void;
  onDisconnect: () => void;
  onReconnect: () => void;
  onToggleSetting: (key: keyof IntegrationSettingsPatch, value: boolean) => void;
  onOpenMCPSettings?: (platform: { id: string; name: string; icon: string }) => void;
}

function formatFull(dateStr: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function logDot(status: string) {
  const map: Record<string, string> = {
    success: "bg-success",
    error: "bg-error",
    refresh: "bg-info",
    reconnect: "bg-warning",
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${map[status] || "bg-text-fog"}`} />;
}

function SettingRow({ label, hint, value, onChange, disabled }: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className="w-full flex items-center justify-between gap-3 py-3 text-left disabled:opacity-50"
    >
      <span>
        <span className="block text-[13px] font-bold text-secondary">{label}</span>
        <span className="block text-[11px] text-text-slate font-medium">{hint}</span>
      </span>
      <span className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 shrink-0 ${value ? "bg-primary" : "bg-border-mist"}`}>
        <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? "translate-x-5" : ""}`} />
      </span>
    </button>
  );
}

export function IntegrationDrawer({
  integration,
  userId,
  onClose,
  onSync,
  onRefreshToken,
  onDisconnect,
  onReconnect,
  onToggleSetting,
  onOpenMCPSettings,
  isOperating,
  operatingAction,
}: IntegrationDrawerProps) {
  const [logsState, setLogsState] = useState<{ provider: string; logs: SyncLogRecord[]; expired: boolean }>({
    provider: "",
    logs: [],
    expired: false,
  });

  useEffect(() => {
    if (!integration || !userId) return;
    let cancelled = false;
    getIntegrationLogs(userId, integration.provider, 10)
      .then((rows) => { if (!cancelled) setLogsState({ provider: integration.provider, logs: rows, expired: integration.expires_at ? new Date(integration.expires_at).getTime() < Date.now() : false }); })
      .catch(() => { if (!cancelled) setLogsState({ provider: integration.provider, logs: [], expired: false }); });
    return () => { cancelled = true; };
  }, [integration, userId]);

  if (!integration) return null;

  const meta = getProviderMeta(integration.provider);
  const connected = integration.connected;
  const listedScopes = integration.scopes ? integration.scopes.split(" ").filter(Boolean) : [];
  const hasRefresh = connected;
  const logsLoading = logsState.provider !== integration.provider;
  const logs = logsState.provider === integration.provider ? logsState.logs : [];
  const expired = logsState.expired;

  return (
    <>
      <AnimatePresence>
        {integration && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {integration && (
          <motion.aside
            key="panel"
            initial={{ x: 440, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 440, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 32 }}
            className="fixed top-0 right-0 z-[70] h-full w-full max-w-[420px] bg-surface-white shadow-2xl overflow-hidden"
          >
            <div className={`h-1.5 bg-gradient-to-r ${meta.gradient}`} />

            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-border-mist">
              <h2 className="font-display font-black text-lg text-secondary">Integration Details</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-black/5 rounded-lg text-text-slate transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-7 overflow-y-auto h-[calc(100%-57px)] pb-12">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl bg-background-mist border-[1.5px] border-border-mist flex items-center justify-center overflow-hidden ${connected ? "" : "grayscale opacity-60"}`}>
                  {meta.icon ? (
                    <img src={meta.icon} alt={integration.name} className="w-10 h-10 object-contain" />
                  ) : (
                    <span className="w-9 h-9 rounded-xl bg-secondary text-white flex items-center justify-center font-black uppercase text-lg">
                      {integration.name.slice(0, 1)}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display font-black text-xl text-secondary">{integration.name}</p>
                  <p className="text-text-slate text-[13px] font-semibold flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{integration.email || "No account connected"}</span>
                  </p>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 text-[11px] font-bold rounded-lg ${
                    connected
                      ? "bg-success-bg text-success border border-success"
                      : "bg-background-mist text-text-slate border border-border-mist"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-text-fog"}`} />
                    {connected ? "Connected" : "Disconnected"}
                  </span>
                </div>
              </div>

              <p className="text-[13px] text-text-slate font-medium leading-relaxed">{meta.description}</p>

              <div className="space-y-3 bg-background-mist border-[1.5px] border-border-mist rounded-xl p-4 text-[13px] font-semibold text-text-slate">
                <div className="flex justify-between">
                  <span className="flex items-center gap-2"><User className="w-4 h-4 text-text-fog" /> Connected Since</span>
                  <span className="font-bold text-secondary">{formatFull(integration.connected_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-text-fog" /> Last Sync</span>
                  <span className="font-bold text-secondary">{formatFull(integration.last_sync_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="flex items-center gap-2"><KeyRound className="w-4 h-4 text-text-fog" /> Token Expiry</span>
                  <span className={`font-bold ${expired ? "text-error" : "text-secondary"}`}>
                    {formatFull(integration.expires_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 text-text-fog" /> Refresh Token</span>
                  <span className={`font-bold ${hasRefresh ? "text-success" : "text-text-fog"}`}>
                    {hasRefresh ? "Available" : "N/A"}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="flex items-center gap-2 font-display font-black text-[15px] text-secondary mb-2">
                  <ShieldCheck className="w-4 h-4" /> Permissions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {meta.permissions.map((p) => (
                    <span key={p} className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${meta.badgeBg} ${meta.accent}`}>
                      {p}
                    </span>
                  ))}
                </div>
                {listedScopes.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {listedScopes.slice(0, 6).map((s) => (
                      <div key={s} className="flex items-start gap-2 text-[11px] text-text-fog font-mono break-all">
                        <Globe className="w-3 h-3 shrink-0 mt-0.5" />
                        {s}
                      </div>
                    ))}
                    {listedScopes.length > 6 && (
                      <div className="text-[11px] text-text-fog font-semibold">+{listedScopes.length - 6} more scopes</div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-display font-bold text-[15px] text-secondary mb-1">Integration Settings</h3>
                <div className="divide-y divide-border-mist">
                  <SettingRow label="Auto Sync" hint="Synchronize new activity automatically" value={integration.settings.auto_sync} onChange={(v) => onToggleSetting("auto_sync", v)} disabled={!connected} />
                  <SettingRow label="Notifications" hint="Get alerts for this platform" value={integration.settings.notifications} onChange={(v) => onToggleSetting("notifications", v)} disabled={!connected} />
                  <SettingRow label="Background Sync" hint="Sync in hourly background jobs" value={integration.settings.background_sync} onChange={(v) => onToggleSetting("background_sync", v)} disabled={!connected} />
                  <SettingRow label="Auto Token Refresh" hint="Refresh expiry automatically" value={integration.settings.token_refresh} onChange={(v) => onToggleSetting("token_refresh", v)} disabled={!connected} />
                </div>
                {onOpenMCPSettings && (
                  <button
                    onClick={() => onOpenMCPSettings({ id: integration.provider, name: integration.name, icon: meta.icon || "" })}
                    className="w-full mt-3 min-h-[40px] px-4 py-2 bg-background-mist border-[2px] border-border-mist text-text-slate font-bold text-[13px] rounded-xl hover:border-secondary hover:text-secondary transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 inline mr-2" /> MCP Tools
                  </button>
                )}
              </div>

              <div>
                <h3 className="flex items-center gap-2 font-display font-bold text-[15px] text-secondary mb-2">
                  <Activity className="w-4 h-4" /> Recent Activity
                </h3>
                {logsLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="animate-pulse bg-background-mist h-10 rounded-lg" />
                    ))}
                  </div>
                ) : logs.length === 0 ? (
                  <p className="text-[12px] text-text-fog font-medium">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id || log.created_at} className="flex items-start gap-2.5 bg-background-mist border border-border-mist rounded-lg p-2.5">
                        {logDot(log.status)}
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-secondary truncate">{log.message || log.status}</p>
                          <p className="text-[10px] text-text-fog font-medium">
                            {formatFull(log.created_at || "")}{log.duration_ms != null ? ` · ${log.duration_ms}ms` : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-2">
                {connected && (
                  <button
                    onClick={onSync}
                    disabled={isOperating}
                    className="w-full min-h-[44px] px-5 py-2.5 bg-surface-white border-[2px] border-secondary text-secondary font-bold text-[14px] rounded-xl hover:bg-background-mist transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${operatingAction === "sync" ? "animate-spin" : ""}`} />
                    {operatingAction === "sync" ? "Syncing..." : "Sync Now"}
                  </button>
                )}
                {connected && (
                  <button
                    onClick={onRefreshToken}
                    disabled={isOperating}
                    className="w-full min-h-[44px] px-5 py-2.5 bg-info-bg border-[2px] border-info text-info font-bold text-[14px] rounded-xl hover:bg-info hover:text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${operatingAction === "refresh" ? "animate-spin" : ""}`} />
                    {operatingAction === "refresh" ? "Refreshing..." : "Refresh Token"}
                  </button>
                )}
                <button
                  onClick={onReconnect}
                  className="w-full min-h-[44px] px-5 py-2.5 bg-warning-bg border-[2px] border-warning text-warning font-bold text-[14px] rounded-xl hover:bg-warning hover:text-white transition-all flex items-center justify-center gap-2"
                >
                  <Unlink className="w-4 h-4" /> Reconnect
                </button>
                {connected && (
                  <button
                    onClick={onDisconnect}
                    className="w-full min-h-[44px] px-5 py-2.5 bg-error-bg border-[2px] border-error text-error font-bold text-[14px] rounded-xl hover:bg-error hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Unlink className="w-4 h-4" /> Disconnect
                  </button>
                )}
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}