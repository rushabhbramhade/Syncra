"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { BriefingExecutiveCard } from "@/components/dashboard/briefing/briefing-executive-card";

const BriefingDetailsModal = dynamic(() => import("@/components/dashboard/briefing-details-modal").then(mod => mod.BriefingDetailsModal), { ssr: false });
import { ScheduleList } from "@/components/dashboard/briefing/schedule-list";
import { BriefingInbox } from "@/components/dashboard/briefing/briefing-inbox";
import {
  getSchedulesAction,
  createScheduleAction,
  deleteScheduleAction,
  updateScheduleAction,
  getBriefingsAction,
  getBriefingDetailsAction,
  getBriefingHistoryAction,
  generateBriefingAction,
  updateBriefingItemStatusAction
} from "@/app/actions/briefing";
import { BriefingScheduleRecord, BriefingRecord, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import {
  AlertCircle,
  CheckCircle,
  RefreshCw,
  History,
  Activity
} from "lucide-react";

export default function BriefingDashboard() {
  const { user, dbUser, isLoading } = useAuth();
  const activeUserId = dbUser?.id;
  const isDbReady = !!activeUserId;
  
  // State
  const [schedules, setSchedules] = useState<BriefingScheduleRecord[]>([]);
  const [latestBriefing, setLatestBriefing] = useState<BriefingRecord | null>(null);
  const [briefingItems, setBriefingItems] = useState<BriefingItemRecord[]>([]);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  
  // Loading & UX
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  
  // Form State for Schedule Creation
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
  
  // Filters & Modal
  const [activeTab, setActiveTab] = useState<"all" | "unread" | "completed" | "archived" | "snoozed">("unread");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<BriefingItemRecord | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load all dashboard data
  const loadBriefingData = useCallback(async () => {
    if (!user || !activeUserId) return;
    setIsDataLoading(true);
    setFeedbackError(null);
    
    try {
      // 1. Fetch schedules
      const scheds = await getSchedulesAction(activeUserId);
      setSchedules(scheds);

      // 2. Fetch latest briefings
      const briefs = await getBriefingsAction(activeUserId, { limit: 1 });
      
      if (briefs && briefs.length > 0) {
        setLatestBriefing(briefs[0]);
        // Fetch briefing items
        const { items } = await getBriefingDetailsAction(activeUserId, briefs[0].id!);
        setBriefingItems(items);
      } else {
        setLatestBriefing(null);
        setBriefingItems([]);
      }

      // 3. Fetch history execution logs
      const logs = await getBriefingHistoryAction(activeUserId, 10);
      setHistoryLogs(logs);

    } catch (e: any) {
      console.error("Failed to load briefing dashboard data:", e);
      setFeedbackError("Failed to fetch briefings data. Please refresh.");
    } finally {
      setIsDataLoading(false);
    }
  }, [user, activeUserId]);

  // Initial load
  useEffect(() => {
    if (user && isDbReady) {
      loadBriefingData();
    }
  }, [user, isDbReady, loadBriefingData]);

  // Handle Manual Briefing Generation
  const handleTriggerBriefing = async () => {
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
      setFeedbackError(err.message || "Manual generation failed. Check integrations.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Schedule Creation (called by ScheduleList component)
  const handleAddSchedule = useCallback(async (data: {
    name: string;
    goal: string;
    frequency: string;
    timezone: string;
    integrations: string[];
    categories: string[];
  }) => {
    if (!user || !activeUserId) return;
    setIsSubmittingSchedule(true);
    setFeedbackError(null);
    
    try {
      await createScheduleAction(activeUserId, {
        name: data.name,
        goal: data.goal.trim() || null,
        frequency: data.frequency,
        timezone: data.timezone,
        integrations: data.integrations,
        categories: data.categories,
        enabled: true,
      });
      
      await loadBriefingData();
      setFeedbackSuccess("Briefing schedule created!");
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setFeedbackError(err.message || "Failed to create schedule.");
    } finally {
      setIsSubmittingSchedule(false);
    }
  }, [user, activeUserId, loadBriefingData]);

  // Toggle Schedule Enabled State
  const handleToggleSchedule = async (scheduleId: string, currentVal: boolean) => {
    if (!user || !activeUserId) return;
    try {
      await updateScheduleAction(activeUserId, scheduleId, { enabled: !currentVal });
      await loadBriefingData();
    } catch (err: any) {
      console.error(err);
      setFeedbackError("Failed to update schedule status.");
    }
  };

  // Delete Schedule
  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!user || !activeUserId) return;
    if (!confirm("Are you sure you want to delete this schedule?")) return;
    
    try {
      await deleteScheduleAction(activeUserId, scheduleId);
      await loadBriefingData();
      setFeedbackSuccess("Schedule deleted.");
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setFeedbackError("Failed to delete schedule.");
    }
  };

  // Filter items based on activeTab and searchQuery
  const filteredItems = briefingItems.filter(item => {
    // 1. Status Filter
    if (activeTab === "unread" && item.status !== "unread") return false;
    if (activeTab === "completed" && item.status !== "completed") return false;
    if (activeTab === "archived" && item.status !== "archived") return false;
    if (activeTab === "snoozed" && item.status !== "snoozed") return false;
    
    // 2. Search Query Filter
    if (searchQuery.trim()) {
      const meta = (item.metadata || {}) as Record<string, any>;
      const titleText = (meta.title || "").toLowerCase();
      const summaryText = (meta.shortSummary || "").toLowerCase();
      const q = searchQuery.toLowerCase();
      return titleText.includes(q) || summaryText.includes(q);
    }
    
    return true;
  });

  if (!user || isLoading || !isDbReady) {
    return (
      <div className="pb-10 font-sans max-w-6xl mx-auto space-y-8 animate-pulse">
        <div>
          <Skeleton className="h-10 w-72 mb-2 rounded-lg" />
          <Skeleton className="h-5 w-96 rounded-lg" />
        </div>
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Skeleton className="h-96 lg:col-span-1 rounded-3xl" />
          <Skeleton className="h-96 lg:col-span-2 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="pb-10 font-sans max-w-6xl mx-auto space-y-8 animate-fade-in">
      
      {/* Feedback Messages */}
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
          <h1 className="font-display font-black text-4xl text-secondary mb-2 tracking-tight">
            Workspace Briefings
          </h1>
          <p className="text-text-slate text-[16px] font-medium max-w-xl leading-relaxed">
            AI-powered summaries of connected Gmail, WhatsApp, and community tools.
          </p>
        </div>

        <Button
          onClick={handleTriggerBriefing}
          disabled={isGenerating || isDataLoading}
          className="rounded-[14px] bg-accent-purple hover:bg-accent-purple/90 text-white font-bold text-[14px] h-11 px-5 flex items-center gap-2 shadow-md hover:translate-y-[-1px] active:translate-y-0 duration-150 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`} />
          <span>{isGenerating ? "Regenerating..." : "Regenerate Brief"}</span>
        </Button>
      </div>

      <BriefingExecutiveCard
        latestBriefing={latestBriefing}
        onRegenerate={handleTriggerBriefing}
        isGenerating={isGenerating}
      />

      {/* Grid: Left config & Right briefing items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Schedules & History */}
        <div className="lg:col-span-1 space-y-8">
          
          <ScheduleList
            schedules={schedules}
            onToggle={handleToggleSchedule}
            onDelete={handleDeleteSchedule}
            onAdd={handleAddSchedule}
            isSubmitting={isSubmittingSchedule}
          />

          {/* History/Execution Logs */}
          <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
            <h3 className="font-display font-black text-lg text-secondary border-b border-border-mist pb-4 mb-4 flex items-center gap-1.5">
              <History className="w-5 h-5 text-accent-purple" />
              <span>Execution Logs</span>
            </h3>

            <div className="space-y-3.5 max-h-[300px] overflow-y-auto">
              {historyLogs.length > 0 ? (
                historyLogs.map(log => (
                  <div key={log.id} className="flex items-start justify-between text-[12.5px] border-b border-border-mist/40 pb-2 last:border-b-0">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-text-slate" />
                        <span className="font-bold text-secondary">
                          {log.trigger_source === "manual" ? "Manual Build" : "Cron Schedule"}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-text-slate mt-0.5">
                        {new Date(log.execution_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        log.status === 'success' ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                      }`}>
                        {log.status}
                      </span>
                      <p className="text-[11px] font-bold text-text-slate mt-1">
                        {log.duration ? `${(log.duration / 1000).toFixed(1)}s` : "\u2014"}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-text-slate text-[13px] font-medium">
                  No execution runs recorded yet.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Briefing items list */}
        <div className="lg:col-span-2 space-y-6">
          <BriefingInbox
            items={filteredItems}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onItemClick={(item) => {
              setSelectedItem(item);
              setIsModalOpen(true);
            }}
            isDataLoading={isDataLoading}
          />
        </div>

      </div>

      {/* Details modal with reply actions */}
      <BriefingDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedItem(null);
        }}
        item={selectedItem}
        onItemUpdated={loadBriefingData}
      />
    </div>
  );
}
