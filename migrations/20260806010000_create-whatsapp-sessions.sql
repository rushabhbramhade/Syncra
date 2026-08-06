-- ============================================================
-- Migration: WhatsApp sessions table
-- Stores Baileys auth creds (creds + signal keys) per user.
-- Admin/service client only (createAdminDb) — RLS passthrough
-- matches how telegram_connections is accessed.
-- ============================================================

-- user_id is the auth/users row id (auth user), stored as-is by the repo's
-- createAdminDb path. No FK: it does not map to the app's `users` table.
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    user_id     UUID PRIMARY KEY,
    session_data JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin/service reads the table; allow service role via RLS passthrough
-- and normal users to read/delete only their own row (mirrors repo usage).
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp_sessions"
    ON whatsapp_sessions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own whatsapp_sessions"
    ON whatsapp_sessions FOR DELETE
    USING (user_id = auth.uid());

CREATE POLICY "Service can manage whatsapp_sessions"
    ON whatsapp_sessions FOR ALL
    USING (true);