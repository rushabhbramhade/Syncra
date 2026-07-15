"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NormalizedEvent } from "@/lib/events/normalized-event";
import { Send, Archive, Clock, CheckCircle, CalendarPlus, ExternalLink } from "lucide-react";

interface QuickActionsProps {
  event: NormalizedEvent | null;
  onAction: (action: string) => void;
}

const actions = [
  { id: "reply", label: "Reply", icon: Send },
  { id: "archive", label: "Archive", icon: Archive },
  { id: "snooze-1h", label: "Snooze 1h", icon: Clock },
  { id: "snooze-4h", label: "Snooze 4h", icon: Clock },
  { id: "snooze-24h", label: "Snooze 24h", icon: Clock },
  { id: "complete", label: "Mark Complete", icon: CheckCircle },
  { id: "follow-up", label: "Schedule Follow-up", icon: CalendarPlus },
  { id: "open", label: "Open Source", icon: ExternalLink },
];

export function QuickActions({ event, onAction }: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="secondary"
          size="sm"
          disabled={!event}
          onClick={() => onAction(action.id)}
          className={cn(
            "text-[12px] px-3 py-1.5 h-auto gap-1.5 rounded-xl",
            action.id === "reply" && "bg-primary text-white hover:bg-primary/90"
          )}
        >
          <action.icon className="w-3.5 h-3.5" />
          <span>{action.label}</span>
        </Button>
      ))}
    </div>
  );
}

export default QuickActions;
