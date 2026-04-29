-- V4 Phase G1 — Milestone library + 52-week seed + RLS + helper RPCs
-- See docs/MASTER_PLAN.md § V4 — Database Schema.

CREATE TABLE milestone_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 104),
  category TEXT NOT NULL CHECK (category IN (
    'motor', 'social', 'communication', 'sleep', 'feeding', 'sensory', 'cognitive'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  hero_emoji TEXT,
  sleep_hours_min NUMERIC(4, 1),
  sleep_hours_max NUMERIC(4, 1),
  feed_interval_hours_min NUMERIC(3, 1),
  feed_interval_hours_max NUMERIC(3, 1),
  ai_summary_cache TEXT,
  ai_summary_cached_at TIMESTAMPTZ,
  UNIQUE (week_number, category)
);

CREATE INDEX idx_milestone_week ON milestone_library(week_number);

-- RLS: milestone_library is public read, service role write (curated content + AI cron)
ALTER TABLE milestone_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestone_select_all" ON milestone_library
  FOR SELECT USING (true);
CREATE POLICY "milestone_insert_service" ON milestone_library
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "milestone_update_service" ON milestone_library
  FOR UPDATE USING (auth.role() = 'service_role');

-- 52-week seed. One primary milestone per week, rotating across categories so every
-- mom sees a developmental anchor each week. G7 will add AI-generated per-week
-- paragraphs into ai_summary_cache via cron (claude-sonnet-4-6).
INSERT INTO milestone_library (
  week_number, category, title, description, hero_emoji,
  sleep_hours_min, sleep_hours_max, feed_interval_hours_min, feed_interval_hours_max
) VALUES
  -- Month 1 — the fourth trimester
  (1,  'sensory',       'Hello, world',                        'Your baby recognizes your voice and smell. Skin-to-skin soothes nervous systems — yours included.', '🌱', 14.0, 17.0, 2.0, 3.0),
  (2,  'feeding',       'Finding the rhythm',                  'Cluster feeds are normal. If breastfeeding, supply is still calibrating — feed on demand.',         '🍼', 14.0, 17.0, 2.0, 3.0),
  (3,  'sleep',         'No pattern yet',                      'Sleep is scattered across 24 hours. Day/night confusion peaks now — daylight helps gently reset.',   '🌙', 14.0, 17.0, 2.0, 3.0),
  (4,  'social',        'First social smile',                  'Around now a real smile (not gas!) may appear when you make eye contact. It is wired for connection.', '😊', 14.0, 17.0, 2.0, 3.5),
  -- Month 2
  (5,  'motor',         'Head control emerging',               'Tummy time builds neck strength. Short, frequent sessions beat long ones.',                          '💪', 14.0, 17.0, 2.5, 3.5),
  (6,  'communication', 'Coos and gurgles',                    'First vowel sounds — "ooh", "aah". Respond like it is a conversation; babies learn turn-taking now.', '🗣️', 14.0, 17.0, 2.5, 3.5),
  (7,  'sensory',       'Tracking across midline',             'Eyes can follow a toy in a slow arc. High-contrast patterns fascinate.',                             '👀', 14.0, 16.5, 2.5, 3.5),
  (8,  'sleep',         'Longer stretches appear',             'Some babies start giving one 4–5 hr stretch. If yours doesn''t, it''s normal — not a training issue.', '😴', 14.0, 16.5, 2.5, 3.5),
  -- Month 3
  (9,  'motor',         'Mini push-ups',                       'On the belly, baby may lift chest briefly. The core is waking up.',                                  '🤸', 14.0, 16.0, 3.0, 4.0),
  (10, 'social',        'Belly laughs incoming',               'First real laughs appear — often at peekaboo or silly faces. It is wildly motivating.',              '😄', 14.0, 16.0, 3.0, 4.0),
  (11, 'feeding',       'More efficient eater',                'Feeds may shorten — baby is getting more milk per minute. Wet-diaper count still matters most.',      '🍼', 14.0, 16.0, 3.0, 4.0),
  (12, 'cognitive',     'Recognizing the routine',             'Baby anticipates what comes next: bath → book → bed. Predictability is a gift to their nervous system.', '🧠', 14.0, 16.0, 3.0, 4.0),
  -- Month 4
  (13, 'motor',         'Rolling flirts',                      'First roll (usually back-to-side) might happen. Never leave unattended on a bed or couch.',           '↪️',  13.5, 15.5, 3.0, 4.0),
  (14, 'sleep',         '4-month sleep shift',                 'Sleep cycles mature → more short wakings. Pattern changes are biology, not your fault.',            '🌙', 13.5, 15.5, 3.0, 4.0),
  (15, 'sensory',       'Hand discovery',                      'Hands fascinate and go in the mouth nonstop. This is how babies map their body.',                    '🖐️', 13.0, 15.5, 3.0, 4.0),
  (16, 'communication', 'Two-way banter',                      'Back-and-forth cooing exchanges. Pause and let baby "reply."',                                       '💬', 13.0, 15.5, 3.0, 4.0),
  -- Month 5
  (17, 'motor',         'Both directions rolling',             'Back-to-front often appears now. Play on the floor becomes more fun (and riskier).',                 '🔄', 13.0, 15.0, 3.0, 4.0),
  (18, 'feeding',       'Solids are on the horizon',           'Watch for readiness: sits with support, shows interest in food, has lost tongue-thrust. Still weeks away.', '🥄', 13.0, 15.0, 3.0, 4.0),
  (19, 'cognitive',     'Cause and effect',                    'Dropping a toy to watch it fall is not bad behavior — it''s science.',                               '🎯', 13.0, 15.0, 3.0, 4.0),
  (20, 'social',        'Stranger awareness dawns',            'Baby may cling or fuss with new people. This is healthy attachment, not personality.',                '🫂', 13.0, 15.0, 3.0, 4.0),
  -- Month 6
  (21, 'feeding',       'First tastes',                        'Around 6 months, if signs of readiness are there: iron-rich foods first. No honey under 1.',           '🥑', 12.5, 15.0, 3.5, 4.5),
  (22, 'motor',         'Sitting unsupported',                 'Tripod-sitting becomes steadier. Prop with pillows at first.',                                        '🪑', 12.5, 15.0, 3.5, 4.5),
  (23, 'sensory',       'Everything to the mouth',             'Oral exploration peaks. Choking hazards: anything that fits through a toilet-paper roll.',            '🧸', 12.5, 14.5, 3.5, 4.5),
  (24, 'communication', 'Babbling chains',                     'Baba, mama, dada — no meaning yet, but the building blocks are here.',                                 '🎵', 12.5, 14.5, 3.5, 4.5),
  -- Month 7
  (25, 'motor',         'Army-crawling',                       'Belly-scooting or commando-crawling may start. Babyproofing window is now.',                         '🐛', 12.0, 14.5, 3.5, 5.0),
  (26, 'cognitive',     'Object permanence',                   'Peekaboo is hilarious now because baby knows you still exist when hidden.',                            '🙈', 12.0, 14.5, 3.5, 5.0),
  (27, 'feeding',       'Textures expand',                     'Mashed → lumpy → soft finger foods. Gagging looks scary but is a safety reflex.',                      '🍽️', 12.0, 14.5, 3.5, 5.0),
  (28, 'social',        'Parent preference',                   'One caregiver may become "the one." It doesn''t mean others are failing.',                            '💞', 12.0, 14.5, 3.5, 5.0),
  -- Month 8
  (29, 'motor',         'Hands-and-knees crawling',            'Classic crawl appears. Some babies skip it entirely — also fine.',                                   '🐾', 11.5, 14.5, 4.0, 5.0),
  (30, 'sleep',         '8-month regression',                  'Separation anxiety + new skills = more night wakings. It passes in 2–6 weeks.',                       '🌙', 11.5, 14.5, 4.0, 5.0),
  (31, 'communication', 'Understanding "no"',                  'Baby pauses when you say their name or "no." Receptive language runs ahead of spoken.',               '👂', 11.5, 14.5, 4.0, 5.0),
  (32, 'motor',         'Pincer grasp',                        'Thumb-and-forefinger pickup. Time for safe finger foods.',                                            '🤏', 11.5, 14.5, 4.0, 5.0),
  -- Month 9
  (33, 'motor',         'Pulling to stand',                    'Furniture cruising is weeks away. Lower the crib mattress now.',                                      '🧍', 11.0, 14.0, 4.0, 5.0),
  (34, 'cognitive',     'Looks for dropped items',             'Baby searches for toys out of sight — full object permanence online.',                                '🔍', 11.0, 14.0, 4.0, 5.0),
  (35, 'social',        'Waves and claps',                     'Social gestures on cue. Imitation is the foundation of learning.',                                    '👋', 11.0, 14.0, 4.0, 5.0),
  (36, 'feeding',       'Self-feeding',                        'Messy, inefficient, vital. Let baby explore food with hands.',                                        '🍞', 11.0, 14.0, 4.0, 5.0),
  -- Month 10
  (37, 'motor',         'Cruising along furniture',            'Sidestepping while holding on. Independent standing is close.',                                        '🚶', 11.0, 14.0, 4.0, 5.0),
  (38, 'communication', 'First word may appear',               'Usually "mama" or "dada" with meaning. Huge individual variation — don''t panic if not yet.',           '🗨️', 11.0, 14.0, 4.0, 5.0),
  (39, 'cognitive',     'Follows simple commands',             '"Give me the ball" — and sometimes they do. Receptive language blooming.',                            '🧩', 11.0, 14.0, 4.0, 5.0),
  (40, 'sensory',       'Textures and tastes',                 'Exposing baby to varied textures (rice, yogurt, avocado) shapes later eating habits.',                 '🥣', 11.0, 14.0, 4.0, 5.0),
  -- Month 11
  (41, 'motor',         'Standing unassisted',                 'A few wobbly seconds of free standing. First steps on the horizon.',                                   '🦶', 11.0, 14.0, 4.0, 5.0),
  (42, 'social',        'Showing and offering',                'Baby holds out toys to share — joint attention is a foundation for communication.',                  '🎁', 11.0, 14.0, 4.0, 5.0),
  (43, 'feeding',       'Transition to cow milk looms',        'At 12 months, most babies can switch from formula/breastmilk to whole milk. Ask your pediatrician.',  '🥛', 11.0, 14.0, 4.0, 5.0),
  (44, 'sleep',         'Consolidated night sleep',            'Many babies now do 10–12 hr nights with 1–2 naps. Many don''t yet — still normal.',                    '😴', 11.0, 14.0, 4.0, 5.0),
  -- Month 12 — first birthday
  (45, 'motor',         'First steps',                         'Average first walker is 12 months, but anywhere 9–18 months is typical.',                             '🎈', 11.0, 14.0, 4.0, 5.0),
  (46, 'communication', '2–5 words',                           'A small vocabulary by 12 months: mama, dada, bye, dog, hi. More words are understood than spoken.',    '📖', 11.0, 14.0, 4.0, 5.0),
  (47, 'cognitive',     'Pretend play emerges',                'Pretending to drink from an empty cup → symbolic thought. Huge cognitive leap.',                      '☕', 11.0, 14.0, 4.0, 5.0),
  (48, 'social',        'Separation eases',                    'Anxiety softens as object permanence solidifies — baby knows you come back.',                         '🫶', 11.0, 14.0, 4.0, 5.0),
  -- Weeks 49–52 (12–13 months)
  (49, 'motor',         'Climbing phase',                      'Couches, stairs, anything. Safety gates and supervision are non-negotiable.',                         '🧗', 11.0, 14.0, 4.0, 5.0),
  (50, 'feeding',       'Toddler appetite drops',              'Growth slows after year 1 — so does appetite. One good meal per day can be plenty.',                    '🍽️', 11.0, 14.0, 4.0, 5.0),
  (51, 'communication', 'Pointing to communicate',             'Proto-declarative pointing: "Look at that!" — a precursor to full language.',                          '👉', 11.0, 14.0, 4.0, 5.0),
  (52, 'social',        'One year in',                         'You both made it through the fourth trimester, the regressions, the firsts. This is a milestone for you, too.', '🎂', 11.0, 14.0, 4.0, 5.0);

-- RPC: Get milestone list for a given week, ordered by category display order
CREATE OR REPLACE FUNCTION get_milestones_for_week(p_week SMALLINT)
RETURNS TABLE (
  id UUID,
  week_number SMALLINT,
  category TEXT,
  title TEXT,
  description TEXT,
  hero_emoji TEXT,
  sleep_hours_min NUMERIC,
  sleep_hours_max NUMERIC,
  feed_interval_hours_min NUMERIC,
  feed_interval_hours_max NUMERIC,
  ai_summary_cache TEXT
) LANGUAGE sql STABLE AS $$
  SELECT
    m.id, m.week_number, m.category, m.title, m.description, m.hero_emoji,
    m.sleep_hours_min, m.sleep_hours_max, m.feed_interval_hours_min, m.feed_interval_hours_max,
    m.ai_summary_cache
  FROM milestone_library m
  WHERE m.week_number = p_week
  ORDER BY
    CASE m.category
      WHEN 'motor' THEN 1
      WHEN 'social' THEN 2
      WHEN 'communication' THEN 3
      WHEN 'cognitive' THEN 4
      WHEN 'sensory' THEN 5
      WHEN 'feeding' THEN 6
      WHEN 'sleep' THEN 7
    END;
$$;

-- RPC: Get the current-week milestone summary for the signed-in user.
-- Returns empty set if no baby_profile yet.
CREATE OR REPLACE FUNCTION get_my_current_milestone()
RETURNS TABLE (
  week_number SMALLINT,
  category TEXT,
  title TEXT,
  description TEXT,
  hero_emoji TEXT,
  baby_name TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    bp.current_week_number AS week_number,
    m.category, m.title, m.description, m.hero_emoji,
    bp.baby_name
  FROM baby_profiles_with_week bp
  JOIN LATERAL (
    SELECT * FROM milestone_library ml
    WHERE ml.week_number = bp.current_week_number
    ORDER BY
      CASE ml.category
        WHEN 'motor' THEN 1 WHEN 'social' THEN 2 WHEN 'communication' THEN 3
        WHEN 'cognitive' THEN 4 WHEN 'sensory' THEN 5 WHEN 'feeding' THEN 6 WHEN 'sleep' THEN 7
      END
    LIMIT 1
  ) m ON TRUE
  WHERE bp.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_milestones_for_week(SMALLINT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_my_current_milestone() TO authenticated;
