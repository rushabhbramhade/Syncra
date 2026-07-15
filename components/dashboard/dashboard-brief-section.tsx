"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

interface BriefItem {
  platform: string;
  text: string;
}

interface DashboardBriefSectionProps {
  title?: string;
  generatedAt?: string;
  executiveSummary?: string;
  briefItems: BriefItem[];
  briefId?: string;
  isLoading: boolean;
  renderPlatformIcon: (platform: string, className?: string) => React.ReactNode;
}

export function DashboardBriefSection({
  title,
  generatedAt,
  executiveSummary,
  briefItems,
  briefId,
  isLoading,
  renderPlatformIcon,
}: DashboardBriefSectionProps) {
  const router = useRouter();

  return (
    <div className="lg:col-span-2 space-y-8">
      <Card className="neo-border bg-surface-white p-8 neo-shadow-md relative overflow-hidden">
        <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-6 border-b-[2px] border-border-mist pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-accent-purple/10 text-accent-purple rounded-xl border-[1.5px] border-accent-purple shadow-sm">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display font-black text-2xl text-secondary">
                {title || "General Workspace Update"}
              </h2>
              <p className="text-text-slate text-[14px] font-medium">
                {generatedAt
                  ? `Generated on ${new Date(generatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
                  : "AI-generated summary of your workspace."}
              </p>
            </div>
          </div>

          {briefId && (
            <Button
              variant="ghost"
              onClick={() => router.push("/dashboard/briefing")}
              className="font-bold text-[13px] text-accent-purple hover:bg-accent-purple/10 rounded-xl px-3 flex items-center gap-1 border-[1.5px] border-accent-purple/30"
            >
              <span>Open Briefing</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>

        <div className="space-y-5 relative z-10">
          {isLoading ? (
            <div className="space-y-4 py-4 animate-pulse">
              <div className="h-20 bg-background-mist rounded-2xl border-[1.5px] border-border-mist w-full"></div>
              <div className="h-20 bg-background-mist rounded-2xl border-[1.5px] border-border-mist w-[90%]"></div>
              <div className="h-20 bg-background-mist rounded-2xl border-[1.5px] border-border-mist w-[95%]"></div>
            </div>
          ) : (
            <>
              {executiveSummary && (
                <div className="p-5 rounded-2xl bg-accent-purple/5 border-[1.5px] border-accent-purple/20 mb-4 transition-all duration-300 hover:bg-accent-purple/10">
                  <h4 className="font-bold text-[13px] text-accent-purple uppercase tracking-wider mb-2">Executive Summary</h4>
                  <p className="text-[15px] text-secondary font-medium leading-relaxed">
                    {executiveSummary}
                  </p>
                </div>
              )}

              <div className="space-y-4">
                {briefItems && briefItems.length > 0 ? (
                  briefItems.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-background-mist border-[1.5px] border-border-mist hover:border-text-fog transition-colors group">
                      <div className="shrink-0 mt-0.5 w-9 h-9 bg-white rounded-xl border-[1.5px] border-border-mist flex items-center justify-center shadow-sm">
                        {renderPlatformIcon(item.platform, "w-5 h-5")}
                      </div>
                      <p className="text-[14.5px] text-secondary font-medium leading-relaxed pt-0.5">
                        {item.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-text-slate font-medium">
                    No briefing data available today. Connect more platforms.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

export default DashboardBriefSection;
