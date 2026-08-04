-- ================================================================
-- Migration: Close anonymous RLS exposure + fix no-op ownership policies.
--
-- Two problems found during launch pre-landing review:
--
-- 1. EXPOSURE: "Service can manage X" policies were created with
--    `FOR ALL USING (true)` and NO TO clause. A policy with no TO
--    clause applies to PUBLIC (anon + authenticated). The app never
--    uses these policies (its admin client runs as project_admin,
--    which bypasses RLS), so they are pure attack surface: anonymous
--    users could read/write/delete every row on:
--      ai_summary_cache, alert_rules, integration_scopes,
--      notification_retry_log, triggered_alerts, user_tasks
--    And anonymous INSERT (WITH CHECK true) on:
--      briefings, briefing_items, briefing_history,
--      notification_center, notification_history
--    Fix: DROP every service policy. The admin client (bypassrls)
--    does all server-side writes; no policy is required for it.
--
-- 2. NO-OP OWNERSHIP: per-user policies compared user_id to
--    auth.uid() directly, but these tables FK user_id -> users.id
--    (the DB primary key), never the auth id. The policies matched
--    nothing (deny-by-default, safe but non-functional). Rewrite
--    them through public.is_owner(user_id) so ownership resolves
--    via the users table, matching 20260804000000.
-- ================================================================

-- 1. Drop the public exposure policies (both naming schemes seen live).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true')
      AND roles @> '{public}'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 2. Rewrite per-user ownership policies through is_owner() + authenticated.
DO $$
DECLARE
  t TEXT;
  friendly TEXT;
  policy_names TEXT[];
  p TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_summary_cache','alert_rules','integration_scopes','triggered_alerts',
    'user_tasks','ai_conversations','ai_tool_calls','ai_workspace_memory',
    'briefings','briefing_schedules','notification_center','notification_history',
    'notification_preferences','telegram_connections','briefing_history'
  ]
  LOOP
    -- Drop every existing policy on this table, both naming schemes.
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;

    -- Recreate ownership policies scoped to authenticated, resolving
    -- ownership through the users table (is_owner handles the FK).
    EXECUTE format('CREATE POLICY "Users can view own %I" ON public.%I FOR SELECT TO authenticated USING (public.is_owner(user_id))', t, t);
    EXECUTE format('CREATE POLICY "Users can insert own %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_owner(user_id))', t, t);
    EXECUTE format('CREATE POLICY "Users can update own %I" ON public.%I FOR UPDATE TO authenticated USING (public.is_owner(user_id)) WITH CHECK (public.is_owner(user_id))', t, t);
    EXECUTE format('CREATE POLICY "Users can delete own %I" ON public.%I FOR DELETE TO authenticated USING (public.is_owner(user_id))', t, t);
  END LOOP;
END $$;

-- briefing_items and notification_retry_log have no user_id column;
-- they resolve ownership through a parent table subquery. Handle
-- separately: their parent rows are owned via is_owner(), so the
-- subquery must also compare against users.id, not auth.uid().

DO $$
DECLARE
  t TEXT;
  policy_names TEXT[];
  p TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['briefing_items','notification_retry_log','ai_messages','ai_message_files']
  LOOP
    FOR p IN
      SELECT policyname FROM pg_policies
      WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;

    IF t = 'briefing_items' THEN
      EXECUTE 'CREATE POLICY "Users can view own briefing_items" ON public.briefing_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND public.is_owner(b.user_id)))';
      EXECUTE 'CREATE POLICY "Users can update own briefing_items" ON public.briefing_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND public.is_owner(b.user_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.briefings b WHERE b.id = briefing_id AND public.is_owner(b.user_id)))';
    ELSIF t = 'notification_retry_log' THEN
      EXECUTE 'CREATE POLICY "Users can view own notification_retry_log" ON public.notification_retry_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.notification_history h WHERE h.id = notification_id AND public.is_owner(h.user_id)))';
    ELSIF t = 'ai_messages' THEN
      EXECUTE 'CREATE POLICY "Users can view own ai_messages" ON public.ai_messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND public.is_owner(c.user_id)))';
      EXECUTE 'CREATE POLICY "Users can insert own ai_messages" ON public.ai_messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND public.is_owner(c.user_id)))';
      EXECUTE 'CREATE POLICY "Users can update own ai_messages" ON public.ai_messages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND public.is_owner(c.user_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND public.is_owner(c.user_id)))';
    ELSE
      EXECUTE 'CREATE POLICY "Users can view own ai_message_files" ON public.ai_message_files FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND public.is_owner(c.user_id)))';
      EXECUTE 'CREATE POLICY "Users can insert own ai_message_files" ON public.ai_message_files FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND public.is_owner(c.user_id)))';
    END IF;
  END LOOP;
END $$;
