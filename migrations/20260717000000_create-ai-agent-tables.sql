-- ============================================================
-- Migration: Create AI Agent Workspace Tables
-- Tables: ai_conversations, ai_messages, ai_message_files, ai_tool_calls, ai_workspace_memory
-- ============================================================

-- 1. AI CONVERSATIONS
CREATE TABLE IF NOT EXISTS ai_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    model           TEXT NOT NULL,
    pinned          BOOLEAN NOT NULL DEFAULT false,
    favorite        BOOLEAN NOT NULL DEFAULT false,
    archived        BOOLEAN NOT NULL DEFAULT false,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_pinned ON ai_conversations(pinned);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_favorite ON ai_conversations(favorite);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_archived ON ai_conversations(archived);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
    ON ai_conversations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own conversations"
    ON ai_conversations FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
    ON ai_conversations FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own conversations"
    ON ai_conversations FOR DELETE
    USING (user_id = auth.uid());

CREATE TRIGGER set_ai_conversations_updated_at
    BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 2. AI MESSAGES
CREATE TABLE IF NOT EXISTS ai_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content         TEXT NOT NULL,
    latency         INTEGER, -- in ms
    tokens_used     INTEGER,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own messages"
    ON ai_messages FOR SELECT
    USING (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own messages"
    ON ai_messages FOR INSERT
    WITH CHECK (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own messages"
    ON ai_messages FOR UPDATE
    USING (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()))
    WITH CHECK (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own messages"
    ON ai_messages FOR DELETE
    USING (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()));


-- 3. AI MESSAGE FILES
CREATE TABLE IF NOT EXISTS ai_message_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    message_id      UUID REFERENCES ai_messages(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    size            INTEGER NOT NULL,
    type            TEXT NOT NULL,
    url             TEXT NOT NULL,
    content         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_message_files_conversation_id ON ai_message_files(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_message_files_message_id ON ai_message_files(message_id);

ALTER TABLE ai_message_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own message files"
    ON ai_message_files FOR SELECT
    USING (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own message files"
    ON ai_message_files FOR INSERT
    WITH CHECK (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own message files"
    ON ai_message_files FOR DELETE
    USING (conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid()));


-- 4. AI TOOL CALLS
CREATE TABLE IF NOT EXISTS ai_tool_calls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      UUID NOT NULL REFERENCES ai_messages(id) ON DELETE CASCADE,
    tool_name       TEXT NOT NULL,
    provider        TEXT NOT NULL,
    arguments       JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    duration        INTEGER, -- in ms
    output          TEXT,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_message_id ON ai_tool_calls(message_id);

ALTER TABLE ai_tool_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tool calls"
    ON ai_tool_calls FOR SELECT
    USING (message_id IN (SELECT id FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid())));

CREATE POLICY "Users can insert own tool calls"
    ON ai_tool_calls FOR INSERT
    WITH CHECK (message_id IN (SELECT id FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid())));

CREATE POLICY "Users can update own tool calls"
    ON ai_tool_calls FOR UPDATE
    USING (message_id IN (SELECT id FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid())))
    WITH CHECK (message_id IN (SELECT id FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid())));


-- 5. AI WORKSPACE MEMORY
CREATE TABLE IF NOT EXISTS ai_workspace_memory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    value           TEXT NOT NULL,
    category        TEXT NOT NULL, -- e.g. 'preference', 'knowledge', 'fact'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_memory_key UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_ai_workspace_memory_user_id ON ai_workspace_memory(user_id);

ALTER TABLE ai_workspace_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own workspace memory"
    ON ai_workspace_memory FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own workspace memory"
    ON ai_workspace_memory FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workspace memory"
    ON ai_workspace_memory FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own workspace memory"
    ON ai_workspace_memory FOR DELETE
    USING (user_id = auth.uid());

CREATE TRIGGER set_ai_workspace_memory_updated_at
    BEFORE UPDATE ON ai_workspace_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
