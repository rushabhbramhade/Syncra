"use client";

import React, { useState } from "react";
import { BriefingScheduleRecord } from "@/lib/repositories/briefings-repository";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Plus, Trash2, HelpCircle } from "lucide-react";

interface ScheduleListProps {
  schedules: BriefingScheduleRecord[];
  onToggle: (scheduleId: string, currentVal: boolean) => void;
  onDelete: (scheduleId: string) => void;
  onAdd: (data: {
    name: string;
    goal: string;
    frequency: string;
    timezone: string;
    integrations: string[];
    categories: string[];
  }) => Promise<void>;
  isSubmitting?: boolean;
}

function getPlatformClass(platform: string) {
  const plat = platform.toLowerCase();
  if (plat === "gmail") return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
  if (plat === "whatsapp") return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
  if (plat === "slack") return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  if (plat === "telegram") return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
}

export function ScheduleList({
  schedules,
  onToggle,
  onDelete,
  onAdd,
  isSubmitting = false,
}: ScheduleListProps) {
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [newScheduleGoal, setNewScheduleGoal] = useState("");
  const [newScheduleFreq, setNewScheduleFreq] = useState("morning_brief");
  const [newScheduleTZ, setNewScheduleTZ] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  });
  const [newScheduleApps, setNewScheduleApps] = useState<string[]>(["gmail", "whatsapp"]);
  const [newScheduleCats, setNewScheduleCats] = useState<string[]>(["email", "messages", "tasks"]);

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleName.trim() || newScheduleApps.length === 0) return;
    await onAdd({
      name: newScheduleName,
      goal: newScheduleGoal.trim() || "",
      frequency: newScheduleFreq,
      timezone: newScheduleTZ,
      integrations: newScheduleApps,
      categories: newScheduleCats,
    });
    setNewScheduleName("");
    setNewScheduleGoal("");
    setShowAddSchedule(false);
  };

  return (
    <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
      <div className="flex items-center justify-between border-b border-border-mist pb-4 mb-4">
        <h3 className="font-display font-black text-lg text-secondary flex items-center gap-1.5">
          <Clock className="w-5 h-5 text-accent-purple" />
          <span>Schedules</span>
        </h3>
        <button
          onClick={() => setShowAddSchedule(!showAddSchedule)}
          className="p-1.5 bg-background-mist text-secondary hover:bg-slate-200 border border-border-mist rounded-xl transition-all shadow-sm"
          title="Add Schedule"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showAddSchedule && (
        <form onSubmit={handleCreateSchedule} className="p-4 bg-background-mist border-[1.5px] border-border-mist rounded-2xl mb-4 space-y-4 animate-in slide-in-from-top duration-200">
          <div className="space-y-1">
            <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider">Schedule Name</label>
            <input
              type="text"
              required
              value={newScheduleName}
              onChange={(e) => setNewScheduleName(e.target.value)}
              placeholder="e.g. Daily Sync, Support Alert"
              className="w-full rounded-xl border border-border-mist bg-white text-[13px] font-semibold text-secondary px-3 py-2 outline-none focus:border-accent-purple"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider flex items-center gap-1">
              <span>Briefing Goal</span>
              <span title="Write what the AI should focus on (e.g. Acme project update)">
                <HelpCircle className="w-3 h-3 text-text-fog" />
              </span>
            </label>
            <textarea
              value={newScheduleGoal}
              onChange={(e) => setNewScheduleGoal(e.target.value)}
              placeholder="Focus summary on Acme Corp agreements and deployment reviews..."
              rows={2}
              className="w-full rounded-xl border border-border-mist bg-white text-[13px] font-semibold text-secondary p-3 outline-none focus:border-accent-purple resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider">Frequency</label>
              <select
                value={newScheduleFreq}
                onChange={(e) => setNewScheduleFreq(e.target.value)}
                className="w-full rounded-xl border border-border-mist bg-white text-[13px] font-semibold text-secondary px-3 py-2 outline-none focus:border-accent-purple"
              >
                <option value="every_15_min">Every 15 mins</option>
                <option value="hourly">Hourly</option>
                <option value="morning_brief">Morning Brief (8 AM)</option>
                <option value="evening_brief">Evening Brief (6 PM)</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider">Timezone</label>
              <input
                type="text"
                required
                value={newScheduleTZ}
                onChange={(e) => setNewScheduleTZ(e.target.value)}
                className="w-full rounded-xl border border-border-mist bg-white text-[12px] font-bold text-secondary px-3 py-2 outline-none focus:border-accent-purple"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider block">Integrations</label>
            <div className="flex flex-wrap gap-2">
              {["gmail", "whatsapp", "slack", "telegram"].map(app => {
                const active = newScheduleApps.includes(app);
                return (
                  <button
                    key={app}
                    type="button"
                    onClick={() => {
                      if (active) setNewScheduleApps(newScheduleApps.filter(a => a !== app));
                      else setNewScheduleApps([...newScheduleApps, app]);
                    }}
                    className={`text-[12px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                      active ? "bg-accent-purple text-white border-accent-purple" : "bg-white text-secondary border-border-mist"
                    }`}
                  >
                    {app}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider block">Brief Categories</label>
            <div className="flex flex-wrap gap-2">
              {["email", "messages", "tasks", "meetings", "follow-ups"].map(cat => {
                const active = newScheduleCats.includes(cat);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      if (active) setNewScheduleCats(newScheduleCats.filter(c => c !== cat));
                      else setNewScheduleCats([...newScheduleCats, cat]);
                    }}
                    className={`text-[12px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                      active ? "bg-accent-purple text-white border-accent-purple" : "bg-white text-secondary border-border-mist"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddSchedule(false)}
              className="rounded-xl font-bold text-[12.5px] h-9 px-3"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || newScheduleApps.length === 0}
              className="rounded-xl bg-accent-purple hover:bg-accent-purple/95 text-white font-bold text-[12.5px] h-9 px-4 shadow-sm"
            >
              {isSubmitting ? "Saving..." : "Save Schedule"}
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {schedules.length > 0 ? (
          schedules.map(schedule => (
            <div key={schedule.id} className="p-4 bg-background-mist border-[1.5px] border-border-mist rounded-2xl flex flex-col gap-2 hover:border-text-fog transition-all">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-[14.5px] text-secondary">{schedule.name}</h4>
                  <span className="text-[11px] font-semibold text-text-slate flex items-center gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{schedule.frequency} ({schedule.timezone})</span>
                  </span>
                </div>

                <button
                  onClick={() => onDelete(schedule.id!)}
                  className="p-1.5 text-text-slate hover:text-error bg-white border border-border-mist rounded-lg transition-colors hover:bg-error-bg"
                  title="Delete Schedule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {schedule.goal && (
                <p className="text-[12px] font-medium text-text-slate line-clamp-1 italic bg-white p-2 rounded-lg border border-border-mist/60">
                  &quot;{schedule.goal}&quot;
                </p>
              )}

              <div className="flex items-center justify-between border-t border-border-mist/60 pt-2 mt-1">
                <div className="flex flex-wrap gap-1.5">
                  {schedule.integrations.map(app => (
                    <span key={app} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${getPlatformClass(app)}`}>
                      {app}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11.5px] font-bold text-text-slate">
                    {schedule.enabled ? "Active" : "Paused"}
                  </span>

                  <button
                    onClick={() => onToggle(schedule.id!, schedule.enabled)}
                    className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ${
                      schedule.enabled ? "bg-accent-purple" : "bg-text-fog"
                    }`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform duration-300 ${
                      schedule.enabled ? "translate-x-4" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-text-slate text-[13px] font-medium">
            No automated schedules. Click + to add.
          </div>
        )}
      </div>
    </Card>
  );
}

export default ScheduleList;
