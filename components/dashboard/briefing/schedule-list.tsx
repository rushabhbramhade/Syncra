"use client";

import React from "react";
import { BriefingScheduleRecord } from "@/lib/repositories/briefings-repository";
import { Card } from "@/components/ui/card";
import { Clock, Trash2, Pause, Play, Edit3, Zap } from "lucide-react";

interface ScheduleListProps {
  schedules: BriefingScheduleRecord[];
  onToggle: (scheduleId: string, currentVal: boolean) => void;
  onDelete: (scheduleId: string) => void;
  onEdit?: (schedule: BriefingScheduleRecord) => void;
  onRunNow?: (scheduleId: string) => Promise<void>;
}

function getPlatformClass(platform: string) {
  const plat = platform.toLowerCase();
  if (plat === "gmail") return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
  if (plat === "outlook") return "bg-blue-600/10 text-blue-700 dark:text-blue-400 border-blue-600/20";
  if (plat === "whatsapp") return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
  if (plat === "slack") return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  if (plat === "telegram") return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
  if (plat === "discord") return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
  if (plat === "github") return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  if (plat === "linkedin") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  if (plat === "calendar") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (plat === "notion") return "bg-stone-500/10 text-stone-600 border-stone-500/20";
  if (plat === "linear") return "bg-rose-500/10 text-rose-600 border-rose-500/20";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
}

export function ScheduleList({ schedules, onToggle, onDelete, onEdit, onRunNow }: ScheduleListProps) {
  return (
    <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
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

                <div className="flex items-center gap-1.5">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(schedule)}
                      className="p-1.5 text-text-slate hover:text-accent-purple bg-white border border-border-mist rounded-lg transition-colors"
                      title="Edit Schedule"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(schedule.id!)}
                    className="p-1.5 text-text-slate hover:text-error bg-white border border-border-mist rounded-lg transition-colors hover:bg-error-bg"
                    title="Delete Schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
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
                  {onRunNow && (
                    <button
                      onClick={() => onRunNow(schedule.id!)}
                      className="p-1.5 text-text-slate hover:text-accent-orange bg-white border border-border-mist rounded-lg transition-colors"
                      title="Run Now"
                    >
                      <Zap className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onToggle(schedule.id!, schedule.enabled)}
                    className="p-1.5 text-text-slate hover:text-accent-purple bg-white border border-border-mist rounded-lg transition-colors"
                    title={schedule.enabled ? "Pause" : "Activate"}
                  >
                    {schedule.enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <span className={`text-[11.5px] font-bold ${schedule.enabled ? "text-success" : "text-text-slate"}`}>
                    {schedule.enabled ? "Active" : "Paused"}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-text-slate text-[13px] font-medium">
            No automated schedules. Click &quot;New Schedule&quot; to create one.
          </div>
        )}
      </div>
    </Card>
  );
}

export default ScheduleList;
