-- Migration: Fix handle_new_user to resolve email unique constraint conflicts by upserting and updating the existing record's auth_user_id.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  provider_name TEXT;
  existing_user_id UUID;
BEGIN
  provider_name := COALESCE(NEW.metadata->>'provider', 'email');

  -- 1. Check if user already exists by auth_user_id
  SELECT id INTO existing_user_id FROM public.users WHERE auth_user_id = NEW.id;

  IF existing_user_id IS NOT NULL THEN
    -- Update by auth_user_id
    UPDATE public.users
    SET
      email = NEW.email,
      full_name = COALESCE(NEW.profile->>'name', NEW.email),
      avatar_url = NEW.profile->>'avatar_url',
      email_verified = COALESCE(NEW.email_verified, FALSE),
      updated_at = CURRENT_TIMESTAMP,
      last_login_at = CURRENT_TIMESTAMP
    WHERE id = existing_user_id;
  ELSE
    -- 2. Check if user already exists by email
    SELECT id INTO existing_user_id FROM public.users WHERE email = NEW.email;

    IF existing_user_id IS NOT NULL THEN
      -- Update by email (associate with new auth_user_id)
      UPDATE public.users
      SET
        auth_user_id = NEW.id,
        full_name = COALESCE(NEW.profile->>'name', NEW.email),
        avatar_url = NEW.profile->>'avatar_url',
        email_verified = COALESCE(NEW.email_verified, FALSE),
        auth_provider = provider_name,
        updated_at = CURRENT_TIMESTAMP,
        last_login_at = CURRENT_TIMESTAMP
      WHERE id = existing_user_id;
    ELSE
      -- 3. Insert new user record
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
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
