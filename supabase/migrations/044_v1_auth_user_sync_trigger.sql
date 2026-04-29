-- V1 — auth.users → public.users mirror trigger
--
-- Replaces the client-side insert in `apps/mobile/src/lib/auth.ts` that fired
-- right after `supabase.auth.signUp()`. That call worked locally (where
-- email-confirm is off by default and `signUp` returns a logged-in session)
-- but **silently RLS-blocked on hosted** because hosted requires email
-- confirmation, `signUp` returns `session=null`, and the subsequent
-- `from('users').insert()` runs as anon. The result: every new hosted user
-- was missing their `public.users` row, breaking every screen that joins on
-- it (profile, milestone hero, reviewer flag, milk donor record, etc).
--
-- See project memory `project_signup_public_users_sync_bug.md` for the full
-- discovery (2026-04-27, first hosted reviewer signup landed in
-- auth.users:eb2c4fc7… with no public.users row).
--
-- This trigger runs as SECURITY DEFINER so it bypasses RLS — that's
-- intentional: GoTrue (the auth schema owner) is the only caller, and the
-- function only reads from `NEW` plus does one INSERT into a single
-- known-safe table with ON CONFLICT DO NOTHING.

-- ---------------------------------------------------------------------------
-- 1. Mirror function — minimal column set, defaults handle the rest.
-- ---------------------------------------------------------------------------
-- We pull `full_name` out of `raw_user_meta_data` because `authService.signUp`
-- in `lib/auth.ts` passes `options: { data: { full_name } }`. If a future
-- signup path skips that (e.g., social auth), `full_name` falls back to
-- empty string — the column is NOT NULL with no default in some migration
-- variants, so the COALESCE prevents a constraint violation from breaking
-- auth.signUp itself (which would otherwise leave the user un-creatable).
--
-- preferred_language hardcoded to 'en' to match the prior client-side
-- behavior; OnboardingProfileScreen / EditProfile let the user change it
-- later.
--
-- ON CONFLICT DO NOTHING makes the trigger idempotent — if the client-side
-- insert in `auth.ts` is still there during deploy and somehow succeeds
-- first, the trigger is a no-op rather than a duplicate-key error.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, preferred_language)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'en'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Trigger — fire after every auth.users INSERT.
-- ---------------------------------------------------------------------------
-- AFTER INSERT (not BEFORE) so the auth.users row is already committed —
-- we don't want to break account creation if the mirror fails. If
-- public.users INSERT errors for some reason, the auth.users row still
-- exists and the user can sign in; admin can repair the mirror manually.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- 3. Backfill — repair any auth.users rows missing their public.users mirror.
-- ---------------------------------------------------------------------------
-- On hosted (2026-04-27) the felitrujillo95 reviewer was already manually
-- repaired via service-role REST. This UPSERT is idempotent: it inserts the
-- mirror for any auth user where the public row is missing, leaves existing
-- rows untouched. On local Supabase this should be a no-op (every signup
-- worked there).
INSERT INTO public.users (id, email, full_name, preferred_language)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  'en'
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.id = au.id
 WHERE pu.id IS NULL
   AND au.email IS NOT NULL
ON CONFLICT (id) DO NOTHING;
