"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Plug,
  AlertTriangle,
  Clock,
  ShieldCheck,
  BrainCircuit,
} from "lucide-react";
import type { WorkspaceIntegration } from "@/app/actions/integrations";

export interface SummaryStatsProps {
  integrations: WorkspaceIntegration[];
  lastSync: string;
  aiHealth: "healthy" | "degraded" | "unavailable";
}

function formatRelative(dateStr: string) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Never";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
  delay,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "default" | "success" | "warning" | "error" | "info";
  delay: number;
}) {
  const toneClasses: Record<string, string> = {
    default: "bg-background-mist text-text-slate border-border-mist",
    success: "bg-success-bg text-success border-success",
    warning: "bg-warning-bg text-warning border-warning",
    error: "bg-error-bg text-error border-error",
    info: "bg-info-bg text-info border-info",
  };
  const iconBox = toneClasses[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 280, damping: 26 }}
      className="bg-surface-white neo-border rounded-[20px] p-4 flex items-center gap-4"
    >
      <div className={`w-11 h-11 rounded-xl border-[2px] flex items-center justify-center shrink-0 ${iconBox}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-text-fog font-black">{label}</p>
        <p className="font-display font-black text-2xl text-secondary leading-tight truncate">{value}</p>
        {sub && <p className="text-[11px] text-text-slate font-semibold truncate">{sub}</p>}
      </div>
    </motion.div>
  );
}

export function IntegrationSummaryStats({ integrations, lastSync, aiHealth }: SummaryStatsProps) {
  const connected = integrations.filter((i) => i.connected).length;
  const failed = integrations.filter((i) => i.sync_status === "error").length;
  const pending = integrations.filter((i) => i.sync_status === "expired" || i.sync_status === "syncing").length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <StatCard
        delay={0}
        icon={<Plug className="w-5 h-5" />}
        label="Connected"
        value={connected}
        sub={`of ${integrations.length} integrations`}
        tone="success"
      />
      <StatCard
        delay={0.05}
        icon={<AlertTriangle className="w-5 h-5" />}
        label="Failed Syncs"
        value={failed}
        sub={failed ? "Action required" : "All healthy"}
        tone={failed ? "error" : "default"}
      />
      <StatCard
        delay={0.1}
        icon={<Clock className="w-5 h-5" />}
        label="Pending Actions"
        value={pending}
        sub={pending ? "Needs attention" : "Clear"}
        tone={pending ? "warning" : "default"}
      />
      <StatCard
        delay={0.15}
        icon={<ShieldCheck className="w-5 h-5" />}
        label="Last Sync"
        value={formatRelative(lastSync)}
        sub="Auto-sync enabled"
        tone="info"
      />
      <StatCard
        delay={0.2}
        icon={<BrainCircuit className="w-5 h-5" />}
        label="AI Health"
        value={aiHealth === "healthy" ? "Healthy" : aiHealth === "degraded" ? "Degraded" : "Offline"}
        sub={aiHealth === "healthy" ? "Agent active" : aiHealth === "degraded" ? "Partial access" : "No data access"}
        tone={aiHealth === "healthy" ? "success" : aiHealth === "degraded" ? "warning" : "default"}
      />
    </div>
  );
}
