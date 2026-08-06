-- ============================================================
-- Migration: add provider_id + entity_kind to unified_messages
--
-- The unified-store write path (UnifiedStoreRepository.toRow) sets these
-- columns for every entity kind, but the table was created without them,
-- so message inserts 400'd. Telegram webhook persistence is the first
-- consumer. Idempotent + non-destructive.
-- ============================================================

ALTER TABLE unified_messages
  ADD COLUMN IF NOT EXISTS provider_id TEXT;
ALTER TABLE unified_messages
  ADD COLUMN IF NOT EXISTS entity_kind TEXT;

CREATE INDEX IF NOT EXISTS idx_unified_messages_integration_sent
  ON unified_messages(integration_id, sent_at DESC);
