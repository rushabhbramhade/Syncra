"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Newspaper,
  Plug2,
  Bell,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    iconBg: "bg-blue-500",
    iconColor: "text-white",
  },
  {
    label: "AI Agent",
    href: "/dashboard/ai-agent",
    icon: Bot,
    iconBg: "bg-violet-500",
    iconColor: "text-white",
  },
  {
    label: "Briefing",
    href: "/dashboard/briefing",
    icon: Newspaper,
    iconBg: "bg-amber-500",
    iconColor: "text-white",
  },
  {
    label: "Integrations",
    href: "/dashboard/integrations",
    icon: Plug2,
    iconBg: "bg-emerald-500",
    iconColor: "text-white",
  },
  {
    label: "Alerts",
    href: "/dashboard/alerts",
    icon: Bell,
    iconBg: "bg-rose-500",
    iconColor: "text-white",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    iconBg: "bg-slate-600",
    iconColor: "text-white",
  },
];

const BOTTOM_ITEMS = [
  {
    label: "Pricing",
    href: "/dashboard/pricing",
    icon: CreditCard,
    iconBg: "bg-cyan-500",
    iconColor: "text-white",
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

function NavItem({
  item,
  collapsed,
  isActive,
}: {
  item: (typeof NAV_ITEMS)[number];
  collapsed: boolean;
  isActive: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={`
        group relative flex items-center gap-3.5 px-3 py-2.5 rounded-2xl transition-all duration-200 cursor-pointer select-none
        ${
          isActive
            ? "bg-secondary text-white shadow-md"
            : "text-text-slate hover:bg-border-mist hover:text-secondary"
        }
        ${collapsed ? "justify-center" : ""}
      `}
    >
      {/* Icon with solid color background */}
      <span
        className={`
          flex-shrink-0 flex items-center justify-center rounded-xl transition-transform duration-200
          ${item.iconBg} ${item.iconColor}
          ${collapsed ? "w-11 h-11" : "w-10 h-10"}
          group-hover:scale-105
        `}
      >
        <Icon className={collapsed ? "w-6 h-6" : "w-5 h-5"} strokeWidth={2} />
      </span>

      {/* Label — hidden when collapsed */}
      {!collapsed && (
        <span className="font-semibold text-[15px] whitespace-nowrap leading-tight">
          {item.label}
        </span>
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className="
            pointer-events-none absolute left-full ml-3 z-50
            px-3 py-1.5 rounded-xl bg-secondary text-white text-[13px] font-bold
            opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0
            transition-all duration-200 whitespace-nowrap shadow-lg
          "
        >
          {item.label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-secondary" />
        </div>
      )}
    </Link>
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={`
        relative flex flex-col h-screen bg-surface-white
        border-r-[2.5px] border-secondary
        transition-all duration-300 ease-in-out
        ${collapsed ? "w-[84px]" : "w-[260px]"}
        flex-shrink-0 z-30
      `}
      style={{ boxShadow: "4px 0 0 rgba(15,23,42,0.06)" }}
    >
      {/* ── Logo & App Name ── */}
      <div
        className={`
          flex items-center gap-3 px-4 py-5 border-b-[2.5px] border-border-mist
          ${collapsed ? "justify-center px-3" : ""}
        `}
      >
        {/* Logo mark */}
        <div
          className={`
            flex-shrink-0 flex items-center justify-center rounded-xl bg-primary text-white font-black
            shadow-md border-[2px] border-secondary transition-all duration-300
            ${collapsed ? "w-11 h-11 text-xl" : "w-10 h-10 text-lg"}
          `}
        >
          <Zap className={collapsed ? "w-6 h-6" : "w-5 h-5"} strokeWidth={2.5} />
        </div>

        {!collapsed && (
          <div className="overflow-hidden">
            <p className="font-display font-black text-[20px] tracking-tight text-secondary leading-none">
              Syncar
            </p>
            <p className="text-[11px] font-bold text-text-fog uppercase tracking-widest mt-0.5">
              AI Workspace
            </p>
          </div>
        )}
      </div>

      {/* ── Main Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href)
            }
          />
        ))}
      </nav>

      {/* ── Divider + Bottom Items ── */}
      <div className="px-3 pb-4 border-t-[2px] border-border-mist pt-3 space-y-1.5">
        {BOTTOM_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            collapsed={collapsed}
            isActive={pathname.startsWith(item.href)}
          />
        ))}
      </div>

      {/* ── Collapse Toggle Button ── */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="
          absolute -right-4 top-[72px]
          w-8 h-8 rounded-full
          bg-surface-white border-[2.5px] border-secondary
          flex items-center justify-center
          text-secondary hover:bg-secondary hover:text-white
          transition-all duration-200 cursor-pointer
          shadow-md z-50
        "
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" strokeWidth={2.5} />
        ) : (
          <ChevronLeft className="w-4 h-4" strokeWidth={2.5} />
        )}
      </button>
    </aside>
  );
}
