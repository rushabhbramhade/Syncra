"use client";

import { useEffect, useState, useRef } from "react";

export type RealtimeConnectionState = "connecting" | "open" | "closed";

/**
 * Reports the liveness of the dashboard SSE stream so the UI can show a
 * realtime pulse. Reloads are handled by useIntegrations (same stream).
 */
export function useRealtimeStatus(userId: string | undefined) {
  const [state, setState] = useState<RealtimeConnectionState>("connecting");
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId) return;
    const es = new EventSource(`/api/dashboard/stream?userId=${userId}`);
    esRef.current = es;
    es.onopen = () => setState("open");
    es.onerror = () => setState("closed");
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as { type?: string };
        if (event.type && event.type !== "connected") {
          setLastEventAt(new Date().toISOString());
        }
      } catch {}
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [userId]);

  return { state, lastEventAt };
}
