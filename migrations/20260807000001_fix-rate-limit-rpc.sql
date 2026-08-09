-- Fix public.consume_rate_limit: the original 20260807000000 migration used a
-- variable named `current_time`, which collides with PostgreSQL's built-in
-- CURRENT_TIME (even a TIME WITH TIME ZONE), so the insert failed with
-- PG 42804 "expression is of type time with time zone". Rename the variable to
-- clock_ts (still clock_timestamp()) so the fixed-window RPC is executable.
--
-- This is the same repair that the edited 20260807000000 file contains for
-- fresh installs; this migration only corrects databases where the broken
-- function was already applied.

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
  clock_ts TIMESTAMPTZ := clock_timestamp();
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
    clock_ts,
    clock_ts + window_duration,
    clock_ts
  )
  ON CONFLICT (user_id, bucket) DO UPDATE
  SET
    count = CASE
      WHEN limits.reset_at <= clock_ts THEN 1
      ELSE limits.count + 1
    END,
    window_start = CASE
      WHEN limits.reset_at <= clock_ts THEN clock_ts
      ELSE limits.window_start
    END,
    reset_at = CASE
      WHEN limits.reset_at <= clock_ts THEN clock_ts + window_duration
      ELSE limits.reset_at
    END,
    updated_at = clock_ts
  RETURNING limits.* INTO current_row;

  RETURN QUERY SELECT
    current_row.count <= p_max_requests,
    GREATEST(p_max_requests - current_row.count, 0),
    FLOOR(EXTRACT(EPOCH FROM current_row.reset_at) * 1000)::BIGINT,
    CASE
      WHEN current_row.count <= p_max_requests THEN 0::BIGINT
      ELSE GREATEST(
        FLOOR(EXTRACT(EPOCH FROM (current_row.reset_at - clock_ts)) * 1000)::BIGINT,
        0::BIGINT
      )
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(UUID, TEXT, INTEGER, INTEGER) TO project_admin;