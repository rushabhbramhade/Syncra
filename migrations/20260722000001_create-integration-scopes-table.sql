-- ============================================================
-- Migration: Integration Scopes (Channel/Repo Selection)
-- Table: integration_scopes
-- ============================================================

CREATE TABLE IF NOT EXISTS integration_scopes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,
    scope_type      TEXT NOT NULL,
    scope_value     TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, provider, scope_type, scope_value)
);

CREATE INDEX IF NOT EXISTS idx_integration_scopes_user_id ON integration_scopes(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_scopes_provider ON integration_scopes(provider);
CREATE INDEX IF NOT EXISTS idx_integration_scopes_scope_type ON integration_scopes(scope_type);

ALTER TABLE integration_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integration scopes"
    ON integration_scopes FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own integration scopes"
    ON integration_scopes FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own integration scopes"
    ON integration_scopes FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Service can manage integration_scopes"
    ON integration_scopes FOR ALL
    USING (true);
