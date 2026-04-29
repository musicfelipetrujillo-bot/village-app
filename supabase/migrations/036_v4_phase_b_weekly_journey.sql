-- V4 Phase B — Weekly Journey
-- Mom-focused weekly content lane for the postpartum 0–12 week window.
-- See docs/PHASE_B_WEEKLY_JOURNEY_PROPOSAL.md.
--
-- Scope:
--   1. maternal_insights        — what's happening with mom this week (recovery,
--                                  emotional, sleep, feeding, relationships, identity)
--   2. village_supports         — peer/expert/community/professional connection
--                                  prompts, with optional CTA deeplink into the app
--   3. week_checklists          — interactive to-dos a postpartum mom can tick off
--   4. user_week_checklist_completions — per-user tick-off ledger
--   5. *_i18n side tables       — non-EN translations (parent row stays English-canonical)
--   6. get_weekly_journey RPC   — one call returns the hydrated weekly payload
--                                  (insights + supports + checklists + per-user completions),
--                                  with locale resolution and EN fallback
--   7. Seed weeks 1–3           — mom-focused, clinician-handoff-grade tone (EN+ES);
--                                  weeks 4–12 land in migration 037 after clinical review
--
-- Decision matrix on the three open questions (see PHASE_B proposal §Risks):
--   • Clinical review workflow → stricter than the proposal draft. Every content row
--     carries `review_status` ∈ {pending, approved, rejected} with `reviewed_by` /
--     `reviewed_at` / `review_notes` audit fields. Public RLS only exposes
--     `approved` rows. A separate `clinical_advisor_reviewed BOOLEAN` flag tracks
--     whether a licensed clinical advisor (vs. founder/seed approval) signed off,
--     so the review dashboard can prioritize what still needs medical review.
--   • Localization → side-table approach (`*_i18n` with UNIQUE(parent_id, locale)).
--     Parent row holds EN as canonical; the side-table only carries non-EN
--     locales. The RPC falls back to the parent EN string when a locale row is
--     missing — so partial translations never blank out a card.
--   • Crisis routing → `maternal_insights.requires_crisis_footer BOOLEAN` flag.
--     When TRUE, the renderer pins the same crisis block we use in `daily-checkin`
--     AI replies (988 / 741741 / PSI / 911) below the insight body. Set on
--     bodies that touch PPD, suicidality, or topics where a tired user might
--     read encouragement as deflection from real distress.
--
-- Safety posture:
--   • `pending` is the default for service-role inserts going forward — clinical
--     review is mandatory before publication.
--   • Seed rows inserted in this migration are marked `approved`,
--     `clinical_advisor_reviewed=FALSE`, with `review_notes='Seed content —
--     founder approval; clinical advisor review pending'`. This unblocks
--     development while flagging exactly what still needs medical sign-off.
--   • Week 1 + 3 emotional insights (PPD-adjacent) carry
--     `requires_crisis_footer=TRUE` so the crisis block always renders below them.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. maternal_insights
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE maternal_insights (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number                SMALLINT    NOT NULL CHECK (week_number BETWEEN 1 AND 104),
  category                   TEXT        NOT NULL CHECK (category IN (
                                            'recovery', 'emotional', 'sleep',
                                            'feeding',  'relationships', 'identity'
                                         )),
  title                      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body                       TEXT        NOT NULL CHECK (char_length(body)  BETWEEN 1 AND 1200),
  hero_emoji                 TEXT,
  -- Risk & Compliance §1.4 — bodies touching PPD/suicidality/medical guidance
  -- get this flag so the renderer pins the crisis-resources block below them.
  requires_crisis_footer     BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Operational state. Public RLS only exposes 'approved' rows.
  review_status              TEXT        NOT NULL DEFAULT 'pending'
                                         CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by                UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at                TIMESTAMPTZ,
  review_notes               TEXT,
  -- Did a licensed clinical advisor sign off (vs. founder/seed approval)?
  -- Independent of review_status so the content team can dashboard separately.
  clinical_advisor_reviewed  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maternal_insights_week_approved
  ON maternal_insights(week_number)
  WHERE review_status = 'approved';

CREATE INDEX idx_maternal_insights_review_dashboard
  ON maternal_insights(review_status, clinical_advisor_reviewed, week_number);

ALTER TABLE maternal_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maternal_insights_select_approved" ON maternal_insights
  FOR SELECT USING (review_status = 'approved');
CREATE POLICY "maternal_insights_insert_service" ON maternal_insights
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "maternal_insights_update_service" ON maternal_insights
  FOR UPDATE USING (auth.role() = 'service_role');

-- 1b. maternal_insights_i18n — non-EN translations (EN lives on the parent row)
CREATE TABLE maternal_insights_i18n (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id  UUID        NOT NULL REFERENCES maternal_insights(id) ON DELETE CASCADE,
  locale      TEXT        NOT NULL CHECK (locale IN ('es')),
  title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body        TEXT        NOT NULL CHECK (char_length(body)  BETWEEN 1 AND 1200),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (insight_id, locale)
);
CREATE INDEX idx_mi_i18n_lookup ON maternal_insights_i18n(insight_id, locale);

ALTER TABLE maternal_insights_i18n ENABLE ROW LEVEL SECURITY;
-- Translations follow their parent's review state — no public read of a
-- translation whose parent insight is pending or rejected.
CREATE POLICY "mi_i18n_select_when_parent_approved" ON maternal_insights_i18n
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM maternal_insights mi
      WHERE mi.id = insight_id AND mi.review_status = 'approved'
    )
  );
