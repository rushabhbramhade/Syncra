-- ============================================================
-- Migration: Intelligence & Personalization Tables
-- Tables: user_rules, user_feedback, classification_audit,
--         ai_decision_log, user_dashboard_layout, ai_user_memory
-- Alter:   briefing_items (score, confidence, cross_refs, etc.)
-- ============================================================

-- 1. USER RULES
CREATE TABLE IF NOT EXISTS user_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_json       JSONB NOT NULL,
    enabled         BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_rules_user_id ON user_rules(user_id);

ALTER TABLE user_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rules"
    ON user_rules FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own rules"
    ON user_rules FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own rules"
    ON user_rules FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own rules"
    ON user_rules FOR DELETE
    USING (user_id = auth.uid());

-- 2. USER FEEDBACK
CREATE TABLE IF NOT EXISTS user_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id        TEXT NOT NULL,
    action          TEXT NOT NULL,
    previous_priority TEXT,
    new_priority    TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_event_id ON user_feedback(event_id);

ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own feedback"
    ON user_feedback FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own feedback"
    ON user_feedback FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own feedback"
    ON user_feedback FOR DELETE
    USING (user_id = auth.uid());

-- 3. CLASSIFICATION AUDIT
CREATE TABLE IF NOT EXISTS classification_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id        TEXT NOT NULL,
    platform        TEXT NOT NULL,
    rule_matches    JSONB DEFAULT '[]'::jsonb,
    score_factors   JSONB DEFAULT '{}'::jsonb,
    final_priority  TEXT NOT NULL,
    final_score     NUMERIC(5,2),
    ai_confidence   NUMERIC(3,2),
    ai_explanation  TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_classification_audit_user_id ON classification_audit(user_id);
CREATE INDEX IF NOT EXISTS idx_classification_audit_created_at ON classification_audit(created_at);

ALTER TABLE classification_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own classification audit"
    ON classification_audit FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own classification audit"
    ON classification_audit FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- 4. AI DECISION LOG
CREATE TABLE IF NOT EXISTS ai_decision_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    briefing_id     UUID REFERENCES briefings(id) ON DELETE SET NULL,
    prompt_type     TEXT NOT NULL,
    prompt_tokens   INT DEFAULT 0,
    response_tokens  INT DEFAULT 0,
    model           TEXT,
    latency_ms      INT DEFAULT 0,
    success         BOOLEAN DEFAULT true,
    error           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_decision_log_user_id ON ai_decision_log(user_id);

ALTER TABLE ai_decision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decision log"
    ON ai_decision_log FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own decision log"
    ON ai_decision_log FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- 5. USER DASHBOARD LAYOUT
CREATE TABLE IF NOT EXISTS user_dashboard_layout (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    layout_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

ALTER TABLE user_dashboard_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dashboard layout"
    ON user_dashboard_layout FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own dashboard layout"
    ON user_dashboard_layout FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own dashboard layout"
    ON user_dashboard_layout FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own dashboard layout"
    ON user_dashboard_layout FOR DELETE
    USING (user_id = auth.uid());

-- 6. AI USER MEMORY
CREATE TABLE IF NOT EXISTS ai_user_memory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    memory_type     TEXT NOT NULL,
    key             TEXT NOT NULL,
    value           JSONB NOT NULL DEFAULT '{}'::jsonb,
    confidence      NUMERIC(3,2) DEFAULT 0.5,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, memory_type, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_user_memory_user_id ON ai_user_memory(user_id);

ALTER TABLE ai_user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory"
    ON ai_user_memory FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memory"
    ON ai_user_memory FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memory"
    ON ai_user_memory FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own memory"
    ON ai_user_memory FOR DELETE
    USING (user_id = auth.uid());

-- 7. ALTER BRIEFING ITEMS (add columns safely)
DO $$
BEGIN
    ALTER TABLE briefing_items ADD COLUMN IF NOT EXISTS score NUMERIC(5,2) DEFAULT 0;
    ALTER TABLE briefing_items ADD COLUMN IF NOT EXISTS confidence NUMERIC(3,2) DEFAULT 1.0;
    ALTER TABLE briefing_items ADD COLUMN IF NOT EXISTS cross_refs TEXT[] DEFAULT '{}';
    ALTER TABLE briefing_items ADD COLUMN IF NOT EXISTS dedup_hash TEXT;
    ALTER TABLE briefing_items ADD COLUMN IF NOT EXISTS explanation TEXT;
    ALTER TABLE briefing_items ADD COLUMN IF NOT EXISTS rules_matched TEXT[] DEFAULT '{}';
EXCEPTION WHEN others THEN
    NULL;
END $$;

-- 8. SERVICE ROLE POLICIES (admin bypass for all new tables)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_rules' AND policyname = 'Service role can read user_rules'
    ) THEN
        CREATE POLICY "Service role can read user_rules"
            ON user_rules FOR SELECT USING (true);
        CREATE POLICY "Service role can write user_rules"
            ON user_rules FOR INSERT WITH CHECK (true);
        CREATE POLICY "Service role can update user_rules"
            ON user_rules FOR UPDATE USING (true) WITH CHECK (true);
        CREATE POLICY "Service role can delete user_rules"
            ON user_rules FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_feedback' AND policyname = 'Service role can read user_feedback'
    ) THEN
        CREATE POLICY "Service role can read user_feedback"
            ON user_feedback FOR SELECT USING (true);
        CREATE POLICY "Service role can write user_feedback"
            ON user_feedback FOR INSERT WITH CHECK (true);
        CREATE POLICY "Service role can delete user_feedback"
            ON user_feedback FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'classification_audit' AND policyname = 'Service role can read classification_audit'
    ) THEN
        CREATE POLICY "Service role can read classification_audit"
            ON classification_audit FOR SELECT USING (true);
        CREATE POLICY "Service role can write classification_audit"
            ON classification_audit FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ai_decision_log' AND policyname = 'Service role can read ai_decision_log'
    ) THEN
        CREATE POLICY "Service role can read ai_decision_log"
            ON ai_decision_log FOR SELECT USING (true);
        CREATE POLICY "Service role can write ai_decision_log"
            ON ai_decision_log FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_dashboard_layout' AND policyname = 'Service role can read user_dashboard_layout'
    ) THEN
        CREATE POLICY "Service role can read user_dashboard_layout"
            ON user_dashboard_layout FOR SELECT USING (true);
        CREATE POLICY "Service role can write user_dashboard_layout"
            ON user_dashboard_layout FOR INSERT WITH CHECK (true);
        CREATE POLICY "Service role can update user_dashboard_layout"
            ON user_dashboard_layout FOR UPDATE USING (true) WITH CHECK (true);
        CREATE POLICY "Service role can delete user_dashboard_layout"
            ON user_dashboard_layout FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'ai_user_memory' AND policyname = 'Service role can read ai_user_memory'
    ) THEN
        CREATE POLICY "Service role can read ai_user_memory"
            ON ai_user_memory FOR SELECT USING (true);
        CREATE POLICY "Service role can write ai_user_memory"
            ON ai_user_memory FOR INSERT WITH CHECK (true);
        CREATE POLICY "Service role can update ai_user_memory"
            ON ai_user_memory FOR UPDATE USING (true) WITH CHECK (true);
        CREATE POLICY "Service role can delete ai_user_memory"
            ON ai_user_memory FOR DELETE USING (true);
    END IF;
EXCEPTION WHEN others THEN
    NULL;
END $$;
