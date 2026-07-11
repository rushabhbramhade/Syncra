"use client";

import React from "react";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  User as UserIcon,
  X,
} from "lucide-react";
import { PRIMARY_NAV, SECONDARY_NAV } from "./nav-data";
import { SidebarNavItem } from "./nav-item";

/* ── Types ── */
interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

/* ── Main Component ── */
export function DashboardSidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: DashboardSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href);

  /* ── Sidebar content (shared between desktop & mobile) ── */
  const sidebarContent = (
    <>
      {/* ── Logo ── */}
      <div
        className={`
          flex items-center gap-3 px-4 py-5 border-b-[2.5px] border-border-mist
          ${collapsed && !mobileOpen ? "justify-center px-3" : ""}
        `}
      >
        <div
          className={`
            flex-shrink-0 flex items-center justify-center rounded-2xl
            bg-primary text-white font-black shadow-md border-[2px] border-secondary
            transition-all duration-300
            w-12 h-12
          `}
        >
          <Zap
            className="w-[24px] h-[24px]"
            strokeWidth={2.5}
          />
        </div>

        {(!collapsed || mobileOpen) && (
          <div className="overflow-hidden min-w-0">
            <p className="font-display font-black text-[19px] tracking-tight text-secondary leading-none">
              Syncra
            </p>
            <p className="text-[10px] font-bold text-text-fog uppercase tracking-[0.15em] mt-0.5">
              AI Workspace
            </p>
          </div>
        )}

        {/* Mobile close button */}
        {mobileOpen && (
          <button
            onClick={onMobileClose}
            className="ml-auto p-1.5 rounded-xl hover:bg-border-mist text-text-slate transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Primary Nav ── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-hide">
        {PRIMARY_NAV.map((item, idx) => (
          <SidebarNavItem
            key={`${item.href}-primary-${idx}`}
            item={item}
            collapsed={collapsed && !mobileOpen}
            isActive={isActive(item.href)}
          />
        ))}
      </nav>

      {/* ── Bottom Section (Pinned Footer) ── */}
      <div className="border-t-[2.5px] border-border-mist px-3 py-3 space-y-1 shrink-0 bg-surface-white">
        {/* Pinned Secondary Nav */}
        {SECONDARY_NAV.map((item, idx) => (
          <SidebarNavItem
            key={`${item.href}-secondary-${idx}`}
            item={item}
            collapsed={collapsed && !mobileOpen}
            isActive={isActive(item.href)}
          />
        ))}

        <div className="h-[2px] bg-border-mist rounded-full !my-3 mx-1" />

        {/* User profile */}
        <div
          className={`
            flex items-center gap-3 px-2.5 py-2 rounded-2xl
            ${collapsed && !mobileOpen ? "justify-center" : ""}
          `}
        >
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-white shadow-sm">
            <UserIcon className="w-[24px] h-[24px]" strokeWidth={2} />
          </div>
          {(!collapsed || mobileOpen) && (
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[13px] text-secondary truncate leading-tight">
                User
              </p>
              <p className="text-[11px] text-text-fog truncate">
                Free plan
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Collapse Toggle (desktop only) ── */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="
          hidden lg:flex
          absolute -right-3.5 top-[72px]
          w-7 h-7 rounded-full
          bg-surface-white border-[2.5px] border-secondary
          items-center justify-center
          text-secondary hover:bg-secondary hover:text-white
          transition-all duration-200 cursor-pointer
          shadow-md z-50
        "
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        )}
      </button>
    </>
  );

  return (
    <>
      {/* ── Mobile Overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* ── Desktop Sidebar ── */}
      <aside
        className={`
          hidden lg:flex relative flex-col h-screen bg-surface-white
          border-r-[2.5px] border-secondary
          transition-all duration-300 ease-in-out flex-shrink-0 z-30
          ${collapsed ? "w-[76px]" : "w-[252px]"}
        `}
        style={{ boxShadow: "3px 0 0 rgba(15,23,42,0.05)" }}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile Drawer ── */}
      <aside
        className={`
          fixed top-0 left-0 bottom-0 w-[280px] bg-surface-white
          border-r-[2.5px] border-secondary
          flex flex-col z-50
          transition-transform duration-300 ease-in-out
          lg:hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ boxShadow: "4px 0 16px rgba(15,23,42,0.10)" }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
