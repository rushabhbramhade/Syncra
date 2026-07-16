"use client";

import React, { useState, useMemo } from "react";
import { History, Activity, Search, Calendar, ExternalLink } from "lucide-react";

interface HistoryTabProps {
  logs: Array<{
    id: string;
    schedule_id: string | null;
    briefing_id?: string | null;
    execution_time: string;
    duration: number;
    status: string;
    errors?: string | null;
    trigger_source: string;
  }>;
  schedules: Array<{ id: string; name: string }>;
  onViewBriefing?: (briefingId: string) => void;
}

export function HistoryTab({ logs, schedules, onViewBriefing }: HistoryTabProps) {
  const [search, setSearch] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (scheduleFilter !== "all" && log.schedule_id !== scheduleFilter) return false;
      if (dateFrom && new Date(log.execution_time) < new Date(dateFrom)) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(log.execution_time) > end) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const source = log.trigger_source.toLowerCase();
        const status = log.status.toLowerCase();
        return source.includes(q) || status.includes(q);
      }
      return true;
    });
  }, [logs, scheduleFilter, dateFrom, dateTo, search]);

  const getScheduleName = (scheduleId: string | null) => {
    if (!scheduleId) return "Manual";
    const sched = schedules.find(s => s.id === scheduleId);
    return sched?.name || "Unknown Schedule";
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display font-black text-xl text-secondary">Generation History</h3>
        <p className="text-[13px] font-medium text-text-slate mt-1">Past AI briefing generation runs, filterable by schedule and date.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-text-fog" />
          <input
            type="text" placeholder="Search history..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl border border-border-mist bg-background-mist text-[12.5px] font-semibold text-secondary pl-9 pr-3 py-2 outline-none focus:border-accent-purple focus:bg-white duration-150"
          />
        </div>
        <select value={scheduleFilter} onChange={e => setScheduleFilter(e.target.value)}
          className="rounded-xl border border-border-mist bg-background-mist text-[12.5px] font-semibold text-secondary px-3 py-2 outline-none focus:border-accent-purple"
        >
          <option value="all">All Schedules</option>
          {schedules.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          <option value="manual">Manual</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="rounded-xl border border-border-mist bg-background-mist text-[12.5px] font-semibold text-secondary px-3 py-2 outline-none focus:border-accent-purple" />
        <span className="text-[11px] font-bold text-text-slate">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="rounded-xl border border-border-mist bg-background-mist text-[12.5px] font-semibold text-secondary px-3 py-2 outline-none focus:border-accent-purple" />
      </div>

      {/* Logs */}
      <div className="space-y-2">
        {filteredLogs.length > 0 ? (
          filteredLogs.map(log => (
            <div key={log.id}
              onClick={() => log.briefing_id && onViewBriefing?.(log.briefing_id)}
              className={`p-4 rounded-2xl bg-white border-[1.5px] border-border-mist transition-all flex items-center justify-between gap-4 group ${
                log.briefing_id && onViewBriefing ? "cursor-pointer hover:border-text-fog hover:shadow-flat-sm" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
                  log.status === "success" ? "bg-success/10 text-success border-success/20" : "bg-error/10 text-error border-error/20"
                }`}>
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[13px] text-secondary">{getScheduleName(log.schedule_id)}</h4>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      log.status === "success" ? "bg-success/10 text-success border-success/20" : "bg-error/10 text-error border-error/20"
                    }`}>
                      {log.status}
                    </span>
                  </div>
                  <p className="text-[11.5px] font-medium text-text-slate mt-0.5 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(log.execution_time).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                    <span className="text-border-mist">{"\u00B7"}</span>
                    <span>{log.duration ? `${(log.duration / 1000).toFixed(1)}s` : "\u2014"}</span>
                    <span className="text-border-mist">{"\u00B7"}</span>
                    <span className="capitalize">{log.trigger_source}</span>
                  </p>
                  {log.errors && (
                    <p className="text-[11px] font-medium text-error mt-1">{log.errors}</p>
                  )}
                </div>
              </div>
              {log.briefing_id && onViewBriefing && (
                <div className="shrink-0 text-text-fog group-hover:text-accent-purple transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-text-slate font-medium space-y-2">
            <History className="w-10 h-10 text-text-fog mx-auto" />
            <h4 className="font-bold text-[14px]">No History Found</h4>
            <p className="text-[12px] max-w-xs mx-auto">Adjust your filters or generate your first briefing.</p>
          </div>
        )}
      </div>
    </div>
  );
}
