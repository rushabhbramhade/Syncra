-- ============================================================
-- Migration: User Tasks (AI-Extracted Action Items)
-- Table: user_tasks
-- ============================================================

CREATE TABLE IF NOT EXISTS user_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    owner           TEXT,
    deadline        TIMESTAMPTZ,
    source_platform TEXT,
    source_item_id  TEXT,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'archived')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_tasks_user_id ON user_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_status ON user_tasks(status);
CREATE INDEX IF NOT EXISTS idx_user_tasks_deadline ON user_tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_user_tasks_source_platform ON user_tasks(source_platform);

ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
    ON user_tasks FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tasks"
    ON user_tasks FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tasks"
    ON user_tasks FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tasks"
    ON user_tasks FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Service can manage user_tasks"
    ON user_tasks FOR ALL
    USING (true);
