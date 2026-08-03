import type { WorkspaceIntegration } from "@/app/actions/integrations";
import type { IntegrationSettings, SyncLogRecord } from "@/lib/repositories/integrations-repository";

export const PROVIDER_IDS = ["gmail", "whatsapp", "slack", "github", "discord", "telegram", "linkedin"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PLANNED_PROVIDER_IDS = ["outlook", "notion", "linear"] as const;
export type PlannedProviderId = (typeof PLANNED_PROVIDER_IDS)[number];

export type AllProviderId = ProviderId | PlannedProviderId;

export const SYNC_STATUSES = ["idle", "syncing", "success", "error", "expired"] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const CONNECTION_STATUSES = ["connected", "connecting", "syncing", "expired", "error", "disconnected"] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export type IntegrationRow = WorkspaceIntegration;
export type { IntegrationSettings, SyncLogRecord };
