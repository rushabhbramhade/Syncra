"use client";

import React, { useMemo } from "react";
import { BriefingRecord, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import {
  AlertTriangle, Timer, UserCheck, RefreshCw, Mail, MessageCircle, AlertCircle, Bell, Inbox
} from "lucide-react";

interface WorkspaceOverviewProps {
  latestBriefing: BriefingRecord | null;
  items: BriefingItemRecord[];
}

interface OverviewStat {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  gmail: <Mail className="w-4 h-4" />,
  outlook: <Mail className="w-4 h-4" />,
  slack: <MessageCircle className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
  telegram: <MessageCircle className="w-4 h-4" />,
  discord: <MessageCircle className="w-4 h-4" />,
  github: <AlertCircle className="w-4 h-4" />,
  linkedin: <Bell className="w-4 h-4" />,
  calendar: <AlertCircle className="w-4 h-4" />,
};

function getProviderTone(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "gmail") return "bg-red-500/10 text-red-600 border-red-500/20";
  if (p === "slack") return "bg-purple-500/10 text-purple-600 border-purple-500/20";
  if (p === "whatsapp") return "bg-green-500/10 text-green-600 border-green-500/20";
  if (p === "telegram") return "bg-sky-500/10 text-sky-600 border-sky-500/20";
  if (p === "discord") return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
  if (p === "github") return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  if (p === "linkedin") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  return "bg-slate-500/10 text-slate-600 border-slate-500/20";
}

/**
 * General Workspace Update — REAL activity only. Every number is derived from
 * persisted briefing items that trace to a synchronized provider record. A
 * provider appears ONLY if it actually contributed items; connected-but-empty
 * and failed providers are surfaced by Integration Health, never invented here.
 */
export const WorkspaceOverview = React.memo(function WorkspaceOverview({ latestBriefing, items }: WorkspaceOverviewProps) {
  const active = useMemo(() => items.filter(i => i.status !== "archived" && i.status !== "completed"), [items]);

  const stats = useMemo<OverviewStat[]>(() => {
    const high = active.filter(i => i.priority.toLowerCase() === "high").length;
    const medium = active.filter(i => i.priority.toLowerCase() === "normal").length;
    const low = active.filter(i => i.priority.toLowerCase() === "low").length;
    const needsReply = active.filter(i => ["email", "messages", "followups", "follow-ups", "follow_ups"].includes(i.category.toLowerCase())).length;

    const stats: OverviewStat[] = [];
    stats.push({ label: "High Priority", value: high, icon: <AlertTriangle className="w-4 h-4" />, tone: "bg-red-500/10 text-red-600 border-red-500/20" });
    stats.push({ label: "Medium", value: medium, icon: <Timer className="w-4 h-4" />, tone: "bg-amber-500/10 text-amber-600 border-amber-500/20" });
    stats.push({ label: "Low", value: low, icon: <RefreshCw className="w-4 h-4" />, tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" });
    stats.push({ label: "Needs Reply", value: needsReply, icon: <UserCheck className="w-4 h-4" />, tone: "bg-accent-purple/10 text-accent-purple border-accent-purple/20" });
    return stats;
  }, [active]);

  // Providers that actually contributed real items — derived, never guessed.
  const providerCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of active) {
      const p = item.platform?.toLowerCase() || "unknown";
      counts[p] = (counts[p] || 0) + 1;
    }
    return counts;
  }, [active]);

  const hasProviderData = Object.keys(providerCounts).length > 0;

  if (!latestBriefing) return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold text-text-slate uppercase tracking-wider">
        <span className="flex items-center gap-1.5">
          <Inbox className="w-3.5 h-3.5" />
          Workspace Activity
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`p-4 rounded-2xl border-[1.5px] flex items-center gap-3 ${s.tone}`}>
            <span className="p-2 rounded-xl bg-white/60 border border-current/10 shrink-0">{s.icon}</span>
            <div>
              <div className="font-display font-black text-2xl leading-none text-secondary">{s.value}</div>
              <div className="text-[11px] font-bold text-text-slate mt-1 uppercase tracking-wide">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
      {hasProviderData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {Object.entries(providerCounts).sort((a, b) => b[1] - a[1]).map(([platform, count]) => (
            <div key={platform} className={`flex items-center gap-2.5 p-3 rounded-2xl border-[1.5px] ${getProviderTone(platform)}`}>
              <span className="p-1.5 rounded-lg bg-white/60 border border-current/10 shrink-0">
                {PLATFORM_ICONS[platform] || <Inbox className="w-4 h-4" />}
              </span>
              <div className="min-w-0">
                <div className="font-display font-black text-lg leading-none text-secondary capitalize">{count}</div>
                <div className="text-[10.5px] font-bold text-text-slate mt-0.5 capitalize truncate">{platform}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
