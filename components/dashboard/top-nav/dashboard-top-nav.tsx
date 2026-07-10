"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  Sparkles,
  Plus,
  Bell,
  Menu,
  ChevronRight,
  User as UserIcon,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

/* ── Breadcrumb Helpers ── */
const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  "ai-agent": "AI Agent",
  briefing: "Briefing",
  inbox: "Inbox",
  tasks: "Tasks",
  calendar: "Calendar",
  integrations: "Integrations",
  files: "Files",
  alerts: "Alerts",
  analytics: "Analytics",
  pricing: "Pricing",
  feedback: "Feedback",
  help: "Help Center",
  settings: "Settings",
};

function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .filter((s) => s !== "dashboard");

  return (
    <nav className="flex items-center gap-1.5 text-[13px] font-semibold" aria-label="Breadcrumb">
      <Link
        href="/dashboard"
        className="text-text-fog hover:text-primary transition-colors"
      >
        Home
      </Link>
      {segments.map((seg, i) => {
        const href = "/dashboard/" + segments.slice(0, i + 1).join("/");
        const label = ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
        const isLast = i === segments.length - 1;

        return (
          <React.Fragment key={href}>
            <ChevronRight className="w-3.5 h-3.5 text-text-fog/60" />
            {isLast ? (
              <span className="text-secondary">{label}</span>
            ) : (
              <Link
                href={href}
                className="text-text-fog hover:text-primary transition-colors"
              >
                {label}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

/* ── Top Nav Props ── */
interface DashboardTopNavProps {
  onMobileMenuOpen: () => void;
}

/* ── Top Nav Component ── */
export function DashboardTopNav({ onMobileMenuOpen }: DashboardTopNavProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const notifRef = React.useRef<HTMLDivElement>(null);

  /* Close notifications on outside click */
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const mockNotifications = [
    {
      id: 1,
      title: "New message in #general",
      desc: "Sarah mentioned you in Slack",
      time: "2m ago",
      unread: true,
    },
    {
      id: 2,
      title: "Task completed",
      desc: "Q3 Report has been finalized",
      time: "15m ago",
      unread: true,
    },
    {
      id: 3,
      title: "Calendar reminder",
      desc: "Team standup in 30 minutes",
      time: "28m ago",
      unread: false,
    },
  ];

  const unreadCount = mockNotifications.filter((n) => n.unread).length;

  return (
    <header
      className="
        sticky top-0 z-20 flex-shrink-0
        flex items-center justify-between gap-4
        px-4 sm:px-6 py-3
        bg-surface-white/95 backdrop-blur-md
        border-b-[2.5px] border-border-mist
      "
    >
      {/* Left: Hamburger (mobile) + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile hamburger */}
        <button
          onClick={onMobileMenuOpen}
          className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-border-mist text-secondary transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" strokeWidth={2.5} />
        </button>

        <Breadcrumb />
      </div>

      {/* Center: Search */}
      <div className="hidden md:flex flex-1 max-w-[520px] mx-4">
        <div
          className={`
            relative w-full flex items-center gap-2.5
            bg-background-mist border-[2px] rounded-2xl
            transition-all duration-200
            ${searchFocused ? "border-primary shadow-md" : "border-border-mist"}
          `}
        >
          <Search className="absolute left-3.5 w-4 h-4 text-text-fog" />
          <input
            type="text"
            placeholder="Search anything…"
            className="
              w-full bg-transparent pl-10 pr-4 py-2.5
              text-[14px] font-medium text-secondary
              placeholder:text-text-fog
              outline-none
            "
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
          <button className="absolute right-2 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-accent-purple/10 text-accent-purple text-[12px] font-bold hover:bg-accent-purple/20 transition-colors">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Ask Syncar AI…</span>
          </button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Mobile search trigger */}
        <button className="md:hidden p-2 rounded-xl hover:bg-border-mist text-text-slate transition-colors">
          <Search className="w-5 h-5" />
        </button>

        {/* Create button */}
        <button
          className="
            hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl
            bg-primary text-white text-[13px] font-bold
            hover:bg-primary/90 transition-colors
            border-[2px] border-secondary shadow-sm
            hover:shadow-md active:shadow-none
          "
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Create</span>
        </button>

        {/* Mobile create */}
        <button className="sm:hidden p-2 rounded-xl bg-primary text-white hover:bg-primary/90 transition-colors border-[2px] border-secondary">
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotifOpen((v) => !v)}
            className="relative p-2 rounded-xl hover:bg-border-mist text-text-slate transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-error border-2 border-surface-white animate-pulse" />
            )}
          </button>

          {/* Notification dropdown */}
          {notifOpen && (
            <div
              className="
                absolute right-0 top-full mt-2
                w-[340px] bg-surface-white
                border-[2.5px] border-secondary rounded-2xl
                shadow-lg overflow-hidden z-50
              "
            >
              <div className="flex items-center justify-between px-4 py-3 border-b-[2px] border-border-mist">
                <h3 className="font-display font-black text-[15px] text-secondary">
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="text-[12px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="max-h-[280px] overflow-y-auto">
                {mockNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`
                      flex items-start gap-3 px-4 py-3 border-b border-border-mist/60
                      hover:bg-background-mist transition-colors cursor-pointer
                      ${notif.unread ? "bg-primary/[0.03]" : ""}
                    `}
                  >
                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${notif.unread ? "bg-primary" : "bg-transparent"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[13px] text-secondary truncate">
                        {notif.title}
                      </p>
                      <p className="text-[12px] text-text-slate mt-0.5 truncate">
                        {notif.desc}
                      </p>
                    </div>
                    <span className="text-[11px] text-text-fog font-medium flex-shrink-0 mt-0.5">
                      {notif.time}
                    </span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t-[2px] border-border-mist">
                <button className="w-full text-center text-[13px] font-bold text-primary hover:underline">
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          className={`
            relative p-2 rounded-xl transition-all duration-300 cursor-pointer
            overflow-hidden group
            ${isDark
              ? "bg-slate-800/60 text-amber-300 hover:bg-slate-700/80 hover:text-amber-200"
              : "bg-amber-50 text-amber-600 hover:bg-amber-100 hover:text-amber-700"
            }
          `}
        >
          {/* Sun icon */}
          <Sun
            className={`
              w-5 h-5 transition-all duration-500 ease-out absolute inset-0 m-auto
              ${isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}
            `}
            strokeWidth={2.5}
          />
          {/* Moon icon */}
          <Moon
            className={`
              w-5 h-5 transition-all duration-500 ease-out
              ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}
            `}
            strokeWidth={2.5}
          />
          {/* Glow ring on hover */}
          <span
            className={`
              absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100
              transition-opacity duration-300 pointer-events-none
              ${isDark
                ? "ring-2 ring-amber-400/30"
                : "ring-2 ring-amber-400/40"
              }
            `}
          />
        </button>

        {/* User avatar */}
        <button className="p-1 rounded-xl hover:ring-2 hover:ring-primary/30 transition-all">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-white">
            <UserIcon className="w-4 h-4" strokeWidth={2} />
          </div>
        </button>
      </div>
    </header>
  );
}
