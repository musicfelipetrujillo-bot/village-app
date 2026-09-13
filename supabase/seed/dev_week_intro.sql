-- dev_week_intro.sql — DEV/STAGING ONLY. Do not run against production.
--
-- Why this file exists
-- -------------------
-- The Manual tab's week-intro hero (the video card above the chapter chips)
-- renders only under `{weekIntro && …}` in ManualScrollV3.tsx. `weekIntro`
-- comes from the `get_manual_week_intro` RPC (110_villie_pro_entitlement.sql),
-- which needs a `manual_week_intro` row matching audience + week + locale
-- EXACTLY, published, with a non-null mux_playback_id.
--
-- As of 2026-09-13 `manual_week_intro` had 0 rows on every environment
-- (docs/PRO_VIDEO_LAUNCH_RUNBOOK.md tracks the content backlog), and the
-- fabricated-clinician placeholder that used to fill the gap was removed in
-- acc143c. So the slot is legitimately empty and the hero is invisible. Check
-- before assuming that is still true:
--   SELECT week_number, locale, is_published FROM manual_week_intro;
--
-- This seeds ONE week so the card can be seen and worked on.
--
-- What it deliberately does NOT do
-- --------------------------------
-- No expert name, no expert role, no clinical attribution of any kind. That is
-- the exact failure acc143c removed: a public Mux sample clip presented as
-- reviewed guidance from a pediatrician who does not exist. The byline row in
-- WeekIntroCard is hidden when both fields are NULL, so the card renders as an
-- unattributed sample — which is what it is.
--
-- The playback id below is Mux's public demo asset. It plays, so the tap-through
-- into ManualVideoScreen is exercisable, but it is visibly not villie content.
--
-- Safety: `pro_launch_readiness()` takes min() across mom+baby (and the locales
-- in pro_launch_targets), so seeding baby weeks leaves mom at 0 and the
-- `pro_video_gate` guard stays shut. This cannot accidentally open the paywall.
--
-- Prerequisite (hit on 2026-09-13): migration 110 must be applied, or the
-- hero stays invisible no matter what this file inserts. `getWeekIntroVideo`
-- ONLY calls the `get_manual_week_intro` RPC and fails soft to null, so a DB
-- behind 110 hides the slot with nothing but a `[manual] getWeekIntroVideo`
-- console warning. Check before blaming the data:
--   SELECT to_regprocedure('get_manual_week_intro(text,int,text)');
--
-- Not auto-run. Unlike supabase/seed.sql (which `supabase db reset` executes),
-- everything under supabase/seed/ is run by hand. Paste into the Supabase
-- Studio SQL editor, or:
--   psql "$DATABASE_URL" -f supabase/seed/dev_week_intro.sql

DO $$
DECLARE
  -- Set this to the account you're testing with. The week is read from that
  -- baby's live `current_week_number` so the seeded row lands on the week the
  -- Manual tab will actually ask for. Default is the local `supabase db reset`
  -- test account; change it when pointing at another database.
  v_email TEXT := 'rey@village.test';

  -- Fallback when the email above resolves to no baby profile (fresh local DB).
  v_week_fallback INT := 1;

  v_week INT;
BEGIN
  SELECT bpw.current_week_number
    INTO v_week
    FROM baby_profiles_with_week bpw
    JOIN auth.users u ON u.id = bpw.user_id   -- baby_profiles.user_id FKs auth.users
   WHERE lower(u.email) = lower(v_email)
   ORDER BY bpw.created_at
   LIMIT 1;

  IF v_week IS NULL THEN
    v_week := v_week_fallback;
    RAISE NOTICE 'No baby profile for %, seeding fallback week %', v_email, v_week;
  ELSE
    RAISE NOTICE 'Seeding week % (current week for %)', v_week, v_email;
  END IF;

  -- Both locales: `get_manual_week_intro` matches locale exactly with no `en`
  -- fallback, so an es-preferred test account would otherwise still see nothing.
  INSERT INTO manual_week_intro (
    audience, week_number, locale, title,
    expert_name, expert_role,
    mux_playback_id, poster_url, duration_seconds, is_published
  )
  VALUES
    ('baby', v_week, 'en', 'Sample clip — not villie content',
     NULL, NULL, 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe', NULL, 96, TRUE),
    ('baby', v_week, 'es', 'Video de prueba — no es contenido de villie',
     NULL, NULL, 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe', NULL, 96, TRUE)
  ON CONFLICT (audience, week_number, locale) DO UPDATE
    SET title            = EXCLUDED.title,
        expert_name      = NULL,
        expert_role      = NULL,
        mux_playback_id  = EXCLUDED.mux_playback_id,
        duration_seconds = EXCLUDED.duration_seconds,
        is_published     = TRUE,
        updated_at       = now();
END $$;

-- Verify what the app will get (run as the signed-in user, not service_role,
-- if you want to exercise the Pro gate path too):
--   SELECT * FROM get_manual_week_intro('baby', <week>, 'en');

-- Undo:
--   DELETE FROM manual_week_intro
--    WHERE mux_playback_id = 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe';
