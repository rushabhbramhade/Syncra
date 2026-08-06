-- ============================================================
-- Migration: provider_health on briefings + unified store columns
--
-- 1. briefings.provider_health: per-provider pipeline report persisted with
--    each briefing (Phase 2/10/11) — fetched/normalized/saved/aiUsed/quality.
-- 2. unified_* tables: UnifiedStoreRepository.toRow sets provider_id +
--    entity_kind for every entity kind, but the tables were created without
--    them, so every non-message store write 400'd. Add them to the tables the
--    briefing pipeline writes. Idempotent + non-destructive.
-- ============================================================

ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS provider_health JSONB DEFAULT '{}'::jsonb;

ALTER TABLE unified_notifications
  ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE unified_notifications
  ADD COLUMN IF NOT EXISTS entity_kind TEXT;

ALTER TABLE unified_tasks
  ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE unified_tasks
  ADD COLUMN IF NOT EXISTS entity_kind TEXT;

ALTER TABLE unified_events
  ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE unified_events
  ADD COLUMN IF NOT EXISTS entity_kind TEXT;

ALTER TABLE unified_conversations
  ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE unified_conversations
  ADD COLUMN IF NOT EXISTS entity_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_unified_notifications_integration
  ON unified_notifications(integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_tasks_integration
  ON unified_tasks(integration_id, created_at DESC);
