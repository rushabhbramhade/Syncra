"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { NormalizedEvent } from "@/lib/events/normalized-event";
import { AlertCircle, Mail, MessageSquare, GitPullRequest, Calendar, Bell } from "lucide-react";

const platformBadges: Record<string, { icon: React.ReactNode; color: string }> = {
  gmail: { icon: <Mail className="w-3 h-3" />, color: "bg-red-500/10 text-red-600" },
  slack: { icon: <MessageSquare className="w-3 h-3" />, color: "bg-purple-500/10 text-purple-600" },
  github: { icon: <GitPullRequest className="w-3 h-3" />, color: "bg-gray-800/10 text-gray-800" },
  calendar: { icon: <Calendar className="w-3 h-3" />, color: "bg-blue-500/10 text-blue-600" },
  alerts: { icon: <Bell className="w-3 h-3" />, color: "bg-amber-500/10 text-amber-600" },
};

const priorityDots: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
  informational: "bg-gray-400",
};

interface TimelineViewProps {
  events: NormalizedEvent[];
}

function getGroupLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === yesterday.getTime()) return "Yesterday";
  if (d >= weekAgo) return "This Week";
  return "Older";
}

export function TimelineView({ events }: TimelineViewProps) {
  const grouped = React.useMemo(() => {
    const groups: Record<string, NormalizedEvent[]> = {};
    for (const ev of events) {
      const label = getGroupLabel(new Date(ev.timestamp));
      if (!groups[label]) groups[label] = [];
      groups[label].push(ev);
    }
    const order = ["Today", "Yesterday", "This Week", "Older"];
    return order.filter((k) => groups[k]).map((k) => ({ label: k, items: groups[k] }));
  }, [events]);

  return (
    <div className="max-h-[500px] overflow-y-auto space-y-4 pr-1">
      {grouped.map((group) => (
        <div key={group.label}>
          <h4 className="text-[11px] font-black uppercase tracking-widest text-text-slate mb-2 sticky top-0 bg-surface-white py-1">
            {group.label}
          </h4>
          <div className="space-y-1">
            {group.items.map((event) => {
              const badge = platformBadges[event.platform] || { icon: <AlertCircle className="w-3 h-3" />, color: "bg-gray-500/10 text-gray-600" };
              const time = new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              return (
                <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-background-mist transition-colors group cursor-default">
                  <span className="text-[11px] font-semibold text-text-slate w-12 shrink-0">{time}</span>
                  <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0", badge.color)}>
                    {badge.icon}
                  </span>
                  <span className="text-[13px] font-medium text-secondary truncate">{event.title}</span>
                  <span className={cn("w-2 h-2 rounded-full shrink-0 ml-auto", priorityDots[event.priority])} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {events.length === 0 && (
        <p className="text-center text-[13px] text-text-slate py-8">No timeline events.</p>
      )}
    </div>
  );
}

export default TimelineView;
