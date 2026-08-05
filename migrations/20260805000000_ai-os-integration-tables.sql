-- ================================================================
-- Migration: AI OS integration tables — sync state, credentials,
-- unified entities, AI index, knowledge graph, webhooks, audit.
--
-- Extends the integration workspace per docs/integrations-architecture.md
-- §3. Reuses user_integrations (never duplicates it).
--
-- Deviation notes (deliberate, documented):
--   * unified_* tables carry a denormalized user_id so RLS uses the
--     proven public.is_owner(user_id) pattern (same as 6 prior
--     migrations) instead of joining through integration_id.
--   * user_integrations.status ('active'/'inactive') is used by every
--     existing query — do NOT overload it. The 11-state machine lives
--     in the new lifecycle_state column.
--   * ai_index_state.embedding is JSONB (portable on managed Postgres).
--     When pgvector is available, query via `embedding::vector(1536)`
--     — the cast is the documented upgrade path, no schema change.
-- ================================================================

-- 1. Extend user_integrations with the lifecycle state machine + capability grants
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS lifecycle_state TEXT
  CHECK (lifecycle_state IN (
    'not_connected','connecting','authenticating','connected','metadata_sync',
    'ai_indexing','ready','realtime_sync','needs_reauthentication','error','disconnected'
  ));
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS capabilities JSONB NOT NULL DEFAULT '[]';
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS state_machine_ver INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;
ALTER TABLE user_integrations ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ;

-- 2. Sync state: per-integration watermarks (cursor, backfill timestamps)
CREATE TABLE IF NOT EXISTS sync_state (
  integration_id UUID PRIMARY KEY REFERENCES user_integrations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL,
  cursor JSONB NOT NULL DEFAULT '{}',
  last_full_sync_at TIMESTAMPTZ,
  last_incremental_at TIMESTAMPTZ,
  next_backfill_after TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sync_state_user ON sync_state(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_state_provider ON sync_state(provider);

-- 3. Credentials: envelope-encrypted tokens, worker-only access (no user policy)
CREATE TABLE IF NOT EXISTS integration_credentials (
  integration_id UUID PRIMARY KEY REFERENCES user_integrations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  access_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  refresh_error_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_integration_credentials_provider ON integration_credentials(provider);

-- 4. Unified entity store (architecture §3.2)
CREATE TABLE IF NOT EXISTS unified_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  provider_message_id TEXT NOT NULL,
  thread_id UUID,
  conversation_id UUID,
  channel_id TEXT,
  author_contact_id UUID,
  body_text TEXT NOT NULL,
  body_html TEXT,
  content_hash TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  direction TEXT CHECK (direction IN ('inbound','outbound')),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, provider_message_id)
);
CREATE INDEX IF NOT EXISTS idx_unified_messages_user ON unified_messages(user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_unified_messages_integration ON unified_messages(integration_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_thread ON unified_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_unified_messages_hash ON unified_messages(content_hash);

CREATE TABLE IF NOT EXISTS unified_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  provider_thread_id TEXT,
  subject TEXT,
  participant_ids UUID[] DEFAULT '{}',
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, provider_thread_id)
);
CREATE INDEX IF NOT EXISTS idx_unified_threads_user ON unified_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_threads_integration ON unified_threads(integration_id);

CREATE TABLE IF NOT EXISTS unified_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  kind TEXT CHECK (kind IN ('dm','group','channel','email-thread')),
  title TEXT,
  channel_id TEXT,
  participant_ids UUID[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, kind, channel_id)
);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_user ON unified_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_conversations_integration ON unified_conversations(integration_id);

CREATE TABLE IF NOT EXISTS unified_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  provider_contact_id TEXT,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, email)
);
CREATE INDEX IF NOT EXISTS idx_unified_contacts_user ON unified_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_contacts_integration ON unified_contacts(integration_id);

CREATE TABLE IF NOT EXISTS unified_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  provider_task_id TEXT,
  kind TEXT CHECK (kind IN ('issue','pr','todo')),
  title TEXT NOT NULL,
  status TEXT,
  priority TEXT,
  assignee_contact_id UUID,
  repo_id UUID,
  url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, provider_task_id)
);
CREATE INDEX IF NOT EXISTS idx_unified_tasks_user ON unified_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_tasks_integration ON unified_tasks(integration_id);
CREATE INDEX IF NOT EXISTS idx_unified_tasks_kind ON unified_tasks(integration_id, kind);

