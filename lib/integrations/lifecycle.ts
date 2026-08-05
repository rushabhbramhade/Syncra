/**
 * Integration lifecycle state machine (architecture §"Integration States").
 *
 * Pure transitions — no I/O, no provider imports. The sync orchestrator and
 * UI both drive this machine; the DB stores only the current state
 * (user_integrations.lifecycle_state) plus a version for optimistic
 * concurrency (state_machine_ver).
 *
 * The happy path Connected → Metadata Sync → AI Indexing → Ready runs fast;
 * background work continues after `ready` via realtime_sync.
 */

import { INTEGRATION_LIFECYCLE_STATES, IntegrationLifecycleState } from "./constants";

export type LifecycleTransition =
  | { from: "not_connected"; to: "connecting" }
  | { from: "connecting"; to: "authenticating" | "error" | "not_connected" }
  | { from: "authenticating"; to: "connected" | "error" | "needs_reauthentication" }
  | { from: "connected"; to: "metadata_sync" | "error" | "disconnected" }
  | { from: "metadata_sync"; to: "ai_indexing" | "connected" | "error" | "needs_reauthentication" }
  | { from: "ai_indexing"; to: "ready" | "metadata_sync" | "error" }
  | { from: "ready"; to: "realtime_sync" | "needs_reauthentication" | "error" | "disconnected" }
  | { from: "realtime_sync"; to: "ready" | "needs_reauthentication" | "error" | "disconnected" }
  | { from: "needs_reauthentication"; to: "authenticating" | "disconnected" | "error" }
  | { from: "error"; to: "connected" | "metadata_sync" | "needs_reauthentication" | "disconnected" }
  | { from: "disconnected"; to: "connecting" | "not_connected" };

const TRANSITION_TABLE = new Map<string, IntegrationLifecycleState[]>();

function seedTransitions(): void {
  const pairs: Array<[IntegrationLifecycleState, IntegrationLifecycleState]> = [
    ["not_connected", "connecting"],
    ["connecting", "authenticating"],
    ["connecting", "error"],
    ["connecting", "not_connected"],
    ["authenticating", "connected"],
    ["authenticating", "error"],
    ["authenticating", "needs_reauthentication"],
    ["connected", "metadata_sync"],
    ["connected", "error"],
    ["connected", "disconnected"],
    ["metadata_sync", "ai_indexing"],
    ["metadata_sync", "connected"],
    ["metadata_sync", "error"],
    ["metadata_sync", "needs_reauthentication"],
    ["ai_indexing", "ready"],
    ["ai_indexing", "metadata_sync"],
    ["ai_indexing", "error"],
    ["ready", "realtime_sync"],
    ["ready", "needs_reauthentication"],
    ["ready", "error"],
    ["ready", "disconnected"],
    ["realtime_sync", "ready"],
    ["realtime_sync", "needs_reauthentication"],
    ["realtime_sync", "error"],
    ["realtime_sync", "disconnected"],
    ["needs_reauthentication", "authenticating"],
    ["needs_reauthentication", "disconnected"],
    ["needs_reauthentication", "error"],
    ["error", "connected"],
    ["error", "metadata_sync"],
    ["error", "needs_reauthentication"],
    ["error", "disconnected"],
    ["disconnected", "connecting"],
    ["disconnected", "not_connected"],
  ];
  for (const [from, to] of pairs) {
    const key = from;
    const existing = TRANSITION_TABLE.get(key) ?? [];
    if (!existing.includes(to)) existing.push(to);
    TRANSITION_TABLE.set(key, existing);
  }
}

seedTransitions();

export function isValidTransition(from: IntegrationLifecycleState, to: IntegrationLifecycleState): boolean {
  return (TRANSITION_TABLE.get(from) ?? []).includes(to);
}

export function assertValidTransition(from: IntegrationLifecycleState, to: IntegrationLifecycleState): void {
  if (!isValidTransition(from, to)) {
    throw new Error(`Invalid integration lifecycle transition: ${from} -> ${to}`);
  }
}

export function parseLifecycleState(value: string | null | undefined): IntegrationLifecycleState {
  if (value && (INTEGRATION_LIFECYCLE_STATES as readonly string[]).includes(value)) {
    return value as IntegrationLifecycleState;
  }
  return "not_connected";
}

/** Deterministic transition helper for the sync orchestrator. */
export function transition(from: IntegrationLifecycleState, to: IntegrationLifecycleState): IntegrationLifecycleState {
  assertValidTransition(from, to);
  return to;
}

export const LIFECYCLE_STATES = INTEGRATION_LIFECYCLE_STATES;
export type { IntegrationLifecycleState };
