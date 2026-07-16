"use client";

import React, { useMemo } from "react";
import { BriefingRecord } from "@/lib/repositories/briefings-repository";
import { Card } from "@/components/ui/card";
import { Sparkles, Calendar, BookOpen, RefreshCw, Globe } from "lucide-react";

interface TodayHeroCardProps {
  latestBriefing: BriefingRecord | null;
  onRegenerate: () => void;
  isGenerating?: boolean;
}

function getPlatformIcon(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "gmail") return "\u2709";
  if (p === "outlook") return "@";
  if (p === "slack") return "#";
  if (p === "whatsapp") return "\uD83D\uDCAC";
  if (p === "telegram") return "\u2708";
  if (p === "discord") return "\uD83D\uDD09";
  if (p === "github") return "\u2B50";
  if (p === "linkedin") return "\uD83D\uDC64";
  if (p === "calendar") return "\uD83D\uDCC5";
  if (p === "notion") return "N";
  if (p === "linear") return "L";
  return "\uD83C\uDF10";
}

function getPlatformColor(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "gmail") return "bg-red-500/10 text-red-600 border-red-500/20";
  if (p === "outlook") return "bg-blue-600/10 text-blue-700 border-blue-600/20";
  if (p === "slack") return "bg-purple-500/10 text-purple-600 border-purple-500/20";
  if (p === "whatsapp") return "bg-green-500/10 text-green-600 border-green-500/20";
  if (p === "telegram") return "bg-sky-500/10 text-sky-600 border-sky-500/20";
  if (p === "discord") return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
  if (p === "github") return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  if (p === "linkedin") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  if (p === "calendar") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (p === "notion") return "bg-stone-500/10 text-stone-600 border-stone-500/20";
  if (p === "linear") return "bg-rose-500/10 text-rose-600 border-rose-500/20";
  return "bg-slate-500/10 text-slate-600 border-slate-500/20";
}

const CIRCUMFERENCE = 2 * Math.PI * 22;

export const TodayHeroCard = React.memo(function TodayHeroCard({ latestBriefing, onRegenerate, isGenerating = false }: TodayHeroCardProps) {
  const latestBriefContent = latestBriefing?.full_content as Record<string, any> | undefined;
  const platforms = useMemo(() => latestBriefContent?.items
    ? [...new Set(latestBriefContent.items.map((i: any) => i.platform))]
    : [], [latestBriefing]);

  if (!latestBriefing) {
    return (
      <Card className="bg-surface-white p-10 neo-shadow-sm text-center space-y-4">
        <div className="w-16 h-16 bg-accent-purple/10 rounded-full flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-accent-purple" />
        </div>
        <div>
          <h3 className="font-display font-black text-xl text-secondary">No AI Brief Yet</h3>
          <p className="text-text-slate text-[14px] font-medium max-w-sm mx-auto mt-1">
            Connect your accounts and generate your first daily briefing to see what matters today.
          </p>
        </div>
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className="inline-flex items-center gap-2 rounded-[12px] bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[14px] h-11 px-6 shadow-md hover:translate-y-[-1px] active:translate-y-0 duration-150"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
          <span>{isGenerating ? "Generating..." : "Generate Today's Brief"}</span>
        </button>
      </Card>
    );
  }

  return (
    <Card className="bg-surface-white p-8 neo-shadow-md relative overflow-hidden">
      <div className="absolute top-[-80px] right-[-80px] w-64 h-64 bg-accent-purple/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-accent-purple/10 text-accent-purple rounded-xl border border-accent-purple/20">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h2 className="font-display font-black text-2xl text-secondary">{latestBriefing.title}</h2>
              <p className="text-[13px] font-bold text-text-slate flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Generated {new Date(latestBriefing.generated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
                {latestBriefContent?.readingTimeMinutes && (
                  <>
                    <span className="text-border-mist">{"\u00B7"}</span>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{latestBriefContent.readingTimeMinutes} min read</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-text-slate" />
              <span className="text-[12px] font-bold text-text-slate">{platforms.length} sources</span>
            </div>
            <div className="relative flex items-center justify-center">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle cx="28" cy="28" r="22" stroke="currentColor" className="text-border-mist" strokeWidth="5" fill="transparent" />
                <circle cx="28" cy="28" r="22" stroke="currentColor" className="text-accent-purple" strokeWidth="5" fill="transparent"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - (latestBriefing.priority_score || 50) / 100)} />
              </svg>
              <span className="absolute font-display font-black text-sm text-secondary">{latestBriefing.priority_score}</span>
            </div>
          </div>
        </div>

        <p className="text-[15px] font-medium text-secondary leading-relaxed bg-accent-purple/5 border border-accent-purple/10 p-5 rounded-2xl">
          {latestBriefing.executive_summary}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {(platforms as string[]).map((p) => (
            <span key={p} className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${getPlatformColor(p)} flex items-center gap-1.5`}>
              <span>{getPlatformIcon(p)}</span>
              <span className="capitalize">{p}</span>
            </span>
          ))}
          <span className="text-[11px] font-bold text-text-slate bg-background-mist px-2.5 py-1 rounded-lg border border-border-mist">
            {latestBriefContent?.totalImportantItems || 0} items
          </span>
        </div>
      </div>
    </Card>
  );
});
