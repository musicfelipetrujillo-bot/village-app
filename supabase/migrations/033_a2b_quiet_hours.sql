-- A2.b follow-up — quiet hours block on notif_prefs.
--
-- Extends the JSONB default written by migration 032. Existing rows are
-- backfilled with a disabled quiet_hours block so the shape is consistent
-- across old + new users. Senders check the block via the shared helper in
-- supabase/functions/_shared/quiet-hours.ts; disabled/missing → no silence.

-- 1. Set the new DEFAULT for rows created from here on.
ALTER TABLE public.users
  ALTER COLUMN notif_prefs SET DEFAULT '{
    "events": true,
    "groups": true,
    "specialists": true,
    "milk_hub": true,
    "articles": true,
    "ai": true,
    "promotions": false,
    "quiet_hours": {
      "enabled": false,
      "start_hour": 22,
      "end_hour": 7,
      "tz": "America/New_York"
    }
  }'::jsonb;

-- 2. Backfill existing rows missing the quiet_hours subtree. `||` merges at
--    the top level, but we only want to add the key when it's absent —
--    otherwise a user who has already tweaked their quiet hours would be
--    reset. COALESCE + conditional update does the right thing.
UPDATE public.users
SET notif_prefs = notif_prefs || '{
  "quiet_hours": {
    "enabled": false,
    "start_hour": 22,
    "end_hour": 7,
    "tz": "America/New_York"
  }
}'::jsonb
WHERE NOT (notif_prefs ? 'quiet_hours');
