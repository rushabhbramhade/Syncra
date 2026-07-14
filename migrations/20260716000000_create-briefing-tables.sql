-- ============================================================
-- Migration: Create Briefing Tables
-- Tables: briefing_schedules, briefings, briefing_items, briefing_history
-- ============================================================

-- 1. BRIEFING SCHEDULES
CREATE TABLE IF NOT EXISTS briefing_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    goal            TEXT,
    description     TEXT,
    integrations    JSONB DEFAULT '[]'::jsonb, -- e.g., ["gmail", "slack", "whatsapp", "telegram"]
    categories      JSONB DEFAULT '[]'::jsonb, -- e.g., ["email", "meetings", "messages", "tasks", "follow-ups"]
    frequency       TEXT NOT NULL,              -- "every_15_min", "hourly", "morning_brief", "evening_brief", "daily", "weekly", "custom"
    timezone        TEXT NOT NULL DEFAULT 'UTC',
    enabled         BOOLEAN NOT NULL DEFAULT true,
    last_run        TIMESTAMPTZ,
    next_run        TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_schedules_user_id ON briefing_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_briefing_schedules_enabled ON briefing_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_briefing_schedules_next_run ON briefing_schedules(next_run);

ALTER TABLE briefing_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own briefing schedules" ON briefing_schedules;
CREATE POLICY "Users can view own briefing schedules"
    ON briefing_schedules FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own briefing schedules" ON briefing_schedules;
CREATE POLICY "Users can insert own briefing schedules"
    ON briefing_schedules FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own briefing schedules" ON briefing_schedules;
CREATE POLICY "Users can update own briefing schedules"
    ON briefing_schedules FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own briefing schedules" ON briefing_schedules;
CREATE POLICY "Users can delete own briefing schedules"
    ON briefing_schedules FOR DELETE
    USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_briefing_schedules_updated_at ON briefing_schedules;
CREATE TRIGGER set_briefing_schedules_updated_at
    BEFORE UPDATE ON briefing_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 2. BRIEFINGS
CREATE TABLE IF NOT EXISTS briefings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id         UUID REFERENCES briefing_schedules(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    executive_summary   TEXT NOT NULL,
    full_content        JSONB DEFAULT '{}'::jsonb,
    priority_score      INTEGER NOT NULL DEFAULT 0,
    generated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    ai_model            TEXT,
    status              TEXT NOT NULL DEFAULT 'completed', -- 'completed', 'failed', 'processing'
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefings_user_id ON briefings(user_id);
CREATE INDEX IF NOT EXISTS idx_briefings_schedule_id ON briefings(schedule_id);
CREATE INDEX IF NOT EXISTS idx_briefings_generated_at ON briefings(generated_at DESC);

ALTER TABLE briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own briefings" ON briefings;
CREATE POLICY "Users can view own briefings"
    ON briefings FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own briefings" ON briefings;
CREATE POLICY "Users can update own briefings"
    ON briefings FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own briefings" ON briefings;
CREATE POLICY "Users can delete own briefings"
    ON briefings FOR DELETE
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service can insert briefings" ON briefings;
CREATE POLICY "Service can insert briefings"
    ON briefings FOR INSERT
    WITH CHECK (true);


-- 3. BRIEFING ITEMS
CREATE TABLE IF NOT EXISTS briefing_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_id     UUID NOT NULL REFERENCES briefings(id) ON DELETE CASCADE,
    platform        TEXT NOT NULL,                                  -- e.g., 'gmail', 'slack', 'whatsapp', 'telegram', 'outlook', 'discord', 'tasks', 'calendar'
    category        TEXT NOT NULL,                                  -- e.g., 'email', 'meetings', 'messages', 'tasks', 'follow-ups'
    source_id       TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb,
    priority        TEXT NOT NULL DEFAULT 'normal',                 -- 'high', 'normal', 'low'
    status          TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'completed', 'archived', 'snoozed')),
    notes           TEXT,
    snoozed_until   TIMESTAMPTZ,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_briefing_items_briefing_id ON briefing_items(briefing_id);
CREATE INDEX IF NOT EXISTS idx_briefing_items_platform ON briefing_items(platform);
CREATE INDEX IF NOT EXISTS idx_briefing_items_category ON briefing_items(category);
CREATE INDEX IF NOT EXISTS idx_briefing_items_status ON briefing_items(status);

ALTER TABLE briefing_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own briefing items" ON briefing_items;
CREATE POLICY "Users can view own briefing items"
    ON briefing_items FOR SELECT
    USING (briefing_id IN (SELECT id FROM briefings WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can update own briefing items" ON briefing_items;
CREATE POLICY "Users can update own briefing items"
    ON briefing_items FOR UPDATE
    USING (briefing_id IN (SELECT id FROM briefings WHERE user_id = auth.uid()))
    WITH CHECK (briefing_id IN (SELECT id FROM briefings WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Service can insert briefing items" ON briefing_items;
CREATE POLICY "Service can insert briefing items"
    ON briefing_items FOR INSERT
    WITH CHECK (true);


-- 4. BRIEFING HISTORY
CREATE TABLE IF NOT EXISTS briefing_history (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    schedule_id         UUID REFERENCES briefing_schedules(id) ON DELETE SET NULL,
    execution_time      TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration            INTEGER, -- duration in ms
    status              TEXT NOT NULL, -- 'success', 'failed'
    errors              TEXT,
    ai_tokens_used      INTEGER DEFAULT 0,
    trigger_source      TEXT NOT NULL -- 'manual', 'schedule'
);

CREATE INDEX IF NOT EXISTS idx_briefing_history_user_id ON briefing_history(user_id);
CREATE INDEX IF NOT EXISTS idx_briefing_history_schedule_id ON briefing_history(schedule_id);

ALTER TABLE briefing_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own briefing history" ON briefing_history;
CREATE POLICY "Users can view own briefing history"
    ON briefing_history FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Service can insert briefing history" ON briefing_history;
CREATE POLICY "Service can insert briefing history"
    ON briefing_history FOR INSERT
    WITH CHECK (true);
