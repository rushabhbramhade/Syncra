"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Zap, Clock, TrendingUp, Target, Shield, MessageSquare, FileText, GitPullRequest } from "lucide-react";

const typeIcons: Record<string, React.ReactNode> = {
  reply: <MessageSquare className="w-4 h-4" />,
  review: <FileText className="w-4 h-4" />,
  pr: <GitPullRequest className="w-4 h-4" />,
  alert: <Shield className="w-4 h-4" />,
  action: <Target className="w-4 h-4" />,
};

const impactColors: Record<string, string> = {
  high: "bg-error/10 text-error border-error/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-success/10 text-success border-success/20",
};

interface Recommendation {
  text: string;
  type: string;
  estimatedEffortMinutes: number;
  businessImpact: string;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
  onApply: () => void;
}

export function RecommendationCard({ recommendation, onApply }: RecommendationCardProps) {
  return (
    <Card className="p-4 neo-shadow-sm">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-accent-purple/10 flex items-center justify-center">
          {typeIcons[recommendation.type] || <Zap className="w-4 h-4 text-accent-purple" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-secondary mb-2">{recommendation.text}</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-1 text-[12px] text-text-slate">
              <Clock className="w-3.5 h-3.5" />
              <span>{recommendation.estimatedEffortMinutes}m</span>
            </div>
            <span className={cn(
              "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
              impactColors[recommendation.businessImpact] || "bg-gray-500/10 text-gray-600 border-gray-200"
            )}>
              {recommendation.businessImpact} impact
            </span>
            <div className="flex items-center gap-1 text-[12px] text-text-slate">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>AI suggested</span>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={onApply} className="text-[13px] px-4 py-1.5 h-auto">
            <Zap className="w-3.5 h-3.5 mr-1" />
            Apply
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default RecommendationCard;
