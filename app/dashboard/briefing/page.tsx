"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { TodayTab } from "@/components/dashboard/briefing/today-tab";
import { SchedulesTab } from "@/components/dashboard/briefing/schedules-tab";
import { HistoryTab } from "@/components/dashboard/briefing/history-tab";
import {
  getSchedulesAction, createScheduleAction, deleteScheduleAction,
  updateScheduleAction, getBriefingsAction, getBriefingItemsAction,
  getBriefingHistoryAction, generateBriefingAction, updateBriefingItemStatusAction,
} from "@/app/actions/briefing";
import { BriefingScheduleRecord, BriefingRecord, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import {
  AlertCircle, CheckCircle, RefreshCw, Sparkles, Send,
} from "lucide-react";

const BriefingDetailsModal = dynamic(() => import("@/components/dashboard/briefing-details-modal").then(mod => mod.BriefingDetailsModal), { ssr: false });
const SendMessageDialog = dynamic(() => import("@/components/dashboard/briefing/send-message-dialog").then(mod => mod.SendMessageDialog), { ssr: false });

type TabName = "today" | "schedules" | "history";

const TABS: { key: TabName; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "schedules", label: "Schedules" },
  { key: "history", label: "History" },
];

export default function BriefingDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, dbUser, isLoading } = useAuth();
  const activeUserId = dbUser?.id;
  const isDbReady = !!activeUserId;

  const currentTab = (searchParams.get("tab") as TabName) || "today";

  const [schedules, setSchedules] = useState<BriefingScheduleRecord[]>([]);
  const [latestBriefing, setLatestBriefing] = useState<BriefingRecord | null>(null);
  const [briefingItems, setBriefingItems] = useState<BriefingItemRecord[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "completed" | "archived" | "snoozed">("unread");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<BriefingItemRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const hasFetched = useRef(false);
  const isMounted = useRef(true);

  const setTab = useCallback((tab: TabName) => {
    router.replace(`/dashboard/briefing?tab=${tab}`, { scroll: false });
  }, [router]);

  const loadBriefingData = useCallback(async () => {
    if (!user || !activeUserId) return;
    setIsDataLoading(true);
    setFeedbackError(null);

    try {
      const [scheds, briefs, logs] = await Promise.all([
        getSchedulesAction(activeUserId),
        getBriefingsAction(activeUserId, { limit: 1 }),
        getBriefingHistoryAction(activeUserId, 10),
      ]);
      if (!isMounted.current) return;
      setSchedules(scheds);
      setHistoryLogs(logs);

      if (briefs && briefs.length > 0) {
        setLatestBriefing(briefs[0]);
        try {
          const items = await getBriefingItemsAction(activeUserId, briefs[0].id!);
          if (isMounted.current) setBriefingItems(items);
        } catch (itemErr) {
          console.warn("[Briefing] Failed to load items, showing empty:", itemErr);
          if (isMounted.current) setBriefingItems([]);
        }
      } else {
        setLatestBriefing(null);
        setBriefingItems([]);
      }
    } catch (e: any) {
      console.warn("[Briefing] Failed to load data (transient during navigation):", e);
    } finally {
      if (isMounted.current) setIsDataLoading(false);
    }
  }, [user, activeUserId]);

  useEffect(() => {
    isMounted.current = true;
    if (!isLoading && user && isDbReady && !hasFetched.current) {
      hasFetched.current = true;
      loadBriefingData();
    }
    return () => { isMounted.current = false; };
  }, [isLoading, user, isDbReady, loadBriefingData]);

  const handleTriggerBriefing = useCallback(async () => {
    if (isGenerating || !user || !activeUserId) return;
    setIsGenerating(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const result = await generateBriefingAction(activeUserId, null);
      if (result.success) {
        setFeedbackSuccess("AI Briefing generated successfully!");
        await loadBriefingData();
        setTimeout(() => setFeedbackSuccess(null), 3000);
      } else {
        throw new Error(result.error || "Generation failed");
      }
    } catch (err: any) {
      console.error(err);
      setFeedbackError(err.message || "Manual generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }, [user, activeUserId, loadBriefingData, isGenerating]);

  const handleAddSchedule = useCallback(async (data: {
    id?: string; name: string; goal: string; frequency: string; timezone: string;
    integrations: string[]; categories: string[];
  }) => {
    if (!user || !activeUserId) return;
    setIsSubmittingSchedule(true);
    setFeedbackError(null);
    try {
      if (data.id) {
        await updateScheduleAction(activeUserId, data.id, {
          name: data.name, goal: data.goal.trim() || null, frequency: data.frequency,
          timezone: data.timezone, integrations: data.integrations, categories: data.categories,
        });
        await loadBriefingData();
        setFeedbackSuccess("Schedule updated!");
      } else {
        await createScheduleAction(activeUserId, {
          name: data.name, goal: data.goal.trim() || null, frequency: data.frequency,
          timezone: data.timezone, integrations: data.integrations, categories: data.categories, enabled: true,
        });
        await loadBriefingData();
        setFeedbackSuccess("Schedule created!");
      }
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setFeedbackError(err.message || "Failed to save schedule.");
    } finally {
      setIsSubmittingSchedule(false);
    }
  }, [user, activeUserId, loadBriefingData]);

  const handleRunNowSchedule = useCallback(async (scheduleId: string) => {
    if (!user || !activeUserId || isGenerating) return;
    setIsGenerating(true);
    setFeedbackError(null);
    try {
      const result = await generateBriefingAction(activeUserId, scheduleId);
      if (result.success) {
        setFeedbackSuccess("Briefing generated for this schedule!");
        await loadBriefingData();
        setTimeout(() => setFeedbackSuccess(null), 3000);
      } else {
        throw new Error(result.error || "Generation failed");
      }
    } catch (err: any) {
      console.error(err);
      setFeedbackError(err.message || "Failed to run schedule.");
    } finally {
      setIsGenerating(false);
    }
  }, [user, activeUserId, loadBriefingData, isGenerating]);

  const handleToggleSchedule = useCallback(async (scheduleId: string, currentVal: boolean) => {
    if (!user || !activeUserId) return;
    try {
      await updateScheduleAction(activeUserId, scheduleId, { enabled: !currentVal });
      await loadBriefingData();
    } catch (err: any) {
      console.error(err);
      setFeedbackError("Failed to update schedule.");
    }
  }, [user, activeUserId, loadBriefingData]);

  const handleDeleteSchedule = useCallback(async (scheduleId: string) => {
    if (!user || !activeUserId) return;
    if (!confirm("Delete this schedule?")) return;
    try {
      await deleteScheduleAction(activeUserId, scheduleId);
      await loadBriefingData();
      setFeedbackSuccess("Schedule deleted.");
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setFeedbackError("Failed to delete schedule.");
    }
  }, [user, activeUserId, loadBriefingData]);

  const handleMarkDone = useCallback(async (itemId: string) => {
    if (!user || !activeUserId) return;
    try {
      await updateBriefingItemStatusAction(activeUserId, itemId, "completed");
      await loadBriefingData();
    } catch (err: any) {
      console.error(err);
    }
  }, [user, activeUserId, loadBriefingData]);

  const handleItemClick = useCallback((item: BriefingItemRecord) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  }, []);

  if (!user || isLoading || !isDbReady) {
    return (
      <div className="pb-10 font-sans max-w-6xl mx-auto space-y-8 animate-pulse">
        <Skeleton className="h-10 w-72 rounded-lg" />
        <Skeleton className="h-5 w-96 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="pb-10 font-sans max-w-6xl mx-auto space-y-6 animate-fade-in">

      {feedbackError && (
        <div className="p-4 bg-error-bg border-[2px] border-error text-error rounded-2xl flex items-center gap-2 font-bold text-[13px] shadow-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{feedbackError}</p>
        </div>
      )}
      {feedbackSuccess && (
        <div className="p-4 bg-success-bg border-[2px] border-success text-success rounded-2xl flex items-center gap-2 font-bold text-[13px] shadow-sm">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <p>{feedbackSuccess}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-3xl text-secondary mb-1 tracking-tight flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-accent-purple" />
            <span>Briefing</span>
          </h1>
          <p className="text-text-slate text-[14px] font-medium">AI-powered summary of your connected platforms.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsSendOpen(true)}
            className="rounded-[14px] border-2 border-accent-purple/20 hover:border-accent-purple/40 text-accent-purple font-bold text-[14px] h-11 px-5 flex items-center gap-2 shadow-sm hover:translate-y-[-1px] active:translate-y-0 duration-150 shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send Message</span>
          </button>
          <button
            onClick={handleTriggerBriefing}
            disabled={isGenerating || isDataLoading}
            className="rounded-[14px] bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[14px] h-11 px-5 flex items-center gap-2 shadow-md hover:translate-y-[-1px] active:translate-y-0 duration-150 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
            <span>{isGenerating ? "Generating..." : "Generate Now"}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-background-mist border border-border-mist rounded-xl p-1 gap-1 w-fit">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`text-[13px] font-black px-5 py-2 rounded-lg transition-colors ${
              currentTab === tab.key ? "bg-white text-secondary shadow-sm" : "text-text-slate hover:text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {currentTab === "today" && (
        <TodayTab
          latestBriefing={latestBriefing}
          briefingItems={briefingItems}
          onRegenerate={handleTriggerBriefing}
          isGenerating={isGenerating}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onItemClick={handleItemClick}
          onMarkDone={handleMarkDone}
          isDataLoading={isDataLoading}
        />
      )}

      {currentTab === "schedules" && (
        <SchedulesTab
          schedules={schedules}
          onToggle={handleToggleSchedule}
          onDelete={handleDeleteSchedule}
          onAdd={handleAddSchedule}
          onRunNow={handleRunNowSchedule}
          isSubmitting={isSubmittingSchedule}
        />
      )}

      {currentTab === "history" && (
        <HistoryTab
          logs={historyLogs}
          schedules={schedules.map(s => ({ id: s.id!, name: s.name }))}
          onViewBriefing={(briefingId) => router.push(`/dashboard/briefing/${briefingId}`)}
        />
      )}

      <BriefingDetailsModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedItem(null); }}
        item={selectedItem}
        onItemUpdated={loadBriefingData}
      />
      <SendMessageDialog
        isOpen={isSendOpen}
        onClose={() => setIsSendOpen(false)}
        userId={activeUserId}
      />
    </div>
  );
}
