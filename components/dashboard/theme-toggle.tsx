"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`
        group relative flex items-center gap-3 w-full rounded-2xl
        transition-all duration-300 cursor-pointer select-none
        ${collapsed ? "justify-center px-2.5 py-2.5" : "px-3 py-2.5"}
        ${isDark
          ? "bg-accent-purple/15 text-accent-purple hover:bg-accent-purple/25"
          : "bg-amber-50 text-amber-600 hover:bg-amber-100"
        }
        dark:text-amber-300 dark:bg-surface-white/5 dark:hover:bg-surface-white/10
      `}
    >
      {/* Animated icon container */}
      <span
        className={`
          relative flex-shrink-0 flex items-center justify-center rounded-xl
          transition-all duration-500 ease-out
          ${collapsed ? "w-10 h-10" : "w-9 h-9"}
          ${isDark
            ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-purple-500/30"
            : "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-400/30"
          }
          group-hover:scale-[1.12] group-active:scale-95
        `}
      >
        <span
          className={`
            absolute inset-0 flex items-center justify-center
            transition-all duration-500 ease-out
            ${isDark ? "rotate-0 opacity-100" : "rotate-90 opacity-0"}
          `}
        >
          <Moon className={collapsed ? "w-5 h-5" : "w-[18px] h-[18px]"} strokeWidth={2.5} />
        </span>
        <span
          className={`
            absolute inset-0 flex items-center justify-center
            transition-all duration-500 ease-out
            ${isDark ? "-rotate-90 opacity-0" : "rotate-0 opacity-100"}
          `}
        >
          <Sun className={collapsed ? "w-5 h-5" : "w-[18px] h-[18px]"} strokeWidth={2.5} />
        </span>
      </span>

      {/* Label */}
      {!collapsed && (
        <div className="min-w-0 flex-1 text-left">
          <span className="font-semibold text-[14px] whitespace-nowrap leading-tight">
            {isDark ? "Dark Mode" : "Light Mode"}
          </span>
        </div>
      )}

      {/* Pill indicator */}
      {!collapsed && (
        <span
          className={`
            ml-auto px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider
            transition-all duration-300
            ${isDark
              ? "bg-accent-purple/20 text-accent-purple"
              : "bg-amber-200/60 text-amber-700"
            }
          `}
        >
          {isDark ? "ON" : "OFF"}
        </span>
      )}

      {/* Tooltip when collapsed */}
      {collapsed && (
        <div
          className="
            pointer-events-none absolute left-full ml-3 z-[100]
            px-3 py-1.5 rounded-xl bg-secondary text-white text-[13px] font-bold
            opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0
            transition-all duration-200 whitespace-nowrap shadow-lg
          "
        >
          {isDark ? "Switch to Light" : "Switch to Dark"}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-secondary" />
        </div>
      )}
    </button>
  );
}
