"use client";

import React, { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Check, Play, Zap } from "lucide-react";
import { BriefingScheduleRecord } from "@/lib/repositories/briefings-repository";
import { BRIEFING_CATEGORIES } from "@/lib/constants/briefing-categories";

const ALL_APPS = ["gmail", "outlook", "slack", "whatsapp", "telegram", "discord", "github", "linkedin", "calendar", "notion", "linear"];
const ALL_CATS = [...BRIEFING_CATEGORIES];

interface NewScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    id?: string;
    name: string;
    goal: string;
    frequency: string;
    timezone: string;
    integrations: string[];
    categories: string[];
  }) => Promise<void>;
  editSchedule?: BriefingScheduleRecord | null;
}

export function NewScheduleDialog({ isOpen, onClose, onSubmit, editSchedule }: NewScheduleDialogProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [integrations, setIntegrations] = useState<string[]>(["gmail", "slack"]);
  const [categories, setCategories] = useState<string[]>(["email", "messages", "tasks", "followUps"]);
  const [frequency, setFrequency] = useState("morning_brief");
  const [timezone, setTimezone] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!editSchedule;

  useEffect(() => {
    if (editSchedule) {
      setName(editSchedule.name || "");
      setGoal(editSchedule.goal || "");
      setIntegrations(editSchedule.integrations || ["gmail", "slack"]);
      setCategories(editSchedule.categories || ["email", "messages", "tasks", "followUps"]);
      setFrequency(editSchedule.frequency || "morning_brief");
      setTimezone(editSchedule.timezone || "UTC");
      setStep(1);
    }
  }, [editSchedule]);

  useEffect(() => {
    if (!isOpen) {
      if (!isEditing) {
        setName("");
        setGoal("");
        setIntegrations(["gmail", "slack"]);
        setCategories(["email", "messages", "tasks", "followUps"]);
        setFrequency("morning_brief");
        try { setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone); } catch { setTimezone("UTC"); }
      }
      setStep(1);
    }
  }, [isOpen, isEditing]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim() || integrations.length === 0) return;
    setIsSubmitting(true);
    await onSubmit({
      id: editSchedule?.id,
      name, goal: goal.trim() || "", frequency, timezone, integrations, categories,
    });
    setIsSubmitting(false);
    onClose();
  };

  const toggleApp = (app: string) => {
    if (integrations.includes(app)) setIntegrations(integrations.filter(a => a !== app));
    else setIntegrations([...integrations, app]);
  };

  const toggleCat = (cat: string) => {
    if (categories.includes(cat)) setCategories(categories.filter(c => c !== cat));
    else setCategories([...categories, cat]);
  };

  const frequencyLabels: Record<string, string> = {
    every_15_min: "Every 15 minutes", hourly: "Hourly", morning_brief: "Morning (8 AM)",
    evening_brief: "Evening (6 PM)", daily: "Daily", weekly: "Weekly",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-[4px] animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h3 className="font-display font-black text-lg text-secondary">{isEditing ? "Edit Schedule" : "New Schedule"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-1 px-6 pt-5 pb-2">
          {[1,2,3,4].map(s => (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black ${
                s < step ? "bg-accent-purple text-white" : s === step ? "bg-accent-purple/10 text-accent-purple border-2 border-accent-purple" : "bg-slate-100 text-slate-400"
              }`}>
                {s < step ? <Check className="w-3.5 h-3.5" /> : s}
              </div>
              {s < 4 && <div className={`h-0.5 flex-1 ${s < step ? "bg-accent-purple" : "bg-slate-200"}`} />}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Step 1: Name + Goal */}
          {step === 1 && (
            <>
              <div className="space-y-1">
                <label className="text-[12px] font-black uppercase text-text-slate tracking-wider">Schedule Name</label>
                <input
                  type="text" required value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Daily Standup Brief"
                  className="w-full rounded-xl border border-border-mist bg-white text-[14px] font-semibold text-secondary px-4 py-2.5 outline-none focus:border-accent-purple"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-black uppercase text-text-slate tracking-wider">Goal / Description</label>
                <textarea
                  value={goal} onChange={e => setGoal(e.target.value)}
                  placeholder="What should the AI focus on? (e.g. Acme Corp project updates)"
                  rows={3}
                  className="w-full rounded-xl border border-border-mist bg-white text-[14px] font-semibold text-secondary p-4 outline-none focus:border-accent-purple resize-none"
                />
              </div>
            </>
          )}

          {/* Step 2: App Selection */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-[13px] font-bold text-text-slate">Select platforms to include:</p>
              <div className="grid grid-cols-2 gap-3">
                {ALL_APPS.map(app => {
                  const active = integrations.includes(app);
                  return (
                    <button key={app} type="button" onClick={() => toggleApp(app)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                        active ? "border-accent-purple bg-accent-purple/5" : "border-border-mist bg-white hover:border-text-fog"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[13px] font-black uppercase ${
                        active ? "bg-accent-purple text-white" : "bg-slate-100 text-slate-500"
                      }`}>{app[0]}</div>
                      <div>
                        <p className="font-bold text-[13px] text-secondary capitalize">{app}</p>
                        <p className="text-[11px] text-text-slate font-medium capitalize">{({
  gmail: "Email", outlook: "Email", slack: "Messages", whatsapp: "Messages",
  telegram: "Messages", discord: "Messages", github: "Issues, PRs",
  linkedin: "Feed", calendar: "Events", notion: "Pages", linear: "Issues"
} as Record<string, string>)[app] || "Messages"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Categories */}
          {step === 3 && (
            <div className="space-y-3">
              <p className="text-[13px] font-bold text-text-slate">Choose categories to include:</p>
              <div className="grid grid-cols-2 gap-3">
                {ALL_CATS.map(cat => {
                  const active = categories.includes(cat);
                  return (
                    <button key={cat} type="button" onClick={() => toggleCat(cat)}
                      className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                        active ? "border-accent-purple bg-accent-purple/5" : "border-border-mist bg-white hover:border-text-fog"
                      }`}
                    >
                      <div className={`w-3 h-3 rounded-full ${active ? "bg-accent-purple" : "bg-slate-200"}`} />
                      <span className="font-bold text-[13px] text-secondary capitalize">{cat.replace(/([A-Z])/g, " $1").trim()}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Timing + Preview */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-black uppercase text-text-slate tracking-wider">Frequency</label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value)}
                    className="w-full rounded-xl border border-border-mist bg-white text-[13px] font-semibold text-secondary px-3 py-2.5 outline-none focus:border-accent-purple"
                  >
                    {Object.entries(frequencyLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-black uppercase text-text-slate tracking-wider">Timezone</label>
                  <input type="text" required value={timezone} onChange={e => setTimezone(e.target.value)}
                    className="w-full rounded-xl border border-border-mist bg-white text-[12px] font-bold text-secondary px-3 py-2.5 outline-none focus:border-accent-purple"
                  />
                </div>
              </div>

              <div className="bg-accent-purple/5 border border-accent-purple/10 rounded-2xl p-5 space-y-2">
                <h4 className="text-[13px] font-black text-accent-purple">Preview</h4>
                <p className="text-[13px] font-medium text-secondary leading-relaxed">
                  {name ? `"${name}"` : "This schedule"} will run{" "}
                  <span className="font-bold">{frequencyLabels[frequency]?.toLowerCase()}</span>
                  , pulling from <span className="font-bold">{integrations.join(", ")}</span>,
                  focused on <span className="font-bold">{categories.join(", ")}</span>.
                </p>
                {goal && <p className="text-[12px] text-text-slate italic">Goal: {goal}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-5 border-t border-slate-100">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1 text-[13px] font-bold text-text-slate hover:text-secondary transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{step > 1 ? "Back" : "Cancel"}</span>
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !name.trim() || step === 2 && integrations.length === 0 || step === 3 && categories.length === 0}
              className="flex items-center gap-1 rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[13px] h-10 px-5 shadow-md disabled:opacity-50 disabled:pointer-events-none"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[13px] h-10 px-6 shadow-md disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : isEditing ? "Update Schedule" : "Create Schedule"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
