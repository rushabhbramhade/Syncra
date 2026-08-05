import { IntegrationRegistry } from "./provider-base";
import type { IntegrationProvider } from "./provider-base";
import type { SyncContext, SyncResult } from "./types";
import type { SyncDepth } from "./constants";
import { getCredentialsRepo } from "@/lib/repositories/credentials-repository";
import { getSyncStateRepo } from "@/lib/repositories/sync-state-repository";
import { getUnifiedStoreRepo } from "@/lib/repositories/unified-store-repository";

/**
 * Shared sync orchestrator (architecture §7, §17 "sync/orchestrator.ts").
 *
 * One pipeline for every provider: cursor → fetch (provider adapter) →
 * normalize → upsert → advance watermark. Queued workers call this — never an
 * HTTP request.
 *
 * Watermark discipline (§7): upsert the batch durably, then advance the cursor,
 * so a crash between the two re-runs idempotently (content_hash upserts).
 *
 * Providers that haven't implemented a sync hook yet report zero rows; the
 * seam exists so Phase 2 fills each adapter without touching this file.
 */

export async function runSync(integrationId: string, userId: string, depth: SyncDepth): Promise<SyncResult> {
  const credentials = getCredentialsRepo();
  const state = getSyncStateRepo();
  const store = getUnifiedStoreRepo();

  // Load credential + watermark.
  const creds = await credentials.get(integrationId);
  if (!creds) return emptyResult();
  const accessToken = await credentials.getAccessToken(integrationId);
  if (!accessToken) return emptyResult();

  const provider = IntegrationRegistry.get(creds.provider);
  if (!provider) return emptyResult();

  const syncRecord = await state.getOrCreate(integrationId, userId, creds.provider);

  // Build context + dispatch to the depth-appropriate provider hook.
  const ctx: SyncContext = {
    integrationId,
    userId,
    providerId: creds.provider as SyncContext["providerId"],
    accessToken,
    depth,
  };

  const hook = pickHook(provider, depth);
  if (!hook) return emptyResult();
  const result = await hook(ctx);

  // Persist entities, then advance watermark — durable before cursor.
  await store.upsertBatch(userId, integrationId, result.entities);
  await advanceWatermark(state, integrationId, depth, result.cursor as Record<string, unknown>);

  return result;
}

function pickHook(provider: IntegrationProvider, depth: SyncDepth) {
  switch (depth) {
    case "snapshot":
      return provider.snapshot as ((ctx: SyncContext) => Promise<SyncResult>) | undefined;
    case "metadata":
    case "deep":
      return provider.syncMetadata;
    case "incremental":
      return provider.syncIncremental;
  }
}

async function advanceWatermark(
  state: ReturnType<typeof getSyncStateRepo>,
  integrationId: string,
  depth: SyncDepth,
  cursor: Record<string, unknown>
): Promise<void> {
  if (Object.keys(cursor).length > 0) await state.advanceCursor(integrationId, cursor);
  if (depth === "deep" || depth === "metadata") await state.markFullSync(integrationId);
  if (depth === "incremental") await state.markIncremental(integrationId);
}

function emptyResult(): SyncResult {
  return { entities: [], cursor: {}, hasMore: false };
}