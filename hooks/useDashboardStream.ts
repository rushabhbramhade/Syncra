"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface StreamEvent {
  type: string;
  data: any;
  timestamp: string;
}

export function useDashboardStream(userId: string | undefined) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!userId) return;
    const es = new EventSource(`/api/dashboard/stream?userId=${userId}`);
    eventSourceRef.current = es;
    setIsConnected(true);

    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as StreamEvent;
        setEvents(prev => [event, ...prev].slice(0, 100));
      } catch {}
    };

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [userId]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, isConnected, clearEvents };
}
