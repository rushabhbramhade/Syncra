"use client";

import React from "react";
import Link from "next/link";
import type { NavItem } from "./nav-data";

interface NavItemProps {
  item: NavItem;
  collapsed: boolean;
  isActive: boolean;
}

export function SidebarNavItem({ item, collapsed, isActive }: NavItemProps) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl
        transition-all duration-300 cursor-pointer select-none
        ${
          isActive
            ? "bg-secondary text-white shadow-md font-bold"
            : "text-text-slate hover:bg-border-mist/60 hover:text-secondary font-semibold"
        }
        ${collapsed ? "justify-center px-1" : ""}
      `}
    >
      {/* Accent border/bar for active state */}
      {isActive && (
        <span className="absolute left-0 top-4 bottom-4 w-1.5 bg-primary rounded-r-full" />
      )}

      {/* Icon container with solid bg - Large premium look */}
      <span
        className={`
          relative flex-shrink-0 flex items-center justify-center rounded-2xl
          transition-all duration-300
          ${item.iconBg} text-white
          w-12 h-12
          shadow-sm group-hover:scale-[1.06] group-hover:shadow-md group-active:scale-95
          ${isActive ? "ring-2 ring-white/30" : ""}
        `}
      >
        <Icon
          className="w-[24px] h-[24px]"
          strokeWidth={2.2}
        />

        {/* Badge on icon */}
        {item.badge && item.badge > 0 && (
          <span
            className={`
              absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center
              rounded-full bg-error text-white text-[10px] font-black px-1
              border-2 border-surface-white
              ${isActive ? "border-secondary" : ""}
            `}
          >
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        )}
      </span>

      {/* Label */}
      {!collapsed && (
        <span className="font-semibold text-[14px] whitespace-nowrap leading-tight truncate">
          {item.label}
        </span>
      )}

      {/* Badge count (expanded mode, on the right) */}
      {!collapsed && item.badge && item.badge > 0 && (
        <span
          className={`
            ml-auto min-w-[22px] h-[22px] flex items-center justify-center
            rounded-full text-[11px] font-black px-1.5
            ${
              isActive
                ? "bg-white/20 text-white"
                : "bg-error/10 text-error"
            }
          `}
        >
          {item.badge}
        </span>
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className="
            pointer-events-none absolute left-full ml-3.5 z-[100]
            px-3 py-2 rounded-xl bg-secondary text-white text-[13px] font-bold
            opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0
            transition-all duration-300 whitespace-nowrap shadow-lg
          "
        >
          {item.label}
          {item.badge && item.badge > 0 && (
            <span className="ml-1.5 text-[11px] opacity-70">({item.badge})</span>
          )}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-secondary" />
        </div>
      )}
    </Link>
  );
}
