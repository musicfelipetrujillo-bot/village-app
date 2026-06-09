-- 073_v4_villie_picks.sql
-- Villie's Picks — weekly editorial product recommendations (books, toys, gear).
--
-- Kept separate from brand_deals (perks) on purpose: picks are curated product
-- recs (affiliate), NOT brand-partnership deals. Folding them into brand_deals
-- would leak picks into the whole perks vertical (PerksList, ai-perk-recommender,
-- the redemption webhook, claim flow). A small dedicated table is the clean
-- separation. Affiliate links here are simple URLs + FTC disclosure, not the
-- full perk redemption machinery.

CREATE TABLE IF NOT EXISTS public.villie_picks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  blurb                text NOT NULL,                         -- one-line "why we love it"
  emoji                text,                                  -- visual fallback until image_url is set
  image_url            text,                                  -- product / cover image (CDN)
  affiliate_url        text,                                  -- where "Get" goes (FTC-disclosed)
  category             text NOT NULL DEFAULT 'general',       -- book | toy | gear | feeding | ...
  eligibility_age_tags text[] NOT NULL DEFAULT '{}',          -- optional stage match
  sort_order           int  NOT NULL DEFAULT 0,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.villie_picks ENABLE ROW LEVEL SECURITY;

-- Public read of active picks for signed-in users; writes are editorial (service role).
DROP POLICY IF EXISTS villie_picks_read_active ON public.villie_picks;
CREATE POLICY villie_picks_read_active ON public.villie_picks
  FOR SELECT TO authenticated
  USING (is_active = true);

REVOKE ALL ON public.villie_picks FROM anon;
GRANT SELECT ON public.villie_picks TO authenticated;

-- Seed — first editorial set. Emoji placeholders; swap for real images +
-- affiliate URLs as the picks are curated. Affiliate URLs left NULL for now.
INSERT INTO public.villie_picks (name, blurb, emoji, category, eligibility_age_tags, sort_order) VALUES
  ('Goodnight Moon',     'The bedtime classic, on repeat',  '📖', 'book',    '{}', 1),
  ('Lovevery play gym',  'The one toy worth the hype now',  '🧸', 'toy',     ARRAY['postpartum_0_6mo','postpartum_6_12mo'], 2),
  ('First-spoons set',   'For the solids mess ahead',       '🥄', 'feeding', ARRAY['postpartum_6_12mo'], 3),
  ('Hooded baby towels', 'Soft, oversized, fast-drying',    '🛁', 'gear',    '{}', 4)
ON CONFLICT DO NOTHING;
