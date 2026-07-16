"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Activity, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react";

interface ToolCallRecord {
  tool_name: string;
  status: string;
  duration: number | null;
  created_at: string;
}

interface HealthData {
  lastSync: string | null;
  recentActivity: ToolCallRecord[];
  errorCount: number;
  totalCalls: number;
  successRate: number;
}

interface Props {
  userId: string;
  provider: string;
}

export function IntegrationHealthCard({ userId, provider }: Props) {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !userId) return;
    import("@/app/actions/integration-health").then(mod =>
      mod.getIntegrationHealthAction(userId, provider).then(setHealth)
    );
  }, [isOpen, userId, provider]);

  return (
    <div className="mt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-[12px] font-bold text-text-slate hover:text-secondary transition-colors"
      >
        <Activity className="w-4 h-4" />
        {isOpen ? "Hide" : "Show"} Activity & Health
      </button>

      {isOpen && health && (
        <Card className="mt-2 p-3 bg-background-mist border-[1.5px] border-border-mist rounded-xl text-[11px] font-semibold text-text-slate space-y-2">
          <div className="flex justify-between">
            <span>Last Sync</span>
            <span className="font-bold text-secondary">{health.lastSync ? new Date(health.lastSync).toLocaleString() : "Never"}</span>
          </div>
          <div className="flex justify-between">
            <span>Success Rate</span>
            <span className={`font-bold ${health.successRate >= 80 ? "text-success" : "text-error"}`}>{health.successRate}%</span>
          </div>
          <div className="flex justify-between">
            <span>Total Calls</span>
            <span className="font-bold text-secondary">{health.totalCalls}</span>
          </div>
          <div className="flex justify-between">
            <span>Errors</span>
            <span className={`font-bold ${health.errorCount > 0 ? "text-error" : "text-success"}`}>{health.errorCount}</span>
          </div>

          {health.recentActivity.length > 0 && (
            <div className="pt-2 border-t border-border-mist">
              <p className="font-bold text-secondary mb-1">Recent Activity</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {health.recentActivity.map((act, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    {act.status === "success" ? <CheckCircle2 className="w-3 h-3 text-success shrink-0" /> : <XCircle className="w-3 h-3 text-error shrink-0" />}
                    <span className="truncate flex-1">{act.tool_name}</span>
                    {act.duration && <span className="shrink-0"><Clock className="w-3 h-3 inline mr-0.5" />{act.duration}ms</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
