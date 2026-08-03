"use client";

import { useCallback, useMemo } from "react";
import type { WorkspaceIntegration } from "@/app/actions/integrations";

/**
 * Selects a single integration from the full list. If the record disappears
 * (disconnect), a detached reference is kept so the UI can still show the
 * disconnected state until the caller clears it.
 */
export function useIntegration(
  integrations: WorkspaceIntegration[],
  provider: string | null
) {
  const live = useMemo(
    () => (provider ? integrations.find((i) => i.provider === provider) || null : null),
    [integrations, provider]
  );

  const isConnected = useCallback((id: string) => {
    return integrations.some((i) => i.provider === id && i.connected);
  }, [integrations]);

  return { integration: live, isConnected };
}
