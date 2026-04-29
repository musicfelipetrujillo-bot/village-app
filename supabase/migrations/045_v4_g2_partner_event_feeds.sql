-- V4 G2 — Partner ICS event feeds (Pass 1 of self-sustaining events ingest)
--
-- Lets ops register a partner's iCalendar (.ics) URL and have a daily cron
-- pull new events into the existing `events` table without code changes per
-- partner. The hospital-discharge GTM motion already gives us the partner
-- relationships; this just inherits the calendar they already maintain for
-- their own staff.
--
-- Posture:
--   - Every event ingested via this path is `is_third_party=TRUE` (partner
--     hosts it, not us) and rendered with the existing third-party
--     disclaimer in EventDetailScreen ("Hosted by an external provider…").
--   - `is_partner` mirrors the feed's `is_partner` flag — partner-vetted
--     calendars (signed agreement) get the partner badge; aggregator feeds
--     do not.
--   - We DO NOT generate events with AI here. ICS pulls real published
--     events only. AI scoring is Pass 2 (Eventbrite ingest).
--
-- Idempotency:
--   - Events are deduped on `(source_feed_id, source_uid)` where source_uid
--     is the iCal `UID:` field. RFC 5545 guarantees UID stability across a
--     calendar's lifetime, so re-pulling is safe.
--   - On re-pull, modified events (new title/time/location) UPDATE in place;
--     events that vanish from the source feed are marked `status='cancelled'`
--     server-side rather than deleted (preserves any RSVPs).
--
-- Pre-launch gates:
--   - app.supabase_url + app.service_role_key set on Supabase Pro for the
--     cron pg_net call to authenticate.
--   - Edge function `events-ingest-ics` deployed.

-- ────────────────────────────────────────────────────────────────────────────
-- events_partner_feeds — registry of ICS URLs we re-pull on a schedule
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE events_partner_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Display
  partner_name TEXT NOT NULL,                -- e.g. "Mount Sinai Miami"
  partner_avatar_url TEXT,
  is_partner BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = signed agreement → partner badge

  -- Source
  ics_url TEXT NOT NULL,
  default_timezone TEXT NOT NULL DEFAULT 'America/New_York',
  default_city TEXT,                         -- city stamped on events that don't carry one
  default_age_tags TEXT[] NOT NULL DEFAULT '{}',
                                             -- {'pregnancy','0-3mo',...} → applied to every event from this feed
  default_event_type TEXT NOT NULL DEFAULT 'local'
    CHECK (default_event_type IN ('local', 'webinar')),

  -- Operational
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_synced_at TIMESTAMPTZ,
  last_sync_status TEXT,                     -- 'ok' | 'http_404' | 'parse_error' | etc.
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  notes TEXT,                                -- ops scratchpad

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_partner_feeds_active
  ON events_partner_feeds(is_active)
  WHERE is_active = TRUE;

CREATE TRIGGER trg_touch_events_partner_feeds_updated_at
  BEFORE UPDATE ON events_partner_feeds
  FOR EACH ROW EXECUTE FUNCTION touch_events_updated_at();

-- RLS — service-role-only. Ops manages this table via Supabase Studio /
-- service-role admin tools; mobile app has no business reading or writing it.
ALTER TABLE events_partner_feeds ENABLE ROW LEVEL SECURITY;
-- (no policies → only service_role / postgres roles can read or write)

-- ────────────────────────────────────────────────────────────────────────────
-- events: source-tracking columns for ICS dedup + drift detection
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS source_feed_id UUID
    REFERENCES events_partner_feeds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_uid TEXT,         -- iCal UID:
  ADD COLUMN IF NOT EXISTS source_synced_at TIMESTAMPTZ;

-- Dedup constraint — within a single feed, UIDs are unique. Two different
-- feeds publishing the same event will currently double-list (Pass 2 will
-- add cross-feed dedup via title+time+location hash).
CREATE UNIQUE INDEX IF NOT EXISTS uq_events_source_feed_uid
  ON events(source_feed_id, source_uid)
  WHERE source_feed_id IS NOT NULL AND source_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_source_feed
  ON events(source_feed_id)
  WHERE source_feed_id IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- pg_cron — daily 09:00 UTC (05:00 ET, before the home-feed-curator at 09:10)
-- ────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'events-ingest-ics-daily') THEN
      PERFORM cron.unschedule('events-ingest-ics-daily');
    END IF;

    PERFORM cron.schedule(
      'events-ingest-ics-daily',
      '0 9 * * *',
      $cron$
      SELECT net.http_post(
        url     := current_setting('app.supabase_url') || '/functions/v1/events-ingest-ics',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || current_setting('app.service_role_key')
        ),
        body    := '{"mode":"all"}'::jsonb
      );
      $cron$
    );
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;
