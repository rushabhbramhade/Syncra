"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton, CardSkeleton, BriefItemSkeleton, PriorityItemSkeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-provider";
import { signOutAction } from "@/app/actions";
import { generateDashboardBrief, DashboardBriefData } from "@/app/actions/dashboard";
import {
  getBriefingsAction,
  getBriefingItemsAction,
  generateBriefingAction
} from "@/app/actions/briefing";
import type { BriefingRecord, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import {
  Mail, Inbox, MessageCircle, WifiOff
} from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { DashboardBriefSection } from "@/components/dashboard/dashboard-brief-section";
import { ConnectedAppsGrid } from "@/components/dashboard/connected-apps-grid";
import { PriorityItemsCard } from "@/components/dashboard/priority-items-card";
import type { BriefingIntelligenceContent } from "@/lib/briefing-intelligence";


interface ExtendedBriefData extends DashboardBriefData {
  executiveSummary?: string;
  title?: string;
  generatedAt?: string;
  id?: string;
  providerHealth?: Record<string, unknown> | null;
}

// Map a stored briefing row + items into the dashboard card shape. This is the
// single source of truth (same data the "By All" page shows), so "Generate Now"
// visibly refreshes the General Workspace Update card.
function mapBriefingToCard(briefing: BriefingRecord, items: BriefingItemRecord[]): ExtendedBriefData {
  const itemsInOrder = items.filter(i => i.status !== "completed").slice(0, 10);
  const highInt = itemsInOrder.filter(i => i.priority === "high");
  const followUps = itemsInOrder.filter(i => i.category === "followUps");
  const meta = (i: BriefingItemRecord) => (i.metadata || {}) as Record<string, string | undefined>;
  return {
    title: briefing.title,
    generatedAt: briefing.generated_at,
    executiveSummary: briefing.executive_summary,
    id: briefing.id,
    importantCount: briefing.priority_score || itemsInOrder.length,
    priorityCount: highInt.length,
    followUpsCount: followUps.length,
    briefItems: itemsInOrder.slice(0, 5).map(i => ({
      platform: i.platform,
      text: meta(i).shortSummary || meta(i).title || i.category,
      category: i.category,
    })),
    priorityItems: highInt.slice(0, 5).map(i => ({
      platform: i.platform,
      title: meta(i).title || meta(i).shortSummary || "Priority item",
      time: new Date(i.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      description: meta(i).shortSummary || meta(i).title || "",
      priority: "High",
    })),
    intelligence: (briefing.full_content as BriefingIntelligenceContent) || undefined,
    providerHealth: briefing.provider_health || undefined,
  };
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
      const providerIds = ["gmail", "outlook", "slack", "whatsapp", "telegram", "discord", "linkedin", "github", "calendar", "notion", "linear"];
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

      const finalPlatforms = apps.filter(a => a.connected).map(a => a.id);

      // Prefer the latest stored briefing (same source as the By All page) so
      // the card shows enriched intelligence + a generated-at timestamp, and so
      // "Generate Now" visibly updates it. Fall back to a live fetch only when
      // no stored briefing exists yet.
      const briefs = await getBriefingsAction(activeUserId, { limit: 1 });
      const latest = briefs && briefs.length > 0 ? briefs[0] : null;
      if (latest) {
        let items: BriefingItemRecord[] = [];
        try {
          items = await getBriefingItemsAction(activeUserId, latest.id!);
        } catch {
          items = [];
        }
        setBriefData(mapBriefingToCard(latest, items));
      } else {
        const data = await generateDashboardBrief(authUserId, finalPlatforms);
        if (data) {
          setBriefData(data);
        } else if (finalPlatforms.length > 0) {
          setDataError("Unable to load dashboard data from your connected platforms. Please try again.");
        }
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
    } catch (err: unknown) {
      console.error("Manual brief generation error:", err);
      setDataError(err instanceof Error ? err.message : "Failed to generate briefing. Please try again.");
      setIsBriefLoading(false);
    }
  };

  useEffect(() => {
    if (user && isDbReady) {
      const t = setTimeout(loadDashboardData, 0);
      return () => clearTimeout(t);
    }
  }, [user, isDbReady, loadDashboardData]);

  // Live refresh: when an integration connects/disconnects, reload so
  // counters, AI health, and brief reflect the new state immediately.
  useEffect(() => {
    if (!user || !isDbReady) return;
    const es = new EventSource("/api/dashboard/stream");
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as { type?: string };
        if (event.type === "connection.updated") loadDashboardData();
      } catch {}
    };
    return () => es.close();
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
            intelligence={briefData?.intelligence}
            providerHealth={briefData?.providerHealth}
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
