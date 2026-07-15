"use client";
import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Rule } from "@/lib/rules/types";
import { ToggleLeft, ToggleRight, Edit3, X, Tag, ChevronDown, ChevronUp } from "lucide-react";

const categoryColors: Record<string, string> = {
  important: "bg-error/10 text-error border-error/20",
  priority: "bg-warning/10 text-warning border-warning/20",
  followup: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  informational: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  risk: "bg-rose-500/10 text-rose-600 border-rose-500/20",
};

interface RuleEditorProps {
  rules: Rule[];
  onSave: (rules: Rule[]) => void;
}

export function RuleEditor({ rules, onSave }: RuleEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Rule[]>(rules);

  const toggleEnabled = (id: string) => {
    setDraft((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  };

  const updateCondition = (ruleId: string, condIndex: number, value: string) => {
    setDraft((prev) => prev.map((r) => r.id === ruleId ? {
      ...r,
      conditions: r.conditions.map((c, i) => i === condIndex ? { ...c, value } : c),
    } : r));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-black text-lg text-secondary">Classification Rules</h3>
        <Button variant="primary" size="sm" onClick={() => onSave(draft)} className="text-[13px] px-4 py-1.5 h-auto">
          Save Rules
        </Button>
      </div>
      {draft.map((rule) => (
        <Card key={rule.id} className="p-4 neo-shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-bold text-[14px] text-secondary">{rule.name}</h4>
                <span className={cn("text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border", categoryColors[rule.category])}>
                  {rule.category}
                </span>
              </div>
              <p className="text-[12px] text-text-slate mb-2">{rule.description}</p>
              {editingId === rule.id && (
                <div className="space-y-2 mt-3 pt-3 border-t border-border-mist">
                  {rule.conditions.map((cond, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[12px] font-semibold text-text-slate w-24 truncate">{cond.field}</span>
                      <span className="text-[11px] text-text-slate">{cond.operator}</span>
                      <input
                        type="text"
                        value={cond.value}
                        onChange={(e) => updateCondition(rule.id, i, e.target.value)}
                        className="flex-1 text-[12px] px-2 py-1 rounded-lg border border-border-mist bg-background-mist focus:outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingId(editingId === rule.id ? null : rule.id)}
                className="h-8 w-8 p-0"
              >
                {editingId === rule.id ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => toggleEnabled(rule.id)} className="h-8 w-8 p-0">
                {rule.enabled ? <ToggleRight className="w-5 h-5 text-success" /> : <ToggleLeft className="w-5 h-5 text-text-slate" />}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default RuleEditor;
