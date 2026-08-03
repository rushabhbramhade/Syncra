"use client";

import React from "react";
import { RefreshCw, AlertTriangle } from "lucide-react";
import type { WorkspaceIntegration } from "@/app/actions/integrations";

export function StatusBadge({ integration }: { integration: WorkspaceIntegration }) {
  const sync = integration.sync_status;

  if (sync === "syncing") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-info-bg border-[1.5px] border-info text-info text-[11px] font-bold rounded-lg">
        <RefreshCw className="w-3 h-3 animate-spin" /> Syncing
      </span>
    );
  }
  if (sync === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-error-bg border-[1.5px] border-error text-error text-[11px] font-bold rounded-lg">
        <AlertTriangle className="w-3 h-3" /> Error
      </span>
    );
  }
  if (sync === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-warning-bg border-[1.5px] border-warning text-warning text-[11px] font-bold rounded-lg">
        <RefreshCw className="w-3 h-3" /> Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-success-bg border-[1.5px] border-success text-success text-[11px] font-bold rounded-lg">
      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
      Connected
    </span>
  );
}
