"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton, CardSkeleton, BriefItemSkeleton, PriorityItemSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { signOutAction } from "@/app/actions";
import { generateDashboardBrief, DashboardBriefData } from "@/app/actions/dashboard";
import {
  generateBriefingAction
} from "@/app/actions/briefing";
import {
  Mail, Inbox, MessageCircle, Wifi, WifiOff
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { DashboardBriefSection } from "@/components/dashboard/dashboard-brief-section";
import { ConnectedAppsGrid } from "@/components/dashboard/connected-apps-grid";
import { PriorityItemsCard } from "@/components/dashboard/priority-items-card";


interface ExtendedBriefData extends DashboardBriefData {
  executiveSummary?: string;
  title?: string;
  generatedAt?: string;
  id?: string;
}

export default function Dashboard() {
  const { user, dbUser, isLoading, clearSession } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.href = "/sign-in";
    }
  }, [user, isLoading]);

  const activeUserId = dbUser?.id;
  const authUserId = user?.id;
  const isDbReady = !!activeUserId;

  const [isSignOutLoading, setIsSignOutLoading] = useState(false);
  const [briefData, setBriefData] = useState<ExtendedBriefData | null>(null);
  const [isBriefLoading, setIsBriefLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const [connectedApps, setConnectedApps] = useState<{
    id: string;
    name: string;
    icon: string;
    connected: boolean;
  }[]>([]);

  const loadDashboardData = useCallback(async () => {
    if (!user || !activeUserId || !authUserId) return;
    setIsBriefLoading(true);
    setDataError(null);

    try {
      const { getConnectionStatus } = await import("@/app/actions/integrations");
      const providerIds = ["gmail", "slack", "telegram", "whatsapp"];
      const results = await Promise.allSettled(
        providerIds.map(id => getConnectionStatus(authUserId, id))
      );

      const apps = providerIds.map((id, i) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        icon: id === "gmail" ? "/gmail.png" : `/${id}.png`,
        connected: results[i].status === "fulfilled" && results[i].value !== null,
      }));
      setConnectedApps(apps);

      const activePlatformIds = apps.filter(a => a.connected).map(a => a.id);
      let finalPlatforms = [...activePlatformIds];

      const stored = localStorage.getItem("syncra-mock-connected-platforms");
      if (stored) {
        try {
          const mockApps = JSON.parse(stored);
          const uniqueMockApps = mockApps.filter((id: string) => !activePlatformIds.includes(id));
          if (uniqueMockApps.length > 0) setIsDemoMode(true);
          finalPlatforms = Array.from(new Set([...finalPlatforms, ...uniqueMockApps]));
        } catch {}
      }

      const data = await generateDashboardBrief(authUserId, finalPlatforms);
      if (data) {
        setBriefData(data);
      }
    } catch (e) {
      console.error("Failed to load dashboard data:", e);
      setDataError("Unable to load dashboard data. Please try again.");
    } finally {
      setIsBriefLoading(false);
    }

  }, [user, activeUserId]);

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

  const renderAppIcon = (platform: string, className = "w-5 h-5") => {
    const app = connectedApps.find(a => a.id === platform.toLowerCase());
    if (app && app.icon) {
      return <img src={app.icon} alt={app.name} className={`object-contain ${className}`} />;
    }
    if (platform === "gmail") return <Mail className={`text-text-slate ${className}`} />;
    if (platform === "slack" || platform === "whatsapp" || platform === "telegram") return <MessageCircle className={`text-text-slate ${className}`} />;
    return <Inbox className={`text-text-slate ${className}`} />;
  };

  if (!user) return null;

  if (isLoading || !isDbReady) {
    return (
      <div className="pb-10 font-sans max-w-6xl mx-auto animate-fade-in">
        <div className="mb-8">
          <Skeleton className="h-10 w-72 mb-2 rounded-lg" />
          <Skeleton className="h-5 w-96 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card className="neo-border bg-surface-white p-8 neo-shadow-md">
              <Skeleton className="h-6 w-40 mb-6 rounded-lg" />
              <div className="space-y-4">
                <BriefItemSkeleton /><BriefItemSkeleton /><BriefItemSkeleton />
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

  return (
    <div className="pb-10 font-sans max-w-6xl mx-auto animate-fade-in">
      {isDemoMode && !briefData?.id && (
        <div className="mb-6 p-4 bg-warning-bg border-[2.5px] border-warning rounded-[24px] flex items-center gap-3 text-warning font-bold neo-shadow-sm">
          <Wifi className="w-5 h-5 shrink-0" />
          <p className="text-[13px]">Demo Mode enabled. Some platforms are simulated. Connect real accounts in Integrations for live data.</p>
        </div>
      )}

      {dataError && (
        <div className="mb-6 p-4 bg-error-bg border-[2.5px] border-error rounded-[24px] flex items-center justify-between gap-3 text-error font-bold neo-shadow-sm">
          <div className="flex items-center gap-3">
            <WifiOff className="w-5 h-5 shrink-0" />
            <p className="text-[13px]">{dataError}</p>
          </div>
          <button onClick={loadDashboardData} className="text-error underline text-[13px] font-bold">Retry</button>
        </div>
      )}

      <DashboardHeader
        userName={user.profile?.name || "User"}
        onRegenerate={handleRegenerate}
        onSignOut={handleSignOut}
        isRegenerating={isBriefLoading}
      />

      <StatsOverview
        importantCount={briefData?.importantCount || 0}
        priorityCount={briefData?.priorityCount || 0}
        followUpsCount={briefData?.followUpsCount || 0}
        isLoading={isBriefLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <DashboardBriefSection
            title={briefData?.title}
            generatedAt={briefData?.generatedAt}
            executiveSummary={briefData?.executiveSummary}
            briefItems={briefData?.briefItems || []}
            briefId={briefData?.id}
            isLoading={isBriefLoading}
            renderPlatformIcon={renderAppIcon}
          />
          <ConnectedAppsGrid connectedApps={connectedApps} />
        </div>
        <div className="space-y-8">
          <PriorityItemsCard
            priorityItems={briefData?.priorityItems || []}
            isLoading={isBriefLoading}
            renderPlatformIcon={renderAppIcon}
          />
        </div>
      </div>

    </div>
  );
}
