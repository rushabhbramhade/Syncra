"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Sparkles, ShieldCheck, Brain, GitMerge, Clock, Target, ServerCog } from "lucide-react";
import {
  BriefingIntelligenceContent,
} from "@/lib/briefing-intelligence";

// Per-platform pipeline report persisted with each briefing (provider_health).
// Authoritative: never hides a connected integration, even with zero data.
type ProviderHealthLine = {
  connected?: boolean;
  fetched?: number;
  normalized?: number;
  saved?: number;
  aiUsed?: number;
  error?: string;
  lastSync?: string;
  referenced?: boolean;
  rendered?: boolean;
  status?: string;
  statusLabel?: string;
  label?: string;
  reconnect?: boolean;
  quality?: { label?: string; score?: number };
};

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    high: "bg-red-500/10 text-red-600 border-red-500/20",
    medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    neutral: "bg-background-mist text-text-slate border-border-mist",
    purple: "bg-accent-purple/10 text-accent-purple border-accent-purple/20",
  };
  return (
    <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${tones[tone] || tones.neutral} uppercase tracking-wide`}>
      {children}
    </span>
  );
}

function SectionCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="p-5 rounded-2xl bg-background-mist border-[1.5px] border-border-mist">
      <h4 className="flex items-center gap-2 font-bold text-[12.5px] text-secondary uppercase tracking-wider mb-3">
        <span className="text-accent-purple">{icon}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

function Collapse({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-[1.5px] border-border-mist rounded-xl overflow-hidden bg-surface-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-[13px] font-bold text-secondary hover:bg-background-mist transition-colors text-left"
      >
        <span>{label}</span>
        {open ? <ChevronDown className="w-4 h-4 text-text-slate shrink-0" /> : <ChevronRight className="w-4 h-4 text-text-slate shrink-0" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function HealthBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-emerald-500" : score >= 45 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-border-mist overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, score))}%` }} />
      </div>
      <span className="text-[12px] font-bold text-secondary w-7 text-right">{score}</span>
    </div>
  );
}

