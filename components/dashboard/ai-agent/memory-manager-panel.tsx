"use client";

import React, { useState } from "react";
import {
  Database,
  X,
  Trash2,
} from "lucide-react";

function MemoryManagerPanel({
  isOpen,
  memories,
  onAddMemory,
  onDeleteMemory,
  onClose,
}: {
  isOpen: boolean;
  memories: any[];
  onAddMemory: (key: string, value: string, category: string) => void;
  onDeleteMemory: (id: string) => void;
  onClose: () => void;
}) {
  const [memoryKey, setMemoryKey] = useState("");
  const [memoryVal, setMemoryVal] = useState("");
  const [memoryCategory, setMemoryCategory] = useState("context");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryKey.trim() || !memoryVal.trim()) return;
    onAddMemory(memoryKey.trim(), memoryVal.trim(), memoryCategory);
    setMemoryKey("");
    setMemoryVal("");
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-40 flex justify-end">
      <div className="w-full max-w-md bg-surface-white dark:bg-[#111827] h-full border-l-2.5 border-secondary dark:border-slate-800 flex flex-col neo-shadow-lg">
        <div className="p-4 border-b-2.5 border-secondary dark:border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-accent-purple" />
            <span className="font-display font-bold text-[15px]">Agent Memory</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-border-mist dark:hover:bg-slate-800 rounded-btn transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-b border-secondary/10 dark:border-slate-800 space-y-3">
          <span className="text-[10px] font-bold text-text-fog uppercase block">Add manual memory</span>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Key (e.g. preferred_model)"
              value={memoryKey}
              onChange={(e) => setMemoryKey(e.target.value)}
              className="flex-1 text-[12px] p-2 bg-background-mist dark:bg-slate-800 rounded-btn border border-secondary/20 dark:border-slate-700 focus:outline-none"
              required
            />

            <select
              value={memoryCategory}
              onChange={(e) => setMemoryCategory(e.target.value)}
              className="text-[12px] p-2 bg-background-mist dark:bg-slate-800 rounded-btn border border-secondary/20 dark:border-slate-700 focus:outline-none"
            >
              <option value="context">Context</option>
              <option value="instruction">Instruction</option>
              <option value="preference">Preference</option>
            </select>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Memory value detail..."
              value={memoryVal}
              onChange={(e) => setMemoryVal(e.target.value)}
              className="flex-1 text-[12px] p-2 bg-background-mist dark:bg-slate-800 rounded-btn border border-secondary/20 dark:border-slate-700 focus:outline-none"
              required
            />
            <button
              type="submit"
              className="py-1.5 px-3 bg-primary text-white font-bold text-[12px] rounded-btn neo-border neo-shadow-sm hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shrink-0"
            >
              Add
            </button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          <span className="text-[10px] font-bold text-text-fog uppercase block pb-1">Stored Memories</span>

          {memories.map((mem) => (
            <div
              key={mem.id}
              className="p-3 bg-background-mist dark:bg-[#0F1629] rounded-panel border border-secondary/10 dark:border-slate-800 flex justify-between items-start gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-mono font-bold text-text-ink">{mem.key}</span>
                  <span className="text-[8px] bg-accent-purple/10 text-accent-purple px-1.5 py-0.5 rounded font-bold uppercase">
                    {mem.category}
                  </span>
                </div>
                <p className="text-[11px] text-text-slate">{mem.value}</p>
              </div>
              <button
                onClick={() => onDeleteMemory(mem.id)}
                className="p-1 hover:text-error text-text-slate transition-colors cursor-pointer"
                title="Forget Memory"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {memories.length === 0 && (
            <div className="text-center py-8 text-text-fog text-[12px]">
              No memory records found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { MemoryManagerPanel };
export default MemoryManagerPanel;
