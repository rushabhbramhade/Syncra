type Listener = (event: { type: string; provider: string; timestamp: string }) => void;

const listeners = new Map<string, Set<Listener>>();

/**
 * In-process integration event bus. Server actions publish connection events;
 * the SSE dashboard stream subscribes and forwards them to the browser so
 * open pages (integrations, dashboard) refresh without polling.
 *
 * ponytail: in-process only — one Next.js server. Multi-instance deployments
 * lose cross-instance delivery; a DB-backed outbox would be the upgrade.
 */
export const IntegrationEvents = {
  subscribe(userId: string, fn: Listener): () => void {
    let set = listeners.get(userId);
    if (!set) {
      set = new Set();
      listeners.set(userId, set);
    }
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) listeners.delete(userId);
    };
  },

  publish(userId: string, type: string, provider: string) {
    const set = listeners.get(userId);
    if (!set) return;
    const event = { type, provider, timestamp: new Date().toISOString() };
    for (const fn of set) {
      try {
        fn(event);
      } catch (err) { console.error("[IntegrationEvents] listener error:", err); }
    }
  },
};
