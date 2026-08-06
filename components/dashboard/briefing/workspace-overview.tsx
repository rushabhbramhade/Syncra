"use client";

import React, { useMemo } from "react";
import { BriefingRecord, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { ShieldCheck, AlertTriangle, Timer, UserCheck, RefreshCw, Sparkles } from "lucide-react";

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

export const WorkspaceOverview = React.memo(function WorkspaceOverview({ latestBriefing, items }: WorkspaceOverviewProps) {
  const content = latestBriefing?.full_content as { [k: string]: unknown } | undefined;

  const stats = useMemo<OverviewStat[]>(() => {
    const active = items.filter(i => i.status !== "archived" && i.status !== "completed");
    const high = active.filter(i => i.priority.toLowerCase() === "high").length;
    const medium = active.filter(i => i.priority.toLowerCase() === "normal").length;
    const low = active.filter(i => i.priority.toLowerCase() === "low").length;
    const needsReply = active.filter(i => ["email", "messages", "mentions", "followups", "follow-ups", "follow_ups"].includes(i.category.toLowerCase())).length;
    const suggestions = (content?.recommendations as unknown as unknown[] | undefined)?.length || 0;
    const goals = (content?.goals as unknown as unknown[] | undefined)?.length || 0;
    const health = (content?.health as { overall?: number } | undefined)?.overall ?? latestBriefing?.priority_score ?? null;

    const stats: OverviewStat[] = [];
    if (health != null) {
      stats.push({
        label: "Workspace Health",
        value: Math.round(health),
        icon: <ShieldCheck className="w-4 h-4" />,
        tone: health >= 70 ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : health >= 45 ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-red-500/10 text-red-600 border-red-500/20",
      });
    }
    stats.push({ label: "High Priority", value: high, icon: <AlertTriangle className="w-4 h-4" />, tone: "bg-red-500/10 text-red-600 border-red-500/20" });
    stats.push({ label: "Medium", value: medium, icon: <Timer className="w-4 h-4" />, tone: "bg-amber-500/10 text-amber-600 border-amber-500/20" });
    stats.push({ label: "Low", value: low, icon: <RefreshCw className="w-4 h-4" />, tone: "bg-slate-500/10 text-slate-600 border-slate-500/20" });
    stats.push({ label: "Needs Reply", value: needsReply, icon: <UserCheck className="w-4 h-4" />, tone: "bg-accent-purple/10 text-accent-purple border-accent-purple/20" });
    if (goals > 0) stats.push({ label: "Goals", value: goals, icon: <Sparkles className="w-4 h-4" />, tone: "bg-sky-500/10 text-sky-600 border-sky-500/20" });
    if (suggestions > 0) stats.push({ label: "AI Suggestions", value: suggestions, icon: <Sparkles className="w-4 h-4" />, tone: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" });
    return stats;
  }, [latestBriefing, items, content]);

  if (!latestBriefing || stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
  );
});