CREATE POLICY "mi_i18n_insert_service" ON maternal_insights_i18n
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "mi_i18n_update_service" ON maternal_insights_i18n
  FOR UPDATE USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────────────
-- 2. village_supports
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE village_supports (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number                SMALLINT    NOT NULL CHECK (week_number BETWEEN 1 AND 104),
  support_type               TEXT        NOT NULL CHECK (support_type IN (
                                            'peer', 'expert', 'community', 'professional'
                                         )),
  title                      TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body                       TEXT        NOT NULL CHECK (char_length(body)  BETWEEN 1 AND 600),
  hero_emoji                 TEXT,
  -- Optional CTA so a card can deeplink into existing app surfaces.
  -- Format: '<tab>:<route>:<param?>' — e.g. 'experts:home:lactation',
  -- 'milk:DonorSearchList', 'home:DailyCheckin', 'community:room:postpartum'.
  -- Validation lives client-side; treat as opaque from the DB's perspective.
  cta_label                  TEXT        CHECK (cta_label IS NULL OR char_length(cta_label) BETWEEN 1 AND 60),
  cta_target                 TEXT        CHECK (cta_target IS NULL OR char_length(cta_target) BETWEEN 1 AND 200),
  review_status              TEXT        NOT NULL DEFAULT 'pending'
                                         CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by                UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at                TIMESTAMPTZ,
  review_notes               TEXT,
  clinical_advisor_reviewed  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_village_supports_week_approved
  ON village_supports(week_number)
  WHERE review_status = 'approved';

ALTER TABLE village_supports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "village_supports_select_approved" ON village_supports
  FOR SELECT USING (review_status = 'approved');
CREATE POLICY "village_supports_insert_service" ON village_supports
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "village_supports_update_service" ON village_supports
  FOR UPDATE USING (auth.role() = 'service_role');

-- 2b. village_supports_i18n
CREATE TABLE village_supports_i18n (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  support_id  UUID        NOT NULL REFERENCES village_supports(id) ON DELETE CASCADE,
  locale      TEXT        NOT NULL CHECK (locale IN ('es')),
  title       TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body        TEXT        NOT NULL CHECK (char_length(body)  BETWEEN 1 AND 600),
  cta_label   TEXT        CHECK (cta_label IS NULL OR char_length(cta_label) BETWEEN 1 AND 60),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (support_id, locale)
);
CREATE INDEX idx_vs_i18n_lookup ON village_supports_i18n(support_id, locale);

ALTER TABLE village_supports_i18n ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vs_i18n_select_when_parent_approved" ON village_supports_i18n
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM village_supports vs
      WHERE vs.id = support_id AND vs.review_status = 'approved'
    )
  );
CREATE POLICY "vs_i18n_insert_service" ON village_supports_i18n
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "vs_i18n_update_service" ON village_supports_i18n
  FOR UPDATE USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────────────
