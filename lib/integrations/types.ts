/**
 * Shared integration types — the unified data contract for the whole platform.
 *
 * Every provider adapter normalizes provider-specific payloads into these
 * Unified* shapes (architecture doc §3.2). The AI, search, and knowledge graph
 * consume ONLY these types — never provider objects.
 *
 * Pure types: no runtime imports, no side effects. Safe to import from anywhere.
 */

import type { CapabilityId, ProviderId, SyncDepth } from "./constants";

// ─── OAuth ──────────────────────────────────────────────────────────────────

export interface OAuthConfig {
  /** Provider scopes requested at connect time. */
  scopes: string[];
  /** Whether the provider uses PKCE. */
  pkce: boolean;
  /** Whether access tokens expire and need refreshing. */
  tokensExpire: boolean;
}

export interface Snapshot {
  /** Smallest useful payload fetched inline after OAuth exchange (≤1s budget). */
  profile: IntegrationProfile;
  /** Provider-native cursor for the next incremental sync, if any. */
  cursor?: unknown;
  /** Lightweight preview entities (e.g. last 20 threads, channel list). */
  entities: NormalizedEntity[];
}

// ─── Sync ───────────────────────────────────────────────────────────────────

export interface SyncResult {
  /** Normalized entities upserted by this batch. */
  entities: NormalizedEntity[];
  /** Next watermark/cursor. Persisted in `sync_state` after the batch commits. */
  cursor: unknown;
  hasMore: boolean;
}

export interface SyncContext {
  integrationId: string;
  userId: string;
  providerId: ProviderId;
  accessToken: string;
  depth: SyncDepth;
}

// ─── Unified entities (architecture §3.2) ───────────────────────────────────

export interface UnifiedBase {
  id?: string;
  integrationId: string;
  /** Provider-native id for dedup (unique per integration). */
  providerId: string;
  /** Provider-specific fields that have no unified home yet. */
  metadata?: Record<string, unknown>;
}

/** Literal discriminant so consumers can narrow the union exhaustively. */
export type EntityKind =
  | "message"
  | "thread"
  | "conversation"
  | "contact"
  | "task"
  | "repo"
  | "event"
  | "notification"
  | "attachment";

export interface UnifiedMessage extends UnifiedBase {
  entityKind: "message";
  threadId?: string | null;
  conversationId?: string | null;
  channelId?: string | null;
  authorContactId?: string | null;
  bodyText: string;
  bodyHtml?: string | null;
  /** Content hash — idempotency key so re-syncs never duplicate. */
  contentHash: string;
  sentAt: string;
  direction: "inbound" | "outbound";
}

export interface UnifiedThread extends UnifiedBase {
  entityKind: "thread";
  providerThreadId?: string | null;
  subject?: string | null;
  participantIds: string[];
  lastMessageAt?: string | null;
}

export interface UnifiedConversation extends UnifiedBase {
  entityKind: "conversation";
  kind: "dm" | "group" | "channel" | "email-thread";
  title?: string | null;
  channelId?: string | null;
  participantIds: string[];
}

export interface UnifiedContact extends UnifiedBase {
  entityKind: "contact";
  providerContactId?: string | null;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export interface UnifiedTask extends UnifiedBase {
  entityKind: "task";
  providerTaskId?: string | null;
  kind: "issue" | "pr" | "todo";
  title: string;
  status?: string | null;
  priority?: string | null;
  assigneeContactId?: string | null;
  repoId?: string | null;
  url?: string | null;
}

export interface UnifiedRepo extends UnifiedBase {
  entityKind: "repo";
  providerRepoId: string;
  fullName: string;
  private: boolean;
}

export interface UnifiedEvent extends UnifiedBase {
  entityKind: "event";
  providerEventId?: string | null;
  title?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  attendees: string[];
}

export interface UnifiedNotification extends UnifiedBase {
  entityKind: "notification";
  providerNotificationId?: string | null;
  kind?: string | null;
  title?: string | null;
  read: boolean;
  url?: string | null;
}

export interface UnifiedAttachment extends UnifiedBase {
  entityKind: "attachment";
  providerAttachmentId?: string | null;
  storageKey?: string | null;
  url?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  extractedText?: string | null;
}

/** Discriminated union of everything the sync engine can emit. */
export type NormalizedEntity =
  | UnifiedMessage
  | UnifiedThread
  | UnifiedConversation
  | UnifiedContact
  | UnifiedTask
  | UnifiedRepo
  | UnifiedEvent
  | UnifiedNotification
  | UnifiedAttachment;

export function entityKind(entity: NormalizedEntity): EntityKind {
  return entity.entityKind;
}

// ─── Provider contract pieces (optional members of IntegrationProvider) ─────

export interface IntegrationProfile {
  email: string;
  providerAccountId?: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface ProviderCapabilities {
  /** Capability ids this provider can satisfy. */
  capabilities: CapabilityId[];
  /** OAuth wiring. */
  oauth: OAuthConfig;
}

// ─── Settings ───────────────────────────────────────────────────────────────

export interface IntegrationSettings {
  autoSync: boolean;
  notifications: boolean;
  backgroundSync: boolean;
  tokenRefresh: boolean;
}

export const DEFAULT_INTEGRATION_SETTINGS: IntegrationSettings = {
  autoSync: true,
  notifications: true,
  backgroundSync: true,
  tokenRefresh: true,
};
