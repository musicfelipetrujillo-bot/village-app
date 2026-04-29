-- V4 G2 — Partner ICS feed onboarding stub
--
-- One-line edits to register a real partner once an agreement is signed.
-- Runs against the events_partner_feeds table from migration 045.
-- This file is reference + template only — don't apply it through the
-- migrations directory (it isn't numbered, and partner data shouldn't live
-- in source-controlled migrations).
--
-- HOW TO USE
--   1. Get the partner's iCalendar (ICS) URL — typically
--      https://hospital.org/events.ics, or a Google Calendar "secret address
--      in iCal format" link.
--   2. Confirm we have a signed agreement (sets is_partner posture below).
--   3. Pick the right TEMPLATE block, fill in the four-or-so ALL_CAPS fields,
--      paste it into Supabase Studio → SQL editor → Run.
--   4. Either wait for the next 09:00 UTC GH Actions run, or fire a one-shot
--      via:  gh workflow run supabase-crons.yml -f function=events-ingest-ics
--              -f body='{"mode":"all"}'
--   5. Watch the EVT review queue (Me → Event review) for new pending events.
--      auto_publish_threshold below decides what auto-publishes vs queues.
--
-- POSTURE BY FEED TYPE
--   * Trusted hospital partner (signed agreement, hospital QA on their cal):
--       is_partner = TRUE
--       auto_publish_threshold = 0.0  (skip review — they vetted it)
--   * Vetted-but-not-signed (e.g. a known nonprofit's public events):
--       is_partner = FALSE
--       auto_publish_threshold = 0.85 (default; AI must be confident)
--   * Aggregator / unknown source (Eventbrite scrape, etc.):
--       is_partner = FALSE
--       auto_publish_threshold = 0.95 (almost everything queues for review)
--
-- All ingested events are stamped is_third_party=TRUE regardless — the
-- "Hosted by an external provider" disclaimer always renders.

-- ────────────────────────────────────────────────────────────────────────────
-- TEMPLATE 1 — Trusted hospital partner (signed agreement)
-- Auto-publishes everything; human review only by exception.
-- ────────────────────────────────────────────────────────────────────────────
/*
INSERT INTO events_partner_feeds (
  partner_name,
  partner_avatar_url,
  is_partner,
  ics_url,
  default_timezone,
  default_city,
  default_age_tags,
  default_event_type,
  auto_publish_threshold,
  is_active,
  notes
) VALUES (
  'PARTNER_NAME_HERE',                    -- e.g. 'Mount Sinai Miami'
  NULL,                                   -- partner_avatar_url, set later
  TRUE,                                   -- is_partner — signed agreement
  'PARTNER_ICS_URL_HERE',                 -- e.g. 'https://msmc.org/events.ics'
  'America/New_York',                     -- partner's tz; events default to this
  'CITY_HERE',                            -- e.g. 'Miami Beach'
  ARRAY['pregnancy','postpartum'],        -- default age tags applied to every event
  'local',                                -- 'local' (in-person) or 'webinar'
  0.0,                                    -- auto-publish — fully trusted
  TRUE,
  'Signed master agreement YYYY-MM-DD; primary contact NAME (EMAIL).'
);
*/

-- ────────────────────────────────────────────────────────────────────────────
-- TEMPLATE 2 — Vetted public source (no signed agreement)
-- AI must be confident before auto-publish; otherwise queues for review.
-- ────────────────────────────────────────────────────────────────────────────
/*
INSERT INTO events_partner_feeds (
  partner_name, is_partner, ics_url,
  default_timezone, default_city, default_age_tags,
  default_event_type, auto_publish_threshold, is_active, notes
) VALUES (
  'PARTNER_NAME_HERE',
  FALSE,
  'PARTNER_ICS_URL_HERE',
  'America/New_York',
  'CITY_HERE',
  ARRAY['pregnancy','postpartum'],
  'local',
  0.85,                                   -- default — AI confidence ≥ 0.85 auto-pub
  TRUE,
  'Public events calendar; relationship informal. Review YYYY-MM-DD.'
);
*/

-- ────────────────────────────────────────────────────────────────────────────
-- TEMPLATE 3 — Aggregator / unknown source
-- Almost everything queues for review. Use sparingly — high reviewer load.
-- ────────────────────────────────────────────────────────────────────────────
/*
INSERT INTO events_partner_feeds (
  partner_name, is_partner, ics_url,
  default_timezone, default_city, default_age_tags,
  default_event_type, auto_publish_threshold, is_active, notes
) VALUES (
  'AGGREGATOR_NAME_HERE',
  FALSE,
  'AGGREGATOR_ICS_URL_HERE',
  'America/New_York',
  NULL,                                   -- aggregator events span cities; geocode resolves
  ARRAY[]::TEXT[],                        -- no default tags; ai-event-screen suggests
  'local',
  0.95,                                   -- aggressive — most rows hit review
  TRUE,
  'Aggregator. Audit reviewer load weekly; deactivate if signal-to-noise drops.'
);
*/

-- ────────────────────────────────────────────────────────────────────────────
-- OPS HELPERS
-- ────────────────────────────────────────────────────────────────────────────

-- See active feeds + last sync status
-- SELECT id, partner_name, is_partner, auto_publish_threshold,
--        last_synced_at, last_sync_status, consecutive_failures
--   FROM events_partner_feeds
--  WHERE is_active = TRUE
--  ORDER BY last_synced_at DESC NULLS FIRST;

-- Pause a misbehaving feed (consecutive_failures will keep counting; this
-- just stops the cron from re-pulling)
-- UPDATE events_partner_feeds SET is_active = FALSE WHERE id = '...';

-- Fire an immediate one-shot pull for a single feed (omit body to do all)
-- (run from a shell — needs SERVICE_ROLE_KEY):
--   curl -X POST "$URL/events-ingest-ics" \
--     -H "Authorization: Bearer $SRK" \
--     -d '{"mode":"feed","feed_id":"<uuid>"}'

-- Demote a row mistakenly auto-published back to pending for re-review
-- UPDATE events SET review_status = 'pending', auto_published_at = NULL
--  WHERE id = '...';

-- ────────────────────────────────────────────────────────────────────────────
-- HEALTH-CHECK QUERIES — paste any block into Supabase SQL editor.
-- Run these whenever cron looks suspicious or before adding a new feed.
-- All queries are read-only and safe to run anytime.
-- ────────────────────────────────────────────────────────────────────────────

-- 1) Ingest funnel — what landed in the last 7 days, by feed
-- Tells you whether each feed is delivering and where rows ended up
-- (auto-published vs queued for review vs rejected).
-- SELECT
--   COALESCE(f.partner_name, '— manual —')   AS feed,
--   COUNT(*) FILTER (WHERE e.review_status='pending')      AS pending,
--   COUNT(*) FILTER (WHERE e.review_status='approved')     AS approved,
--   COUNT(*) FILTER (WHERE e.review_status='rejected')     AS rejected,
--   COUNT(*) FILTER (WHERE e.auto_published_at IS NOT NULL) AS auto_pub,
--   COUNT(*)                                                AS total
-- FROM events e
-- LEFT JOIN events_partner_feeds f ON f.id = e.source_feed_id
-- WHERE e.created_at > now() - INTERVAL '7 days'
--   AND e.source_feed_id IS NOT NULL
-- GROUP BY feed
-- ORDER BY total DESC;

