-- 083_v4_perks_rebrand_pampers_nara.sql
-- Rebrand two seed perks per founder request:
--   Comotomo        → Pampers        (discount code, diapers)
--   The Nesting Co. → Nara Organics  (partner offer, organic baby essentials)
-- Also clears Comotomo's Google-favicon logo (it rendered blank on device, which
-- is the "logo not showing" the founder flagged). Both logos are left NULL here so
-- the perk card shows a clean brand initial until the real logo screenshots are
-- uploaded to Storage and wired in a follow-up. Copy/codes/links updated to match
-- the new brands. Affiliate plumbing stays demo-stubbed (G3 network gate not live).

-- ── Comotomo → Pampers ─────────────────────────────────────────────────────────
UPDATE public.brand_deals
SET brand_name        = 'Pampers',
    title             = '20% off Pampers diapers',
    short_description = 'Trusted overnight protection, gentle on newborn skin.',
    long_description  = 'Use code VILLAGE20 at checkout on pampers.com. One use per customer. Excludes bundles.',
    terms_url         = 'https://www.pampers.com/en-us/terms-and-conditions',
    direct_url        = 'https://www.pampers.com',
    category          = 'gear',
    brand_logo_url    = NULL,
    updated_at        = now()
WHERE brand_name = 'Comotomo';

-- ── The Nesting Co. → Nara Organics ────────────────────────────────────────────
UPDATE public.brand_deals
SET brand_name              = 'Nara Organics',
    title                   = 'Partner: 20% off your first order',
    short_description       = 'Organic baby essentials, thoughtfully and cleanly made.',
    long_description        = 'Partner offer from Nara Organics. The Village earns a referral fee on qualifying purchases.',
    discount_label          = '20% off',
    category                = 'feeding',
    affiliate_url_template  = 'https://shareasale.com/r.cfm?b=nara&u=villagepartner&subid={subid}',
    affiliate_advertiser_id = 'SAS-NARA-123',
    brand_logo_url          = NULL,
    updated_at              = now()
WHERE brand_name = 'The Nesting Co.';
