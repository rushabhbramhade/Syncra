"use client";
import React from "react";
import { IntelligenceResult } from "@/lib/intelligence/pipeline";
import { PriorityFeed } from "@/components/dashboard/intelligence/PriorityFeed";
import { ScoreBreakdown } from "@/components/dashboard/intelligence/ScoreBreakdown";
import { ExplanationPanel } from "@/components/dashboard/intelligence/ExplanationPanel";
import { RecommendationCard } from "@/components/dashboard/intelligence/RecommendationCard";
import { TimelineView } from "@/components/dashboard/intelligence/TimelineView";
import { QuickActions } from "@/components/dashboard/intelligence/QuickActions";
import { ProductivityDashboard } from "@/components/dashboard/analytics/ProductivityDashboard";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Lightbulb, TrendingUp, GitBranch } from "lucide-react";

interface IntelligenceSectionProps {
  data: IntelligenceResult | null;
  isLoading: boolean;
}

export function IntelligenceSection({ data, isLoading }: IntelligenceSectionProps) {
  if (isLoading) {
    return (
      <div className="mt-10 space-y-6 animate-pulse">
        <div className="h-6 w-48 bg-background-mist rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-background-mist rounded-xl" />
          <div className="h-64 bg-background-mist rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data || data.normalized.length === 0) return null;

  return (
    <div className="mt-10 space-y-8">
      <h2 className="font-display font-black text-2xl text-secondary">Intelligence</h2>

      <ProductivityDashboard
        metrics={null}
        isLoading={false}
      />

      {data.risks.length > 0 && (
        <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-error" />
            <h3 className="font-display font-black text-lg text-secondary">Risks Detected</h3>
          </div>
          <div className="space-y-3">
            {data.risks.map((risk, i) => (
              <div key={i} className="p-3 rounded-xl bg-error-bg border border-error/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    risk.severity === "critical" ? "bg-error text-white" :
                    risk.severity === "high" ? "bg-warning text-white" :
                    "bg-warning/20 text-warning"
                  }`}>{risk.severity}</span>
                  <span className="text-[10px] font-bold text-text-slate uppercase">{risk.riskType.replace(/_/g, " ")}</span>
                </div>
                <p className="text-[13px] font-semibold text-secondary">{risk.description}</p>
                <p className="text-[11px] text-text-slate mt-1">{risk.recommendedAction}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data.summary && (
        <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-5 h-5 text-warning" />
            <h3 className="font-display font-black text-lg text-secondary">Executive Summary</h3>
          </div>
          <p className="text-[14px] text-text-slate leading-relaxed">{data.summary}</p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-secondary" />
              <h3 className="font-display font-black text-lg text-secondary">Priority Feed</h3>
            </div>
            <PriorityFeed events={data.normalized} />
          </Card>

          {data.normalized.length > 0 && (
            <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <GitBranch className="w-5 h-5 text-secondary" />
                <h3 className="font-display font-black text-lg text-secondary">Timeline</h3>
              </div>
              <TimelineView events={data.normalized} />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {data.normalized.length > 0 && (
            <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
              <h3 className="font-display font-black text-lg text-secondary mb-4">Score Breakdown</h3>
              <ScoreBreakdown event={data.normalized[0]} onClose={() => {}} />
            </Card>
          )}

          <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
            <h3 className="font-display font-black text-lg text-secondary mb-4">Quick Actions</h3>
            <QuickActions event={null} onAction={() => {}} />
          </Card>

          {data.recommendations.length > 0 && data.recommendations.map((rec, i) => (
            <RecommendationCard key={i} recommendation={rec} onApply={() => {}} />
          ))}

          {Object.keys(data.explanations).length > 0 && (
            <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
              <h3 className="font-display font-black text-lg text-secondary mb-4">Why This Matters</h3>
              <div className="space-y-3">
                {data.normalized.slice(0, 3).map(event => (
                  <ExplanationPanel
                    key={event.id}
                    event={event}
                    onClose={() => {}}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
