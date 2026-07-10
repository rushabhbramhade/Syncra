"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background-mist font-sans">
      {/* ── Sidebar ── */}
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 bg-surface-white border-b-[2.5px] border-secondary z-20 sticky top-0">
          <div>
            <h1 className="font-display font-black text-xl text-secondary leading-tight">
              Dashboard
            </h1>
            <p className="text-[13px] text-text-slate font-medium mt-0.5">
              Welcome back 👋 — here's your workspace overview.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Realtime pulse */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-background-mist border-[2px] border-border-mist rounded-full text-xs font-bold text-text-slate">
              <span className="w-2 h-2 rounded-full bg-success animate-ping" />
              <span>Realtime Connected</span>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
