"use client";

import React, { useState, useMemo } from "react";
import { BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { WhyTagPopover } from "./why-tag-popover";
import { CorrelationLink } from "./correlation-link";
import {
  Search, Inbox, ChevronRight, Mail, MessageCircle, AlertCircle, Bell, CheckSquare,
  RefreshCw, ThumbsUp, MessageSquare, ExternalLink, Archive, Clock, CheckCircle
} from "lucide-react";

type ViewMode = "type" | "platform";

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

function getPlatformIcon(platform: string, className = "w-4 h-4") {
  const p = platform.toLowerCase();
  if (p === "gmail" || p === "outlook") return <Mail className={className} />;
  if (p === "slack" || p === "whatsapp" || p === "telegram" || p === "discord") return <MessageCircle className={className} />;
  if (p === "github") return <AlertCircle className={className} />;
  if (p === "linkedin") return <Bell className={className} />;
  if (p === "calendar") return <CalendarIcon className={className} />;
  if (p === "notion" || p === "linear") return <FileTextIcon className={className} />;
  return <Inbox className={className} />;
}

function CalendarIcon({ className }: { className?: string }) {
  return <AlertCircle className={className} />;
}
function FileTextIcon({ className }: { className?: string }) {
  return <AlertCircle className={className} />;
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

function getCategoryIcon(category: string, className = "w-3.5 h-3.5") {
  const c = category.toLowerCase();
  if (c === "email") return <Mail className={className} />;
  if (c === "messages") return <MessageCircle className={className} />;
  if (c === "mentions") return <Bell className={className} />;
  if (c === "tasks") return <CheckSquare className={className} />;
  if (c === "followups" || c === "follow-ups" || c === "follow_ups") return <RefreshCw className={className} />;
  if (c === "activity") return <ActivityIcon className={className} />;
  return <Inbox className={className} />;
}

function ActivityIcon({ className }: { className?: string }) {
  return <AlertCircle className={className} />;
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
  const [viewMode, setViewMode] = useState<ViewMode>("type");

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (activeTab === "all") {}
      else if (activeTab === "unread" && item.status !== "unread") return false;
      else if (activeTab === "completed" && item.status !== "completed") return false;
      else if (activeTab === "archived" && item.status !== "archived") return false;
      else if (activeTab === "snoozed" && item.status !== "snoozed") return false;

      if (searchQuery.trim()) {
        const meta = (item.metadata || {}) as Record<string, any>;
        const titleText = (meta.title || "").toLowerCase();
        const summaryText = (meta.shortSummary || "").toLowerCase();
        const q = searchQuery.toLowerCase();
        return titleText.includes(q) || summaryText.includes(q);
      }
      return true;
    });
  }, [items, activeTab, searchQuery]);

  const groupedByType = useMemo(() => {
    const groups: Record<string, BriefingItemRecord[]> = {};
    for (const item of filteredItems) {
      const cat = item.category.toLowerCase();
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    }
    return groups;
  }, [filteredItems]);

  const groupedByPlatform = useMemo(() => {
    const groups: Record<string, BriefingItemRecord[]> = {};
    for (const item of filteredItems) {
      const p = item.platform.toLowerCase();
      if (!groups[p]) groups[p] = [];
      groups[p].push(item);
    }
    return groups;
  }, [filteredItems]);

  return (
    <div className="space-y-4">
      {/* View Mode Toggle + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-background-mist border border-border-mist rounded-xl p-1 gap-1">
          <button
            onClick={() => setViewMode("type")}
            className={`text-[12px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
              viewMode === "type" ? "bg-white text-secondary shadow-sm" : "text-text-slate hover:text-secondary"
            }`}
          >
            By Type
          </button>
          <button
            onClick={() => setViewMode("platform")}
            className={`text-[12px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
              viewMode === "platform" ? "bg-white text-secondary shadow-sm" : "text-text-slate hover:text-secondary"
            }`}
          >
            By Platform
          </button>
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

      {/* Status Tabs */}
      <div className="flex bg-background-mist border border-border-mist rounded-xl p-1 gap-1 overflow-x-auto">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => onTabChange(tab)}
            className={`text-[11px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors shrink-0 ${
              activeTab === tab ? "bg-white text-secondary shadow-sm" : "text-text-slate hover:text-secondary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Items */}
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
      ) : viewMode === "type" ? (
        <div className="space-y-6">
          {Object.entries(groupedByType).map(([category, catItems]) => (
            <div key={category}>
              <h4 className="text-[13px] font-black text-secondary uppercase tracking-wider flex items-center gap-1.5 mb-3 px-1">
                {getCategoryIcon(category)}
                <span className="capitalize">{category.replace(/[-_]/g, " ")}</span>
                <span className="text-text-fog font-bold text-[11px]">({catItems.length})</span>
              </h4>
              <div className="space-y-2">
                {catItems.map(item => (
                  <ItemRow key={item.id} item={item} onItemClick={onItemClick} onMarkDone={onMarkDone} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByPlatform).map(([platform, platItems]) => (
            <div key={platform}>
              <h4 className="text-[13px] font-black text-secondary uppercase tracking-wider flex items-center gap-1.5 mb-3 px-1">
                {getPlatformIcon(platform)}
                <span className="capitalize">{platform}</span>
                <span className="text-text-fog font-bold text-[11px]">({platItems.length})</span>
              </h4>
              <div className="space-y-2">
                {platItems.map(item => (
                  <ItemRow key={item.id} item={item} onItemClick={onItemClick} onMarkDone={onMarkDone} />
                ))}
              </div>
            </div>
          ))}
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
  const meta = (item.metadata || {}) as Record<string, any>;
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
              {meta.title || "No Title"}
            </h4>
            <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
              item.priority === "high" ? "bg-error/10 text-error border-error/20" : "bg-slate-100 text-text-slate border-slate-200"
            }`}>
              {item.priority}
            </span>
          </div>
          <p className="text-[12.5px] font-medium text-text-slate line-clamp-1 leading-relaxed">
            {meta.shortSummary || ""}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${getPlatformClass(item.platform)}`}>
              {item.platform}
            </span>
            <span className="text-[10px] font-bold text-text-slate bg-background-mist px-1.5 py-0.5 rounded-md border border-border-mist capitalize">
              {item.category}
            </span>
            <span className="text-[10px] font-medium text-text-slate">
              {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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

export default UnifiedItemList;
