-- Migration: Fix handle_new_user trigger function to coalesce created_at, updated_at, and email_verified to prevent NOT NULL constraint violations when they are evaluated as null on auth insertion.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  provider_name TEXT;
BEGIN
  provider_name := COALESCE(NEW.metadata->>'provider', 'email');

  INSERT INTO public.users (
    id,
    auth_user_id,
    email,
    full_name,
    avatar_url,
    auth_provider,
    email_verified,
    created_at,
    updated_at,
    last_login_at
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.email,
    COALESCE(NEW.profile->>'name', NEW.email),
    NEW.profile->>'avatar_url',
    provider_name,
    COALESCE(NEW.email_verified, FALSE),
    COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
    COALESCE(NEW.updated_at, CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (auth_user_id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    email_verified = EXCLUDED.email_verified,
    updated_at = CURRENT_TIMESTAMP,
    last_login_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
