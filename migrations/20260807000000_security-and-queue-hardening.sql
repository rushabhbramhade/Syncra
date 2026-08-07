-- Close RLS policies accidentally granted to PUBLIC by later migrations and
-- make the notification queue's processing claim compatible with its schema.

-- WhatsApp session_data contains reusable Baileys credentials. It is accessed
-- only through the server admin client, which bypasses RLS, so no client role
-- should have a table policy.
DO $$
DECLARE
  policy_name TEXT;
BEGIN
  FOR policy_name IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'whatsapp_sessions'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.whatsapp_sessions',
      policy_name
    );
  END LOOP;
END $$;

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- These tables are written by the admin client. Authenticated users may read
-- only their own records; anonymous and authenticated clients cannot insert,
-- update, or delete audit records directly.
DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'briefing_generation_runs',
    'briefing_message_deliveries'
  ]
  LOOP
    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        policy_name,
        table_name
      );
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_owner(user_id))',
      'Users can view own ' || table_name,
      table_name
    );
  END LOOP;
END $$;

-- The worker atomically claims queued jobs by changing status to processing.
-- Keep this list aligned with NotificationStatus in the repository.
ALTER TABLE public.notification_history
  DROP CONSTRAINT IF EXISTS notification_history_status_check;

ALTER TABLE public.notification_history
  ADD CONSTRAINT notification_history_status_check
  CHECK (status IN (
    'queued',
    'processing',
    'sent',
    'delivered',
    'failed',
    'cancelled',
    'retrying',
    'read',
    'acknowledged'
  ));

-- Atomic fixed-window rate limiting for paid and public server endpoints.
-- No client policies are created; only the admin client may access this table.
CREATE TABLE IF NOT EXISTS public.rate_limits (
  user_id UUID NOT NULL,
  bucket TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  window_start TIMESTAMPTZ NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bucket)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_at
  ON public.rate_limits(reset_at);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_user_id UUID,
  p_bucket TEXT,
  p_window_ms INTEGER,
  p_max_requests INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at_ms BIGINT,
  retry_after_ms BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_time TIMESTAMPTZ := clock_timestamp();
  window_duration INTERVAL;
  current_row public.rate_limits%ROWTYPE;
BEGIN
  IF p_window_ms <= 0 OR p_max_requests <= 0 THEN
    RAISE EXCEPTION 'Invalid rate limit configuration';
  END IF;

  window_duration := p_window_ms * INTERVAL '1 millisecond';

  INSERT INTO public.rate_limits AS limits (
    user_id,
    bucket,
    count,
    window_start,
    reset_at,
    updated_at
  )
  VALUES (
    p_user_id,
    p_bucket,
    1,
    current_time,
    current_time + window_duration,
    current_time
  )
  ON CONFLICT (user_id, bucket) DO UPDATE
  SET
    count = CASE
      WHEN limits.reset_at <= current_time THEN 1
      ELSE limits.count + 1
    END,
    window_start = CASE
      WHEN limits.reset_at <= current_time THEN current_time
      ELSE limits.window_start
    END,
    reset_at = CASE
      WHEN limits.reset_at <= current_time THEN current_time + window_duration
      ELSE limits.reset_at
    END,
    updated_at = current_time
  RETURNING limits.* INTO current_row;

  RETURN QUERY SELECT
    current_row.count <= p_max_requests,
    GREATEST(p_max_requests - current_row.count, 0),
    FLOOR(EXTRACT(EPOCH FROM current_row.reset_at) * 1000)::BIGINT,
    CASE
      WHEN current_row.count <= p_max_requests THEN 0::BIGINT
      ELSE GREATEST(
        FLOOR(EXTRACT(EPOCH FROM (current_row.reset_at - current_time)) * 1000)::BIGINT,
        0::BIGINT
      )
    END;
END;
$$;

REVOKE ALL ON TABLE public.rate_limits FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT ALL ON TABLE public.rate_limits TO project_admin;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO project_admin;
