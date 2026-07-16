"use client";

import React, { useState } from "react";
import { Info, AlertCircle } from "lucide-react";

interface WhyTagPopoverProps {
  category: string;
  signals?: string[];
  reason?: string;
}

export function WhyTagPopover({ category, signals = [], reason }: WhyTagPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="inline-flex items-center gap-1 text-[10px] font-bold text-text-slate hover:text-accent-purple transition-colors cursor-pointer"
      >
        <Info className="w-3 h-3" />
        <span>Why tagged as {category}?</span>
      </button>

      {open && (
        <div className="absolute top-5 left-0 z-30 w-64 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-4 animate-in fade-in slide-in-from-top-1 duration-150 text-left">
          <h4 className="text-[12px] font-black text-secondary mb-2 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-accent-purple" />
            <span>Classification: {category}</span>
          </h4>
          {reason && (
            <p className="text-[11px] font-medium text-text-slate mb-2 leading-relaxed">{reason}</p>
          )}
          {signals.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-text-slate uppercase tracking-wider mb-1">Signals detected:</p>
              <ul className="space-y-0.5">
                {signals.map((s, i) => (
                  <li key={i} className="text-[11px] font-medium text-text-slate flex items-start gap-1.5">
                    <span className="text-success mt-0.5">{"\u2022"}</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