-- 3. week_checklists
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE week_checklists (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number                SMALLINT    NOT NULL CHECK (week_number BETWEEN 1 AND 104),
  category                   TEXT        NOT NULL CHECK (category IN (
                                            'medical', 'practical', 'emotional', 'household'
                                         )),
  item_text                  TEXT        NOT NULL CHECK (char_length(item_text) BETWEEN 1 AND 240),
  -- Items the clinical team flags as must-do (e.g. 6-week PP visit).
  -- Renders with stronger visual emphasis on the screen.
  is_essential               BOOLEAN     NOT NULL DEFAULT FALSE,
  sort_order                 SMALLINT    NOT NULL DEFAULT 100,
  review_status              TEXT        NOT NULL DEFAULT 'pending'
                                         CHECK (review_status IN ('pending', 'approved', 'rejected')),
  reviewed_by                UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at                TIMESTAMPTZ,
  review_notes               TEXT,
  clinical_advisor_reviewed  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_week_checklists_week_approved
  ON week_checklists(week_number, sort_order)
  WHERE review_status = 'approved';

ALTER TABLE week_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "week_checklists_select_approved" ON week_checklists
  FOR SELECT USING (review_status = 'approved');
CREATE POLICY "week_checklists_insert_service" ON week_checklists
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "week_checklists_update_service" ON week_checklists
  FOR UPDATE USING (auth.role() = 'service_role');

-- 3b. week_checklists_i18n — only item_text needs translation
CREATE TABLE week_checklists_i18n (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_item_id   UUID        NOT NULL REFERENCES week_checklists(id) ON DELETE CASCADE,
  locale              TEXT        NOT NULL CHECK (locale IN ('es')),
  item_text           TEXT        NOT NULL CHECK (char_length(item_text) BETWEEN 1 AND 240),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (checklist_item_id, locale)
);
CREATE INDEX idx_wc_i18n_lookup ON week_checklists_i18n(checklist_item_id, locale);

ALTER TABLE week_checklists_i18n ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wc_i18n_select_when_parent_approved" ON week_checklists_i18n
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM week_checklists wc
      WHERE wc.id = checklist_item_id AND wc.review_status = 'approved'
    )
  );
CREATE POLICY "wc_i18n_insert_service" ON week_checklists_i18n
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "wc_i18n_update_service" ON week_checklists_i18n
  FOR UPDATE USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────────────
-- 4. user_week_checklist_completions — per-user tick-off ledger
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE user_week_checklist_completions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checklist_item_id   UUID        NOT NULL REFERENCES week_checklists(id) ON DELETE CASCADE,
  completed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, checklist_item_id)
);
CREATE INDEX idx_uwcc_user ON user_week_checklist_completions(user_id);

ALTER TABLE user_week_checklist_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uwcc_select_own"   ON user_week_checklist_completions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uwcc_insert_own"   ON user_week_checklist_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uwcc_delete_own"   ON user_week_checklist_completions
  FOR DELETE USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. get_weekly_journey RPC — hydrated payload for the Weekly Journey screen
-- ────────────────────────────────────────────────────────────────────────────
-- One call returns the full week: insights + supports + checklists (with per-user
-- completion state). Locale resolution: when p_locale='es' (or any non-en locale),
-- LEFT JOIN the i18n side-table and COALESCE back to the parent EN row when a
-- translation is missing. Only `review_status='approved'` rows are returned.
CREATE OR REPLACE FUNCTION get_weekly_journey(
  p_week    INT,
  p_locale  TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'week_number', p_week,
    'locale',      p_locale,
    'maternal_insights', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id',                     mi.id,
          'category',               mi.category,
          'title',                  COALESCE(mi_t.title, mi.title),
          'body',                   COALESCE(mi_t.body,  mi.body),
          'hero_emoji',             mi.hero_emoji,
          'requires_crisis_footer', mi.requires_crisis_footer,
          'is_translated',          (mi_t.id IS NOT NULL)
        )
        ORDER BY mi.category
       )
       FROM maternal_insights mi
       LEFT JOIN maternal_insights_i18n mi_t
         ON mi_t.insight_id = mi.id AND mi_t.locale = p_locale
       WHERE mi.week_number = p_week AND mi.review_status = 'approved'
      ), '[]'::jsonb
    ),
    'village_supports', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id',           vs.id,
          'support_type', vs.support_type,
          'title',        COALESCE(vs_t.title, vs.title),
          'body',         COALESCE(vs_t.body,  vs.body),
          'hero_emoji',   vs.hero_emoji,
          'cta_label',    COALESCE(vs_t.cta_label, vs.cta_label),
          'cta_target',   vs.cta_target,
          'is_translated', (vs_t.id IS NOT NULL)
        )
        ORDER BY vs.support_type
       )
       FROM village_supports vs
       LEFT JOIN village_supports_i18n vs_t
         ON vs_t.support_id = vs.id AND vs_t.locale = p_locale
       WHERE vs.week_number = p_week AND vs.review_status = 'approved'
      ), '[]'::jsonb
    ),
    'checklists', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id',           wc.id,
          'category',     wc.category,
          'item_text',    COALESCE(wc_t.item_text, wc.item_text),
          'is_essential', wc.is_essential,
          'sort_order',   wc.sort_order,
          'completed',    (uwcc.id IS NOT NULL),
          'is_translated', (wc_t.id IS NOT NULL)
        )
        ORDER BY wc.sort_order, wc.id
       )
       FROM week_checklists wc
       LEFT JOIN week_checklists_i18n wc_t
         ON wc_t.checklist_item_id = wc.id AND wc_t.locale = p_locale
       LEFT JOIN user_week_checklist_completions uwcc
         ON uwcc.checklist_item_id = wc.id AND uwcc.user_id = auth.uid()
       WHERE wc.week_number = p_week AND wc.review_status = 'approved'
      ), '[]'::jsonb
    )
  )
