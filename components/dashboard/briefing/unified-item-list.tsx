"use client";

import React, { useState, useMemo } from "react";
import { BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { WhyTagPopover } from "./why-tag-popover";
import { CorrelationLink } from "./correlation-link";
import {
  Search, Inbox, ChevronRight, Mail, MessageCircle, AlertCircle, Bell,
  ThumbsUp, MessageSquare, ExternalLink, Clock, CheckCircle,
  Zap, Filter
} from "lucide-react";

interface UnifiedItemListProps {
  items: BriefingItemRecord[];
  activeTab: "all" | "unread" | "completed" | "archived" | "snoozed";
  onTabChange: (tab: "all" | "unread" | "completed" | "archived" | "snoozed") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onItemClick: (item: BriefingItemRecord) => void;
  onMarkDone: (itemId: string) => void;
  isDataLoading?: boolean;
}

const STATUS_TABS = ["all", "unread", "completed", "archived", "snoozed"] as const;

interface BriefingItemMeta {
  title?: unknown;
  shortSummary?: unknown;
  signals?: unknown[];
  whyClassified?: unknown;
  correlation?: { relatedItemId?: string; text?: string; platform?: string };
}

type SmartFilter =
  | "all"
  | "needs_reply"
  | "unread"
  | "today"
  | "this_week"
  | "high"
  | "medium"
  | "low"
  | "mentions";

const SMART_FILTERS: { key: SmartFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
  { key: "needs_reply", label: "Needs Reply" },
  { key: "mentions", label: "Mentions" },
  { key: "unread", label: "Unread" },
  { key: "today", label: "Today" },
  { key: "this_week", label: "This Week" },
];

const PRIORITY_RANK: Record<string, number> = { high: 0, normal: 1, low: 2 };

export function formatWaiting(timestamp: string): string {
  const ms = Date.now() - new Date(timestamp).getTime();
  if (ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

function getPlatformIcon(platform: string, className = "w-4 h-4") {
  const p = platform.toLowerCase();
  if (p === "gmail" || p === "outlook") return <Mail className={className} />;
  if (p === "slack" || p === "whatsapp" || p === "telegram" || p === "discord") return <MessageCircle className={className} />;
  if (p === "github") return <AlertCircle className={className} />;
  if (p === "linkedin") return <Bell className={className} />;
  if (p === "calendar") return <AlertCircle className={className} />;
  return <Inbox className={className} />;
}

function getPlatformClass(platform: string) {
  const p = platform.toLowerCase();
  if (p === "gmail") return "bg-red-500/10 text-red-600 border-red-500/20";
  if (p === "outlook") return "bg-blue-600/10 text-blue-700 border-blue-600/20";
  if (p === "whatsapp") return "bg-green-500/10 text-green-600 border-green-500/20";
  if (p === "slack") return "bg-purple-500/10 text-purple-600 border-purple-500/20";
  if (p === "telegram") return "bg-sky-500/10 text-sky-600 border-sky-500/20";
  if (p === "discord") return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
  if (p === "github") return "bg-gray-500/10 text-gray-700 border-gray-500/20";
  if (p === "linkedin") return "bg-blue-500/10 text-blue-600 border-blue-500/20";
  if (p === "calendar") return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
  if (p === "notion") return "bg-stone-500/10 text-stone-600 border-stone-500/20";
  if (p === "linear") return "bg-rose-500/10 text-rose-600 border-rose-500/20";
  return "bg-slate-500/10 text-slate-600 border-slate-500/20";
}

function getPrimaryAction(platform: string): { label: string; icon: React.ReactNode } {
  const p = platform.toLowerCase();
  if (p === "gmail") return { label: "Reply", icon: <Mail className="w-3.5 h-3.5" /> };
  if (p === "slack") return { label: "Reply in thread", icon: <MessageSquare className="w-3.5 h-3.5" /> };
  if (p === "whatsapp") return { label: "Reply", icon: <MessageCircle className="w-3.5 h-3.5" /> };
  if (p === "telegram") return { label: "Reply", icon: <MessageCircle className="w-3.5 h-3.5" /> };
  if (p === "discord") return { label: "Reply", icon: <MessageSquare className="w-3.5 h-3.5" /> };
  if (p === "github") return { label: "Comment", icon: <MessageSquare className="w-3.5 h-3.5" /> };
  if (p === "linkedin") return { label: "Like / Comment", icon: <ThumbsUp className="w-3.5 h-3.5" /> };
  return { label: "View", icon: <ExternalLink className="w-3.5 h-3.5" /> };
}

export const UnifiedItemList = React.memo(function UnifiedItemList({
  items, activeTab, onTabChange, searchQuery, onSearchChange,
  onItemClick, onMarkDone, isDataLoading = false,
}: UnifiedItemListProps) {
  const [smartFilter, setSmartFilter] = useState<SmartFilter>("all");
  const [focusMode, setFocusMode] = useState(false);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (activeTab === "all") {}
      else if (activeTab === "unread" && item.status !== "unread") return false;
      else if (activeTab === "completed" && item.status !== "completed") return false;
      else if (activeTab === "archived" && item.status !== "archived") return false;
      else if (activeTab === "snoozed" && item.status !== "snoozed") return false;

      const cat = item.category.toLowerCase();
      const priority = item.priority.toLowerCase();

      const meta = (item.metadata || {}) as Record<string, unknown>;
      const isMention =
        cat === "mentions" ||
        Boolean(meta.mentions) ||
        Boolean(meta.isMention) ||
        String(meta.title || "").toLowerCase().includes("@");

      if (smartFilter === "high" && priority !== "high") return false;
      if (smartFilter === "medium" && priority !== "normal" && priority !== "medium") return false;
      if (smartFilter === "low" && priority !== "low") return false;
      if (smartFilter === "mentions" && !isMention) return false;
      if (smartFilter === "needs_reply" && !["email", "messages", "mentions", "followups", "follow-ups", "follow_ups"].includes(cat)) return false;
      if (smartFilter === "unread" && item.status !== "unread") return false;
      if (smartFilter === "today" && !isToday(item.timestamp)) return false;
      if (smartFilter === "this_week" && !isThisWeek(item.timestamp)) return false;

      if (focusMode && priority !== "high" && smartFilter !== "high") {
        if (!["email", "messages", "mentions"].includes(cat)) return false;
      }

      if (searchQuery.trim()) {
        const meta = item.metadata || {};
        const titleText = String((meta as { title?: unknown }).title || "").toLowerCase();
        const summaryText = String((meta as { shortSummary?: unknown }).shortSummary || "").toLowerCase();
        const q = searchQuery.toLowerCase();
        return titleText.includes(q) || summaryText.includes(q);
      }
      return true;
    });
  }, [items, activeTab, smartFilter, focusMode, searchQuery]);

  const groupedByPriority = useMemo(() => {
    const groups: Record<string, BriefingItemRecord[]> = { high: [], normal: [], low: [] };
    for (const item of filteredItems) {
      const key = (["high", "normal", "low"].includes(item.priority.toLowerCase()) ? item.priority.toLowerCase() : "normal");
      groups[key].push(item);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const rankA = PRIORITY_RANK[a.priority.toLowerCase()] ?? 1;
        const rankB = PRIORITY_RANK[b.priority.toLowerCase()] ?? 1;
        if (rankA !== rankB) return rankA - rankB;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
    }
    return groups;
  }, [filteredItems]);

  const activeCount = items.filter(i => i.status === "unread").length;

  return (
    <div className="space-y-4">
      {/* Smart Filter Chips + Focus Mode */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-black text-text-slate uppercase tracking-wider mr-1">
            <Filter className="w-3.5 h-3.5" />
            Filter
          </span>
          {SMART_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setSmartFilter(f.key)}
              className={`text-[11px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider border transition-colors ${
                smartFilter === f.key
                  ? "bg-accent-purple/10 text-accent-purple border-accent-purple/30"
                  : "bg-background-mist text-text-slate border-border-mist hover:text-secondary"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            onClick={() => setFocusMode(o => !o)}
            className={`text-[11px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider border transition-colors flex items-center gap-1.5 ${
              focusMode
                ? "bg-error/10 text-error border-error/30"
                : "bg-background-mist text-text-slate border-border-mist hover:text-secondary"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            Focus Mode
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex bg-background-mist border border-border-mist rounded-xl p-1 gap-1 overflow-x-auto">
            {STATUS_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                className={`text-[11px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors shrink-0 ${
                  activeTab === tab ? "bg-white text-secondary shadow-sm" : "text-text-slate hover:text-secondary"
                }`}
              >
                {tab === "all" ? `All (${activeCount})` : tab}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-text-fog" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full sm:w-56 rounded-xl border border-border-mist bg-background-mist text-[12.5px] font-semibold text-secondary pl-9 pr-3 py-2 outline-none focus:border-accent-purple focus:bg-white duration-150"
            />
          </div>
        </div>
      </div>

      {/* Items grouped by priority */}
      {isDataLoading ? (
        <div className="space-y-3 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-20 bg-background-mist rounded-xl border border-border-mist" />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-12 text-center text-text-slate font-medium space-y-2">
          <Inbox className="w-10 h-10 text-text-fog mx-auto" />
          <h4 className="font-bold text-[14px]">No Items Found</h4>
          <p className="text-[12px] max-w-xs mx-auto">Try a different filter or search term.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(["high", "normal", "low"] as const).map(level => {
            const levelItems = groupedByPriority[level];
            if (levelItems.length === 0) return null;
            const label = level === "high" ? "High Priority" : level === "normal" ? "Medium Priority" : "Low Priority";
            return (
              <div key={level}>
                <h4 className={`text-[13px] font-black uppercase tracking-wider flex items-center gap-1.5 mb-3 px-1 ${
                  level === "high" ? "text-error" : level === "normal" ? "text-amber-600" : "text-text-slate"
                }`}>
                  <span className={`w-2 h-2 rounded-full ${level === "high" ? "bg-error" : level === "normal" ? "bg-amber-500" : "bg-text-fog"}`} />
                  <span>{label}</span>
                  <span className="text-text-fog font-bold text-[11px]">({levelItems.length})</span>
                </h4>
                <div className="space-y-2">
                  {levelItems.map(item => (
                    <ItemRow key={item.id} item={item} onItemClick={onItemClick} onMarkDone={onMarkDone} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

const ItemRow = React.memo(function ItemRow({ item, onItemClick, onMarkDone }: {
  item: BriefingItemRecord;
  onItemClick: (item: BriefingItemRecord) => void;
  onMarkDone: (itemId: string) => void;
}) {
  const meta = (item.metadata || {}) as BriefingItemMeta;
  const correlation = meta.correlation as { relatedItemId?: string; text?: string; platform?: string } | undefined;
  const primaryAction = getPrimaryAction(item.platform);

  return (
    <div
      onClick={() => onItemClick(item)}
      className="p-4 rounded-2xl bg-white border-[1.5px] border-border-mist hover:border-text-fog hover:shadow-flat-sm transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl shrink-0 mt-0.5 border ${getPlatformClass(item.platform)}`}>
          {getPlatformIcon(item.platform, "w-4 h-4")}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold text-[14px] text-secondary group-hover:text-accent-purple duration-200 truncate">
              {String(meta.title || "No Title")}
            </h4>
            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
              item.priority === "high" ? "bg-error/10 text-error border-error/20" : "bg-slate-100 text-text-slate border-slate-200"
            }`}>
              {item.priority}
            </span>
          </div>
          <p className="text-[12.5px] font-medium text-text-slate line-clamp-1 leading-relaxed">
            {String(meta.shortSummary || "")}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${getPlatformClass(item.platform)}`}>
              {item.platform}
            </span>
            <span className="text-[10px] font-bold text-text-slate bg-background-mist px-1.5 py-0.5 rounded-md border border-border-mist capitalize">
              {item.category}
            </span>
            <span className="text-[10px] font-medium text-text-slate flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Waiting {formatWaiting(item.timestamp)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <WhyTagPopover
              category={item.category}
              signals={(meta.signals as string[]) || []}
              reason={meta.whyClassified as string}
            />
            {correlation?.text && correlation?.platform && (
              <CorrelationLink text={correlation.text} platform={correlation.platform} />
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onMarkDone(item.id!); }}
            className="p-1.5 text-text-fog hover:text-success hover:bg-success/5 rounded-lg transition-colors"
            title="Mark Done"
          >
            <CheckCircle className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-bold text-text-slate bg-background-mist px-2 py-0.5 rounded-md border border-border-mist flex items-center gap-1">
            {primaryAction.icon}
            {primaryAction.label}
          </span>
          <ChevronRight className="w-4 h-4 text-text-fog group-hover:text-secondary group-hover:translate-x-1 duration-200" />
        </div>
      </div>
    </div>
  );
});

function isToday(timestamp: string): boolean {
  const d = new Date(timestamp);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function isThisWeek(timestamp: string): boolean {
  const d = new Date(timestamp);
  const now = new Date();
  if (isNaN(d.getTime())) return false;
  const msInWeek = 7 * 24 * 60 * 60 * 1000;
  const diff = now.getTime() - d.getTime();
  return diff >= -msInWeek && diff <= msInWeek;
}

export default UnifiedItemList;
