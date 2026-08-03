"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowUpRight } from "lucide-react";
import type { WorkspaceIntegration } from "@/app/actions/integrations";
import { getProviderMeta } from "@/features/integrations/constants/providers";

export interface IntegrationSearchProps {
  open: boolean;
  onClose: () => void;
  integrations: WorkspaceIntegration[];
  onSelect: (integration: WorkspaceIntegration) => void;
  onConnect: (integration: WorkspaceIntegration) => void;
}

function formatRelative(dateStr?: string) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Never";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function IntegrationSearch({
  open,
  onClose,
  integrations,
  onSelect,
  onConnect,
}: IntegrationSearchProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return integrations;
    return integrations.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.provider.toLowerCase().includes(q) ||
        (i.email || "").toLowerCase().includes(q) ||
        (i.scopes || "").toLowerCase().includes(q)
    );
  }, [integrations, query]);

  const close = useCallback(() => { setQuery(""); setActiveIndex(0); onClose(); }, [onClose]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter" && results[activeIndex]) onSelect(results[activeIndex]);
      else if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIndex, onSelect, close]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.96, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 12, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="w-full max-w-lg bg-surface-white neo-border rounded-[24px] overflow-hidden neo-shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b-2 border-border-mist">
              <Search className="w-5 h-5 text-text-fog shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
                placeholder="Search integrations, emails, providers..."
                className="flex-1 bg-transparent text-[15px] font-medium text-secondary placeholder:text-text-fog focus:outline-none"
              />
              <button onClick={close} className="p-1.5 hover:bg-black/5 rounded-lg text-text-slate" aria-label="Close search">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto py-2">
              {results.length === 0 ? (
                <p className="px-5 py-8 text-center text-text-fog font-semibold text-[14px]">
                  No results for &ldquo;{query}&rdquo;
                </p>
              ) : (
                results.map((integration, idx) => {
                  const meta = getProviderMeta(integration.provider);
                  return (
                    <button
                      key={integration.provider}
                      onClick={() => onSelect(integration)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                        idx === activeIndex ? "bg-background-mist" : ""
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-background-mist border border-border-mist flex items-center justify-center overflow-hidden shrink-0">
                        {meta.icon ? (
                          <img src={meta.icon} alt={integration.name} className="w-6 h-6 object-contain" />
                        ) : (
                          <span className="font-black uppercase text-sm text-secondary">{integration.name.slice(0, 1)}</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[14px] text-secondary truncate">{integration.name}</p>
                        <p className="text-[11px] text-text-slate font-medium truncate">
                          {integration.email || "Not connected"} · synced {formatRelative(integration.last_sync_at)}
                        </p>
                      </div>
                      {integration.connected ? (
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-success-bg border border-success text-success text-[10px] font-bold rounded-lg shrink-0">
                          Connected
                        </span>
                      ) : (
                        <span
                          onClick={(e) => { e.stopPropagation(); onConnect(integration); }}
                          className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded-lg shrink-0 cursor-pointer"
                        >
                          Connect <ArrowUpRight className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-5 py-2.5 border-t-2 border-border-mist text-[10px] text-text-fog font-semibold flex items-center gap-3">
              <span><kbd className="px-1 py-0.5 bg-background-mist border border-border-mist rounded">↑</kbd> <kbd className="px-1 py-0.5 bg-background-mist border border-border-mist rounded">↓</kbd> navigate</span>
              <span><kbd className="px-1 py-0.5 bg-background-mist border border-border-mist rounded">Enter</kbd> open</span>
              <span><kbd className="px-1 py-0.5 bg-background-mist border border-border-mist rounded">Esc</kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
