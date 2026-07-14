"use client";

import React from "react";
import { BriefingRecord } from "@/lib/repositories/briefings-repository";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, BookOpen, Inbox } from "lucide-react";

interface BriefingExecutiveCardProps {
  latestBriefing: BriefingRecord | null;
  onRegenerate: () => void;
  isGenerating?: boolean;
}

export function BriefingExecutiveCard({
  latestBriefing,
  onRegenerate,
  isGenerating = false,
}: BriefingExecutiveCardProps) {
  const latestBriefContent = latestBriefing?.full_content as Record<string, any> | undefined;

  if (!latestBriefing) {
    return (
      <Card className="neo-border bg-surface-white p-10 neo-shadow-sm text-center space-y-4">
        <Inbox className="w-12 h-12 text-text-fog mx-auto" />
        <div>
          <h3 className="font-display font-black text-xl text-secondary">No AI Briefings Available</h3>
          <p className="text-text-slate text-[14px] font-medium max-w-sm mx-auto mt-1">
            Connect your accounts and click &apos;Regenerate Brief&apos; to build your very first briefing.
          </p>
        </div>
        <Button
          onClick={onRegenerate}
          disabled={isGenerating}
          className="rounded-[12px] bg-accent-purple hover:bg-accent-purple/90 text-white font-bold h-10 px-5 shadow-sm"
        >
          Generate First Briefing
        </Button>
      </Card>
    );
  }

  return (
    <Card className="neo-border bg-surface-white p-8 neo-shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between gap-6 hover:shadow-flat-md transition-all duration-300">
      <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none" />

      <div className="space-y-4 flex-1 relative z-10">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-accent-purple/10 text-accent-purple rounded-lg border border-accent-purple/20">
            <Sparkles className="w-4 h-4" />
          </span>
          <h2 className="font-display font-black text-xl text-secondary">
            {latestBriefing.title}
          </h2>
        </div>

        <p className="text-[15px] font-medium text-secondary leading-relaxed bg-accent-purple/5 border border-accent-purple/10 p-5 rounded-2xl">
          {latestBriefing.executive_summary}
        </p>

        <div className="flex flex-wrap items-center gap-6 text-[12.5px] font-bold text-text-slate">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>Generated {new Date(latestBriefing.generated_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
          {latestBriefContent?.readingTimeMinutes && (
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              <span>{latestBriefContent.readingTimeMinutes} min read</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center md:justify-center border-t md:border-t-0 md:border-l border-border-mist pt-5 md:pt-0 md:pl-8 shrink-0 relative z-10">
        <div className="flex flex-row md:flex-col items-center gap-4 text-center">
          <div className="relative flex items-center justify-center">
            <svg className="w-20 h-20 transform -rotate-90">
              <circle cx="40" cy="40" r="32" stroke="currentColor" className="text-border-mist" strokeWidth="6" fill="transparent" />
              <circle cx="40" cy="40" r="32" stroke="currentColor" className="text-accent-purple" strokeWidth="6" fill="transparent"
                strokeDasharray={2 * Math.PI * 32}
                strokeDashoffset={2 * Math.PI * 32 * (1 - (latestBriefing.priority_score || 50) / 100)} />
            </svg>
            <span className="absolute font-display font-black text-xl text-secondary">
              {latestBriefing.priority_score}
            </span>
          </div>
          <div className="text-left md:text-center">
            <h4 className="font-bold text-[14px] text-secondary">Priority Score</h4>
            <p className="text-[11.5px] text-text-slate font-semibold mt-0.5">Workspace Alert Level</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default BriefingExecutiveCard;
