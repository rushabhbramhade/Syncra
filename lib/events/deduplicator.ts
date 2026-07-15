import { NormalizedEvent } from "./normalized-event";

export function deduplicate(events: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Map<string, NormalizedEvent>();
  const hashCollisions: NormalizedEvent[] = [];

  for (const event of events) {
    const existing = seen.get(event.dedupHash);
    if (!existing) {
      seen.set(event.dedupHash, event);
    } else {
      // Keep the one with higher score, merge metadata
      if (event.score > existing.score) {
        existing.crossRefs = [...existing.crossRefs, existing.sourceEventId];
        event.crossRefs = [...event.crossRefs, existing.sourceEventId];
        seen.set(event.dedupHash, event);
      } else {
        existing.crossRefs = [...existing.crossRefs, event.sourceEventId];
        event.crossRefs = [...event.crossRefs, existing.sourceEventId];
      }
      hashCollisions.push(event);
    }
  }

  return Array.from(seen.values());
}

export function mergeDedupedEvents(events: NormalizedEvent[]): NormalizedEvent[] {
  const merged = new Map<string, NormalizedEvent>();

  for (const event of events) {
    const key = event.dedupHash;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...event });
    } else {
      if (event.score > existing.score) existing.score = event.score;
      if (event.priority !== "informational") existing.priority = event.priority;
      existing.confidence = Math.max(existing.confidence, event.confidence);
      existing.crossRefs = [...new Set([...existing.crossRefs, ...event.crossRefs, event.id])];
    }
  }

  return Array.from(merged.values());
}