-- 2) AI-screen confidence distribution (last 7 days)
-- Mid-confidence rows (0.55–0.85) eat reviewer time. If "medium" dominates
-- "high", consider tightening the AI prompt or partner thresholds.
-- SELECT
--   CASE
--     WHEN ingestion_confidence IS NULL    THEN 'unscreened'
--     WHEN ingestion_confidence >= 0.85    THEN 'high'
--     WHEN ingestion_confidence >= 0.55    THEN 'medium'
--     ELSE                                       'low'
--   END                                         AS band,
--   COUNT(*)                                    AS rows,
--   ROUND(AVG(ingestion_confidence)::NUMERIC, 2) AS avg_conf
-- FROM events
-- WHERE created_at > now() - INTERVAL '7 days'
--   AND source_feed_id IS NOT NULL
-- GROUP BY band
-- ORDER BY band;

-- 3) Geocode backlog — local events still waiting on coords
-- needs_geocode=TRUE rows older than 24h indicate Google + Nominatim BOTH
-- failed for the address. Inspect manually or fix the source LOCATION.
-- SELECT
--   id, title, venue_name, address, city,
--   age(now(), created_at) AS age,
--   needs_geocode
-- FROM events
-- WHERE type='local'
--   AND needs_geocode = TRUE
--   AND created_at < now() - INTERVAL '24 hours'
--   AND status <> 'cancelled'
-- ORDER BY created_at ASC
-- LIMIT 50;

