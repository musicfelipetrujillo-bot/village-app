-- 111_week_nudge_push.sql
-- "Baby's week" retention pushes — milestone-anticipating nudges + a dormant
-- winback. Decisions (Felipe, 2026-07-30):
--   · fires on HER baby's rollover day at 10am LOCAL (not a global blast)
--   · copy is AI-generated once per week, cached here, reviewable/editable
--   · scope = weekly nudge + dormant winback
--   · its own opt-out (`notif_prefs.baby_week`), ON by default
--
-- SAFETY POSTURE (read before editing copy): these notifications name
-- developmental milestones to a postpartum audience. Milestone copy that
-- reads as a deadline ("your baby should be walking by now") causes real
-- parental anxiety and is exactly the tone the Risk & Compliance doc keeps
-- us away from. Every row is therefore constrained to INVITATION framing —
-- "curious whether…", "some babies start around now" — never "should",
-- never a comparison to other babies, never a claim that absence is a
-- problem. The generator prompt enforces it and `week_nudges_copy_safe`
-- CHECK below is the last line of defense.

-- ── (1) notif_prefs — add `baby_week`, default TRUE ─────────────────────────
-- Content nudges about her own baby's week are the core loop of the product,
-- so they default ON (unlike `promotions`/`newsletter`, which are opt-in
-- marketing under CAN-SPAM/FTC). Quiet hours still apply.
UPDATE users
SET notif_prefs = jsonb_set(
  COALESCE(notif_prefs, '{}'::jsonb), '{baby_week}', 'true'::jsonb, TRUE
)
WHERE (notif_prefs ? 'baby_week') = FALSE;

ALTER TABLE users ALTER COLUMN notif_prefs SET DEFAULT
  '{"events":true,"groups":true,"specialists":true,"milk_hub":true,"articles":true,"ai":true,"promotions":false,"newsletter":false,"trending":true,"baby_week":true,"quiet_hours":{"enabled":false,"start_hour":22,"end_hour":7,"tz":"America/New_York"}}'::jsonb;

-- ── (2) week_nudges — the cached push copy ──────────────────────────────────
-- One row per (week, locale, kind, variant). `variant` lets a week carry a
-- couple of alternate hooks later (A/B or "second time she reaches week N"
-- for a second baby) without a schema change; today everything is variant 1.
CREATE TABLE IF NOT EXISTS week_nudges (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind           TEXT NOT NULL DEFAULT 'week' CHECK (kind IN ('week', 'winback')),
  -- NULL for winback copy (not week-specific).
  week_number    INT CHECK (week_number BETWEEN 0 AND 104),
  locale         TEXT NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'es')),
  variant        INT  NOT NULL DEFAULT 1 CHECK (variant BETWEEN 1 AND 9),
  -- iOS truncates hard: keep the title short and the body one breath long.
  title          TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 48),
  body           TEXT NOT NULL CHECK (char_length(body)  BETWEEN 10 AND 160),
  -- Where the tap lands. Parsed by apps/mobile/src/lib/deeplink.ts.
  deeplink       TEXT NOT NULL DEFAULT 'villie://home',
  -- Which milestone_library category inspired the hook (analytics only).
  hook_category  TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  generator      TEXT,                     -- e.g. 'haiku-4.5-v1' / 'hand'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULLS NOT DISTINCT (PG15+) is load-bearing: winback rows carry a NULL
  -- week_number, and under the default NULLS-DISTINCT rule they would never
  -- collide — the ON CONFLICT below would silently insert a duplicate on
  -- every re-run of this migration.
  UNIQUE NULLS NOT DISTINCT (kind, week_number, locale, variant)
);

-- Anxiety guard. Blocks the deadline/comparison phrasings outright so a
-- future generator change (or a hand edit) can't quietly ship "your baby
-- should be crawling by now". Case-insensitive, EN + ES.
ALTER TABLE week_nudges DROP CONSTRAINT IF EXISTS week_nudges_copy_safe;
-- ("behind" alone is too broad — "the reason behind the fussiness" is fine —
-- so only the comparative/deficit phrasings are blocked.)
ALTER TABLE week_nudges ADD CONSTRAINT week_nudges_copy_safe CHECK (
  (title || ' ' || body) !~* '(should be|should have|should already|must be|by now|falling behind|is behind|other babies|than other|normal babies|debería|deberia|atrasad|retrasad|otros bebés|otros bebes|ya tendría|ya tendria)'
);

CREATE INDEX IF NOT EXISTS idx_week_nudges_lookup
  ON week_nudges (kind, week_number, locale) WHERE is_active = TRUE;

ALTER TABLE week_nudges ENABLE ROW LEVEL SECURITY;
-- Content, not user data: readable by the app (so a future in-app preview or
-- the Notifications list can render the same copy), writable only by the
-- generator running as service_role.
DROP POLICY IF EXISTS week_nudges_read ON week_nudges;
CREATE POLICY week_nudges_read ON week_nudges
  FOR SELECT TO authenticated USING (is_active = TRUE);

