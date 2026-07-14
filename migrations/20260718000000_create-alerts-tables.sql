-- ============================================================
-- Migration: Alerts System
-- Tables: alert_rules, triggered_alerts
-- ============================================================

-- 1. ALERT RULES (user-defined alert configurations)
CREATE TABLE IF NOT EXISTS alert_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    description     TEXT,
    selected_apps   TEXT[] NOT NULL DEFAULT '{}',
    trigger_rule    TEXT NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    notification_method TEXT NOT NULL DEFAULT 'in_app' CHECK (notification_method IN ('in_app', 'email', 'telegram', 'whatsapp', 'all')),
    frequency       TEXT NOT NULL DEFAULT 'realtime' CHECK (frequency IN ('realtime', 'hourly', 'daily', 'weekly')),
    action_on_trigger TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    last_triggered  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_rules_user_id ON alert_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_alert_rules_priority ON alert_rules(priority);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert rules"
    ON alert_rules FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own alert rules"
    ON alert_rules FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own alert rules"
    ON alert_rules FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own alert rules"
    ON alert_rules FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Service can manage alert rules"
    ON alert_rules FOR ALL
    USING (true);

-- 2. TRIGGERED ALERTS (alert instances fired from rules)
CREATE TABLE IF NOT EXISTS triggered_alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_id         UUID REFERENCES alert_rules(id) ON DELETE SET NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    source_app      TEXT NOT NULL,
    priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'snoozed', 'dismissed')),
    metadata        JSONB,
    ai_summary      TEXT,
    ai_next_action  TEXT,
    ai_draft_reply  TEXT,
    snoozed_until   TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ,
    triggered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_triggered_alerts_user_id ON triggered_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_rule_id ON triggered_alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_status ON triggered_alerts(status);
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_priority ON triggered_alerts(priority);
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_triggered_at ON triggered_alerts(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_triggered_alerts_source_app ON triggered_alerts(source_app);

ALTER TABLE triggered_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own triggered alerts"
    ON triggered_alerts FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update own triggered alerts"
    ON triggered_alerts FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own triggered alerts"
    ON triggered_alerts FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Service can manage triggered alerts"
    ON triggered_alerts FOR ALL
    USING (true);