$$;

GRANT EXECUTE ON FUNCTION get_weekly_journey(INT, TEXT) TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────────────────
-- 6. Seed weeks 1–3 (postpartum core, EN+ES)
-- ────────────────────────────────────────────────────────────────────────────
-- Tone target: clinician-handoff-grade, calm, second-person familiar. Same bar
-- as the existing milestone_library seed. Marked `approved` /
-- `clinical_advisor_reviewed=FALSE` so the build can proceed in parallel with
-- the actual medical review pass.
--
-- Convention used below: a CTE `INSERT … RETURNING id` plus a follow-on
-- `INSERT INTO _i18n` that selects from the CTE. Verbose, but each row's EN
-- and ES sit next to each other so the translator can read them as pairs.

-- ─── Week 1 — the first 7 days ───────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (
    week_number, category, title, body, hero_emoji,
    requires_crisis_footer, review_status, clinical_advisor_reviewed,
    review_notes
  ) VALUES (
    1, 'recovery',
    'Your body is doing the slow work',
    'The first week is not about bouncing back — it is about healing. Bleeding (lochia) is heaviest now and will gradually shift from bright red to pink to yellow over the coming weeks. Your uterus is contracting back down. Stairs feel longer. Sitting still hurts in places you didn''t know existed. Rest when the baby rests is not a cliché — it is medical advice.',
    '🌱',
    FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body)
SELECT id, 'es',
  'Tu cuerpo está haciendo el trabajo lento',
  'La primera semana no se trata de recuperarte rápido — se trata de sanar. El sangrado (loquios) es más abundante ahora y poco a poco pasará de rojo brillante a rosado y a amarillo en las próximas semanas. Tu útero se está contrayendo. Las escaleras se sienten más largas. Sentarte duele en lugares que no sabías que existían. Descansa cuando el bebé descanse — no es un consejo trillado, es una indicación médica.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (
    week_number, category, title, body, hero_emoji,
    requires_crisis_footer, review_status, clinical_advisor_reviewed,
    review_notes
  ) VALUES (
    1, 'emotional',
    'The cry of relief, and the cry that isn''t',
    'In the first days, hormones drop fast. You may cry without knowing why — over the baby, over a song, over nothing. That is the baby blues, and it usually softens by week two. But if the heaviness sharpens — if you feel detached from the baby, hopeless, or have thoughts of harming yourself or them — that is not weakness and it is not a phase to push through. Reach out today. The crisis lines below are answered by people trained for exactly this.',
    '💧',
    TRUE, 'approved', FALSE,
    'Seed content — PPD-adjacent; crisis footer required; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body)
SELECT id, 'es',
  'El llanto de alivio, y el que no lo es',
  'En los primeros días, las hormonas bajan rápido. Puedes llorar sin saber por qué — por el bebé, por una canción, por nada. Eso es la melancolía posparto, y suele suavizarse hacia la segunda semana. Pero si la pesadez se vuelve más aguda — si te sientes desconectada del bebé, sin esperanza, o tienes pensamientos de hacerte daño o de hacerle daño a tu bebé — eso no es debilidad ni una fase que tengas que aguantar sola. Pide ayuda hoy. Las líneas de crisis abajo son atendidas por personas entrenadas exactamente para esto.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (
    week_number, category, title, body, hero_emoji,
    requires_crisis_footer, review_status, clinical_advisor_reviewed,
    review_notes
  ) VALUES (
    1, 'sleep',
    'Sleep is a stranger right now',
    'Newborn sleep is scattered across all 24 hours — 16 to 18 total, but in 1–3 hour stretches at most. Your sleep will mirror that. The "sleep when the baby sleeps" advice is real, even if it means letting the dishes sit and the laundry pile grow. Day-night confusion is normal in the first weeks; bright daylight in the morning and dim light at night gently helps reset it.',
    '🌙',
    FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body)
