-- Felipe 2026-05-28: TestFlight gear listings looked blank/odd without
-- product images. This seeds one category-themed Unsplash photo per
-- placeholder listing so the browse experience reads as populated.
--
-- These are pre-launch seed images only — real users will replace with
-- their own uploads as soon as they list. Once real listings outnumber
-- seed ones, this whole block can be deleted with no downstream impact.
--
-- Image strategy: use Unsplash's redirect-by-keyword URLs. Each request
-- returns a fresh random photo matching the search term. Stable enough
-- for visual polish; not stable for tests, which is fine — these are
-- placeholders, not fixtures.
--
-- Run in Supabase Studio SQL editor:
-- https://supabase.com/dashboard/project/albyndcruwopulazvpjs/sql/new

-- Stroller — UPPAbaby Minu V2
INSERT INTO gear_listing_images (listing_id, image_url, sort_order)
VALUES ('ad271b03-6d55-4599-a635-e898e74ee236',
        'https://images.unsplash.com/photo-1610202995548-aaca6dad24c8?w=900&h=900&fit=crop&q=80',
        0)
ON CONFLICT DO NOTHING;

-- Carrier — Ergobaby Omni 360
INSERT INTO gear_listing_images (listing_id, image_url, sort_order)
VALUES ('3b05fc63-7277-451b-97dd-6aa678a6e94a',
        'https://images.unsplash.com/photo-1503944168849-8bf86e1635b2?w=900&h=900&fit=crop&q=80',
        0)
ON CONFLICT DO NOTHING;

-- High chair — Stokke Tripp Trapp
INSERT INTO gear_listing_images (listing_id, image_url, sort_order)
VALUES ('2c0fff2c-9a94-4a7d-a0d6-37c2d161a4f4',
        'https://images.unsplash.com/photo-1518152006812-edab29b069ac?w=900&h=900&fit=crop&q=80',
        0)
ON CONFLICT DO NOTHING;

-- Bouncer — 4moms MamaRoo 4
INSERT INTO gear_listing_images (listing_id, image_url, sort_order)
VALUES ('2f785944-634b-4117-868b-30b88d6d048a',
        'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=900&h=900&fit=crop&q=80',
        0)
ON CONFLICT DO NOTHING;

-- Activity center — Lovevery Play Gym (FREE)
INSERT INTO gear_listing_images (listing_id, image_url, sort_order)
VALUES ('dee4140d-3570-4df0-b96b-cf2f29635b0b',
        'https://images.unsplash.com/photo-1606092195730-5d7b9af1efc5?w=900&h=900&fit=crop&q=80',
        0)
ON CONFLICT DO NOTHING;

-- Feeding gear — Comotomo bottles
INSERT INTO gear_listing_images (listing_id, image_url, sort_order)
VALUES ('fc89bc9b-d6ae-42df-a7c7-e95c2bf407c4',
        'https://images.unsplash.com/photo-1599116493329-65f88069be37?w=900&h=900&fit=crop&q=80',
        0)
ON CONFLICT DO NOTHING;

-- Clothing bundle — Carter's 0-3mo (12 pieces)
INSERT INTO gear_listing_images (listing_id, image_url, sort_order)
VALUES ('eaad6ecd-68ec-4805-8a57-6d44b8143f53',
        'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=900&h=900&fit=crop&q=80',
        0)
ON CONFLICT DO NOTHING;

-- Toy — Melissa & Doug wooden puzzle bundle
INSERT INTO gear_listing_images (listing_id, image_url, sort_order)
VALUES ('1b701c7e-ccfe-4bb0-b63d-d0863c90d1e5',
        'https://images.unsplash.com/photo-1567448400815-59d0ef6c4b78?w=900&h=900&fit=crop&q=80',
        0)
ON CONFLICT DO NOTHING;

-- Verify
SELECT gl.title, gl.brand, COUNT(gli.id) AS images
FROM gear_listings gl
LEFT JOIN gear_listing_images gli ON gli.listing_id = gl.id
GROUP BY gl.id, gl.title, gl.brand
ORDER BY gl.title;
