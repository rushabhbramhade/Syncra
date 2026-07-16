"use client";

import React from "react";
import { BriefingRecord, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { TodayHeroCard } from "./today-hero-card";
import { UnifiedItemList } from "./unified-item-list";

interface TodayTabProps {
  latestBriefing: BriefingRecord | null;
  briefingItems: BriefingItemRecord[];
  onRegenerate: () => void;
  isGenerating: boolean;
  activeTab: "all" | "unread" | "completed" | "archived" | "snoozed";
  onTabChange: (tab: "all" | "unread" | "completed" | "archived" | "snoozed") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onItemClick: (item: BriefingItemRecord) => void;
  onMarkDone: (itemId: string) => void;
  isDataLoading: boolean;
}

export const TodayTab = React.memo(function TodayTab({
  latestBriefing, briefingItems, onRegenerate, isGenerating,
  activeTab, onTabChange, searchQuery, onSearchChange,
  onItemClick, onMarkDone, isDataLoading,
}: TodayTabProps) {
  return (
    <div className="space-y-6">
      <TodayHeroCard
        latestBriefing={latestBriefing}
        onRegenerate={onRegenerate}
        isGenerating={isGenerating}
      />
      <UnifiedItemList
        items={briefingItems}
        activeTab={activeTab}
        onTabChange={onTabChange}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onItemClick={onItemClick}
        onMarkDone={onMarkDone}
        isDataLoading={isDataLoading}
      />
    </div>
  );
});
