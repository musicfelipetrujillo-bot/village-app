-- 086_v4_events_more_classes.sql
-- More Villie Plans placeholders per founder: baby sign language, sleep
-- workshops, infant massage, story time, BLW, sleep-training Q&A. Locals carry
-- a venue + PostGIS point; webinars carry a stream_url. now()-relative dates so
-- they stay upcoming whenever applied. Miami-located to match the seed set.
INSERT INTO public.events
  (type, title, description, host_name, is_partner, is_third_party,
   starts_at, ends_at, timezone, capacity, age_tags,
   venue_name, address, city, location, stream_url, platform, is_free)
VALUES
  ('local', 'Baby Sign Language Basics',
   'Your baby can tell you "milk," "more," and "all done" months before they talk. Learn the first 10 signs and how to weave them into daily routines.',
   'Tiny Signs Miami', TRUE, FALSE,
   date_trunc('day', now()) + interval '9 days' + interval '14 hours',
   date_trunc('day', now()) + interval '9 days' + interval '15 hours',
   'America/New_York', 16, ARRAY['6-12mo','12mo+'],
   'Coral Gables Branch Library', '3443 Segovia St, Coral Gables', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.2620, 25.7210), 4326)::geography,
   NULL, NULL, TRUE),

  ('local', 'Newborn Sleep Workshop',
   'What is normal for newborn sleep (and what is not), wake windows, drowsy-but-awake, and gentle rhythms that actually survive real nights. No sleep training required.',
   'Coach Sarah Mills, CPSC', TRUE, FALSE,
   date_trunc('day', now()) + interval '11 days' + interval '18 hours',
   date_trunc('day', now()) + interval '11 days' + interval '19 hours' + interval '30 minutes',
   'America/New_York', 18, ARRAY['pregnancy','0-3mo','3-6mo'],
   'South Miami Wellness Center', '6300 SW 73rd St, South Miami', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.2930, 25.7080), 4326)::geography,
   NULL, NULL, TRUE),

  ('local', 'Infant Massage for Bonding & Colic',
   'A hands-on class teaching gentle strokes that ease gas and fussiness and deepen connection. Bring a mat and a hungry-for-cuddles baby.',
   'Nurture Touch Miami', TRUE, FALSE,
   date_trunc('day', now()) + interval '12 days' + interval '15 hours',
   date_trunc('day', now()) + interval '12 days' + interval '16 hours',
   'America/New_York', 12, ARRAY['0-3mo','3-6mo'],
   'Nurture Touch Studio, Brickell', '1110 Brickell Ave, Miami', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.1930, 25.7620), 4326)::geography,
   NULL, NULL, TRUE),

  ('local', 'Mommy & Me Story Time',
   'Songs, finger-plays, and board books for the littlest listeners, led by a childrens librarian. Free, drop-in, and stroller-friendly.',
   'Miami-Dade Public Library', FALSE, TRUE,
   date_trunc('day', now()) + interval '13 days' + interval '14 hours',
   date_trunc('day', now()) + interval '13 days' + interval '14 hours' + interval '45 minutes',
   'America/New_York', NULL, ARRAY['6-12mo','12mo+'],
   'West Kendall Regional Library', '10201 Hammocks Blvd, Miami', 'Miami',
   ST_SetSRID(ST_MakePoint(-80.4300, 25.7000), 4326)::geography,
   NULL, NULL, TRUE),

  ('webinar', 'Baby-Led Weaning Workshop',
   'A practical, live walkthrough of starting solids the BLW way: safe first foods, gag vs choke, portion sizes, and managing the mess. Q&A at the end.',
   'Dr. Marisol Reyes, RD', FALSE, TRUE,
   date_trunc('day', now()) + interval '14 days' + interval '23 hours',
   date_trunc('day', now()) + interval '15 days' + interval '0 hours',
   'America/New_York', NULL, ARRAY['3-6mo','6-12mo'],
   NULL, NULL, NULL, NULL,
   'https://zoom.us/j/villie-blw', 'zoom', TRUE),

  ('webinar', 'Sleep Training Without Tears: Live Q&A',
   'A judgment-free conversation about the full spectrum of sleep approaches — from no-cry to gradual — so you can choose what fits your family. Bring questions.',
   'Coach Sarah Mills, CPSC', FALSE, TRUE,
   date_trunc('day', now()) + interval '17 days' + interval '23 hours',
   date_trunc('day', now()) + interval '18 days' + interval '0 hours',
   'America/New_York', NULL, ARRAY['3-6mo','6-12mo','12mo+'],
   NULL, NULL, NULL, NULL,
   'https://zoom.us/j/villie-sleep-qa', 'zoom', TRUE);
