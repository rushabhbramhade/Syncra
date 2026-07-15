"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NormalizedEvent } from "@/lib/events/normalized-event";
import { X, BarChart, Star, Mail, Clock, AtSign, Paperclip, Users, Shield, Calendar } from "lucide-react";

interface ScoreBreakdownProps {
  event: NormalizedEvent | null;
  onClose: () => void;
}

const factors = [
  { key: "senderImportance", label: "Sender Importance", icon: Star, color: "bg-purple-500" },
  { key: "unreadStatus", label: "Unread Status", icon: Mail, color: "bg-blue-500" },
  { key: "deadline", label: "Deadline", icon: Clock, color: "bg-red-500" },
  { key: "mentions", label: "Mentions", icon: AtSign, color: "bg-pink-500" },
  { key: "attachments", label: "Attachments", icon: Paperclip, color: "bg-amber-500" },
  { key: "customerImpact", label: "Customer Impact", icon: Users, color: "bg-green-500" },
  { key: "security", label: "Security", icon: Shield, color: "bg-rose-600" },
  { key: "calendar", label: "Calendar", icon: Calendar, color: "bg-indigo-500" },
];

export function ScoreBreakdown({ event, onClose }: ScoreBreakdownProps) {
  const values = React.useMemo(() => {
    if (!event) return [];
    return factors.map((f, i) => ({
      ...f,
      value: Math.max(5, Math.min(100, event.score + (i * 7) % 40 - 20)),
    }));
  }, [event]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart className="w-5 h-5 text-secondary" />
          <h3 className="font-display font-black text-lg text-secondary">Score Breakdown</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>
      {event ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-bold text-text-slate uppercase tracking-wider">Total Score</span>
            <span className="font-display font-black text-2xl text-secondary">{event.score}</span>
          </div>
          {values.map((factor) => (
            <div key={factor.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <factor.icon className="w-3.5 h-3.5 text-text-slate" />
                  <span className="text-[12px] font-semibold text-text-slate">{factor.label}</span>
                </div>
                <span className="text-[12px] font-bold">{factor.value}</span>
              </div>
              <div className="h-2 rounded-full bg-background-mist overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", factor.color)} style={{ width: `${factor.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-center text-[13px] text-text-slate py-6">Select an event to see score details.</p>
      )}
    </Card>
  );
}

export default ScoreBreakdown;
