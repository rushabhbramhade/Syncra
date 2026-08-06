-- ============================================================
-- Migration: Archive stale briefings (pre-hardening/fabricated)
--
-- Briefings created before the anti-hallucination gate store no real
-- source freshness. Soft-archive them so users see only fresh,
-- data-driven briefings or a proper empty state — never placeholder
-- AI content. Non-destructive and idempotent (rerunnable).
-- ============================================================

ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Stale = no real integration data was recorded for it (empty source
-- freshness). Legitimate briefings always carry >= 1 source entry.
UPDATE briefings
SET archived_at = now()
WHERE archived_at IS NULL
  AND (source_freshness IS NULL
       OR source_freshness = '{}'::jsonb
       OR jsonb_typeof(source_freshness) = 'null');

-- Keep unarchived rows fast to scan.
CREATE INDEX IF NOT EXISTS idx_briefings_archived
  ON briefings(archived_at) WHERE archived_at IS NULL;