SELECT id, 'es',
  'Dormir es un desconocido ahora',
  'El sueño del recién nacido se reparte en las 24 horas — entre 16 y 18 horas en total, pero en bloques de 1 a 3 horas como máximo. Tu sueño se va a parecer al suyo. El consejo de "duerme cuando el bebé duerma" es real, aunque signifique dejar los platos y que la ropa se acumule. La confusión entre día y noche es normal en las primeras semanas; la luz natural de la mañana y la luz tenue de la noche ayudan suavemente a reajustarla.'
FROM new_row;

-- Village supports — week 1
WITH new_row AS (
  INSERT INTO village_supports (
    week_number, support_type, title, body, hero_emoji,
    cta_label, cta_target,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    1, 'professional',
    'Lactation help in the first week',
    'If feeding hurts beyond a quick latch-and-release pinch, or if the baby isn''t producing 6+ wet diapers a day by day five, a lactation consultant in the first week saves weeks of pain later. Most insurance covers at least one visit.',
    '🤱',
    'Find a lactation consultant', 'experts:home:lactation',
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label)
SELECT id, 'es',
  'Apoyo en lactancia en la primera semana',
  'Si dar pecho duele más allá de un pellizco rápido al agarrarse, o si el bebé no llega a 6 o más pañales mojados al día para el quinto día, una consultora de lactancia en la primera semana te ahorra semanas de dolor después. La mayoría de los seguros cubren al menos una visita.',
  'Buscar consultora de lactancia'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (
    week_number, support_type, title, body, hero_emoji,
    cta_label, cta_target,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    1, 'community',
    'You are not the first to feel this',
    'The postpartum room in the Village is full of moms in week 1, 2, 3. Reading what someone wrote at 3 a.m. last night can be enough to make this hour bearable.',
    '💞',
    'Open postpartum room', 'community:room:postpartum',
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label)
SELECT id, 'es',
  'No eres la primera en sentir esto',
  'La sala de posparto en The Village está llena de mamás en la semana 1, 2, 3. Leer lo que alguien escribió a las 3 de la mañana anoche puede ser suficiente para hacer que esta hora sea más llevadera.',
  'Abrir sala de posparto'
FROM new_row;

-- Checklist — week 1
WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    1, 'medical',
    'Watch bleeding: soaking a pad an hour, large clots, or fever over 100.4°F → call your provider.',
    TRUE, 10,
    'approved', FALSE,
    'Seed content — clinical red-flag list; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Vigila el sangrado: empapar una toalla por hora, coágulos grandes o fiebre de más de 38°C → llama a tu proveedor.'
FROM new_row;

WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    1, 'practical',
    'Set up a feeding station within arm''s reach of where you sit most: water, snacks, phone charger, burp cloths.',
    FALSE, 20,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Arma una estación de alimentación al alcance de donde te sientas más: agua, snacks, cargador del teléfono, paños para eructos.'
FROM new_row;

WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    1, 'emotional',
    'Tell one trusted person how you actually feel today — not the polite version.',
    FALSE, 30,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Cuéntale a una persona de confianza cómo te sientes de verdad hoy — no la versión amable.'
FROM new_row;

WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    1, 'household',
    'Outsource one household task this week — meals, laundry, or older-child care. Accept help when offered.',
    FALSE, 40,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Delega una tarea del hogar esta semana — comidas, lavandería o cuidado de un hijo mayor. Acepta la ayuda cuando te la ofrezcan.'
FROM new_row;

-- ─── Week 2 ────────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (
    week_number, category, title, body, hero_emoji,
    requires_crisis_footer, review_status, clinical_advisor_reviewed,
    review_notes
  ) VALUES (
    2, 'recovery',
    'Day 8–14: the in-between',
    'Bleeding is lighter but still there. If you had stitches, they are starting to dissolve — sitting on a folded towel can help. Constipation is common; water, fiber, and a stool softener if your provider okayed one keeps the first bowel movements from becoming their own crisis. You may notice your hands and feet are still puffy — that fluid takes weeks to fully leave.',
    '🌿',
    FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body)
SELECT id, 'es',
  'Días 8 a 14: el intermedio',
  'El sangrado es más leve pero sigue ahí. Si te pusieron puntos, ya están empezando a disolverse — sentarte sobre una toalla doblada ayuda. El estreñimiento es común; agua, fibra y un ablandador de heces si tu proveedor lo aprobó evitan que las primeras evacuaciones se vuelvan otra crisis. Puede que notes que tus manos y pies siguen hinchados — ese líquido tarda semanas en salir del todo.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (
    week_number, category, title, body, hero_emoji,
    requires_crisis_footer, review_status, clinical_advisor_reviewed,
    review_notes
  ) VALUES (
    2, 'emotional',
    'Baby blues vs. something heavier',
    'Up to 80% of moms feel weepy, anxious, or short-tempered in the first two weeks. That is the baby blues, and it usually lifts on its own. The line you watch for is duration and depth: feelings that last beyond two weeks, intrusive thoughts, panic, rage, or feeling nothing at all when you look at the baby. Those are signs of postpartum mood disorders — common, treatable, and not a verdict on your fitness as a mother.',
    '🫧',
    FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body)