export const BriefingIntelligence = React.memo(function BriefingIntelligence({
  content,
  providerHealth,
}: {
  content: BriefingIntelligenceContent | null | undefined;
  providerHealth?: Record<string, unknown> | null;
}) {
  const [showReasoning, setShowReasoning] = useState(false);

  if (!content) return null;
  const { health, insights, relationships, recommendations, goals, timeline, confidence, sourceStats } = content;

  const healthLines: Record<string, ProviderHealthLine> = (providerHealth || {}) as Record<string, ProviderHealthLine>;
  const providers = Object.keys(healthLines).sort();
  // Real "missing data": connected integrations with a verified successful
  // fetch that returned zero records. "No Recent Activity" is ONLY valid after
  // auth + fetch + normalize + store all succeeded and 0 real entities came
  // back. Failed providers (auth / permission / rate / sync / reconnect) are
  // surfaced by the Integration Health card — they are never mislabeled as idle.
  const FAILURE_STATUSES = new Set([
    "authentication_failed",
    "permission_missing",
    "rate_limited",
    "sync_failed",
    "reconnect_required",
  ]);
  const realMissingData = providers.filter((p) => {
    const h = healthLines[p];
    if (!h) return false;
    if (h.error || (h.status && FAILURE_STATUSES.has(h.status))) return false;
    return !h.fetched;
  });
  const missingData = realMissingData.length > 0 ? realMissingData : undefined;

  const topActions = (recommendations || []).filter(r => r.priority === "high" || r.confidence >= 70).slice(0, 5);
  const otherActions = (recommendations || []).slice(topActions.length);

  const insightIcon: Record<string, string> = {
    warning: "text-red-500",
    opportunity: "text-emerald-600",
    pattern: "text-accent-purple",
    concept: "text-sky-600",
  };

  return (
    <div className="space-y-5">
      {health && (
        <SectionCard icon={<ShieldCheck className="w-4 h-4" />} title="Workspace Health">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="26" stroke="currentColor" className="text-border-mist" strokeWidth="5" fill="transparent" />
                <circle cx="32" cy="32" r="26" stroke="currentColor"
                  className={health.overall >= 70 ? "text-emerald-500" : health.overall >= 45 ? "text-amber-500" : "text-red-500"}
                  strokeWidth="5" fill="transparent"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={2 * Math.PI * 26 * (1 - (health.overall || 50) / 100)} />
              </svg>
              <span className="absolute font-display font-black text-lg text-secondary">{health.overall || 0}</span>
            </div>
            <p className="text-[13.5px] font-medium text-secondary leading-relaxed flex-1">{health.summary}</p>
          </div>
          <div className="space-y-2.5">
            {(health.breakdown || []).map(d => (
              <div key={d.name} className="grid grid-cols-[130px_1fr] md:grid-cols-[130px_1fr_1fr] gap-2 items-center">
                <span className="text-[12px] font-bold text-text-slate">{d.name}</span>
                <HealthBar score={d.score} />
                <span className="text-[11.5px] text-text-slate font-medium hidden md:block">{d.reason}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {providers.length > 0 && (
        <SectionCard icon={<ServerCog className="w-4 h-4" />} title="Integration Health">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {providers.map((p) => {
              const h = healthLines[p];
              const label = h?.statusLabel
                || h?.label
                || (h?.error ? "Error" : h?.fetched ? "Healthy" : "No data");
              const tone: string = label === "Healthy" ? "low" : (label === "No Recent Activity" || label === "Partial") ? "neutral" : "high";
              return (
                <div key={p} className="flex flex-col gap-1 p-2.5 rounded-lg bg-background-mist border border-border-mist">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-bold text-secondary capitalize">{p}</span>
                    <Pill tone={tone}>{label}</Pill>
                  </div>
                  {h?.fetched ? (
                    <p className="text-[11px] text-text-slate font-semibold">
                      fetched {h.fetched} · saved {h.saved} · in AI {h.aiUsed}
                    </p>
                  ) : !h?.error ? (
                    <p className="text-[11px] text-text-slate font-semibold">no recent activity</p>
                  ) : null}
                  {h?.reconnect && (
                    <p className="text-[10.5px] text-amber-600 font-bold">
                      Reconnect required — re-authorize to grant access.
                    </p>
                  )}
                  {!h?.fetched && h?.lastSync && (
                    <p className="text-[10.5px] text-text-slate">
                      Last successful sync: {new Date(h.lastSync).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  )}
                  {h?.error && <p className="text-[10.5px] text-red-600 font-medium break-words">{h.error}</p>}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {goals && goals.length > 0 && (
        <SectionCard icon={<Target className="w-4 h-4" />} title="Today's Goals">
          <ul className="space-y-2">
            {goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${g.priority === "high" ? "bg-red-500" : g.priority === "medium" ? "bg-amber-500" : "bg-emerald-500"}`} />
                <div>
                  <p className="text-[13px] font-semibold text-secondary leading-relaxed">{g.text}</p>
                  {g.reason && <p className="text-[11.5px] text-text-slate font-medium mt-0.5">{g.reason}</p>}
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {topActions.length > 0 && (
        <SectionCard icon={<Sparkles className="w-4 h-4" />} title="Top Actions">
          <div className="space-y-3">
            {topActions.map((r, i) => (
              <div key={i} className="p-4 rounded-xl bg-surface-white border-[1.5px] border-border-mist">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <Pill tone={r.priority || "medium"}>{r.priority || "action"}</Pill>
                  <Pill tone="purple">{r.confidence != null ? `${r.confidence}% confidence` : "recommended"}</Pill>
                  {r.platform && <Pill>{r.platform}</Pill>}
                </div>
                <p className="text-[14px] font-semibold text-secondary">{r.text}</p>
                {r.reason && <p className="text-[12.5px] text-text-slate font-medium mt-1">{r.reason}</p>}
                {r.affectedPlatforms && r.affectedPlatforms.length > 0 && (
                  <p className="text-[11.5px] text-text-slate font-semibold mt-1.5">
                    Sources: {r.affectedPlatforms.join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
          {otherActions.length > 0 && (
            <button onClick={() => setShowReasoning(o => !o)} className="mt-3 text-[12.5px] font-bold text-accent-purple flex items-center gap-1">
              {showReasoning ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {showReasoning ? "Hide" : "Show"} {otherActions.length} more
            </button>
          )}
          {showReasoning && otherActions.length > 0 && (
            <div className="mt-3 space-y-2.5">
              {otherActions.map((r, i) => (
                <div key={i} className="p-3 rounded-xl bg-background-mist border border-border-mist">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Pill>{r.platform || "action"}</Pill>
                    {r.confidence != null && <Pill tone="purple">{r.confidence}%</Pill>}
                  </div>
                  <p className="text-[13px] font-semibold text-secondary">{r.text}</p>
                  {r.reason && <p className="text-[12px] text-text-slate font-medium mt-0.5">{r.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {insights && insights.length > 0 && (
        <SectionCard icon={<Brain className="w-4 h-4" />} title="Insights">
          <ul className="space-y-2">
            {insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${insightIcon[ins.type] || "text-text-slate"}`} style={{ background: "currentColor" }} />
                <span className="text-[13px] font-medium text-secondary leading-relaxed">{ins.text}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {relationships && relationships.length > 0 && (
        <SectionCard icon={<GitMerge className="w-4 h-4" />} title="Related Activity">
          <div className="space-y-3">
            {relationships.map((rel, i) => (
              <div key={i} className="p-4 rounded-xl bg-surface-white border-[1.5px] border-border-mist">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-bold text-[13.5px] text-secondary">{rel.title}</span>
                  <div className="flex flex-wrap gap-1">
                    {(rel.platforms || []).map(p => <Pill key={p}>{p}</Pill>)}
                  </div>
                </div>
                <p className="text-[12.5px] text-text-slate font-medium mb-2">{rel.summary}</p>
                {(rel.items || []).length > 0 && (
                  <ul className="space-y-1 pl-1 border-l-2 border-accent-purple/20">
                    {rel.items.map((it, j) => (
                      <li key={j} className="text-[12.5px] font-medium text-secondary pl-3">
                        <span className="text-text-slate font-bold mr-1.5 capitalize">{it.platform}</span>
                        {it.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {timeline && timeline.length > 0 && (
        <SectionCard icon={<Clock className="w-4 h-4" />} title="Timeline">
          <ol className="relative space-y-3 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-0.5 before:bg-accent-purple/20">
            {timeline.map((t, i) => (
              <li key={i} className="flex items-center gap-3 pl-6 relative">
                <span className="absolute left-0 w-[15px] h-[15px] rounded-full bg-accent-purple/20 border-2 border-accent-purple/50" />
                <span className="text-[11.5px] font-bold text-text-slate w-14 shrink-0">{t.time}</span>
                <span className="text-[13px] font-medium text-secondary">{t.title}</span>
                {t.platform && <Pill>{t.platform}</Pill>}
              </li>
            ))}
          </ol>
        </SectionCard>
      )}

      {(confidence || sourceStats) && (
        <Collapse label="AI Reasoning & Data Sources" defaultOpen={confidence && confidence.overall < 70}>
          <div className="space-y-4">
            {confidence && (
              <div className="flex items-start gap-4">
                <div className="relative flex items-center justify-center shrink-0">
                  <svg className="w-14 h-14 transform -rotate-90">
                    <circle cx="28" cy="28" r="22" stroke="currentColor" className="text-border-mist" strokeWidth="4" fill="transparent" />
                    <circle cx="28" cy="28" r="22" stroke="currentColor" className="text-accent-purple" strokeWidth="4" fill="transparent"
                      strokeDasharray={2 * Math.PI * 22}
                      strokeDashoffset={2 * Math.PI * 22 * (1 - (confidence.overall || 50) / 100)} />
                  </svg>
                  <span className="absolute font-display font-black text-sm text-secondary">{confidence.overall || 0}</span>
                </div>
                <div className="flex-1">
                  <p className="text-[13px] font-semibold text-secondary mb-1">Confidence: {confidence.overall || 0}%</p>
                  <p className="text-[12.5px] text-text-slate font-medium">{confidence.reason}</p>
                  {missingData && missingData.length > 0 && (
                    <p className="text-[11.5px] text-amber-600 font-semibold mt-2">
                      No recent activity: {missingData.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            )}
            {sourceStats && sourceStats.length > 0 && (
              <div>
                <p className="text-[12px] font-bold text-text-slate uppercase tracking-wide mb-2">Sync status</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sourceStats.map((s, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-background-mist border border-border-mist">
                      <span className="text-[12.5px] font-bold text-secondary capitalize">{s.platform}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-text-slate font-semibold">{s.itemsProcessed} items</span>
                        <Pill tone={s.syncStatus === "ok" ? "low" : s.syncStatus === "error" ? "high" : "neutral"}>
                          {s.syncStatus}
                        </Pill>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Collapse>
      )}
    </div>
  );
});
