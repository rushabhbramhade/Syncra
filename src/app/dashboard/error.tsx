"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="p-4 bg-error-bg border-[2.5px] border-error rounded-2xl">
            <AlertTriangle className="w-10 h-10 text-error" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="font-display font-black text-2xl text-secondary">
            Something went wrong
          </h1>
          <p className="text-text-slate text-[15px] font-medium leading-relaxed">
            This page encountered an error. Your session and other workspace
            tabs are unaffected.
          </p>
          {process.env.NODE_ENV === "development" && error?.message && (
            <pre className="mt-3 p-3 bg-background-mist border border-border-mist rounded-xl text-xs text-error text-left overflow-auto max-h-32">
              {error.message}
            </pre>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-surface-white border-[2px] border-border-mist text-secondary font-bold rounded-xl hover:border-secondary transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
