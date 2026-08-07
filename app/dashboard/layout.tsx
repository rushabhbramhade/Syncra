"use client";

import React, { useState, useEffect, useCallback } from "react";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopNav } from "@/components/dashboard/top-nav";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/components/auth-provider";

const SIDEBAR_KEY = "syncra-sidebar-collapsed";

function DashboardSessionGate({ children }: { children: React.ReactNode }) {
  const { user, dbUser, isLoading, errorMsg, refreshSession } = useAuth();

  if (errorMsg) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-mist p-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-secondary">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-text-slate">{errorMsg}</p>
          <button
            type="button"
            onClick={() => void refreshSession()}
            className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (isLoading || !user || !dbUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-mist">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/25 border-t-primary" />
          <p className="text-[14px] font-bold text-text-slate">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return children;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* ── Sidebar state ── */
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  /* Persist & restore collapsed state */
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(SIDEBAR_KEY);
        if (stored === "true") setCollapsed(true);
      } catch {
        // Ignore if localStorage is unavailable
      }
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  /* Close mobile drawer on resize to desktop */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = () => {
      if (mq.matches) setMobileOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  /* Auto-collapse on tablets */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
    if (mq.matches) {
      const timer = setTimeout(() => setCollapsed(true), 0);
      return () => clearTimeout(timer);
    }
  }, []);

  /* Prevent FOUC — render nothing until hydrated */
  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-mist">
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin h-8 w-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-[14px] font-bold text-text-slate">
            Loading workspace…
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <DashboardSessionGate>
        <ThemeProvider>
          <div className="flex h-screen overflow-hidden bg-background-mist font-sans">
          {/* ── Sidebar ── */}
          <DashboardSidebar
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            mobileOpen={mobileOpen}
            onMobileClose={closeMobile}
          />

          {/* ── Main Content Area ── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Top navigation */}
            <DashboardTopNav onMobileMenuOpen={openMobile} />

            {/* Scrollable page content */}
            <main className="flex-1 overflow-y-auto">
              <div className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8 max-w-[1440px] mx-auto">
                {children}
              </div>
            </main>
          </div>
          </div>
        </ThemeProvider>
      </DashboardSessionGate>
    </AuthProvider>
  );
}
