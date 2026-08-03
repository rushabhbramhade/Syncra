"use client";

import React from "react";

export function IntegrationCardSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[22px] border-[2.5px] border-border-mist bg-surface-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-14 h-14 rounded-2xl bg-background-mist animate-pulse" />
            <div className="w-20 h-6 rounded-lg bg-background-mist animate-pulse" />
          </div>
          <div className="h-6 w-2/3 rounded-lg bg-background-mist animate-pulse mb-2" />
          <div className="h-3 w-full rounded bg-background-mist animate-pulse mb-1.5" />
          <div className="h-3 w-4/5 rounded bg-background-mist animate-pulse mb-4" />
          <div className="h-16 w-full rounded-xl bg-background-mist animate-pulse mb-4" />
          <div className="flex gap-2">
            <div className="h-[42px] flex-1 rounded-xl bg-background-mist animate-pulse" />
            <div className="h-[42px] w-[42px] rounded-xl bg-background-mist animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function IntegrationSummarySkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-[20px] bg-surface-white neo-border p-4 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-background-mist animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-16 rounded bg-background-mist animate-pulse" />
            <div className="h-6 w-10 rounded bg-background-mist animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-background-mist animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}