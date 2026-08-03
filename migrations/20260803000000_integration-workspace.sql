-- ================================================================
-- Migration: Integration Workspace — sync state + activity logs
-- Extends the existing user_integrations table (reuse, no duplicate).
-- ================================================================

-- 1. Add sync-state columns to user_integrations
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS sync_status TEXT NOT NULL DEFAULT 'idle';
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS connected BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Indexes for the status/sync queries used by the dashboard
CREATE INDEX IF NOT EXISTS idx_user_integrations_connected ON user_integrations(connected);
CREATE INDEX IF NOT EXISTS idx_user_integrations_sync_status ON user_integrations(sync_status);

-- 3. Sync activity log (powers the detail drawer "Recent Activity" feed)
CREATE TABLE IF NOT EXISTS integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error', 'refresh', 'reconnect')),
  message TEXT,
  metadata JSONB DEFAULT '{}',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_user_id ON integration_sync_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_provider ON integration_sync_logs(provider);
CREATE INDEX IF NOT EXISTS idx_integration_sync_logs_created_at ON integration_sync_logs(created_at);

ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;
