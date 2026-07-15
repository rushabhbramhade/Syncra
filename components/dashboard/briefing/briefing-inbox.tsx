"use client";

import React from "react";
import { BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { Card } from "@/components/ui/card";
import {
  ListFilter,
  Search,
  Inbox,
  CheckCircle,
  ChevronRight,
  Mail,
  MessageCircle,
} from "lucide-react";

interface BriefingInboxProps {
  items: BriefingItemRecord[];
  activeTab: "all" | "unread" | "completed" | "archived" | "snoozed";
  onTabChange: (tab: "all" | "unread" | "completed" | "archived" | "snoozed") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onItemClick: (item: BriefingItemRecord) => void;
  isDataLoading?: boolean;
}

const TABS = ["unread", "completed", "archived", "snoozed"] as const;

function getAppIcon(platform: string, className = "w-4 h-4") {
  const plat = platform.toLowerCase();
  if (plat === "gmail") return <Mail className={className} />;
  if (plat === "slack" || plat === "whatsapp" || plat === "telegram" || plat === "discord") {
    return <MessageCircle className={className} />;
  }
  return <Inbox className={className} />;
}

function getPlatformClass(platform: string) {
  const plat = platform.toLowerCase();
  if (plat === "gmail") return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
  if (plat === "whatsapp") return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
  if (plat === "slack") return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
  if (plat === "telegram") return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
  return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
}

export function BriefingInbox({
  items,
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onItemClick,
  isDataLoading = false,
}: BriefingInboxProps) {
  return (
    <Card className="neo-border bg-surface-white p-6 neo-shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-mist pb-4">
        <div className="flex items-center gap-2">
          <ListFilter className="w-5 h-5 text-accent-purple" />
          <h3 className="font-display font-black text-lg text-secondary">Briefing Inbox</h3>
        </div>

        <div className="flex bg-background-mist border border-border-mist rounded-xl p-1 gap-1">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`text-[12px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
                activeTab === tab ? "bg-white text-secondary shadow-sm" : "text-text-slate hover:text-secondary"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-text-fog" />
        <input
          type="text"
          placeholder="Search inbox by subject, platform, or contents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-2xl border border-border-mist focus:border-accent-purple bg-background-mist text-[13.5px] font-semibold text-secondary pl-10 pr-4 py-2.5 outline-none duration-150 focus:bg-white"
        />
      </div>

      <div className="space-y-4">
        {isDataLoading ? (
          <div className="space-y-3 py-4 animate-pulse">
            <div className="h-16 bg-background-mist rounded-xl border border-border-mist"></div>
            <div className="h-16 bg-background-mist rounded-xl border border-border-mist"></div>
            <div className="h-16 bg-background-mist rounded-xl border border-border-mist"></div>
          </div>
        ) : items.length > 0 ? (
          items.map(item => {
            const meta = (item.metadata || {}) as Record<string, any>;
            return (
              <div
                key={item.id}
                onClick={() => onItemClick(item)}
                className="p-5 rounded-2xl bg-white border-[1.5px] border-border-mist hover:border-text-fog hover:shadow-flat-sm transition-all duration-200 cursor-pointer flex justify-between gap-4 group"
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-xl shrink-0 mt-0.5 border ${getPlatformClass(item.platform)}`}>
                    {getAppIcon(item.platform, "w-5 h-5")}
                  </div>
                  <div>
                    <h4 className="font-bold text-[15px] text-secondary group-hover:text-accent-purple duration-200 line-clamp-1">
                      {meta.title || "No Title"}
                    </h4>
                    <p className="text-[13.5px] font-medium text-text-slate line-clamp-2 leading-relaxed mt-1">
                      {meta.shortSummary}
                    </p>

                    {item.notes && (
                      <div className="text-[11.5px] text-accent-purple font-bold mt-2 bg-accent-purple/5 border border-accent-purple/10 px-3 py-1.5 rounded-lg inline-flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>{item.notes}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] font-black uppercase tracking-wider">
                      <span className={`px-2 py-0.5 rounded border ${getPlatformClass(item.platform)}`}>
                        {item.platform}
                      </span>
                      <span className="text-text-slate">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end justify-between shrink-0">
                  <ChevronRight className="w-5 h-5 text-text-fog group-hover:text-secondary group-hover:translate-x-1 duration-200" />
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                    item.priority === "high" ? "bg-error/10 text-error border-error/20" : "bg-slate-100 text-text-slate border-slate-200"
                  }`}>
                    {item.priority}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-text-slate font-medium space-y-2">
            <Inbox className="w-10 h-10 text-text-fog mx-auto" />
            <h4 className="font-bold text-[14px]">No Items Found</h4>
            <p className="text-[12px] max-w-xs mx-auto">
              Try checking other filter tabs or search query parameters.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default BriefingInbox;
