"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { BriefingRecord, BriefingItemRecord } from "@/lib/repositories/briefings-repository";
import { getBriefingDetailsAction, getBriefingsAction, updateBriefingItemStatusAction } from "@/app/actions/briefing";
import { ChevronLeft, ChevronRight, Sparkles, AlertCircle, Calendar, Clock, BarChart3, Loader2 } from "lucide-react";
import { decodeHtmlEntities } from "@/lib/utils";

export default function BriefingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, dbUser, isLoading: authLoading } = useAuth();
  const activeUserId = dbUser?.id;
  const briefingId = params.id as string;

  const [briefing, setBriefing] = useState<BriefingRecord | null>(null);
  const [items, setItems] = useState<BriefingItemRecord[]>([]);
  const [allBriefings, setAllBriefings] = useState<BriefingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentIndex = allBriefings.findIndex(b => b.id === briefingId);

  const loadData = useCallback(async () => {
    if (!activeUserId || !briefingId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [briefingsResult, detailResult] = await Promise.allSettled([
        getBriefingsAction(activeUserId, { limit: 20 }),
        getBriefingDetailsAction(activeUserId, briefingId),
      ]);

      if (briefingsResult.status === "fulfilled") {
        setAllBriefings(briefingsResult.value);
      }

      if (detailResult.status === "fulfilled") {
        setBriefing(detailResult.value.briefing);
        setItems(detailResult.value.items);
      } else {
        setError(detailResult.reason?.message || "Failed to load briefing.");
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load briefing.");
    } finally {
      setIsLoading(false);
    }
  }, [activeUserId, briefingId]);

  useEffect(() => {
    if (!authLoading && activeUserId) {
      loadData();
    }
  }, [authLoading, activeUserId, loadData]);

  if (authLoading || isLoading) {
    return (
      <div className="pb-10 font-sans max-w-4xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 text-accent-purple animate-spin" />
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="pb-10 font-sans max-w-4xl mx-auto space-y-4">
        <div className="p-6 rounded-2xl bg-error-bg border border-error/30 text-error flex items-center gap-3 font-bold text-[14px]">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error || "Briefing not found."}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/dashboard/briefing")} className="text-accent-purple font-bold text-[13px] hover:underline">
            Back to Briefing
          </button>
          <span className="text-text-fog text-[12px]">{"\u00B7"}</span>
          <button onClick={loadData} className="text-accent-purple font-bold text-[13px] hover:underline">
            Retry
          </button>
        </div>
        {/* Show nav even when detail failed */}
        {allBriefings.length > 0 && (
          <div className="p-4 rounded-2xl bg-white border border-border-mist">
            <h3 className="text-[12px] font-bold text-text-slate mb-2">Other Briefings</h3>
            <div className="space-y-1">
              {allBriefings.map(b => (
                <button key={b.id} onClick={() => router.push(`/dashboard/briefing/${b.id}`)}
                  className="block w-full text-left px-3 py-2 rounded-xl text-[13px] font-medium text-secondary hover:bg-background-mist transition-colors">
                  {b.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const priorityColor = briefing.priority_score >= 7 ? "text-error" : briefing.priority_score >= 4 ? "text-warning" : "text-success";

  return (
    <div className="pb-10 font-sans max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard/briefing")}
          className="flex items-center gap-1.5 text-[13px] font-bold text-text-slate hover:text-secondary transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-2">
          {currentIndex > 0 && (
            <button
              onClick={() => router.push(`/dashboard/briefing/${allBriefings[currentIndex - 1].id}`)}
              className="flex items-center gap-1 text-[12px] font-bold text-text-slate hover:text-secondary px-3 py-1.5 rounded-xl border border-border-mist hover:border-text-fog transition-all"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
          )}
          {currentIndex < allBriefings.length - 1 && (
            <button
              onClick={() => router.push(`/dashboard/briefing/${allBriefings[currentIndex + 1].id}`)}
              className="flex items-center gap-1 text-[12px] font-bold text-text-slate hover:text-secondary px-3 py-1.5 rounded-xl border border-border-mist hover:border-text-fog transition-all"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="p-6 rounded-3xl bg-white border border-border-mist shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-accent-purple/10 border border-accent-purple/20 text-accent-purple">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-black text-2xl text-secondary leading-tight">{briefing.title}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-[12.5px] font-medium text-text-slate">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(briefing.generated_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {new Date(briefing.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="flex items-center gap-1">
                  <BarChart3 className={`w-3.5 h-3.5 ${priorityColor}`} />
                  <span className={`font-bold ${priorityColor}`}>Priority: {briefing.priority_score}/10</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-6 p-5 rounded-2xl bg-background-mist border border-border-mist">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-text-slate mb-2">Executive Summary</h3>
          <p className="text-[14px] text-secondary font-medium leading-relaxed">{briefing.executive_summary}</p>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        <h2 className="font-display font-black text-lg text-secondary">Items ({items.length})</h2>
        {items.map((item, index) => (
          <BriefingItemCard key={item.id} item={item} index={index + 1} userId={activeUserId!} onItemUpdated={loadData} />
        ))}
        {items.length === 0 && (
          <div className="py-8 text-center text-text-slate font-medium text-[13px]">No items in this briefing.</div>
        )}
      </div>
    </div>
  );
}

function BriefingItemCard({ item, index, userId, onItemUpdated }: {
  item: BriefingItemRecord;
  index: number;
  userId: string;
  onItemUpdated: () => void;
}) {
  const meta = (item.metadata || {}) as Record<string, any>;

  const handleMarkDone = async () => {
    try {
      await updateBriefingItemStatusAction(userId, item.id!, "completed");
      onItemUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  const platformColors: Record<string, string> = {
    gmail: "bg-red-500/10 text-red-600 border-red-500/20",
    outlook: "bg-blue-600/10 text-blue-700 border-blue-600/20",
    slack: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    whatsapp: "bg-green-500/10 text-green-600 border-green-500/20",
    telegram: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    discord: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
    github: "bg-gray-500/10 text-gray-700 border-gray-500/20",
    linkedin: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    calendar: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    notion: "bg-stone-500/10 text-stone-600 border-stone-500/20",
    linear: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };

  return (
    <div className="p-4 rounded-2xl bg-white border-[1.5px] border-border-mist hover:border-text-fog transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-[11px] font-black text-text-fog mt-1 shrink-0">#{index}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="font-bold text-[14px] text-secondary truncate">{meta.title || "No Title"}</h3>
              <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${platformColors[item.platform.toLowerCase()] || "bg-slate-100 text-text-slate"}`}>
                {item.platform}
              </span>
              <span className="text-[10px] font-bold text-text-slate bg-background-mist px-1.5 py-0.5 rounded border border-border-mist capitalize">
                {item.category}
              </span>
            </div>
            <p className="text-[12.5px] font-medium text-text-slate leading-relaxed">{meta.shortSummary || ""}</p>
            {meta.originalContent && (
              <details className="mt-2">
                <summary className="text-[11px] font-bold text-accent-purple cursor-pointer">Original content</summary>
                <p className="mt-1 text-[12px] text-text-slate whitespace-pre-wrap bg-background-mist p-3 rounded-xl border border-border-mist">{decodeHtmlEntities(meta.originalContent)}</p>
              </details>
            )}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] font-medium text-text-slate">
                {new Date(item.timestamp).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={handleMarkDone}
          disabled={item.status === "completed"}
          className={`p-2 rounded-xl border transition-all shrink-0 ${
            item.status === "completed" ? "bg-success/10 text-success border-success/20" : "text-text-fog hover:text-success hover:bg-success/5 border-border-mist hover:border-success/30"
          }`}
          title={item.status === "completed" ? "Done" : "Mark Done"}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
