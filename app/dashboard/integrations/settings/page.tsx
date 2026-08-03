"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Trash2, Plug, Settings, AlertTriangle } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { useIntegrations } from "@/hooks/useIntegrations";
import { ACTIVE_PROVIDERS, getProviderMeta } from "@/features/integrations/constants/providers";
import type { WorkspaceIntegration } from "@/app/actions/integrations";
import type { IntegrationSettingsPatch } from "@/hooks/useIntegrations";

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className={`w-11 h-6 rounded-full p-1 transition-colors duration-200 shrink-0 cursor-pointer disabled:opacity-40 ${value ? "bg-primary" : "bg-border-mist"}`}
      role="switch"
      aria-checked={value}
    >
      <span className={`block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? "translate-x-5" : ""}`} />
    </button>
  );
}

function IntegrationSettingsRow({
  integration,
  onToggle,
  onDelete,
}: {
  integration: WorkspaceIntegration;
  onToggle: (key: keyof IntegrationSettingsPatch, value: boolean) => Promise<void>;
  onDelete: () => void;
}) {
  const router = useRouter();
  const meta = getProviderMeta(integration.provider);
  const connected = integration.connected;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function handleToggle(key: keyof IntegrationSettingsPatch, value: boolean) {
    setToast(null);
    await onToggle(key, value);
    setToast(`${meta.name}: ${key.replace(/_/g, " ")} updated`);
  }

  return (
    <div className="bg-surface-white neo-border rounded-[20px] overflow-hidden">
      <div className={`h-1 bg-gradient-to-r ${meta.gradient}`} />
      <div className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-xl bg-background-mist border border-border-mist flex items-center justify-center overflow-hidden">
            {meta.icon ? <img src={meta.icon} alt={meta.name} className="w-6 h-6 object-contain" /> : null}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-black text-[15px] text-secondary">{meta.name}</h3>
            <p className="text-[11px] text-text-slate font-semibold truncate">{connected ? integration.email || "Connected" : "Not connected"}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold rounded-lg ${
            connected ? "bg-success-bg text-success border border-success" : "bg-background-mist text-text-slate border border-border-mist"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-text-fog"}`} />
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          {([
            ["auto_sync", "Auto Sync", "Synchronize new activity automatically"],
            ["notifications", "Notifications", "Get alerts for this platform"],
            ["background_sync", "Background Sync", "Sync in hourly background jobs"],
            ["token_refresh", "Token Refresh", "Refresh expired tokens automatically"],
          ] as [keyof IntegrationSettingsPatch, string, string][]).map(([key, label, hint]) => (
            <div key={key} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-[13px] font-bold text-secondary">{label}</p>
                <p className="text-[11px] text-text-slate font-medium">{hint}</p>
              </div>
              <Toggle
                value={integration.settings[key]}
                onChange={(v) => handleToggle(key, v)}
                disabled={!connected}
              />
            </div>
          ))}
        </div>

        {toast && <p className="mt-3 text-[12px] font-bold text-success">{toast}</p>}

        <div className="mt-4 pt-4 border-t-2 border-border-mist flex items-center justify-between gap-3">
          <button
            onClick={() => {
              if (!confirmDelete) { setConfirmDelete(true); return; }
              onDelete();
              setConfirmDelete(false);
            }}
            disabled={!connected}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-error-bg border-[2px] border-error text-error text-[12px] font-bold rounded-lg hover:bg-error hover:text-white transition-all disabled:opacity-40 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmDelete ? "Confirm delete?" : "Delete Data"}
          </button>
          <button
            onClick={() => router.push("/dashboard/integrations")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-white border-[2px] border-border-mist text-text-slate text-[12px] font-bold rounded-lg hover:border-secondary hover:text-secondary transition-all cursor-pointer"
          >
            <Plug className="w-3.5 h-3.5" /> Manage
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationSettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { integrations, isLoading, disconnect, updateSettings } = useIntegrations(user?.id);

  const connectedCount = integrations.filter((i) => i.connected).length;

  if (authLoading || isLoading || !user) {
    return (
      <div className="pb-16 font-sans">
        <div className="mb-8">
          <div className="h-9 w-2/3 bg-background-mist animate-pulse rounded-lg mb-2" />
          <div className="h-4 w-1/2 bg-background-mist animate-pulse rounded" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 bg-background-mist animate-pulse rounded-[20px]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-16 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <a href="/dashboard/integrations" className="inline-flex items-center gap-1 text-[12px] font-bold text-text-fog hover:text-secondary transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /> Integrations
            </a>
          </div>
          <h1 className="font-display font-black text-4xl text-secondary mb-2 tracking-tight flex items-center gap-3">
            <Settings className="w-8 h-8 text-primary" /> Integration Settings
          </h1>
          <p className="text-text-slate text-[15px] font-medium">
            Configure sync, notifications, and background behaviour per platform.
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-info-bg border-[2px] border-info text-info font-black text-[13px] rounded-xl shadow-flat-sm">
          <Plug className="w-4 h-4" /> {connectedCount} connected
        </div>
      </div>

      <div className="flex items-start gap-3 mb-6 p-4 bg-warning-bg border-[2px] border-warning rounded-[20px] text-[13px] text-text-ink font-semibold">
        <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <p>Settings apply per platform. Deleting a connection removes its tokens and stops all syncs; the MCP tools for that platform go offline immediately.</p>
      </div>

      <div className="space-y-4">
        {ACTIVE_PROVIDERS.map((meta, idx) => {
          const integration = integrations.find((i) => i.provider === meta.id) || null;
          if (!integration) {
            return (
              <motion.div
                key={meta.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="bg-surface-white neo-border rounded-[20px] p-5 flex items-center gap-3 opacity-70"
              >
                <div className="w-11 h-11 rounded-xl bg-background-mist border border-border-mist flex items-center justify-center overflow-hidden grayscale">
                  {meta.icon ? <img src={meta.icon} alt={meta.name} className="w-6 h-6 object-contain" /> : null}
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-black text-[15px] text-secondary">{meta.name}</h3>
                  <p className="text-[11px] text-text-fog font-semibold">Connect on the integrations page to configure</p>
                </div>
              </motion.div>
            );
          }
          return (
            <motion.div key={meta.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
              <IntegrationSettingsRow
                integration={integration}
                onToggle={async (key, value) => { await updateSettings(integration.provider, { [key]: value }); }}
                onDelete={() => { disconnect(integration.provider); }}
              />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
