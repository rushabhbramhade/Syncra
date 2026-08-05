/**
 * Event contracts — the typed envelope for everything that moves through the
 * platform event bus (architecture doc §3).
 *
 * Naming convention: `<source>.<domain>.<action>.v<version>`
 * e.g. `integration.sync.completed.v1`, `kg.node.created.v1`.
 *
 * Pure types + constants. Bus implementation (publish/subscribe, DLQ, replay)
 * is a later phase; these contracts are the shared vocabulary every publisher
 * and subscriber compiles against.
 */

// ─── Event types (source.domain.action) ─────────────────────────────────────

export const EVENT_TYPES = {
  // Integration lifecycle + sync
  "integration.connected.v1": "integration.connected.v1",
  "integration.disconnected.v1": "integration.disconnected.v1",
  "integration.sync.completed.v1": "integration.sync.completed.v1",
  "integration.sync.failed.v1": "integration.sync.failed.v1",
  "integration.token.refreshed.v1": "integration.token.refreshed.v1",
  "integration.token.revoked.v1": "integration.token.revoked.v1",
  "integration.needs_reauth.v1": "integration.needs_reauth.v1",

  // Provider webhook ingest
  "webhook.received.v1": "webhook.received.v1",
  "webhook.verified.v1": "webhook.verified.v1",
  "webhook.unverified.v1": "webhook.unverified.v1",

  // Unified data
  "entity.ingested.v1": "entity.ingested.v1",

  // Knowledge graph
  "kg.node.created.v1": "kg.node.created.v1",
  "kg.edge.created.v1": "kg.edge.created.v1",

  // AI runtime
  "ai.task.started.v1": "ai.task.started.v1",
  "ai.task.completed.v1": "ai.task.completed.v1",
  "ai.task.failed.v1": "ai.task.failed.v1",
  "ai.tool.called.v1": "ai.tool.called.v1",
  "ai.approval.requested.v1": "ai.approval.requested.v1",
  "ai.approval.resolved.v1": "ai.approval.resolved.v1",

  // Auth / security
  "auth.permission.denied.v1": "auth.permission.denied.v1",
  "audit.recorded.v1": "audit.recorded.v1",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

/** Parse an event type string; null when unknown. */
export function parseEventType(value: string): EventType | null {
  return (Object.values(EVENT_TYPES) as string[]).includes(value) ? (value as EventType) : null;
}

// ─── Event envelope ─────────────────────────────────────────────────────────

export interface EventEnvelope {
  /** Unique event id (publisher generates). */
  id: string;
  /** Full event type including version. */
  type: EventType;
  /** ISO-8601 timestamp of occurrence. */
  occurredAt: string;
  /** Publishing service (e.g. "sync-worker", "webhook-ingest"). */
  source: string;
  /** Correlation id — same across a user-facing operation's event chain. */
  correlationId: string;
  /** Trace id for distributed tracing. */
  traceId: string;
  /** Idempotency key — consumers dedupe on (type, idempotencyKey). */
  idempotencyKey: string;
  payload: Record<string, unknown>;
}

// ─── Typed payloads for the bus-critical events ─────────────────────────────

export interface IntegrationEventPayload {
  userId: string;
  integrationId: string;
  providerId: string;
}

export interface SyncEventPayload extends IntegrationEventPayload {
  depth: "snapshot" | "metadata" | "deep" | "incremental";
  cursor?: unknown;
  entityCount: number;
  durationMs: number;
}

export interface SyncFailedEventPayload extends IntegrationEventPayload {
  depth: "snapshot" | "metadata" | "deep" | "incremental";
  error: string;
}

export interface WebhookEventPayload {
  providerId: string;
  integrationId?: string;
  eventType: string;
  receivedAt: string;
}

export interface EntityIngestedPayload {
  integrationId: string;
  userId: string;
  entityKind: string;
  entityId: string;
}

export interface KgNodeEventPayload {
  integrationId: string;
  userId: string;
  nodeId: string;
  kind: string;
  label: string;
}

export interface AiTaskEventPayload {
  taskId: string;
  userId: string;
  taskName: string;
  status: "started" | "completed" | "failed";
  error?: string;
}

export interface ApprovalRequestedPayload {
  approvalId: string;
  userId: string;
  capability: string;
  toolName: string;
  args: Record<string, unknown>;
}

// ─── Publisher / subscriber contracts ───────────────────────────────────────

export type EventHandler<E extends EventEnvelope = EventEnvelope> = (event: E) => Promise<void>;

export interface EventPublisher {
  publish<E extends EventEnvelope>(event: E): Promise<void>;
  publishMany(events: EventEnvelope[]): Promise<void>;
}

export interface EventSubscriber {
  subscribe(type: EventType | EventType[], handler: EventHandler): void;
}
