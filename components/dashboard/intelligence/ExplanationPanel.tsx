"use client";
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NormalizedEvent } from "@/lib/events/normalized-event";
import { X, Info, Target, Activity, Percent, Lightbulb, CheckCircle } from "lucide-react";

interface ExplanationPanelProps {
  event: NormalizedEvent | null;
  onClose: () => void;
}

export function ExplanationPanel({ event, onClose }: ExplanationPanelProps) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-secondary" />
          <h3 className="font-display font-black text-lg text-secondary">Classification Details</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>
      {event ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-background-mist">
            <Lightbulb className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-bold text-secondary mb-0.5">Reason</p>
              <p className="text-[12px] text-text-slate">{event.explanation}</p>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="w-3.5 h-3.5 text-text-slate" />
              <span className="text-[12px] font-bold text-text-slate uppercase tracking-wider">Matched Rules</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.rulesMatched.map((rule, i) => (
                <span key={i} className="text-[11px] font-semibold px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20">
                  {rule}
                </span>
              ))}
              {event.rulesMatched.length === 0 && (
                <span className="text-[12px] text-text-slate">No rules matched</span>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="w-3.5 h-3.5 text-text-slate" />
              <span className="text-[12px] font-bold text-text-slate uppercase tracking-wider">Signals</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {event.labels.map((label, i) => (
                <span key={i} className="text-[11px] font-semibold px-2 py-1 rounded-md bg-accent-purple/10 text-accent-purple border border-accent-purple/20">
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl bg-background-mist">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-success" />
              <span className="text-[13px] font-bold text-secondary">Confidence</span>
            </div>
            <span className="font-display font-black text-xl text-success">{Math.round(event.confidence * 100)}%</span>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <CheckCircle className="w-5 h-5 text-primary shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-secondary mb-0.5">Recommended Action</p>
              <p className="text-[12px] text-text-slate">{event.priority === "critical" || event.priority === "high" ? "Respond within the hour" : "Review when available"}</p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-center text-[13px] text-text-slate py-6">Select an event to see classification details.</p>
      )}
    </Card>
  );
}

export default ExplanationPanel;
