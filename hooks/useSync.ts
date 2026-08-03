"use client";

import { useState, useCallback } from "react";
import { syncIntegration, refreshToken } from "@/app/actions/integrations";

interface SyncState {
  provider: string | null;
  running: boolean;
  lastError: string | null;
}

export function useSync(userId: string | undefined) {
  const [state, setState] = useState<SyncState>({ provider: null, running: false, lastError: null });

  const sync = useCallback(async (provider: string, onDone?: () => void) => {
    if (!userId) return { success: false, error: "Not authenticated" };
    setState({ provider, running: true, lastError: null });
    const res = await syncIntegration(userId, provider);
    if (!res.success) setState({ provider, running: false, lastError: res.error || "Sync failed." });
    else setState({ provider: null, running: false, lastError: null });
    onDone?.();
    return res;
  }, [userId]);

  const refresh = useCallback(async (provider: string, onDone?: () => void) => {
    if (!userId) return { success: false, error: "Not authenticated" };
    setState({ provider, running: true, lastError: null });
    const res = await refreshToken(userId, provider);
    if (!res.success) setState({ provider, running: false, lastError: res.error || "Refresh failed." });
    else setState({ provider: null, running: false, lastError: null });
    onDone?.();
    return res;
  }, [userId]);

  return { ...state, sync, refresh, clearError: () => setState((s) => ({ ...s, lastError: null })) };
}