-- ── (3) push_sends — the dedupe ledger ──────────────────────────────────────
-- The GH Actions cron retries once on a non-2xx, and the weekly job runs
-- HOURLY (to catch each user's 10am local), so the sender WILL be invoked
-- many times per user per week. UNIQUE(user_id, kind, dedupe_key) is what
-- makes "send at most once" true. Mirrors newsletter_sends (migration 067).
--   dedupe_key: 'week:<n>' for the weekly nudge, 'winback:<iso-week>' for the
--   dormant nudge — so a winback can recur in a later week but never twice
--   in the same one.
CREATE TABLE IF NOT EXISTS push_sends (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('week', 'winback', 'checkin')),
  dedupe_key  TEXT NOT NULL,
  nudge_id    UUID REFERENCES week_nudges(id) ON DELETE SET NULL,
  title       TEXT,
  body        TEXT,
  deeplink    TEXT,
  -- 'sent' | 'skipped_prefs' | 'skipped_quiet' | 'failed' — we ledger the
  -- skips too, otherwise an opted-out user gets re-evaluated every hour and
  -- we can't tell "never eligible" from "never delivered" in analytics.
  outcome     TEXT NOT NULL DEFAULT 'sent',
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_push_sends_user ON push_sends (user_id, sent_at DESC);
ALTER TABLE push_sends ENABLE ROW LEVEL SECURITY;
-- service-role only (no policies) — same posture as pro_subscription_events.

-- ── (4) list_week_nudge_recipients ──────────────────────────────────────────
-- Returns the users who should get a "baby's week" push RIGHT NOW.
--
-- Timing: the cron runs hourly; a user is picked up on the single hour where
-- her LOCAL time is p_local_hour (default 10). Timezone comes from her quiet
-- hours setting (the only tz we store), falling back to America/New_York —
-- Miami-first launch, and the ledger means a wrong guess costs at most a
-- badly-timed send, never a duplicate.
--
-- Rollover: baby enters week N on the weekday she was born, so we fire when
-- the local date is exactly a multiple of 7 days after DOB (adjusted for a
-- preemie's corrected age, same offset the app's week math uses).
CREATE OR REPLACE FUNCTION list_week_nudge_recipients(
  p_local_hour   INT DEFAULT 10,
  p_max_week     INT DEFAULT 52,
  p_active_days  INT DEFAULT 60
) RETURNS TABLE (
  user_id            UUID,
  preferred_language TEXT,
  current_week       INT,
  baby_first_name    TEXT,
  tz                 TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH candidates AS (
    SELECT
      u.id AS user_id,
      COALESCE(u.preferred_language, 'en')                              AS preferred_language,
      COALESCE(u.notif_prefs #>> '{quiet_hours,tz}', 'America/New_York') AS tz,
      bp.date_of_birth
        + make_interval(days => COALESCE(bp.corrected_age_offset_days, 0)) AS anchor,
      bp.baby_name,
      u.notif_prefs
    FROM users u
    JOIN baby_profiles bp ON bp.user_id = u.id
    JOIN auth.users au     ON au.id = u.id
    WHERE u.deleted_at IS NULL
      -- Opt-out honored; missing key reads as opted-in (default TRUE).
      AND COALESCE((u.notif_prefs ->> 'baby_week')::boolean, TRUE) = TRUE
      -- Don't chase users who never came back at all; the winback job owns them.
      AND au.last_sign_in_at > now() - make_interval(days => p_active_days)
  ), localized AS (
    SELECT
      c.*,
      (now() AT TIME ZONE c.tz)::date  AS local_date,
      EXTRACT(HOUR FROM (now() AT TIME ZONE c.tz))::int AS local_hour
    FROM candidates c
  )
  SELECT
    l.user_id,
    l.preferred_language,
    ((l.local_date - l.anchor::date) / 7 + 1)::int AS current_week,
    NULLIF(split_part(COALESCE(l.baby_name, ''), ' ', 1), '') AS baby_first_name,
    l.tz
  FROM localized l
  WHERE l.local_hour = p_local_hour
    -- Rollover day only: exact multiple of 7 days since (corrected) birth.
    AND (l.local_date - l.anchor::date) >= 0
    AND (l.local_date - l.anchor::date) % 7 = 0
    AND ((l.local_date - l.anchor::date) / 7 + 1) BETWEEN 1 AND p_max_week
    AND NOT EXISTS (
      SELECT 1 FROM push_sends ps
      WHERE ps.user_id = l.user_id
        AND ps.kind = 'week'
        AND ps.dedupe_key = 'week:' || ((l.local_date - l.anchor::date) / 7 + 1)::text
    );
$$;
REVOKE EXECUTE ON FUNCTION list_week_nudge_recipients(INT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION list_week_nudge_recipients(INT, INT, INT) TO service_role;

-- ── (5) list_winback_recipients ─────────────────────────────────────────────
-- Dormant users: last sign-in between p_min_days and p_max_days ago. The
-- upper bound is deliberate — past it she has churned and a nudge reads as
-- spam; that's a re-onboarding email problem, not a push problem.
-- One per ISO week maximum, enforced by the ledger key.
CREATE OR REPLACE FUNCTION list_winback_recipients(
  p_local_hour INT DEFAULT 10,
  p_min_days   INT DEFAULT 7,
  p_max_days   INT DEFAULT 45
) RETURNS TABLE (
  user_id            UUID,
  preferred_language TEXT,
  current_week       INT,
  baby_first_name    TEXT,
  tz                 TEXT,
  dedupe_key         TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  WITH candidates AS (
    SELECT
      u.id AS user_id,
      COALESCE(u.preferred_language, 'en')                               AS preferred_language,
      COALESCE(u.notif_prefs #>> '{quiet_hours,tz}', 'America/New_York') AS tz,
      bp.date_of_birth + make_interval(days => COALESCE(bp.corrected_age_offset_days, 0)) AS anchor,
      bp.baby_name,
      au.last_sign_in_at
    FROM users u
    JOIN auth.users au      ON au.id = u.id
    LEFT JOIN baby_profiles bp ON bp.user_id = u.id
    WHERE u.deleted_at IS NULL
      AND COALESCE((u.notif_prefs ->> 'baby_week')::boolean, TRUE) = TRUE
      AND au.last_sign_in_at IS NOT NULL
      AND au.last_sign_in_at <  now() - make_interval(days => p_min_days)
      AND au.last_sign_in_at >= now() - make_interval(days => p_max_days)
  ), localized AS (
    SELECT
      c.*,
      (now() AT TIME ZONE c.tz)::date                    AS local_date,
      EXTRACT(HOUR FROM (now() AT TIME ZONE c.tz))::int  AS local_hour
    FROM candidates c
  )
  SELECT
    l.user_id,
    l.preferred_language,
    CASE WHEN l.anchor IS NULL THEN NULL
         ELSE GREATEST(1, LEAST(104, ((l.local_date - l.anchor::date) / 7 + 1)))::int
    END AS current_week,
    NULLIF(split_part(COALESCE(l.baby_name, ''), ' ', 1), '') AS baby_first_name,
    l.tz,
    'winback:' || to_char(l.local_date, 'IYYY-"W"IW') AS dedupe_key
  FROM localized l
  WHERE l.local_hour = p_local_hour
    AND NOT EXISTS (
      SELECT 1 FROM push_sends ps
      WHERE ps.user_id = l.user_id
        AND ps.kind = 'winback'
        AND ps.dedupe_key = 'winback:' || to_char(l.local_date, 'IYYY-"W"IW')
    )
    -- Never stack a winback on top of a week nudge she got in the last 3 days.
    AND NOT EXISTS (
      SELECT 1 FROM push_sends ps2
      WHERE ps2.user_id = l.user_id
        AND ps2.sent_at > now() - INTERVAL '3 days'
        AND ps2.outcome = 'sent'
    );
$$;
REVOKE EXECUTE ON FUNCTION list_winback_recipients(INT, INT, INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION list_winback_recipients(INT, INT, INT) TO service_role;

-- ── (6) week_nudge_source — what the generator reads per week ───────────────
-- Bundles the already-approved per-week content so `ai-week-nudge-generate`
-- can write a hook grounded in real milestone copy instead of inventing
-- developmental claims. Returns NULL-safe empty text when a week has no
-- weekly_journey rows (weeks 13+ today).
CREATE OR REPLACE FUNCTION week_nudge_source(p_week INT)
RETURNS TABLE (
  week_number     INT,
  milestone_title TEXT,
  milestone_body  TEXT,
  milestone_cat   TEXT,
  insight_titles  TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    p_week,
    ml.title,
    COALESCE(ml.ai_summary_cache, ml.description),
    ml.category,
    COALESCE((
      SELECT string_agg(mi.title, ' · ' ORDER BY mi.id)
      FROM maternal_insights mi
      WHERE mi.week_number = p_week AND mi.review_status = 'approved'
    ), '')
  FROM milestone_library ml
  WHERE ml.week_number = p_week
  ORDER BY ml.category
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION week_nudge_source(INT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION week_nudge_source(INT) TO service_role;

-- ── (7) Winback copy (hand-authored — never AI, it's tone-critical) ─────────
-- Warm, zero guilt, no "we miss you" guilt-trip and no implication she has
-- neglected anything. One variant each, EN + ES.
INSERT INTO week_nudges (kind, week_number, locale, variant, title, body, deeplink, generator)
VALUES
  ('winback', NULL, 'en', 1,
   'still here whenever you need us',
   'no catching up required — your week is waiting exactly where you left it.',
   'villie://home', 'hand'),
  ('winback', NULL, 'es', 1,
   'aquí seguimos, cuando nos necesites',
   'no hay nada que ponerse al día — tu semana te espera justo donde la dejaste.',
   'villie://home', 'hand')
ON CONFLICT (kind, week_number, locale, variant) DO NOTHING;
