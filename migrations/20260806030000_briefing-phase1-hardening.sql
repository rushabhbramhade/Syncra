-- ============================================================
-- Migration: Briefing Phase 1 hardening
--   * briefing_generation_runs: per-execution attempt tracking
--   * briefing_schedules: optimistic lock columns to prevent
--     overlapping concurrent ticks double-executing the same due slot
--   * briefings.source_freshness: per-source fetch timestamps
--   * briefing_message_deliveries: outbound action audit + UI status
-- ============================================================

-- 1. Lock columns on briefing_schedules
ALTER TABLE briefing_schedules
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;

-- 2. Source freshness on briefings
ALTER TABLE briefings
  ADD COLUMN IF NOT EXISTS source_freshness JSONB DEFAULT '{}'::jsonb;

-- 3. Per-execution attempt tracking
CREATE TABLE IF NOT EXISTS briefing_generation_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id     UUID REFERENCES briefing_schedules(id) ON DELETE SET NULL,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'running', 'success', 'failed')),
    attempt_number  INTEGER NOT NULL DEFAULT 1,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    briefing_id     UUID REFERENCES briefings(id) ON DELETE SET NULL,
    duration_ms     INTEGER,
    trigger_source  TEXT NOT NULL CHECK (trigger_source IN ('manual', 'schedule')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_gen_runs_schedule
    ON briefing_generation_runs(schedule_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_gen_runs_user
    ON briefing_generation_runs(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_gen_runs_status
    ON briefing_generation_runs(status) WHERE status IN ('pending', 'running');

ALTER TABLE briefing_generation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own briefing generation runs" ON briefing_generation_runs;
CREATE POLICY "Users can view own briefing generation runs"
    ON briefing_generation_runs FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service can insert briefing generation runs" ON briefing_generation_runs;
CREATE POLICY "Service can insert briefing generation runs"
    ON briefing_generation_runs FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update briefing generation runs" ON briefing_generation_runs;
CREATE POLICY "Service can update briefing generation runs"
    ON briefing_generation_runs FOR UPDATE
    USING (true) WITH CHECK (true);

-- 4. Outbound message delivery audit (Phase 1.4)
CREATE TABLE IF NOT EXISTS briefing_message_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_item_id UUID NOT NULL REFERENCES briefing_items(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL,
    recipient       TEXT,
    body            TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'sent', 'failed')),
    error_code      TEXT,
    error_message   TEXT,
    provider_response JSONB,
    attempted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_deliveries_item
    ON briefing_message_deliveries(briefing_item_id);
CREATE INDEX IF NOT EXISTS idx_briefing_deliveries_user
    ON briefing_message_deliveries(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_briefing_deliveries_status
    ON briefing_message_deliveries(status) WHERE status = 'pending';

ALTER TABLE briefing_message_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own deliveries" ON briefing_message_deliveries;
CREATE POLICY "Users can view own deliveries"
    ON briefing_message_deliveries FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service can insert deliveries" ON briefing_message_deliveries;
CREATE POLICY "Service can insert deliveries"
    ON briefing_message_deliveries FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service can update deliveries" ON briefing_message_deliveries;
CREATE POLICY "Service can update deliveries"
    ON briefing_message_deliveries FOR UPDATE
    USING (true) WITH CHECK (true);
