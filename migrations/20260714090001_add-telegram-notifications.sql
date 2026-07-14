-- ============================================================
-- Migration: Add Telegram Notifications
-- Tables: telegram_connections, notification_preferences, notification_history
-- ============================================================

-- 1. TELEGRAM CONNECTIONS
CREATE TABLE IF NOT EXISTS telegram_connections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id         TEXT NOT NULL,
    telegram_username TEXT,
    first_name      TEXT,
    last_name       TEXT,
    connected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_verified   TIMESTAMPTZ NOT NULL DEFAULT now(),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disconnected', 'revoked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_connections_user_id ON telegram_connections(user_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_connections_chat_id ON telegram_connections(chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_connections_status ON telegram_connections(status);

ALTER TABLE telegram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own telegram connection"
    ON telegram_connections FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own telegram connection"
    ON telegram_connections FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own telegram connection"
    ON telegram_connections FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own telegram connection"
    ON telegram_connections FOR DELETE
    USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_telegram_connections_updated_at ON telegram_connections;
CREATE TRIGGER set_telegram_connections_updated_at
    BEFORE UPDATE ON telegram_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    schedule        TEXT NOT NULL DEFAULT 'instant' CHECK (schedule IN ('instant', 'every_15_min', 'hourly', 'morning_brief', 'evening_brief', 'daily', 'weekly')),
    timezone        TEXT NOT NULL DEFAULT 'UTC',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_type ON notification_preferences(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_enabled ON notification_preferences(enabled);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification preferences"
    ON notification_preferences FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification preferences"
    ON notification_preferences FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification preferences"
    ON notification_preferences FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notification preferences"
    ON notification_preferences FOR DELETE
    USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS set_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER set_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3. NOTIFICATION HISTORY
CREATE TABLE IF NOT EXISTS notification_history (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    provider        TEXT NOT NULL DEFAULT 'telegram',
    title           TEXT,
    message         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'cancelled')),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at    TIMESTAMPTZ,
    error_message   TEXT,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at DESC);

ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification history"
    ON notification_history FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Service can insert notification history"
    ON notification_history FOR INSERT
    WITH CHECK (true);
