-- 076_v4_picks_perks_images.sql
-- Real placeholder imagery for Villie's Picks (actual-item photos) + brand
-- logos for the perk partners.
--
-- Sources (all free / hotlink-permitted, used as PLACEHOLDERS until partner-
-- supplied assets are uploaded to Supabase Storage with rights):
--   • Picks → Open Library cover API (the book) + Unsplash (free license,
--     commercial OK, no attribution) for the item-type photos.
--   • Perk brand logos → Google's public favicon service (real brand marks).
-- Production note: replace with partner-provided / Storage-hosted assets — the
-- favicon marks are low-res for some brands and hotlinks can change.

-- ── Villie's Picks — actual-item photos ──────────────────────────────────────
UPDATE public.villie_picks SET image_url = 'https://covers.openlibrary.org/b/isbn/0694003611-L.jpg'
  WHERE name = 'Goodnight Moon';
UPDATE public.villie_picks SET image_url = 'https://images.unsplash.com/photo-1589827711524-0fb39b96e630?w=600&q=70&fit=crop'
  WHERE name = 'Lovevery play gym';
UPDATE public.villie_picks SET image_url = 'https://images.unsplash.com/photo-1544829832-c8047d6b9d89?w=600&q=70&fit=crop'
  WHERE name = 'First-spoons set';
UPDATE public.villie_picks SET image_url = 'https://images.unsplash.com/photo-1630304566704-780606056458?w=600&q=70&fit=crop'
  WHERE name = 'Hooded baby towels';

-- ── Perk partners — real brand logos ─────────────────────────────────────────
UPDATE public.brand_deals SET brand_logo_url = 'https://www.google.com/s2/favicons?sz=128&domain=lovevery.com'
  WHERE brand_name ILIKE 'Lovevery' AND (brand_logo_url IS NULL OR brand_logo_url = '');
UPDATE public.brand_deals SET brand_logo_url = 'https://www.google.com/s2/favicons?sz=128&domain=hibobbie.com'
  WHERE brand_name ILIKE 'Bobbie' AND (brand_logo_url IS NULL OR brand_logo_url = '');
UPDATE public.brand_deals SET brand_logo_url = 'https://www.google.com/s2/favicons?sz=128&domain=comotomo.com'
  WHERE brand_name ILIKE 'Comotomo' AND (brand_logo_url IS NULL OR brand_logo_url = '');
UPDATE public.brand_deals SET brand_logo_url = 'https://www.google.com/s2/favicons?sz=128&domain=uppababy.com'
  WHERE brand_name ILIKE 'UPPAbaby' AND (brand_logo_url IS NULL OR brand_logo_url = '');
UPDATE public.brand_deals SET brand_logo_url = 'https://www.google.com/s2/favicons?sz=128&domain=thenestingco.com'
  WHERE brand_name ILIKE 'Nesting Co%' AND (brand_logo_url IS NULL OR brand_logo_url = '');
