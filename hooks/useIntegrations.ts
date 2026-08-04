"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getAllIntegrations,
  syncIntegration,
  refreshToken,
  disconnectIntegration,
  reconnectIntegration,
  updateIntegrationSettings,
} from "@/app/actions/integrations";
import type { WorkspaceIntegration } from "@/app/actions/integrations";

export interface IntegrationSettingsPatch {
  auto_sync?: boolean;
  notifications?: boolean;
  background_sync?: boolean;
  token_refresh?: boolean;
}

export function useIntegrations(userId: string | undefined) {
  const [integrations, setIntegrations] = useState<WorkspaceIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string>("");
  const fetchedRef = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setIsLoading(true);
    const data = await getAllIntegrations(userId);
    setIntegrations(data);
    const latest = data
      .map((i) => i.last_sync_at)
      .filter(Boolean)
      .sort()
      .pop();
    setLastSync(latest || "");
    if (!silent) setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId && !fetchedRef.current) {
      fetchedRef.current = true;
      load();
    }
  }, [userId, load]);

  // Realtime: refresh status when the SSE dashboard stream emits integration events.
  useEffect(() => {
    if (!userId) return;
    const es = new EventSource("/api/dashboard/stream");
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as { type?: string };
        if (event.type?.startsWith("integration") || event.type === "connection.updated") {
          load(true);
        }
      } catch {}
    };
    return () => es.close();
  }, [userId, load]);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    await load(true);
    setIsRefreshing(false);
  }, [load]);

  const optimisticPatch = (provider: string, patch: Partial<WorkspaceIntegration>) => {
    setIntegrations((prev) => prev.map((i) => (i.provider === provider ? { ...i, ...patch } : i)));
  };

  const runSync = useCallback(async (provider: string) => {
    optimisticPatch(provider, { sync_status: "syncing", last_error: null });
    const res = await syncIntegration(userId!, provider);
    if (res.success) {
      optimisticPatch(provider, { sync_status: "success", last_sync_at: res.syncedAt || new Date().toISOString() });
    } else {
      optimisticPatch(provider, { sync_status: "error", last_error: res.error || "Sync failed." });
    }
    return res;
  }, [userId, optimisticPatch]);

  const runRefreshToken = useCallback(async (provider: string) => {
    optimisticPatch(provider, { sync_status: "syncing" });
    const res = await refreshToken(userId!, provider);
    if (res.success) {
      optimisticPatch(provider, { sync_status: "success", expires_at: res.expiresAt || "" });
    } else {
      optimisticPatch(provider, { sync_status: "error", last_error: res.error || "Refresh failed." });
    }
    return res;
  }, [userId, optimisticPatch]);

  const disconnect = useCallback(async (provider: string) => {
    await disconnectIntegration(userId!, provider);
    setIntegrations((prev) => prev.filter((i) => i.provider !== provider));
    return { success: true };
  }, [userId]);

  const reconnect = useCallback(async (provider: string) => {
    const res = await reconnectIntegration(userId!, provider);
    if (res.success) {
      setIntegrations((prev) => prev.filter((i) => i.provider !== provider));
    }
    return res;
  }, [userId]);

  const updateSettings = useCallback(async (provider: string, settings: IntegrationSettingsPatch) => {
    optimisticPatch(provider, { metadata: { ...(integrations.find((i) => i.provider === provider)?.metadata || {}), ...settings } });
    const res = await updateIntegrationSettings(userId!, provider, settings);
    if (!res.success) await load(true);
    return res;
  }, [userId, integrations, optimisticPatch, load]);

  return {
    integrations,
    isLoading,
    isRefreshing,
    lastSync,
    refresh,
    runSync,
    runRefreshToken,
    disconnect,
    reconnect,
    updateSettings,
  };
}
