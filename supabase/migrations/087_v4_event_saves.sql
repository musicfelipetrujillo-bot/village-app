-- 087_v4_event_saves.sql
-- "Saved plans" — let moms bookmark events into a wishlist, separate from RSVP
-- (RSVP = "I'm going"; save = "keep this for later"). Mirrors the
-- gear_saved_listings / milk_saved_donors own-only pattern.
CREATE TABLE IF NOT EXISTS public.event_saves (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id  UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  saved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS idx_event_saves_user ON public.event_saves(user_id);

ALTER TABLE public.event_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY event_saves_select_own ON public.event_saves
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY event_saves_insert_own ON public.event_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY event_saves_delete_own ON public.event_saves
  FOR DELETE USING (auth.uid() = user_id);

-- RPC: the caller's saved upcoming events, EventCard-shaped so the Saved Plans
-- screen can render them with the same card as the events list.
CREATE OR REPLACE FUNCTION public.list_my_saved_events()
RETURNS TABLE (
  id UUID, type TEXT, title TEXT, description TEXT,
  cover_image_url TEXT, host_name TEXT, host_avatar_url TEXT,
  is_partner BOOLEAN, is_third_party BOOLEAN,
  starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, timezone TEXT,
  capacity INTEGER, age_tags TEXT[],
  venue_name TEXT, address TEXT, city TEXT,
  lat DOUBLE PRECISION, lng DOUBLE PRECISION, distance_km DOUBLE PRECISION,
  stream_url TEXT, platform TEXT,
  is_free BOOLEAN, price_cents INTEGER, status TEXT,
  going_count INTEGER, saved_at TIMESTAMPTZ
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
  SELECT
    e.id, e.type, e.title, e.description,
    e.cover_image_url, e.host_name, e.host_avatar_url,
    e.is_partner, e.is_third_party,
    e.starts_at, e.ends_at, e.timezone,
    e.capacity, e.age_tags,
    e.venue_name, e.address, e.city,
    CASE WHEN e.location IS NOT NULL THEN ST_Y(e.location::geometry) END,
    CASE WHEN e.location IS NOT NULL THEN ST_X(e.location::geometry) END,
    NULL::DOUBLE PRECISION,
    e.stream_url, e.platform,
    e.is_free, e.price_cents, e.status,
    (SELECT COUNT(*)::INTEGER FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going'),
    s.saved_at
  FROM event_saves s
  JOIN events e ON e.id = s.event_id
  WHERE s.user_id = auth.uid()
    AND e.status IN ('upcoming', 'live')
    AND e.ends_at > now()
  ORDER BY e.starts_at;
$$;

REVOKE EXECUTE ON FUNCTION public.list_my_saved_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_my_saved_events() TO authenticated, service_role;
