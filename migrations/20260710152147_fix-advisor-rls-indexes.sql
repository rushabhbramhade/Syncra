-- Migration to address all 11 security and performance advisor recommendations for RLS and foreign key indexing.

-- 1. Create index on foreign key / filter column public.files(user_id) if not exists
CREATE INDEX IF NOT EXISTS idx_files_user_id ON public.files(user_id);

-- 2. Drop existing policies on public.users
DROP POLICY IF EXISTS "Allow public read access to users table" ON public.users;
DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.users;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.users;

-- Recreate policies on public.users using (select auth.uid()) wrapper to optimize performance
CREATE POLICY "Allow users to select their own profile" ON public.users
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = auth_user_id);

CREATE POLICY "Allow users to update their own profile" ON public.users
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = auth_user_id);

CREATE POLICY "Allow users to insert their own profile" ON public.users
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = auth_user_id);


-- 3. Drop existing policies on public.files
DROP POLICY IF EXISTS "Allow users to delete their own files" ON public.files;
DROP POLICY IF EXISTS "Allow users to update their own files" ON public.files;
DROP POLICY IF EXISTS "Allow users to insert their own files" ON public.files;
DROP POLICY IF EXISTS "Allow users to select their own files" ON public.files;

-- Recreate policies on public.files using (select auth.uid()) wrapper to optimize performance
CREATE POLICY "Allow users to delete their own files" ON public.files
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Allow users to update their own files" ON public.files
  FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Allow users to insert their own files" ON public.files
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Allow users to select their own files" ON public.files
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
