-- ================================================================
-- Migration: Fix no-op RLS ownership policies on intelligence tables.
--
-- user_rules, user_feedback, classification_audit, ai_decision_log,
-- user_dashboard_layout and ai_user_memory reference users.id (the DB
-- primary key) via their user_id FK, but their policies compared
-- user_id directly to auth.uid() — which is the auth id, never the
-- DB PK — so the policies matched nothing (deny-by-default, safe, but
-- non-functional for direct client access). Rewrite them to resolve
-- ownership through the users table mapping, matching the pattern in
-- 20260723000000_fix-child-rls-ownership.sql.
-- ================================================================

CREATE OR REPLACE FUNCTION public.is_owner(table_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = table_user_id AND u.auth_user_id = auth.uid()
  )
$$;

DO $$
DECLARE
  t TEXT;
  friendly TEXT;
  policy_names TEXT[];
  p TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_rules','user_feedback','classification_audit','ai_decision_log','user_dashboard_layout','ai_user_memory']
  LOOP
    -- Map table to the friendly names used by the original migration.
    CASE t
      WHEN 'user_rules' THEN friendly := 'rules';
      WHEN 'user_feedback' THEN friendly := 'feedback';
      WHEN 'classification_audit' THEN friendly := 'classification audit';
      WHEN 'ai_decision_log' THEN friendly := 'decision log';
      WHEN 'user_dashboard_layout' THEN friendly := 'dashboard layout';
      ELSE friendly := 'memory';
    END CASE;

    EXECUTE format('DROP POLICY IF EXISTS "Users can view own %s" ON public.%I', friendly, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %s" ON public.%I', friendly, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update own %s" ON public.%I', friendly, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %s" ON public.%I', friendly, t);

    EXECUTE format('DROP POLICY IF EXISTS "Users can view own %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can insert own %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can update own %I" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Users can delete own %I" ON public.%I', t, t);

    -- Recreate with ownership resolved through the users table.
    EXECUTE format('CREATE POLICY "Users can view own %I" ON public.%I FOR SELECT TO authenticated USING (public.is_owner(user_id))', t, t);
    EXECUTE format('CREATE POLICY "Users can insert own %I" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_owner(user_id))', t, t);
    EXECUTE format('CREATE POLICY "Users can update own %I" ON public.%I FOR UPDATE TO authenticated USING (public.is_owner(user_id)) WITH CHECK (public.is_owner(user_id))', t, t);
    EXECUTE format('CREATE POLICY "Users can delete own %I" ON public.%I FOR DELETE TO authenticated USING (public.is_owner(user_id))', t, t);
  END LOOP;
END $$;

-- is_owner(uuid) helper is intentionally kept: policies depend on it.
