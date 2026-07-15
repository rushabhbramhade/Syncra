"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { NormalizedEvent } from "@/lib/events/normalized-event";
import { AlertCircle, ArrowUp, MessageSquare, Mail, GitPullRequest, Calendar, Bell } from "lucide-react";

const platformIcons: Record<string, React.ReactNode> = {
  gmail: <Mail className="w-4 h-4" />,
  slack: <MessageSquare className="w-4 h-4" />,
  github: <GitPullRequest className="w-4 h-4" />,
  calendar: <Calendar className="w-4 h-4" />,
  alerts: <Bell className="w-4 h-4" />,
};

const priorityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 border-red-200",
  high: "bg-orange-500/10 text-orange-600 border-orange-200",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
  low: "bg-green-500/10 text-green-600 border-green-200",
  informational: "bg-gray-500/10 text-gray-600 border-gray-200",
};

interface PriorityFeedProps {
  events: NormalizedEvent[];
}

export function PriorityFeed({ events }: PriorityFeedProps) {
  const sorted = [...events].sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-3">
      {sorted.map((event) => (
        <Card key={event.id} className="p-4 flex items-start gap-3 neo-shadow-sm">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-surface-mist flex items-center justify-center">
            {platformIcons[event.platform] || <AlertCircle className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-bold text-[14px] text-secondary truncate">{event.title}</h4>
              <span className={cn(
                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border",
                priorityColors[event.priority]
              )}>
                {event.priority}
              </span>
            </div>
            <p className="text-[12px] text-text-slate line-clamp-2">{event.summary}</p>
          </div>
          <div className="shrink-0 flex items-center gap-1 text-[13px] font-bold">
            <ArrowUp className={cn(
              "w-3.5 h-3.5",
              event.score >= 70 ? "text-error" : event.score >= 40 ? "text-warning" : "text-text-slate"
            )} />
            <span>{event.score}</span>
          </div>
        </Card>
      ))}
      {sorted.length === 0 && (
        <p className="text-center text-[13px] text-text-slate py-8">No events to display.</p>
      )}
    </div>
  );
}

export default PriorityFeed;
