"use client";
/* eslint-disable react-hooks/set-state-in-effect, react/no-unescaped-entities */
import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { signOutAction } from "@/app/actions";
import { useAuth } from "@/components/auth-provider";
import { generateDashboardBrief, DashboardBriefData } from "@/app/actions/dashboard";
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
} from "lucide-react";

export default function Dashboard() {
  const router = useRouter();
  
  // Get centralized auth state
  const { user, isLoading, clearSession } = useAuth();

  // Redirect backstop
  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/sign-in";
    }
  }, [user, isLoading]);
  
  const [isSignOutLoading, setIsSignOutLoading] = useState(false);
  const [briefData, setBriefData] = useState<DashboardBriefData | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(true);

  // Integrations state
  const [connectedApps, setConnectedApps] = useState<{
    id: string;
    name: string;
    icon: string;
    connected: boolean;
  }[]>([]);

  // Load integration statuses and brief
  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setIsBriefLoading(true);
    
    try {
      const { getGmailConnectionStatus } = await import("@/app/actions/integrations");
      const gmailConn = await getGmailConnectionStatus(user.id);
      
      const apps = [
        { id: "gmail", name: "Gmail", icon: "/gmail.png", connected: !!gmailConn },
        { id: "slack", name: "Slack", icon: "/slack.png", connected: false },
        { id: "telegram", name: "Telegram", icon: "/telegram.png", connected: false },
        { id: "whatsapp", name: "WhatsApp", icon: "/whatsapp.png", connected: false },
        { id: "outlook", name: "Outlook", icon: "/email.png", connected: false },
      ];
      setConnectedApps(apps);

      const activePlatformIds = apps.filter(a => a.connected).map(a => a.id);
      
      // If we only have Gmail connected or none, we still simulate some connected platforms for demo purposes
      // Since mock connected list is stored in localStorage by IntegrationsPage, we can read it
      let finalPlatforms = [...activePlatformIds];
      const stored = localStorage.getItem("syncra-mock-connected-platforms");
      if (stored) {
        try {
          const mockApps = JSON.parse(stored);
          finalPlatforms = Array.from(new Set([...finalPlatforms, ...mockApps]));
        } catch {}
      }

      // Fetch the generated brief
      const data = await generateDashboardBrief(user.id, finalPlatforms);
      setBriefData(data);
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
    } finally {
      setIsBriefLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-mist font-sans">
        <div className="text-center space-y-4 max-w-sm px-6">
          <svg className="animate-spin h-10 w-10 text-primary mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="font-bold text-secondary text-lg">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const renderAppIcon = (platform: string, className = "w-5 h-5") => {
    const app = connectedApps.find(a => a.id === platform);
    if (app && app.icon) {
      return <img src={app.icon} alt={app.name} className={`object-contain ${className}`} />;
    }
    // Fallbacks
    if (platform === "gmail" || platform === "outlook") return <Mail className={`text-text-slate ${className}`} />;
    if (platform === "slack" || platform === "whatsapp" || platform === "telegram") return <MessageCircle className={`text-text-slate ${className}`} />;
    return <Inbox className={`text-text-slate ${className}`} />;
  };

  return (
    <div className="pb-10 font-sans max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display font-black text-4xl text-secondary mb-2 tracking-tight">
            Welcome back, {user.profile?.name ? user.profile.name.split(" ")[0] : "User"}! 👋
          </h1>
          <p className="text-text-slate text-[16px] font-medium max-w-2xl leading-relaxed">
            Here's what's happening across your connected workspace today.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={loadDashboardData}
            disabled={isBriefLoading}
            className="flex items-center gap-2 border-[2px] border-border-mist hover:border-secondary transition-all rounded-[14px] bg-surface-white font-bold text-secondary h-11 px-4"
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
        <Card className="neo-border bg-surface-white p-6 neo-shadow-sm flex items-center gap-4 hover:shadow-flat-sm transition-all duration-300 group">
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
        <Card className="neo-border bg-surface-white p-6 neo-shadow-sm flex items-center gap-4 hover:shadow-flat-sm transition-all duration-300 group">
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
        <Card className="neo-border bg-surface-white p-6 neo-shadow-sm flex items-center gap-4 hover:shadow-flat-sm transition-all duration-300 group">
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
            
            <div className="flex items-center gap-3 mb-6 border-b-[2px] border-border-mist pb-4 relative z-10">
              <div className="p-2.5 bg-accent-purple/10 text-accent-purple rounded-xl border-[1.5px] border-accent-purple shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-display font-black text-2xl text-secondary">Today's Brief</h2>
                <p className="text-text-slate text-[14px] font-medium">AI-generated summary of your workspace.</p>
              </div>
            </div>

            <div className="space-y-5 relative z-10">
              {isBriefLoading ? (
                <div className="space-y-4 py-4 animate-pulse">
                  <div className="h-20 bg-background-mist rounded-2xl border-[1.5px] border-border-mist w-full"></div>
                  <div className="h-20 bg-background-mist rounded-2xl border-[1.5px] border-border-mist w-[90%]"></div>
                  <div className="h-20 bg-background-mist rounded-2xl border-[1.5px] border-border-mist w-[95%]"></div>
                </div>
              ) : briefData?.briefItems && briefData.briefItems.length > 0 ? (
                briefData.briefItems.map((item, idx) => (
                  <div key={idx} className="flex gap-4 p-5 rounded-2xl bg-background-mist border-[1.5px] border-border-mist hover:border-text-fog transition-colors group">
                    <div className="shrink-0 mt-1 w-10 h-10 bg-white rounded-xl border-[1.5px] border-border-mist flex items-center justify-center shadow-sm">
                      {renderAppIcon(item.platform, "w-6 h-6")}
                    </div>
                    <p className="text-[15px] text-secondary font-medium leading-relaxed pt-0.5">
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
                    <span className="text-[12px] font-semibold text-success flex items-center gap-1 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-success"></span> Connected
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
