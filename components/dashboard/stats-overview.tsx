"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { AlertCircle, Clock, CheckCircle } from "lucide-react";

interface StatsOverviewProps {
  importantCount: number;
  priorityCount: number;
  followUpsCount: number;
  isLoading: boolean;
}

export function StatsOverview({ importantCount, priorityCount, followUpsCount, isLoading }: StatsOverviewProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card className="neo-border bg-surface-white p-6 neo-shadow-sm flex items-center gap-4 hover:shadow-flat-sm hover:translate-y-[-2px] transition-all duration-300 group cursor-pointer" onClick={() => router.push("/dashboard/briefing")}>
        <div className="w-14 h-14 rounded-2xl bg-error/10 border-[1.5px] border-error flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <AlertCircle className="w-6 h-6 text-error" />
        </div>
        <div>
          <p className="text-text-slate text-[13px] font-bold uppercase tracking-wider mb-1">Important</p>
          <div className="font-display font-black text-3xl text-secondary leading-none">
            {isLoading ? "..." : importantCount}
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
            {isLoading ? "..." : priorityCount}
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
            {isLoading ? "..." : followUpsCount}
          </div>
        </div>
      </Card>
    </div>
  );
}

export default StatsOverview;
