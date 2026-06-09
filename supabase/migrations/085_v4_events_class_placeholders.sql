-- 085_v4_events_class_placeholders.sql
-- Villie Plans was empty: the 4 seed events (migration 010) are dated late
-- Apr–early May 2026, now in the past, so list_events_near (ends_at > now())
-- returns nothing. This (1) refreshes the stale seed events into the future and
-- (2) adds a batch of real-feeling class placeholders — Baby & Me music, postpartum
-- yoga, swim, breastfeeding circle, newborn care, plus a mental-health webinar — so
-- the Plans tab reads like a populated local calendar. Miami-located to match the
-- existing seed; dates are relative to now() so they stay upcoming whenever applied.

-- 1) Refresh the original 4 seed events into the future (+40 days keeps their
--    relative spacing + times-of-day; no fragile title matching).
UPDATE public.events
SET starts_at = starts_at + interval '40 days',
    ends_at   = ends_at   + interval '40 days'
WHERE ends_at < now();

-- 2) New class placeholders. Locals carry a venue + PostGIS point (constraint
--    local_has_location); the webinar carries a stream_url (webinar_has_url).
INSERT INTO public.events
  (type, title, description, host_name, is_partner, is_third_party,
   starts_at, ends_at, timezone, capacity, age_tags,
   venue_name, address, city, location, stream_url, platform, is_free)
VALUES
  ('local', 'Baby & Me Music Class',
   'Sing, shake the egg shakers, and bounce along. A gentle 45-minute circle for babies and their grown-ups — no musical experience required.',
   'Tiny Tunes Miami', TRUE, FALSE,
   date_trunc('day', now()) + interval '1 day' + interval '14 hours',
   date_trunc('day', now()) + interval '1 day' + interval '15 hours',
   'America/New_York', 15, ARRAY['0-3mo','3-6mo','6-12mo','12mo+'],
   'Pinecrest Gardens', '11000 Red Rd, Pinecrest', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.3081, 25.6680), 4326)::geography,
   NULL, NULL, TRUE),

  ('local', 'Postpartum Yoga: Mom + Baby',
   'A slow flow built for healing bodies. Move at your own pace with baby beside you on the mat — modifications for C-section and early postpartum offered.',
   'Bloom Yoga Studio', TRUE, FALSE,
   date_trunc('day', now()) + interval '2 days' + interval '13 hours' + interval '30 minutes',
   date_trunc('day', now()) + interval '2 days' + interval '14 hours' + interval '30 minutes',
   'America/New_York', 12, ARRAY['pregnancy','0-3mo','3-6mo','6-12mo'],
   'Bloom Studio Coral Gables', '301 Altara Ave, Coral Gables', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.2684, 25.7215), 4326)::geography,
   NULL, NULL, TRUE),

  ('webinar', 'Postpartum Mental Health: Ask a Therapist',
   'A live, judgment-free Q&A on the baby blues, PPD/PPA, and when to reach out. Bring your questions; stay anonymous if you like.',
   'Dr. Lisa Chen, PhD', FALSE, TRUE,
   date_trunc('day', now()) + interval '3 days' + interval '23 hours',
   date_trunc('day', now()) + interval '4 days' + interval '0 hours',
   'America/New_York', NULL, ARRAY['pregnancy','0-3mo','3-6mo','6-12mo','12mo+'],
   NULL, NULL, NULL, NULL,
   'https://zoom.us/j/villie-ppmh', 'zoom', TRUE),

  ('local', 'Baby & Me Swim Class',
   'Warm-water splash class introducing babies to floating, kicking, and breath cues with a parent in the pool. Swim diapers required.',
   'AquaTots Miami', FALSE, TRUE,
   date_trunc('day', now()) + interval '4 days' + interval '15 hours',
   date_trunc('day', now()) + interval '4 days' + interval '15 hours' + interval '45 minutes',
   'America/New_York', 10, ARRAY['3-6mo','6-12mo','12mo+'],
   'Venetian Pool', '2701 De Soto Blvd, Coral Gables', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.2762, 25.7460), 4326)::geography,
   NULL, NULL, TRUE),

  ('local', 'Breastfeeding Support Circle',
   'A drop-in circle with an IBCLC on hand. Nurse, ask questions, weigh baby, or just sit with other moms who get it. Bottle-feeders welcome too.',
   'The Village Community', TRUE, FALSE,
   date_trunc('day', now()) + interval '6 days' + interval '17 hours',
   date_trunc('day', now()) + interval '6 days' + interval '18 hours' + interval '30 minutes',
   'America/New_York', NULL, ARRAY['pregnancy','0-3mo','3-6mo'],
   'Wynwood Family Hub', '2750 NW 3rd Ave, Miami', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.1990, 25.8040), 4326)::geography,
   NULL, NULL, TRUE),

  ('local', 'Newborn Care Basics',
   'The fourth-trimester crash course: swaddling, diapering, cord care, safe sleep, and reading newborn cues. Great for partners and grandparents too.',
   'Baptist Health Birth Center', FALSE, TRUE,
   date_trunc('day', now()) + interval '8 days' + interval '22 hours',
   date_trunc('day', now()) + interval '8 days' + interval '23 hours' + interval '30 minutes',
   'America/New_York', 20, ARRAY['pregnancy','0-3mo'],
   'Baptist Health Birth Center', '8900 N Kendall Dr, Miami', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.3360, 25.6880), 4326)::geography,
   NULL, NULL, TRUE);
