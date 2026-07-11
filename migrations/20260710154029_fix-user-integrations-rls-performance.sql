-- Migration to address performance advisor recommendation for public.user_integrations RLS policy.

-- Drop existing policy
DROP POLICY IF EXISTS "user_integrations_policy" ON public.user_integrations;

-- Recreate the policy with (SELECT auth.uid()) wrapper to optimize performance
CREATE POLICY "user_integrations_policy" ON public.user_integrations
  FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
