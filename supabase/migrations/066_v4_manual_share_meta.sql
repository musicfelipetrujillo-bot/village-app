-- 066_v4_manual_share_meta.sql
--
-- Anon-callable public share metadata for The Manual.
--
-- Why this needs to be anon-callable:
--   When someone shares a Manual video on Instagram/X/SMS, the recipient
--   clicks the URL (https://villieapp.com/m/?v=<id>) and lands on the
--   marketing site WITHOUT being logged in to villie. The landing page
--   needs to fetch the video's title/thumbnail/description so it can
--   render a respectable preview + Open-in-app CTA.
--
-- Why we can't reuse list_manual_videos:
--   list_manual_videos is granted to `authenticated, service_role` only,
--   and it returns per-user state (is_watched, is_saved) that anon must
--   not see.
--
-- What this returns:
--   Strictly the *public* preview fields — title, description, thumbnail
--   url, duration, audience+category for "back to villie" deeplinks.
--   No watch state, no save state, no user-keyed columns. SECURITY DEFINER
--   so anon can call but the function itself enforces the approval gate
--   (review_status='approved') against the underlying table.

CREATE OR REPLACE FUNCTION get_manual_video_share_meta(p_video_id UUID)
RETURNS TABLE (
  id              UUID,
  audience        TEXT,
  category        TEXT,
  title           TEXT,
  description     TEXT,
  duration_seconds INT,
  thumbnail_url   TEXT,
  poster_url      TEXT,
  has_captions_en BOOLEAN,
  has_captions_es BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    mv.id,
    mv.audience,
    mv.category,
    mv.title,
    mv.description,
    mv.duration_seconds,
    mv.thumbnail_url,
    mv.poster_url,
    mv.has_captions_en,
    mv.has_captions_es
  FROM manual_videos mv
  WHERE mv.id = p_video_id
    AND mv.review_status = 'approved';
$$;

REVOKE EXECUTE ON FUNCTION get_manual_video_share_meta(UUID) FROM PUBLIC;
-- anon is the role used by the Supabase REST API when no auth header is
-- present. The landing page uses the anon key to call this RPC.
GRANT  EXECUTE ON FUNCTION get_manual_video_share_meta(UUID) TO anon, authenticated, service_role;
