"use client";
/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities */
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton, CardSkeleton, BriefItemSkeleton, PriorityItemSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { signOutAction } from "@/app/actions";
import { generateDashboardBrief, DashboardBriefData } from "@/app/actions/dashboard";
import {
  getBriefingsAction,
  generateBriefingAction,
  getBriefingDetailsAction
} from "@/app/actions/briefing";
import {
  LogOut,
  RefreshCw,
  Sparkles,
  Inbox,
  AlertCircle,
  Clock,
  Settings,
  Mail,
  MessageCircle,
  CheckCircle,
  Wifi,
  WifiOff,
  ArrowRight,
} from "lucide-react";

interface ExtendedBriefData extends DashboardBriefData {
  executiveSummary?: string;
  title?: string;
  generatedAt?: string;
  id?: string;
}

export default function Dashboard() {
  const router = useRouter();
  
  // Get centralized auth state
  const { user, dbUser, isLoading, clearSession } = useAuth();

  // Redirect backstop
  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/sign-in";
    }
  }, [user, isLoading]);

  // dbUser.id = public.users PK (used for FK-referenced tables like briefings)
  // user.id  = auth.users ID (used for user_integrations which has no FK constraint)
  const activeUserId = dbUser?.id;
  const authUserId = user?.id;
  const isDbReady = !!activeUserId;
  
  const [isSignOutLoading, setIsSignOutLoading] = useState(false);
  const [briefData, setBriefData] = useState<ExtendedBriefData | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Integrations state
  const [connectedApps, setConnectedApps] = useState<{
    id: string;
    name: string;
    icon: string;
    connected: boolean;
  }[]>([]);

  // Load integration statuses and brief
  const loadDashboardData = useCallback(async () => {
    if (!user || !activeUserId || !authUserId) return;
    setIsBriefLoading(true);
    setDataError(null);
    
    try {
      const { getGmailConnectionStatus } = await import("@/app/actions/integrations");
      const gmailConn = await getGmailConnectionStatus(authUserId);
      
      const apps = [
        { id: "gmail", name: "Gmail", icon: "/gmail.png", connected: !!gmailConn },
        { id: "slack", name: "Slack", icon: "/slack.png", connected: false },
        { id: "telegram", name: "Telegram", icon: "/telegram.png", connected: false },
        { id: "whatsapp", name: "WhatsApp", icon: "/whatsapp.png", connected: false },
        { id: "outlook", name: "Outlook", icon: "/email.png", connected: false },
      ];
      setConnectedApps(apps);

      // 1. Try to load the latest briefing from the database
      const briefings = await getBriefingsAction(activeUserId, { limit: 1 });
      
      if (briefings && briefings.length > 0) {
        const latestBrief = briefings[0];
        
        // Load details (items)
        const { items } = await getBriefingDetailsAction(activeUserId, latestBrief.id!);
        const fullContent = latestBrief.full_content as any;
        
        const formatted: ExtendedBriefData = {
          importantCount: fullContent.totalImportantItems || 0,
          priorityCount: fullContent.highPriorityCount || 0,
          followUpsCount: fullContent.categories?.followUps?.items?.length || 0,
          briefItems: items.map(item => ({
            platform: item.platform,
            text: (item.metadata as any)?.shortSummary || (item.metadata as any)?.title || ""
          })),
          priorityItems: items.map(item => ({
            platform: item.platform,
            title: (item.metadata as any)?.title || "",
            time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            description: (item.metadata as any)?.shortSummary || "",
            priority: item.priority === 'high' ? 'High' : item.priority === 'normal' ? 'Medium' : 'Low'
          })),
          executiveSummary: latestBrief.executive_summary,
          title: latestBrief.title,
          generatedAt: latestBrief.generated_at,
          id: latestBrief.id
        };
        
        setBriefData(formatted);
      } else {
        // 2. Fall back to on-the-fly generation/mocks if database is empty
        const activePlatformIds = apps.filter(a => a.connected).map(a => a.id);
        let finalPlatforms = [...activePlatformIds];

        const stored = localStorage.getItem("syncra-mock-connected-platforms");
        if (stored) {
          try {
            const mockApps = JSON.parse(stored);
            if (mockApps.length > 0) setIsDemoMode(true);
            finalPlatforms = Array.from(new Set([...finalPlatforms, ...mockApps]));
          } catch {}
        }

        const data = await generateDashboardBrief(authUserId, finalPlatforms);
        setBriefData(data || null);
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
      setDataError("Unable to load dashboard data. Please try again.");
    } finally {
      setIsBriefLoading(false);
    }
  }, [user, activeUserId]);

  // Handle manual briefing generation
  const handleRegenerate = async () => {
    if (!user || !activeUserId) return;
    setIsBriefLoading(true);
    setDataError(null);
    
    try {
      const res = await generateBriefingAction(activeUserId, null);
      if (res.success) {
        await loadDashboardData();
      } else {
        throw new Error(res.error || "Generation returned failure");
      }
    } catch (err: any) {
      console.error("Manual brief generation error:", err);
      setDataError(err.message || "Failed to generate briefing. Please try again.");
      setIsBriefLoading(false);
    }
  };

  useEffect(() => {
    if (user && isDbReady) {
      loadDashboardData();
    }
  }, [user, isDbReady, loadDashboardData]);

  // Handle Log Out
  const handleSignOut = async () => {
    setIsSignOutLoading(true);
    try {
      await signOutAction();
      clearSession();
      window.location.href = "/sign-in";
    } catch (err) {
      console.error(err);
      clearSession();
      window.location.href = "/sign-in";
    } finally {
      setIsSignOutLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  if (isLoading || !isDbReady) {
    return (
      <div className="pb-10 font-sans max-w-6xl mx-auto animate-fade-in">
        <div className="mb-8">
          <Skeleton className="h-10 w-72 mb-2 rounded-lg" />
          <Skeleton className="h-5 w-96 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="neo-border bg-surface-white p-8 neo-shadow-md">
              <Skeleton className="h-6 w-40 mb-6 rounded-lg" />
              <div className="space-y-4">
                <BriefItemSkeleton />
                <BriefItemSkeleton />
                <BriefItemSkeleton />
              </div>
            </Card>
          </div>
          <Card className="neo-border bg-surface-white neo-shadow-md p-6">
            <Skeleton className="h-5 w-32 mb-4 rounded-lg" />
            <Skeleton className="h-4 w-48 mb-6 rounded-lg" />
            <PriorityItemSkeleton />
          </Card>
        </div>
      </div>
    );
  }

  const renderAppIcon = (platform: string, className = "w-5 h-5") => {
    const app = connectedApps.find(a => a.id === platform.toLowerCase());
    if (app && app.icon) {
      return <img src={app.icon} alt={app.name} className={`object-contain ${className}`} />;
    }
    // Fallbacks
    if (platform === "gmail" || platform === "outlook") return <Mail className={`text-text-slate ${className}`} />;
    if (platform === "slack" || platform === "whatsapp" || platform === "telegram") return <MessageCircle className={`text-text-slate ${className}`} />;
    return <Inbox className={`text-text-slate ${className}`} />;
  };

  return (
    <div className="pb-10 font-sans max-w-6xl mx-auto animate-fade-in">
      {/* Demo Mode Banner */}
      {isDemoMode && !briefData?.id && (
        <div className="mb-6 p-4 bg-warning-bg border-[2.5px] border-warning rounded-[24px] flex items-center gap-3 text-warning font-bold neo-shadow-sm">
          <Wifi className="w-5 h-5 shrink-0" />
          <p className="text-[13px]">
            Demo Mode enabled. Some platforms are simulated. Connect real accounts in Integrations for live data.
          </p>
        </div>
      )}

      {/* Error Banner */}
      {dataError && (
        <div className="mb-6 p-4 bg-error-bg border-[2.5px] border-error rounded-[24px] flex items-center justify-between gap-3 text-error font-bold neo-shadow-sm">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 shrink-0" />
            <p className="text-[13px]">{dataError}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadDashboardData} className="text-error underline">
            Retry
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display font-black text-4xl text-secondary mb-2 tracking-tight">
            Welcome back, {user.profile?.name ? user.profile.name.split(" ")[0] : "User"}!
          </h1>
          <p className="text-text-slate text-[16px] font-medium max-w-2xl leading-relaxed">
            Here's what's happening across your connected workspace today ({user.email}).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={handleRegenerate}
            disabled={isBriefLoading}
            className="flex items-center gap-2 border-[2px] border-border-mist hover:border-secondary transition-all rounded-[14px] bg-surface-white font-bold text-secondary h-11 px-4 neo-shadow-sm hover:translate-y-[-2px] active:translate-y-[0px] duration-200"
          >
            <RefreshCw className={`w-4 h-4 ${isBriefLoading ? "animate-spin" : ""}`} />
            <span>Regenerate Brief</span>
          </Button>
          <Button
            variant="ghost"
            isLoading={isSignOutLoading}
            onClick={handleSignOut}
            className="text-text-slate hover:text-error hover:bg-error-bg font-bold flex items-center gap-2 px-3 py-1.5 border-[2px] border-transparent hover:border-error rounded-[14px] h-11"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="neo-border bg-surface-white p-6 neo-shadow-sm flex items-center gap-4 hover:shadow-flat-sm hover:translate-y-[-2px] transition-all duration-300 group cursor-pointer" onClick={() => router.push("/dashboard/briefing")}>
          <div className="w-14 h-14 rounded-2xl bg-error/10 border-[1.5px] border-error flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <AlertCircle className="w-6 h-6 text-error" />
          </div>
          <div>
            <p className="text-text-slate text-[13px] font-bold uppercase tracking-wider mb-1">Important</p>
            <div className="font-display font-black text-3xl text-secondary leading-none">
              {isBriefLoading ? "..." : briefData?.importantCount || 0}
            </div>
          </div>
        </Card>
        <Card className="neo-border bg-surface-white p-6 neo-shadow-sm flex items-center gap-4 hover:shadow-flat-sm hover:translate-y-[-2px] transition-all duration-300 group cursor-pointer" onClick={() => router.push("/dashboard/briefing")}>
          <div className="w-14 h-14 rounded-2xl bg-warning/10 border-[1.5px] border-warning flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Clock className="w-6 h-6 text-warning" />
          </div>
          <div>
            <p className="text-text-slate text-[13px] font-bold uppercase tracking-wider mb-1">Priority</p>
            <div className="font-display font-black text-3xl text-secondary leading-none">
              {isBriefLoading ? "..." : briefData?.priorityCount || 0}
            </div>
          </div>
        </Card>
        <Card className="neo-border bg-surface-white p-6 neo-shadow-sm flex items-center gap-4 hover:shadow-flat-sm hover:translate-y-[-2px] transition-all duration-300 group cursor-pointer" onClick={() => router.push("/dashboard/briefing")}>
          <div className="w-14 h-14 rounded-2xl bg-success/10 border-[1.5px] border-success flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <CheckCircle className="w-6 h-6 text-success" />
          </div>
          <div>
            <p className="text-text-slate text-[13px] font-bold uppercase tracking-wider mb-1">Follow-ups</p>
            <div className="font-display font-black text-3xl text-secondary leading-none">
              {isBriefLoading ? "..." : briefData?.followUpsCount || 0}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Briefing Area */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="neo-border bg-surface-white p-8 neo-shadow-md relative overflow-hidden">
            {/* Background gradient decorative */}
            <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-accent-purple/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-between mb-6 border-b-[2px] border-border-mist pb-4 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-accent-purple/10 text-accent-purple rounded-xl border-[1.5px] border-accent-purple shadow-sm">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-display font-black text-2xl text-secondary">
                    {briefData?.title || "Today's Brief"}
                  </h2>
                  <p className="text-text-slate text-[14px] font-medium">
                    {briefData?.generatedAt 
                      ? `Generated on ${new Date(briefData.generatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
                      : "AI-generated summary of your workspace."}
                  </p>
                </div>
              </div>
              
              {briefData?.id && (
                <Button
                  variant="ghost"
                  onClick={() => router.push("/dashboard/briefing")}
                  className="font-bold text-[13px] text-accent-purple hover:bg-accent-purple/10 rounded-xl px-3 flex items-center gap-1 border-[1.5px] border-accent-purple/30"
                >
                  <span>Open Briefing</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="space-y-5 relative z-10">
              {isBriefLoading ? (
                <div className="space-y-4 py-4 animate-pulse">
                  <div className="h-20 bg-background-mist rounded-2xl border-[1.5px] border-border-mist w-full"></div>
                  <div className="h-20 bg-background-mist rounded-2xl border-[1.5px] border-border-mist w-[90%]"></div>
                  <div className="h-20 bg-background-mist rounded-2xl border-[1.5px] border-border-mist w-[95%]"></div>
                </div>
              ) : (
                <>
                  {/* Executive Summary Section */}
                  {briefData?.executiveSummary && (
                    <div className="p-5 rounded-2xl bg-accent-purple/5 border-[1.5px] border-accent-purple/20 mb-4 transition-all duration-300 hover:bg-accent-purple/10">
                      <h4 className="font-bold text-[13px] text-accent-purple uppercase tracking-wider mb-2">Executive Summary</h4>
                      <p className="text-[15px] text-secondary font-medium leading-relaxed">
                        {briefData.executiveSummary}
                      </p>
                    </div>
                  )}

                  {/* Bullet Summary Items */}
                  <div className="space-y-4">
                    {briefData?.briefItems && briefData.briefItems.length > 0 ? (
                      briefData.briefItems.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-background-mist border-[1.5px] border-border-mist hover:border-text-fog transition-colors group">
                          <div className="shrink-0 mt-0.5 w-9 h-9 bg-white rounded-xl border-[1.5px] border-border-mist flex items-center justify-center shadow-sm">
                            {renderAppIcon(item.platform, "w-5 h-5")}
                          </div>
                          <p className="text-[14.5px] text-secondary font-medium leading-relaxed pt-0.5">
                            {item.text}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-text-slate font-medium">
                        No briefing data available today. Connect more platforms.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </Card>

          {/* Connected Apps Top 4 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectedApps.slice(0, 4).map((app) => (
              <div key={app.id} className="p-5 rounded-2xl bg-surface-white border-[2.5px] border-border-mist flex items-center justify-between hover:border-text-fog hover:shadow-flat-sm transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-background-mist border-[1.5px] border-border-mist flex items-center justify-center">
                    <img src={app.icon} alt={app.name} className="w-6 h-6 object-contain" />
                  </div>
                  <div>
                    <h4 className="font-bold text-secondary">{app.name}</h4>
                    <span className={`text-[12px] font-semibold flex items-center gap-1 mt-0.5 ${app.connected ? "text-success" : "text-text-fog"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${app.connected ? "bg-success" : "bg-text-fog"}`}></span>
                      {app.connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => router.push("/dashboard/integrations")}
                  className="p-2 text-text-slate hover:text-secondary bg-background-mist hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-border-mist"
                  title="Manage Integration"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Priority Items Card */}
          <Card className="neo-border bg-surface-white neo-shadow-md">
            <div className="p-6 border-b-[2px] border-border-mist flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-xl text-secondary">Priority Items</h3>
                <p className="text-[13px] text-text-slate font-medium mt-0.5">Needs your attention</p>
              </div>
              <div className="p-2 rounded-lg bg-warning/10 text-warning">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>
            
            <div className="p-2">
              {isBriefLoading ? (
                <div className="space-y-2 p-4 animate-pulse">
                  <div className="h-16 bg-background-mist rounded-xl border border-border-mist w-full"></div>
                  <div className="h-16 bg-background-mist rounded-xl border border-border-mist w-full"></div>
                  <div className="h-16 bg-background-mist rounded-xl border border-border-mist w-full"></div>
                </div>
              ) : briefData?.priorityItems && briefData.priorityItems.length > 0 ? (
                <div className="divide-y-[1.5px] divide-border-mist">
                  {briefData.priorityItems.slice(0, 4).map((item, i) => (
                    <div key={i} className="p-4 hover:bg-background-mist transition-colors group cursor-default">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          {renderAppIcon(item.platform, "w-4 h-4")}
                          <h4 className="font-bold text-[14px] text-secondary line-clamp-1">
                            {item.title}
                          </h4>
                        </div>
                        <span className="text-[11px] font-semibold text-text-slate whitespace-nowrap bg-white border border-border-mist px-2 py-0.5 rounded-full">
                          {item.time}
                        </span>
                      </div>
                      <p className="text-[13px] text-text-slate font-medium line-clamp-2 mb-3">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md ${
                          item.priority === 'High' ? 'bg-error/10 text-error' :
                          item.priority === 'Medium' ? 'bg-warning/10 text-warning' :
                          'bg-success/10 text-success'
                        }`}>
                          {item.priority}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-[13px] text-text-slate font-medium">
                  No priority items at the moment.
                </div>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