-- 4) Geocode coverage check — local events sitting at Null-Island sentinel
-- Belt-and-braces for #3. If the events-geocode sweep fails silently,
-- needs_geocode might be cleared but coords stay at (0,0). This catches it.
-- SELECT
--   id, title, venue_name,
--   ST_Y(location::geometry) AS lat,
--   ST_X(location::geometry) AS lng,
--   needs_geocode
-- FROM events
-- WHERE type='local'
--   AND location IS NOT NULL
--   AND ABS(ST_Y(location::geometry)) < 0.001
--   AND ABS(ST_X(location::geometry)) < 0.001
--   AND status <> 'cancelled'
-- LIMIT 50;

-- 5) Reviewer queue depth — pending rows that haven't been triaged yet
-- High depth + high age = reviewer is behind. Filter by feed if you want
-- to see which partner is generating the load.
-- SELECT
--   COALESCE(f.partner_name, '— manual —') AS feed,
--   COUNT(*)                               AS pending_rows,
--   MAX(age(now(), e.created_at))          AS oldest_age,
--   AVG(EXTRACT(EPOCH FROM age(now(), e.created_at)) / 3600)::INT AS avg_age_hours
-- FROM events e
-- LEFT JOIN events_partner_feeds f ON f.id = e.source_feed_id
-- WHERE e.review_status = 'pending'
--   AND e.ends_at > now()
-- GROUP BY feed
-- ORDER BY pending_rows DESC;

-- 6) Cross-feed dedup confirmation — feeds publishing the same event
-- Run after migration 048 has been live a week. Looks for events that
-- ALMOST matched an earlier row from a different feed but landed anyway
-- (within ±90min, ≤500m, similar title). Manual triage tool — no auto.
-- SELECT a.id AS a_id, b.id AS b_id, a.title, a.starts_at,
--        a.source_feed_id AS feed_a, b.source_feed_id AS feed_b
--   FROM events a
--   JOIN events b
--     ON b.id <> a.id
--    AND b.starts_at BETWEEN a.starts_at - INTERVAL '90 minutes'
--                        AND a.starts_at + INTERVAL '90 minutes'
--    AND lower(regexp_replace(b.title, '\s+', ' ', 'g'))
--        LIKE substr(lower(regexp_replace(a.title, '\s+', ' ', 'g')), 1, 40) || '%'
--    AND b.source_feed_id IS DISTINCT FROM a.source_feed_id
--    AND b.status <> 'cancelled'
--    AND a.status <> 'cancelled'
--  WHERE a.created_at > now() - INTERVAL '14 days'
--  ORDER BY a.starts_at;

-- 7) Feed staleness alarm — feeds that haven't synced in > 36h
-- Cron is daily; anything > 36h means consecutive_failures should be > 0.
-- SELECT id, partner_name, is_active, last_synced_at, last_sync_status,
--        consecutive_failures
--   FROM events_partner_feeds
--  WHERE is_active = TRUE
--    AND (last_synced_at IS NULL OR last_synced_at < now() - INTERVAL '36 hours')
--  ORDER BY consecutive_failures DESC, last_synced_at ASC NULLS FIRST;
