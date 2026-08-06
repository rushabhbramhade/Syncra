"use client";

import React from "react";
import { motion } from "framer-motion";
import { RefreshCw, PlugZap, Link2, ChevronRight } from "lucide-react";
import type { WorkspaceIntegration } from "@/app/actions/integrations";
import { getProviderMeta } from "@/features/integrations/constants/providers";
import { StatusBadge } from "@/features/integrations/components/status/status-badge";

export interface IntegrationCardProps {
  integration: WorkspaceIntegration;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  onOpenDetails: () => void;
  isSyncing?: boolean;
  isDisconnecting?: boolean;
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Never";
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " · " +
    d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ProviderIcon({ integration, size = 48 }: { integration: WorkspaceIntegration; size?: number }) {
  const meta = getProviderMeta(integration.provider);
  if (meta.icon) {
    return (
      <img
        src={meta.icon}
        alt={integration.name}
        className="object-contain"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span className="w-8 h-8 rounded-lg bg-secondary text-white flex items-center justify-center font-black uppercase text-sm">
      {integration.name.slice(0, 1)}
    </span>
  );
}

export function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onSync,
  onOpenDetails,
  isSyncing,
  isDisconnecting,
}: IntegrationCardProps) {
  const meta = getProviderMeta(integration.provider);
  const connected = integration.connected;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
      whileHover={{ y: -4 }}
      className="group relative rounded-[22px] p-[2px] neo-shadow-md transition-shadow duration-300 hover:shadow-flat-hover"
    >
      {/* Gradient border */}
      <div className={`absolute inset-0 rounded-[22px] opacity-60 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br ${connected ? meta.gradient : "from-border-mist to-border-mist"}`} />
      <div className="absolute inset-[2px] rounded-[20px] bg-surface-white" />

      <div className="relative p-6 flex flex-col min-h-[360px]">
        {/* Top row: icon + status */}
        <div className="flex items-start justify-between mb-4">
          <div className={`w-14 h-14 rounded-2xl bg-background-mist border-[1.5px] border-border-mist flex items-center justify-center overflow-hidden ${connected ? "" : "opacity-60 grayscale"}`}>
            <ProviderIcon integration={integration} />
          </div>
          {connected ? <StatusBadge integration={integration} /> : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-background-mist border-[1.5px] border-border-mist text-text-slate text-[11px] font-medium rounded-lg">
              Ready
            </span>
          )}
        </div>

        {/* Name + description */}
        <h3 className="font-display font-black text-xl text-secondary mb-1">{integration.name}</h3>
        <p className="text-text-slate text-[13px] font-medium leading-relaxed line-clamp-2 mb-4">
          {meta.description}
        </p>

        {/* Connected account / last sync */}
        {connected && (
          <div className="mb-4 bg-background-mist border-[1.5px] border-border-mist rounded-xl p-3 text-[11px] font-semibold text-text-slate space-y-1.5">
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Account</span>
              <span className="font-bold text-secondary truncate">{integration.email}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="shrink-0">Last Sync</span>
              <span className="font-bold text-secondary">{formatDate(integration.last_sync_at)}</span>
            </div>
            {integration.last_error && (
              <div className="flex justify-between gap-2">
                <span className="shrink-0">Status</span>
                <span className="font-bold text-error truncate">{integration.last_error}</span>
              </div>
            )}
          </div>
        )}

        {/* Permissions summary */}
        {connected && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {meta.permissions.slice(0, 2).map((p) => (
              <span key={p} className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${meta.badgeBg} ${meta.accent}`}>
                {p}
              </span>
            ))}
            {meta.permissions.length > 2 && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-background-mist text-text-fog">
                +{meta.permissions.length - 2} more
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex items-center gap-2">
          {connected ? (
            <>
              <button
                onClick={onSync}
                disabled={isSyncing}
                className="flex-1 min-h-[42px] px-4 py-2 bg-surface-white border-[2px] border-secondary text-secondary font-bold text-[14px] rounded-xl hover:bg-background-mist transition-all duration-200 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin" : ""}`} />
                {isSyncing ? "Syncing..." : "Sync Now"}
              </button>
              <button
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="min-h-[42px] px-3 bg-error-bg border-[2px] border-error text-error font-bold text-[14px] rounded-xl hover:bg-error hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isDisconnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Disconnecting...
                  </>
                ) : (
                  "Disconnect"
                )}
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              className="w-full min-h-[42px] px-4 py-2 bg-primary text-white border-[2px] border-primary font-bold text-[14px] rounded-xl hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-flat-sm active:translate-x-0 active:translate-y-0 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
            >
              <PlugZap className="w-4 h-4" /> Connect
            </button>
          )}

          <button
            onClick={onOpenDetails}
            title="Details"
            className="min-h-[42px] px-3 bg-surface-white border-[2px] border-border-mist text-text-slate font-bold text-[14px] rounded-xl hover:border-secondary hover:text-secondary transition-all duration-200 cursor-pointer flex items-center justify-center"
          >
            <ChevronRight className="w-[18px] h-[18px]" />
          </button>
        </div>

        {!connected && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-text-fog font-semibold">
            <Link2 className="w-3.5 h-3.5" /> AI will get live access after connecting
          </p>
        )}
      </div>
    </motion.div>
  );
}
