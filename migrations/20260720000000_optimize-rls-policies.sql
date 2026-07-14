-- ================================================================
-- Migration: Optimize RLS Policies — denormalize user_id into
-- ai_tool_calls to eliminate double-nested subqueries.
-- ================================================================

-- ================================================================
-- Step 1: Add user_id column to ai_tool_calls
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ai_tool_calls'
          AND column_name = 'user_id'
    ) THEN
        ALTER TABLE ai_tool_calls
            ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;


-- ================================================================
-- Step 2: Add a NOT VALID foreign key constraint (skip existing
-- row validation to avoid locking on large tables). The column
-- already has the FK above from Step 1; if it already existed
-- without an FK, this catches that case.
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = 'ai_tool_calls'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND ccu.column_name = 'user_id'
    ) THEN
        ALTER TABLE ai_tool_calls
            ADD CONSTRAINT fk_ai_tool_calls_user_id
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            NOT VALID;
    END IF;
END $$;


-- ================================================================
-- Step 3: Backfill existing rows with the correct user_id
-- traversing ai_tool_calls → ai_messages → ai_conversations.
-- ================================================================
UPDATE ai_tool_calls
SET user_id = ai_conversations.user_id
FROM ai_messages
JOIN ai_conversations ON ai_messages.conversation_id = ai_conversations.id
WHERE ai_tool_calls.message_id = ai_messages.id
  AND ai_tool_calls.user_id IS NULL;


-- ================================================================
-- Step 4: Validate the NOT VALID constraint now that data is
-- populated (light-weight, no full table lock required in most
-- Postgres versions, but still safer than adding it VALIDATED).
-- ================================================================
DO $$
BEGIN
    ALTER TABLE ai_tool_calls
        VALIDATE CONSTRAINT fk_ai_tool_calls_user_id;
END $$;


-- ================================================================
-- Step 5: Create index on the new user_id column for fast
-- RLS lookups.
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_ai_tool_calls_user_id
    ON ai_tool_calls(user_id);


-- ================================================================
-- Step 6: Create a trigger function that automatically sets
-- user_id on INSERT or UPDATE by walking the message chain.
-- ================================================================
CREATE OR REPLACE FUNCTION set_ai_tool_calls_user_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT ai_conversations.user_id INTO NEW.user_id
    FROM ai_messages
    JOIN ai_conversations ON ai_messages.conversation_id = ai_conversations.id
    WHERE ai_messages.id = NEW.message_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Message with id % not found or has no conversation', NEW.message_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- Step 7: Attach the trigger to fire before INSERT or UPDATE.
-- ================================================================
DROP TRIGGER IF EXISTS set_ai_tool_calls_user_id_trigger ON ai_tool_calls;
CREATE TRIGGER set_ai_tool_calls_user_id_trigger
    BEFORE INSERT OR UPDATE OF message_id
    ON ai_tool_calls
    FOR EACH ROW
    EXECUTE FUNCTION set_ai_tool_calls_user_id();


-- ================================================================
-- Step 8: Drop the old double-nested subquery policies.
-- ================================================================
DROP POLICY IF EXISTS "Users can view own tool calls" ON ai_tool_calls;
DROP POLICY IF EXISTS "Users can insert own tool calls" ON ai_tool_calls;
DROP POLICY IF EXISTS "Users can update own tool calls" ON ai_tool_calls;


-- ================================================================
-- Step 9: Create optimised policies using the direct user_id
-- column instead of traversing two JOINs at query time.
-- ================================================================
CREATE POLICY "Users can view own tool calls"
    ON ai_tool_calls FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tool calls"
    ON ai_tool_calls FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tool calls"
    ON ai_tool_calls FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ================================================================
-- Step 10: (Optional) Also optimise ai_messages and
-- ai_message_files in the same migration since they suffer
-- from the same subquery pattern.
-- ================================================================

-- -- ai_messages already has a conversation_id FK; we can add
-- -- a user_id column here too for consistency, but the current
-- -- single-level subquery is usually acceptable. Uncomment if
-- -- needed:
-- DO $$
-- BEGIN
--     IF NOT EXISTS (
--         SELECT 1 FROM information_schema.columns
--         WHERE table_name = 'ai_messages' AND column_name = 'user_id'
--     ) THEN
--         ALTER TABLE ai_messages ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
--     END IF;
-- END $$;
--
-- UPDATE ai_messages
-- SET user_id = ai_conversations.user_id
-- FROM ai_conversations
-- WHERE ai_messages.conversation_id = ai_conversations.id
--   AND ai_messages.user_id IS NULL;
--
-- CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON ai_messages(user_id);
--
-- -- Trigger to auto-set user_id on ai_messages
-- CREATE OR REPLACE FUNCTION set_ai_messages_user_id()
-- RETURNS TRIGGER AS $$
-- BEGIN
--     SELECT user_id INTO NEW.user_id FROM ai_conversations WHERE id = NEW.conversation_id;
--     RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql;
--
-- DROP TRIGGER IF EXISTS set_ai_messages_user_id_trigger ON ai_messages;
-- CREATE TRIGGER set_ai_messages_user_id_trigger
--     BEFORE INSERT OR UPDATE OF conversation_id
--     ON ai_messages
--     FOR EACH ROW
--     EXECUTE FUNCTION set_ai_messages_user_id();
