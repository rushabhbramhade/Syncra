"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface PriorityItem {
  platform: string;
  title: string;
  time: string;
  description: string;
  priority: string;
}

interface PriorityItemsCardProps {
  priorityItems: PriorityItem[];
  isLoading: boolean;
  renderPlatformIcon: (platform: string, className?: string) => React.ReactNode;
}

export function PriorityItemsCard({ priorityItems, isLoading, renderPlatformIcon }: PriorityItemsCardProps) {
  return (
    <Card className="neo-border bg-surface-white neo-shadow-md">
      <div className="p-6 border-b-[2px] border-border-mist flex items-center justify-between">
        <div>
          <h3 className="font-display font-black text-xl text-secondary">Priority Items</h3>
          <p className="text-[13px] text-text-slate font-medium mt-0.5">Needs your attention</p>
        </div>
        <div className="p-2 rounded-lg bg-warning/10 text-warning">
          <AlertCircle className="w-5 h-5" />
        </div>
      </div>

      <div className="p-2">
        {isLoading ? (
          <div className="space-y-2 p-4 animate-pulse">
            <div className="h-16 bg-background-mist rounded-xl border border-border-mist w-full"></div>
            <div className="h-16 bg-background-mist rounded-xl border border-border-mist w-full"></div>
            <div className="h-16 bg-background-mist rounded-xl border border-border-mist w-full"></div>
          </div>
        ) : priorityItems && priorityItems.length > 0 ? (
          <div className="divide-y-[1.5px] divide-border-mist">
            {priorityItems.slice(0, 4).map((item, i) => (
              <div key={i} className="p-4 hover:bg-background-mist transition-colors group cursor-default">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    {renderPlatformIcon(item.platform, "w-4 h-4")}
                    <h4 className="font-bold text-[14px] text-secondary line-clamp-1">
                      {item.title}
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-text-slate whitespace-nowrap bg-white border border-border-mist px-2 py-0.5 rounded-full">
                    {item.time}
                  </span>
                </div>
                <p className="text-[13px] text-text-slate font-medium line-clamp-2 mb-3">
                  {item.description}
                </p>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${
                    item.priority === 'High' ? 'bg-error/10 text-error' :
                    item.priority === 'Medium' ? 'bg-warning/10 text-warning' :
                    'bg-success/10 text-success'
                  }`}>
                    {item.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-[13px] text-text-slate font-medium">
            No priority items at the moment.
          </div>
        )}
      </div>
    </Card>
  );
}

export default PriorityItemsCard;
