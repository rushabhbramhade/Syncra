"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, LogOut } from "lucide-react";

interface DashboardHeaderProps {
  userName: string;
  onRegenerate: () => void;
  onSignOut: () => void;
  isRegenerating: boolean;
}

export function DashboardHeader({ userName, onRegenerate, onSignOut, isRegenerating }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
      <div>
        <h1 className="font-display font-black text-2xl text-secondary mb-2">
          Welcome back, {userName}!
        </h1>
        <p className="text-text-slate text-[16px] font-medium max-w-2xl leading-relaxed">
          Here&apos;s what&apos;s happening across your connected workspace today.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={onRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-2 border-[2px] border-border-mist hover:border-secondary transition-all rounded-[14px] bg-surface-white font-bold text-secondary h-11 px-4 neo-shadow-sm hover:translate-y-[-2px] active:translate-y-[0px] duration-200"
        >
          <RefreshCw className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`} />
          <span>Regenerate Brief</span>
        </Button>
        <Button
          variant="ghost"
          onClick={onSignOut}
          className="text-text-slate hover:text-error hover:bg-error-bg font-bold flex items-center gap-2 px-3 py-1.5 border-[2px] border-transparent hover:border-error rounded-[14px] h-11"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default DashboardHeader;
