-- ============================================================
-- Migration: Notification System Refactor
-- Tables: notification_center, ai_summary_cache, notification_retry_log
-- Updates: notification_history (add retry fields, new statuses)
-- ============================================================

-- 1. NOTIFICATION CENTER (In-app notifications)
CREATE TABLE IF NOT EXISTS notification_center (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    provider        TEXT NOT NULL DEFAULT 'telegram',
    status          TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    external_history_id UUID REFERENCES notification_history(id) ON DELETE SET NULL,
    read_at         TIMESTAMPTZ,
    archived_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_center_user_id ON notification_center(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_center_status ON notification_center(status);
CREATE INDEX IF NOT EXISTS idx_notification_center_type ON notification_center(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_center_created_at ON notification_center(created_at DESC);

ALTER TABLE notification_center ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
    ON notification_center FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
    ON notification_center FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
    ON notification_center FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Service can insert notifications"
    ON notification_center FOR INSERT
    WITH CHECK (true);

DROP TRIGGER IF EXISTS set_notification_center_updated_at ON notification_center;
CREATE TRIGGER set_notification_center_updated_at
    BEFORE UPDATE ON notification_center
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. AI SUMMARY CACHE
CREATE TABLE IF NOT EXISTS ai_summary_cache (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    summary_type    TEXT NOT NULL CHECK (summary_type IN ('daily_brief', 'priority_summary')),
    cache_key       TEXT NOT NULL,
    content         TEXT NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, summary_type, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_ai_summary_cache_user_type ON ai_summary_cache(user_id, summary_type);
CREATE INDEX IF NOT EXISTS idx_ai_summary_cache_expires ON ai_summary_cache(expires_at);

ALTER TABLE ai_summary_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cache"
    ON ai_summary_cache FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service can manage cache"
    ON ai_summary_cache FOR ALL
    USING (true);

-- 3. NOTIFICATION RETRY LOG
CREATE TABLE IF NOT EXISTS notification_retry_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id     UUID NOT NULL REFERENCES notification_history(id) ON DELETE CASCADE,
    attempt             INTEGER NOT NULL,
    status              TEXT NOT NULL CHECK (status IN ('attempted', 'success', 'failed')),
    error_message       TEXT,
    attempted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_retry_log_notification_id ON notification_retry_log(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_retry_log_attempted_at ON notification_retry_log(attempted_at);

ALTER TABLE notification_retry_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own retry logs"
    ON notification_retry_log FOR SELECT
    USING (notification_id IN (SELECT id FROM notification_history WHERE user_id = auth.uid()));

CREATE POLICY "Service can manage retry logs"
    ON notification_retry_log FOR ALL
    USING (true);

-- 4. UPDATE NOTIFICATION_HISTORY - Add retry fields and new statuses
ALTER TABLE notification_history 
    ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS retry_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS provider_response JSONB,
    ADD COLUMN IF NOT EXISTS source_event TEXT,
    ADD COLUMN IF NOT EXISTS template TEXT;

-- Update status constraint (PostgreSQL doesn't support ALTER CHECK directly, so we recreate)
DO $$
BEGIN
    ALTER TABLE notification_history DROP CONSTRAINT IF EXISTS notification_history_status_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE notification_history 
    ADD CONSTRAINT notification_history_status_check 
    CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'cancelled', 'retrying', 'read', 'acknowledged'));

CREATE INDEX IF NOT EXISTS idx_notification_history_retry_at ON notification_history(retry_at) WHERE retry_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notification_history_source_event ON notification_history(source_event);