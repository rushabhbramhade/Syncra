"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Mail, CheckCircle, Calendar, Clock, Zap, Brain } from "lucide-react";
import { ProductivityMetrics } from "./useProductivityMetrics";

interface ProductivityDashboardProps {
  metrics: ProductivityMetrics | null;
  isLoading: boolean;
}

export function ProductivityDashboard({ metrics, isLoading }: ProductivityDashboardProps) {
  if (isLoading || !metrics) {
    return (
      <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 bg-background-mist rounded-lg" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-background-mist rounded-xl" />)}
          </div>
        </div>
      </Card>
    );
  }

  const statCards = [
    { label: "Emails Replied", value: metrics.emailsReplied, icon: Mail, color: "text-accent-purple", bg: "bg-accent-purple/10" },
    { label: "Tasks Completed", value: metrics.tasksCompleted, icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
    { label: "Meetings Attended", value: metrics.meetingsAttended, icon: Calendar, color: "text-warning", bg: "bg-warning/10" },
    { label: "Avg Response", value: `${metrics.averageResponseTimeMinutes}m`, icon: Clock, color: "text-text-slate", bg: "bg-background-mist" },
    { label: "Focus Hours", value: `${metrics.focusHoursToday}h`, icon: Zap, color: "text-secondary", bg: "bg-secondary/5" },
    { label: "AI Interactions", value: metrics.aiInteractions, icon: Brain, color: "text-accent-purple", bg: "bg-accent-purple/5" },
  ];

  const TrendIcon = metrics.trend === "up" ? TrendingUp : metrics.trend === "down" ? TrendingDown : Minus;
  const trendColor = metrics.trend === "up" ? "text-success" : metrics.trend === "down" ? "text-error" : "text-text-slate";

  return (
    <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display font-black text-xl text-secondary">Productivity</h3>
        <div className={`flex items-center gap-1 text-[13px] font-bold ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span>{metrics.trend === "up" ? "Improving" : metrics.trend === "down" ? "Declining" : "Stable"}</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(stat => (
          <div key={stat.label} className="p-3 rounded-xl bg-background-mist border border-border-mist">
            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-2`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <p className="text-[20px] font-black text-secondary leading-none mb-1">{stat.value}</p>
            <p className="text-[11px] font-semibold text-text-slate">{stat.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
