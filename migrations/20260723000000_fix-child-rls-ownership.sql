-- ================================================================
-- Migration: Fix no-op RLS ownership policies on child tables.
--
-- user_integrations and files key rows by user_id (references
-- users.id, the DB primary key), but their policies compared
-- user_id directly to auth.uid() — which is the auth id, never the
-- DB PK — so the policies matched nothing (deny-by-default, safe,
-- but non-functional for direct client access). Rewrite them to
-- resolve ownership through the users table mapping.
-- ================================================================

-- user_integrations
DROP POLICY IF EXISTS "user_integrations_policy" ON public.user_integrations;

CREATE POLICY "user_integrations_policy" ON public.user_integrations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_id AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_id AND u.auth_user_id = auth.uid()
    )
  );

-- files
DROP POLICY IF EXISTS "Allow users to delete their own files" ON public.files;
DROP POLICY IF EXISTS "Allow users to update their own files" ON public.files;
DROP POLICY IF EXISTS "Allow users to insert their own files" ON public.files;
DROP POLICY IF EXISTS "Allow users to select their own files" ON public.files;

CREATE POLICY "Allow users to select their own files" ON public.files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_id AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Allow users to insert their own files" ON public.files
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_id AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Allow users to update their own files" ON public.files
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_id AND u.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_id AND u.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Allow users to delete their own files" ON public.files
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = user_id AND u.auth_user_id = auth.uid()
    )
  );