CREATE TABLE IF NOT EXISTS unified_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  provider_repo_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  private BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, provider_repo_id)
);
CREATE INDEX IF NOT EXISTS idx_unified_repos_user ON unified_repos(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_repos_integration ON unified_repos(integration_id);

CREATE TABLE IF NOT EXISTS unified_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  provider_event_id TEXT,
  title TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  attendees JSONB DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_unified_events_user ON unified_events(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_events_integration ON unified_events(integration_id);

CREATE TABLE IF NOT EXISTS unified_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  provider_notification_id TEXT,
  kind TEXT,
  title TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  url TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, provider_notification_id)
);
CREATE INDEX IF NOT EXISTS idx_unified_notifications_user ON unified_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_notifications_integration ON unified_notifications(integration_id);

CREATE TABLE IF NOT EXISTS unified_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  provider_attachment_id TEXT,
  storage_key TEXT,
  url TEXT,
  filename TEXT,
  mime_type TEXT,
  size_bytes BIGINT,
  extracted_text TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, provider_attachment_id)
);
CREATE INDEX IF NOT EXISTS idx_unified_attachments_user ON unified_attachments(user_id);
CREATE INDEX IF NOT EXISTS idx_unified_attachments_integration ON unified_attachments(integration_id);

-- 5. AI index state (architecture §3.3)
CREATE TABLE IF NOT EXISTS ai_index_state (
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  embedding_model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','embedded','failed')),
  summary TEXT,
  embedding JSONB,
  indexed_at TIMESTAMPTZ,
  error TEXT,
  PRIMARY KEY (entity_type, entity_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_index_state_status ON ai_index_state(status);
CREATE INDEX IF NOT EXISTS idx_ai_index_state_integration ON ai_index_state(integration_id);
CREATE INDEX IF NOT EXISTS idx_ai_index_state_user ON ai_index_state(user_id);

-- 6. Knowledge graph (architecture §3.4)
CREATE TABLE IF NOT EXISTS kg_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  properties JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (integration_id, kind, label)
);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_user ON kg_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_integration ON kg_nodes(integration_id);
CREATE INDEX IF NOT EXISTS idx_kg_nodes_kind_label ON kg_nodes(kind, label);

CREATE TABLE IF NOT EXISTS kg_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID NOT NULL REFERENCES user_integrations(id) ON DELETE CASCADE,
  source_node_id UUID NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  target_node_id UUID NOT NULL REFERENCES kg_nodes(id) ON DELETE CASCADE,
  relation TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_node_id, target_node_id, relation)
);
CREATE INDEX IF NOT EXISTS idx_kg_edges_user ON kg_edges(user_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_source ON kg_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_kg_edges_target ON kg_edges(target_node_id);

-- 7. Webhook events (at-least-once ingest, dedup on processed_at)
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  user_id UUID,
  integration_id UUID,
  event_type TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_unprocessed
  ON webhook_events(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON webhook_events(provider, received_at);

-- 8. Audit logs (architecture §15)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  integration_id UUID,
  actor TEXT NOT NULL CHECK (actor IN ('user','ai','system','worker')),
  action TEXT NOT NULL,
  target TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_integration ON audit_logs(integration_id);

-- 9. RLS — unified tables and sync_state follow the proven is_owner(user_id)
-- pattern; credentials and webhook_events stay worker-only (no user policy).
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sync_state','unified_messages','unified_threads','unified_conversations',
    'unified_contacts','unified_tasks','unified_repos','unified_events',
    'unified_notifications','unified_attachments','ai_index_state','kg_nodes','kg_edges'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Users can view own %I" ON public.%I FOR SELECT TO authenticated USING (public.is_owner(user_id))', t, t);
    EXECUTE format('CREATE POLICY "Users can insert own %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_owner(user_id))', t, t);
    EXECUTE format('CREATE POLICY "Users can update own %I" ON public.%I FOR UPDATE TO authenticated USING (public.is_owner(user_id)) WITH CHECK (public.is_owner(user_id))', t, t);
    EXECUTE format('CREATE POLICY "Users can delete own %I" ON public.%I FOR DELETE TO authenticated USING (public.is_owner(user_id))', t, t);
  END LOOP;

  -- audit_logs: users may read their own; writes stay worker-only.
  EXECUTE 'ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY "Users can view own audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.is_owner(user_id))';
END $$;
