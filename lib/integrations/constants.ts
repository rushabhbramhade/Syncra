/**
 * Canonical integration constants — single source of truth for provider ids,
 * integration lifecycle states, and the capability catalog.
 *
 * UI-facing display metadata lives in `features/integrations/constants/providers.ts`.
 * This module is the type-level contract layer: everything in lib/ imports from here,
 * nothing hardcodes provider ids.
 */

/**
 * Registered provider ids. Includes `calendar` — registered in the provider
 * registry via `calendar-provider.ts` but not yet exposed in the UI list.
 */
export const PROVIDER_IDS = [
  "gmail",
  "slack",
  "whatsapp",
  "telegram",
  "discord",
  "linkedin",
  "calendar",
  "github",
] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Full integration lifecycle — the state machine every integration row moves
 * through. `Connected → Metadata Sync → AI Indexing → Ready` is the happy path;
 * background work continues after `ready`.
 */
export const INTEGRATION_LIFECYCLE_STATES = [
  "not_connected",
  "connecting",
  "authenticating",
  "connected",
  "metadata_sync",
  "ai_indexing",
  "ready",
  "realtime_sync",
  "needs_reauthentication",
  "error",
  "disconnected",
] as const;

export type IntegrationLifecycleState = (typeof INTEGRATION_LIFECYCLE_STATES)[number];

/** Sync depths — deep sync always runs in the background, never in a request. */
export const SYNC_DEPTHS = ["snapshot", "metadata", "deep", "incremental"] as const;

export type SyncDepth = (typeof SYNC_DEPTHS)[number];

/**
 * Capability catalog: capability id → providers that declare it.
 *
 * The AI never asks "is Slack connected" — it asks which connected provider
 * supports a capability. This map is the routing table. It must stay in sync
 * with each provider adapter's declared capabilities (Phase 2 enforces at
 * registration time).
 */
export const CAPABILITY_CATALOG = {
  "email.read": ["gmail"],
  "email.write": ["gmail"],
  "email.modify": ["gmail"],
  "message.read": ["slack", "discord", "telegram", "whatsapp"],
  "message.write": ["slack", "discord", "telegram", "whatsapp"],
  "message.search": ["slack"],
  "notification.read": ["github", "gmail", "linkedin"],
  "repo.read": ["github"],
  "repo.write": ["github"],
  "profile.read": ["linkedin"],
  "connection.read": ["linkedin"],
  "event.read": ["calendar"],
} as const satisfies Record<string, readonly ProviderId[]>;

export type CapabilityId = keyof typeof CAPABILITY_CATALOG;

export function isCapabilityId(value: string): value is CapabilityId {
  return Object.prototype.hasOwnProperty.call(CAPABILITY_CATALOG, value);
}
