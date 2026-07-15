export type StreamEventType = 'event_scored' | 'briefing_generated' | 'rule_updated' | 'feedback_recorded' | 'sync_complete';

export interface StreamEvent {
  type: StreamEventType;
  data: any;
  timestamp: string;
}

type Listener = (event: StreamEvent) => void;

const listeners: Map<string, Set<Listener>> = new Map();

export function emitStreamEvent(event: StreamEvent): void {
  const userListeners = listeners.get(event.data?.userId);
  if (userListeners) {
    for (const listener of userListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[DashboardStream] listener error", err);
      }
    }
  }
}

export function subscribeStream(userId: string, listener: Listener): () => void {
  if (!listeners.has(userId)) {
    listeners.set(userId, new Set());
  }
  listeners.get(userId)!.add(listener);

  return () => {
    const userListeners = listeners.get(userId);
    if (userListeners) {
      userListeners.delete(listener);
      if (userListeners.size === 0) {
        listeners.delete(userId);
      }
    }
  };
}
