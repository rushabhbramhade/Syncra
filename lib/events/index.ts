export type { NormalizedEvent, PlatformType, EventCategory, PriorityLevel, Contact, PlatformMetadata, EventCluster } from "./normalized-event";
export type { RawEvent } from "./normalizer";
export { normalizeEvent, normalizeAll, registerNormalizer } from "./normalizer";
export { deduplicate, mergeDedupedEvents } from "./deduplicator";
export { correlateEvents, applyCorrelations } from "./correlator";
