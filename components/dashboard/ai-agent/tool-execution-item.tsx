"use client";

import React, { useState } from "react";
import {
  Loader2,
  Check,
  ShieldAlert,
} from "lucide-react";

function ToolExecutionItem({ tc }: { tc: any }) {
  const [expanded, setExpanded] = useState(false);
  const isSuccess = tc.status === "success";
  const isFailed = tc.status === "failed";
  const duration = tc.duration ? `${(tc.duration / 1000).toFixed(2)}s` : null;

  return (
    <div className="bg-background-mist dark:bg-[#0F1629] rounded-panel border border-secondary/15 dark:border-slate-800 overflow-hidden text-[12.5px] font-mono shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-secondary/5 dark:hover:bg-slate-800 cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {tc.status === "pending" && <Loader2 className="w-4 h-4 animate-spin text-accent-purple" />}
          {isSuccess && <Check className="w-4 h-4 text-success" />}
          {isFailed && <ShieldAlert className="w-4 h-4 text-error" />}
          <span className="font-bold text-text-ink">
            {tc.tool_name}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[10px]">
          {duration && <span className="text-text-slate font-sans font-medium">{duration}</span>}
          <span
            className={`px-1.5 py-0.5 rounded font-sans font-bold uppercase text-[9px] ${
              tc.status === "pending" ? "bg-accent-purple/10 text-accent-purple" :
              isSuccess ? "bg-success-bg text-success" : "bg-error-bg text-error"
            }`}
          >
            {tc.status}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="p-3 bg-surface-white dark:bg-[#111827] border-t border-secondary/10 dark:border-slate-800 space-y-3 font-mono text-[11px] text-text-slate">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-text-fog uppercase block font-sans">Arguments</span>
            <pre className="p-2 bg-background-mist dark:bg-[#0F1629] rounded border border-secondary/5 dark:border-slate-800 overflow-x-auto scrollbar-hide text-text-ink">
              {JSON.stringify(tc.arguments, null, 2)}
            </pre>
          </div>

          {(tc.output || tc.error) && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-text-fog uppercase block font-sans">
                {isFailed ? "Error Message" : "Output Results"}
              </span>
              <pre className={`p-2 rounded border overflow-x-auto scrollbar-hide text-text-ink ${
                isFailed
                  ? "bg-error-bg/30 border-error/20 text-error"
                  : "bg-background-mist dark:bg-[#0F1629] border-secondary/5 dark:border-slate-800"
              }`}>
                {tc.output ? (
                  tc.output.startsWith("{") ? JSON.stringify(JSON.parse(tc.output), null, 2) : tc.output
                ) : tc.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { ToolExecutionItem };
export default ToolExecutionItem;
