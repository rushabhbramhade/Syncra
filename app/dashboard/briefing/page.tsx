"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefingDetailsModal } from "@/components/dashboard/briefing-details-modal";
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
  Sparkles,
  Calendar,
  Clock,
  Settings,
  Mail,
  MessageCircle,
  Inbox,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Plus,
  Trash2,
  ListFilter,
  Search,
  BookOpen,
  History,
  Activity,
  ChevronRight,
  HelpCircle,
  MapPin
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
  const [showAddSchedule, setShowAddSchedule] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState("");
  const [newScheduleGoal, setNewScheduleGoal] = useState("");
  const [newScheduleFreq, setNewScheduleFreq] = useState("morning_brief");
  const [newScheduleTZ, setNewScheduleTZ] = useState(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
  });
  const [newScheduleApps, setNewScheduleApps] = useState<string[]>(["gmail", "whatsapp"]);
  const [newScheduleCats, setNewScheduleCats] = useState<string[]>(["email", "messages", "tasks"]);
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

  // Handle Schedule Creation
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScheduleName.trim() || !user || !activeUserId || isSubmittingSchedule) return;
    setIsSubmittingSchedule(true);
    setFeedbackError(null);
    
    try {
      await createScheduleAction(activeUserId, {
        name: newScheduleName,
        goal: newScheduleGoal.trim() || null,
        frequency: newScheduleFreq,
        timezone: newScheduleTZ,
        integrations: newScheduleApps,
        categories: newScheduleCats,
        enabled: true,
      });
      
      setNewScheduleName("");
      setNewScheduleGoal("");
      setShowAddSchedule(false);
      await loadBriefingData();
      setFeedbackSuccess("Briefing schedule created!");
      setTimeout(() => setFeedbackSuccess(null), 3000);
    } catch (err: any) {
      console.error(err);
      setFeedbackError(err.message || "Failed to create schedule.");
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

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

  // Icon Render Helpers
  const getAppIcon = (platform: string, className = "w-4 h-4") => {
    const plat = platform.toLowerCase();
    if (plat === "gmail" || plat === "outlook") return <Mail className={className} />;
    if (plat === "slack" || plat === "whatsapp" || plat === "telegram" || plat === "discord") {
      return <MessageCircle className={className} />;
    }
    return <Inbox className={className} />;
  };

  const getPlatformClass = (platform: string) => {
    const plat = platform.toLowerCase();
    if (plat === "gmail") return "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20";
    if (plat === "whatsapp") return "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20";
    if (plat === "slack") return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20";
    if (plat === "telegram") return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
    return "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20";
  };

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

  const latestBriefContent = latestBriefing?.full_content as any;

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

      {/* Latest Briefing Executive Card */}
      {latestBriefing ? (
        <Card className="neo-border bg-surface-white p-8 neo-shadow-md relative overflow-hidden flex flex-col md:flex-row justify-between gap-6 hover:shadow-flat-md transition-all duration-300">
          <div className="absolute top-[-50px] right-[-50px] w-48 h-48 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="space-y-4 flex-1 relative z-10">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-accent-purple/10 text-accent-purple rounded-lg border border-accent-purple/20">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="font-display font-black text-xl text-secondary">
                {latestBriefing.title}
              </h2>
            </div>
            
            <p className="text-[15px] font-medium text-secondary leading-relaxed bg-accent-purple/5 border border-accent-purple/10 p-5 rounded-2xl">
              {latestBriefing.executive_summary}
            </p>

            <div className="flex flex-wrap items-center gap-6 text-[12.5px] font-bold text-text-slate">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Generated {new Date(latestBriefing.generated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              {latestBriefContent?.readingTimeMinutes && (
                <div className="flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" />
                  <span>{latestBriefContent.readingTimeMinutes} min read</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center md:justify-center border-t md:border-t-0 md:border-l border-border-mist pt-5 md:pt-0 md:pl-8 shrink-0 relative z-10">
            <div className="flex flex-row md:flex-col items-center gap-4 text-center">
              <div className="relative flex items-center justify-center">
                <svg className="w-20 h-20 transform -rotate-90">
                  <circle cx="40" cy="40" r="32" stroke="currentColor" className="text-border-mist" strokeWidth="6" fill="transparent" />
                  <circle cx="40" cy="40" r="32" stroke="currentColor" className="text-accent-purple" strokeWidth="6" fill="transparent"
                    strokeDasharray={2 * Math.PI * 32}
                    strokeDashoffset={2 * Math.PI * 32 * (1 - (latestBriefing.priority_score || 50) / 100)} />
                </svg>
                <span className="absolute font-display font-black text-xl text-secondary">
                  {latestBriefing.priority_score}
                </span>
              </div>
              <div className="text-left md:text-center">
                <h4 className="font-bold text-[14px] text-secondary">Priority Score</h4>
                <p className="text-[11.5px] text-text-slate font-semibold mt-0.5">Workspace Alert Level</p>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="neo-border bg-surface-white p-10 neo-shadow-sm text-center space-y-4">
          <Inbox className="w-12 h-12 text-text-fog mx-auto" />
          <div>
            <h3 className="font-display font-black text-xl text-secondary">No AI Briefings Available</h3>
            <p className="text-text-slate text-[14px] font-medium max-w-sm mx-auto mt-1">
              Connect your accounts and click 'Regenerate Brief' to build your very first briefing.
            </p>
          </div>
          <Button
            onClick={handleTriggerBriefing}
            disabled={isGenerating}
            className="rounded-[12px] bg-accent-purple hover:bg-accent-purple/90 text-white font-bold h-10 px-5 shadow-sm"
          >
            Generate First Briefing
          </Button>
        </Card>
      )}

      {/* Grid: Left config & Right briefing items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Schedules & History */}
        <div className="lg:col-span-1 space-y-8">
          
          {/* Schedules list */}
          <Card className="neo-border bg-surface-white p-6 neo-shadow-sm">
            <div className="flex items-center justify-between border-b border-border-mist pb-4 mb-4">
              <h3 className="font-display font-black text-lg text-secondary flex items-center gap-1.5">
                <Clock className="w-5 h-5 text-accent-purple" />
                <span>Schedules</span>
              </h3>
              <button
                onClick={() => setShowAddSchedule(!showAddSchedule)}
                className="p-1.5 bg-background-mist text-secondary hover:bg-slate-200 border border-border-mist rounded-xl transition-all shadow-sm"
                title="Add Schedule"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Add Schedule Form */}
            {showAddSchedule && (
              <form onSubmit={handleCreateSchedule} className="p-4 bg-background-mist border-[1.5px] border-border-mist rounded-2xl mb-4 space-y-4 animate-in slide-in-from-top duration-200">
                <div className="space-y-1">
                  <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider">Schedule Name</label>
                  <input
                    type="text"
                    required
                    value={newScheduleName}
                    onChange={(e) => setNewScheduleName(e.target.value)}
                    placeholder="e.g. Daily Sync, Support Alert"
                    className="w-full rounded-xl border border-border-mist bg-white text-[13px] font-semibold text-secondary px-3 py-2 outline-none focus:border-accent-purple"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider flex items-center gap-1">
                    <span>Briefing Goal</span>
                    <span title="Write what the AI should focus on (e.g. Acme project update)">
                      <HelpCircle className="w-3 h-3 text-text-fog" />
                    </span>
                  </label>
                  <textarea
                    value={newScheduleGoal}
                    onChange={(e) => setNewScheduleGoal(e.target.value)}
                    placeholder="Focus summary on Acme Corp agreements and deployment reviews..."
                    rows={2}
                    className="w-full rounded-xl border border-border-mist bg-white text-[13px] font-semibold text-secondary p-3 outline-none focus:border-accent-purple resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider">Frequency</label>
                    <select
                      value={newScheduleFreq}
                      onChange={(e) => setNewScheduleFreq(e.target.value)}
                      className="w-full rounded-xl border border-border-mist bg-white text-[13px] font-semibold text-secondary px-3 py-2 outline-none focus:border-accent-purple"
                    >
                      <option value="every_15_min">Every 15 mins</option>
                      <option value="hourly">Hourly</option>
                      <option value="morning_brief">Morning Brief (8 AM)</option>
                      <option value="evening_brief">Evening Brief (6 PM)</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider">Timezone</label>
                    <input
                      type="text"
                      required
                      value={newScheduleTZ}
                      onChange={(e) => setNewScheduleTZ(e.target.value)}
                      className="w-full rounded-xl border border-border-mist bg-white text-[12px] font-bold text-secondary px-3 py-2 outline-none focus:border-accent-purple"
                    />
                  </div>
                </div>

                {/* Platforms selection checkboxes */}
                <div className="space-y-2">
                  <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider block">Integrations</label>
                  <div className="flex flex-wrap gap-2">
                    {["gmail", "whatsapp", "slack", "telegram"].map(app => {
                      const active = newScheduleApps.includes(app);
                      return (
                        <button
                          key={app}
                          type="button"
                          onClick={() => {
                            if (active) setNewScheduleApps(newScheduleApps.filter(a => a !== app));
                            else setNewScheduleApps([...newScheduleApps, app]);
                          }}
                          className={`text-[12px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                            active ? "bg-accent-purple text-white border-accent-purple" : "bg-white text-secondary border-border-mist"
                          }`}
                        >
                          {app}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Categories selection checkboxes */}
                <div className="space-y-2">
                  <label className="text-[11.5px] font-black uppercase text-text-slate tracking-wider block">Brief Categories</label>
                  <div className="flex flex-wrap gap-2">
                    {["email", "messages", "tasks", "meetings", "follow-ups"].map(cat => {
                      const active = newScheduleCats.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (active) setNewScheduleCats(newScheduleCats.filter(c => c !== cat));
                            else setNewScheduleCats([...newScheduleCats, cat]);
                          }}
                          className={`text-[12px] font-bold px-3 py-1.5 rounded-xl border transition-all ${
                            active ? "bg-accent-purple text-white border-accent-purple" : "bg-white text-secondary border-border-mist"
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowAddSchedule(false)}
                    className="rounded-xl font-bold text-[12.5px] h-9 px-3"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingSchedule || newScheduleApps.length === 0}
                    className="rounded-xl bg-accent-purple hover:bg-accent-purple/95 text-white font-bold text-[12.5px] h-9 px-4 shadow-sm"
                  >
                    {isSubmittingSchedule ? "Saving..." : "Save Schedule"}
                  </Button>
                </div>
              </form>
            )}

            {/* Schedules list content */}
            <div className="space-y-3">
              {schedules.length > 0 ? (
                schedules.map(schedule => (
                  <div key={schedule.id} className="p-4 bg-background-mist border-[1.5px] border-border-mist rounded-2xl flex flex-col gap-2 hover:border-text-fog transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-[14.5px] text-secondary">{schedule.name}</h4>
                        <span className="text-[11px] font-semibold text-text-slate flex items-center gap-1 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{schedule.frequency} ({schedule.timezone})</span>
                        </span>
                      </div>
                      
                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id!)}
                        className="p-1.5 text-text-slate hover:text-error bg-white border border-border-mist rounded-lg transition-colors hover:bg-error-bg"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {schedule.goal && (
                      <p className="text-[12px] font-medium text-text-slate line-clamp-1 italic bg-white p-2 rounded-lg border border-border-mist/60">
                        "{schedule.goal}"
                      </p>
                    )}

                    <div className="flex items-center justify-between border-t border-border-mist/60 pt-2 mt-1">
                      <div className="flex flex-wrap gap-1.5">
                        {schedule.integrations.map(app => (
                          <span key={app} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${getPlatformClass(app)}`}>
                            {app}
                          </span>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-bold text-text-slate">
                          {schedule.enabled ? "Active" : "Paused"}
                        </span>
                        
                        {/* Toggle switch */}
                        <button
                          onClick={() => handleToggleSchedule(schedule.id!, schedule.enabled)}
                          className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ${
                            schedule.enabled ? "bg-accent-purple" : "bg-text-fog"
                          }`}
                        >
                          <div className={`w-4 h-4 bg-white rounded-full shadow-sm transform duration-300 ${
                            schedule.enabled ? "translate-x-4" : "translate-x-0"
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-text-slate text-[13px] font-medium">
                  No automated schedules. Click + to add.
                </div>
              )}
            </div>
          </Card>

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
                        {log.duration ? `${(log.duration / 1000).toFixed(1)}s` : "—"}
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
          <Card className="neo-border bg-surface-white p-6 neo-shadow-sm space-y-5">
            {/* Tabs Filter Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-mist pb-4">
              <div className="flex items-center gap-2">
                <ListFilter className="w-5 h-5 text-accent-purple" />
                <h3 className="font-display font-black text-lg text-secondary">Briefing Inbox</h3>
              </div>

              {/* Tabs buttons */}
              <div className="flex bg-background-mist border border-border-mist rounded-xl p-1 gap-1">
                {(["unread", "completed", "archived", "snoozed"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-[12px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider transition-colors ${
                      activeTab === tab ? "bg-white text-secondary shadow-sm" : "text-text-slate hover:text-secondary"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-text-fog" />
              <input
                type="text"
                placeholder="Search inbox by subject, platform, or contents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border border-border-mist focus:border-accent-purple bg-background-mist text-[13.5px] font-semibold text-secondary pl-10 pr-4 py-2.5 outline-none duration-150 focus:bg-white"
              />
            </div>

            {/* Briefing Items Grid/List */}
            <div className="space-y-4">
              {isDataLoading ? (
                <div className="space-y-3 py-4 animate-pulse">
                  <div className="h-16 bg-background-mist rounded-xl border border-border-mist"></div>
                  <div className="h-16 bg-background-mist rounded-xl border border-border-mist"></div>
                  <div className="h-16 bg-background-mist rounded-xl border border-border-mist"></div>
                </div>
              ) : filteredItems.length > 0 ? (
                filteredItems.map(item => {
                  const meta = (item.metadata || {}) as Record<string, any>;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setIsModalOpen(true);
                      }}
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
                          
                          {/* Replied text notes if completed */}
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
                              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-between shrink-0">
                        <ChevronRight className="w-5 h-5 text-text-fog group-hover:text-secondary group-hover:translate-x-1 duration-200" />
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                          item.priority === 'high' ? 'bg-error/10 text-error border-error/20' : 'bg-slate-100 text-text-slate border-slate-200'
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