SELECT id, 'es',
  'Melancolía posparto frente a algo más pesado',
  'Hasta el 80% de las mamás se sienten llorosas, ansiosas o con poca paciencia en las primeras dos semanas. Eso es la melancolía posparto y suele pasar sola. La línea que vigilas es la duración y la profundidad: sentimientos que duran más de dos semanas, pensamientos intrusivos, pánico, rabia o sentir nada al mirar al bebé. Esos son signos de trastornos de ánimo posparto — comunes, tratables, y no son un veredicto sobre lo buena madre que eres.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (
    week_number, category, title, body, hero_emoji,
    requires_crisis_footer, review_status, clinical_advisor_reviewed,
    review_notes
  ) VALUES (
    2, 'feeding',
    'Supply is still negotiating',
    'If breastfeeding, your milk has likely transitioned from colostrum to mature milk by now. Cluster feeding — especially in the evening — is normal and is how the baby tells your body to make more. Your nipples may be sore; deep latch matters more than duration. If you are formula-feeding or combo-feeding, the rhythm is the same: feed when hungry, watch wet diapers and weight, and trust the data over the noise.',
    '🍼',
    FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body)
SELECT id, 'es',
  'La producción todavía se está negociando',
  'Si das pecho, tu leche probablemente ya pasó de calostro a leche madura. Las tomas en racimo — sobre todo por la noche — son normales y son la forma en que el bebé le pide a tu cuerpo que produzca más. Los pezones pueden estar adoloridos; un buen agarre profundo importa más que la duración de la toma. Si das fórmula o combinas, el ritmo es el mismo: alimenta cuando tenga hambre, vigila los pañales mojados y el peso, y confía en los datos por encima del ruido.'
FROM new_row;

-- Village supports — week 2
WITH new_row AS (
  INSERT INTO village_supports (
    week_number, support_type, title, body, hero_emoji,
    cta_label, cta_target,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    2, 'expert',
    'Pediatric weight check',
    'Most pediatricians want a 2-week visit. The baby will be weighed naked, examined, and you''ll get to ask the questions you''ve been saving up. Bring your own list — it is hard to remember anything in there.',
    '🩺',
    'Find a pediatrician', 'experts:home:pediatrics',
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label)
SELECT id, 'es',
  'Control de peso con el pediatra',
  'La mayoría de los pediatras quieren una visita a las dos semanas. Pesarán al bebé sin ropa, lo examinarán y tú podrás hacer las preguntas que has ido guardando. Lleva tu propia lista — adentro es difícil recordar nada.',
  'Buscar pediatra'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (
    week_number, support_type, title, body, hero_emoji,
    cta_label, cta_target,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    2, 'professional',
    'A postpartum doula for the night shift',
    'If a few hours of overnight help is in reach, a postpartum doula can hold the baby between feeds while you sleep in a true block — the kind of sleep that resets your nervous system. Many work in 4–8 hour blocks rather than full nights.',
    '🌙',
    'Browse postpartum doulas', 'experts:home:doula_postpartum',
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label)
SELECT id, 'es',
  'Una doula posparto para el turno de la noche',
  'Si tienes acceso a unas horas de ayuda nocturna, una doula posparto puede sostener al bebé entre tomas mientras tú duermes un bloque real — del tipo de sueño que reinicia tu sistema nervioso. Muchas trabajan en bloques de 4 a 8 horas en lugar de noches completas.',
  'Ver doulas posparto'
FROM new_row;

-- Checklist — week 2
WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    2, 'medical',
    'Schedule the 2-week pediatric visit if you haven''t already.',
    TRUE, 10,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Agenda la visita pediátrica de las 2 semanas si todavía no la tienes.'
FROM new_row;

WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    2, 'practical',
    'Drink at least 8 glasses of water daily — keep a bottle wherever you feed.',
    FALSE, 20,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Toma al menos 8 vasos de agua al día — ten una botella donde sea que des de comer.'
FROM new_row;

WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    2, 'emotional',
    'Take 10 minutes outside today — porch, balcony, sidewalk. Sunlight + breath.',
    FALSE, 30,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Sal 10 minutos al aire libre hoy — porche, balcón, banqueta. Luz natural y respiración.'
FROM new_row;

WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    2, 'household',
    'Decline non-essential visitors this week. "Not yet" is a complete sentence.',
    FALSE, 40,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Aplaza visitas no esenciales esta semana. "Todavía no" es una oración completa.'
FROM new_row;

-- ─── Week 3 ────────────────────────────────────────────────────────────────
WITH new_row AS (
  INSERT INTO maternal_insights (
    week_number, category, title, body, hero_emoji,
    requires_crisis_footer, review_status, clinical_advisor_reviewed,
    review_notes
  ) VALUES (
    3, 'identity',
    'Who am I now?',
    'Matrescence — the developmental shift into motherhood — is as real as adolescence. Your sense of self may feel unfamiliar this week. Old hobbies, old social rhythms, old clothes, old jokes — none of them fit quite right. That isn''t loss; it is reorganization. The you that emerges over the next year will be both the same and different. Both can be true.',
    '🌗',
    FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body)
SELECT id, 'es',
  '¿Quién soy ahora?',
  'La matrescencia — el cambio de desarrollo hacia ser madre — es tan real como la adolescencia. Tu sentido de quién eres puede sentirse extraño esta semana. Viejos pasatiempos, viejos ritmos sociales, vieja ropa, viejos chistes — ninguno te queda igual. Eso no es pérdida; es reorganización. La tú que va a emerger durante el próximo año será al mismo tiempo la misma y distinta. Ambas cosas pueden ser ciertas.'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (
    week_number, category, title, body, hero_emoji,
    requires_crisis_footer, review_status, clinical_advisor_reviewed,
    review_notes
  ) VALUES (
    3, 'emotional',
    'When sadness lingers past two weeks',
    'If the heavy feeling hasn''t lifted by now, it has a name and a treatment. Postpartum depression and anxiety affect roughly 1 in 7 mothers — they are the most common medical complication of childbirth. They are not a moral failure, not a sign of inadequate love, not something to push through alone. Talking to your OB, midwife, or primary care provider is the first concrete step. Postpartum Support International (1-800-944-4773) can also match you to a local specialist.',
    '🌧️',
    TRUE, 'approved', FALSE,
    'Seed content — PPD-explicit; crisis footer required; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body)
SELECT id, 'es',
  'Cuando la tristeza se queda más allá de dos semanas',
  'Si la sensación de pesadez no se ha levantado todavía, tiene un nombre y un tratamiento. La depresión y la ansiedad posparto afectan aproximadamente a 1 de cada 7 madres — son la complicación médica más común del parto. No son una falla moral, ni una señal de amor insuficiente, ni algo que tengas que aguantar sola. Hablar con tu obstetra, partera o médica de cabecera es el primer paso concreto. Postpartum Support International (1-800-944-4773) también puede conectarte con una especialista cerca de ti (atienden en español).'
FROM new_row;

WITH new_row AS (
  INSERT INTO maternal_insights (
    week_number, category, title, body, hero_emoji,
    requires_crisis_footer, review_status, clinical_advisor_reviewed,
    review_notes
  ) VALUES (
    3, 'feeding',
    'Cluster feeds and growth spurts',
    'Around three weeks many babies hit a growth spurt — feeding nearly nonstop for a day or two, especially in the evening. It feels like a supply problem; it almost never is. The baby is signaling your body to scale up. Stay hydrated, sit down whenever you can, and trust that this resolves in 24–72 hours. If it lasts longer or wet diapers drop, that is when to call lactation or your pediatrician.',
    '🌾',
    FALSE, 'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO maternal_insights_i18n (insight_id, locale, title, body)
SELECT id, 'es',
  'Tomas en racimo y picos de crecimiento',
  'Alrededor de las tres semanas muchos bebés tienen un pico de crecimiento — comen casi sin parar por uno o dos días, sobre todo de noche. Se siente como un problema de producción; casi nunca lo es. El bebé le está pidiendo a tu cuerpo que produzca más. Mantente hidratada, siéntate cuando puedas, y confía en que se resuelve en 24 a 72 horas. Si dura más o si los pañales mojados disminuyen, ahí es cuando llamas a lactancia o al pediatra.'
FROM new_row;

-- Village supports — week 3
WITH new_row AS (
  INSERT INTO village_supports (
    week_number, support_type, title, body, hero_emoji,
    cta_label, cta_target,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    3, 'expert',
    'Mental health screening matters',
    'A short screening (the Edinburgh Postnatal Depression Scale, or EPDS) takes 5 minutes. Many OBs and pediatricians offer it; if yours hasn''t, ask. Catching PPD early changes the trajectory.',
    '🩺',
    'Find a PPD therapist', 'experts:home:ppd_therapy',
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label)
SELECT id, 'es',
  'El tamizaje de salud mental sí importa',
  'Un tamizaje breve (la Escala de Depresión Posparto de Edimburgo, o EPDS) toma 5 minutos. Muchos obstetras y pediatras lo ofrecen; si el tuyo no, pídelo. Detectar la depresión posparto temprano cambia el panorama.',
  'Buscar terapeuta de PPD'
FROM new_row;

WITH new_row AS (
  INSERT INTO village_supports (
    week_number, support_type, title, body, hero_emoji,
    cta_label, cta_target,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    3, 'community',
    'A weekly check-in with yourself',
    'The daily check-in in the Village is a 30-second touchpoint with how you are actually doing — and Villie reads it. If something flags as crisis, you''ll get the right resources fast.',
    '📓',
    'Open today''s check-in', 'home:DailyCheckin',
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO village_supports_i18n (support_id, locale, title, body, cta_label)
SELECT id, 'es',
  'Un chequeo semanal contigo misma',
  'El chequeo diario en The Village es un punto de contacto de 30 segundos con cómo estás de verdad — y Villie lo lee. Si algo se marca como crisis, recibirás los recursos correctos rápido.',
  'Abrir el chequeo de hoy'
FROM new_row;

-- Checklist — week 3
WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    3, 'medical',
    'Note any persistent sadness, anxiety, or intrusive thoughts — bring them up at your next provider visit.',
    TRUE, 10,
    'approved', FALSE,
    'Seed content — clinical-grade emotional triage; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Anota cualquier tristeza, ansiedad o pensamiento intrusivo persistente — coméntalo en tu próxima visita médica.'
FROM new_row;

WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    3, 'practical',
    'Move your body gently for 10 minutes — walking, stretching, deep breathing.',
    FALSE, 20,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Mueve el cuerpo suavemente por 10 minutos — caminar, estirar, respirar profundo.'
FROM new_row;

WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    3, 'emotional',
    'Reconnect with your partner for 5 minutes today — eye contact, no phones.',
    FALSE, 30,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Reconéctate con tu pareja 5 minutos hoy — contacto visual, sin teléfonos.'
FROM new_row;

WITH new_row AS (
  INSERT INTO week_checklists (
    week_number, category, item_text, is_essential, sort_order,
    review_status, clinical_advisor_reviewed, review_notes
  ) VALUES (
    3, 'household',
    'Plan one easy meal you can heat one-handed — soup, rice bowl, leftovers in single portions.',
    FALSE, 40,
    'approved', FALSE,
    'Seed content — founder approval; clinical advisor review pending'
  ) RETURNING id
)
INSERT INTO week_checklists_i18n (checklist_item_id, locale, item_text)
SELECT id, 'es',
  'Planea una comida fácil que puedas calentar con una sola mano — sopa, bowl de arroz, sobras en porciones individuales.'
FROM new_row;

-- ────────────────────────────────────────────────────────────────────────────
-- End migration 036.
-- Next: migration 037 will seed weeks 4–12 once a clinical advisor has signed
-- off on this batch (flips clinical_advisor_reviewed=TRUE on the rows above).
-- The build-order then continues per docs/PHASE_B_WEEKLY_JOURNEY_PROPOSAL.md:
--   2. apps/mobile/src/api/weekly-journey.ts
--   3. apps/mobile/src/screens/home/WeeklyJourneyScreen.tsx
--   4. EN+ES i18n keys (~25/locale)
--   5. HomeNavigator wiring + HeroWeekCard CTA repoint
