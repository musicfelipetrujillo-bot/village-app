-- V4 Phase G3 — Brand Perks + Affiliate Tracking
-- Spec: docs/source/Village_Feature_Specs.md § Spec 4 (Brand Perks)
-- Scope v1: stub-network support (impact|shareasale|cj|direct|none).
-- FTC: every partner/affiliate deal surfaces a disclosure in-app — see PerkDetailScreen.

-- ────────────────────────────────────────────────────────────────────────────
-- brand_deals — catalog
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE brand_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Brand identity
  brand_name TEXT NOT NULL,
  brand_logo_url TEXT,
  hero_image_url TEXT,

  -- Offer
  title TEXT NOT NULL,
  short_description TEXT NOT NULL,
  long_description TEXT NOT NULL,
  terms_url TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'feeding','sleep','gear','apparel','health','learning','services','other'
  )),

  -- Deal type + redemption
  deal_type TEXT NOT NULL CHECK (deal_type IN (
    'discount_code','affiliate_link','free_sample','partner_offer'
  )),
  redemption_method TEXT NOT NULL CHECK (redemption_method IN (
    'show_code','tap_link','request_sample'
  )),
  discount_code TEXT,                              -- null unless deal_type='discount_code'
  discount_label TEXT,                             -- "20% off", "$10 off $50", etc.

  -- Affiliate plumbing (stubbed for v1 — networks go live per-partner later)
  affiliate_network TEXT NOT NULL DEFAULT 'none'
    CHECK (affiliate_network IN ('impact','shareasale','cj','direct','none')),
  affiliate_url_template TEXT,                     -- e.g. 'https://...?subid={subid}'
  affiliate_advertiser_id TEXT,                    -- network's id for this brand
  direct_url TEXT,                                 -- used when affiliate_network='none' or 'direct'

  -- Eligibility
  eligibility_age_tags TEXT[] NOT NULL DEFAULT '{}',  -- subset of {'pregnancy','0-3mo','3-6mo','6-12mo','12mo+'}
  eligibility_countries TEXT[] NOT NULL DEFAULT ARRAY['US'],

  -- Flags
  is_partner BOOLEAN NOT NULL DEFAULT FALSE,       -- curated partner (prominent slot)
  disclosure_required BOOLEAN NOT NULL DEFAULT TRUE, -- FTC: always true when affiliate or partner

  -- Lifecycle
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','paused','ended')),
  sort_priority INTEGER NOT NULL DEFAULT 0,        -- higher = shown first

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT code_when_discount CHECK (
    deal_type <> 'discount_code' OR discount_code IS NOT NULL
  ),
  CONSTRAINT url_when_affiliate CHECK (
    deal_type <> 'affiliate_link' OR (affiliate_url_template IS NOT NULL OR direct_url IS NOT NULL)
  )
);

CREATE INDEX idx_brand_deals_status   ON brand_deals(status);
CREATE INDEX idx_brand_deals_category ON brand_deals(category);
CREATE INDEX idx_brand_deals_sort     ON brand_deals(sort_priority DESC, created_at DESC);
CREATE INDEX idx_brand_deals_age_tags ON brand_deals USING GIN(eligibility_age_tags);

CREATE OR REPLACE FUNCTION touch_brand_deals_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_brand_deals_updated_at
  BEFORE UPDATE ON brand_deals
  FOR EACH ROW EXECUTE FUNCTION touch_brand_deals_updated_at();

-- ────────────────────────────────────────────────────────────────────────────
-- deal_claims — per-user claims / clicks / conversions
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE deal_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deal_id UUID NOT NULL REFERENCES brand_deals(id) ON DELETE CASCADE,

  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subid TEXT NOT NULL,                             -- tracking id sent to affiliate network
  click_url TEXT,                                  -- resolved affiliate URL or direct_url
  revealed_code TEXT,                              -- snapshot of discount_code at claim time

  -- Webhook-updated (see perks-redemption-webhook)
  webhook_confirmed_at TIMESTAMPTZ,
  converted_amount_cents INTEGER,
  network_order_id TEXT,

  status TEXT NOT NULL DEFAULT 'clicked'
    CHECK (status IN ('clicked','confirmed','expired')),

  UNIQUE (user_id, deal_id, subid)
);

CREATE INDEX idx_deal_claims_user  ON deal_claims(user_id, claimed_at DESC);
CREATE INDEX idx_deal_claims_deal  ON deal_claims(deal_id);
CREATE INDEX idx_deal_claims_subid ON deal_claims(subid);

-- ────────────────────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE brand_deals  ENABLE ROW LEVEL SECURITY;
ALTER TABLE deal_claims  ENABLE ROW LEVEL SECURITY;

-- brand_deals: public read of active deals; service-role writes.
CREATE POLICY "brand_deals_public_read" ON brand_deals
  FOR SELECT USING (status = 'active');
CREATE POLICY "brand_deals_service_write" ON brand_deals
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- deal_claims: own-only read + insert; updates only via service role (webhook).
CREATE POLICY "deal_claims_own_read" ON deal_claims
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "deal_claims_own_insert" ON deal_claims
  FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "deal_claims_service_update" ON deal_claims
  FOR UPDATE USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: list_perks — eligibility-filtered feed
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_perks(
  p_age_tags TEXT[] DEFAULT NULL,
  p_country TEXT DEFAULT 'US',
  p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  brand_name TEXT, brand_logo_url TEXT, hero_image_url TEXT,
  title TEXT, short_description TEXT, category TEXT,
  deal_type TEXT, redemption_method TEXT, discount_label TEXT,
  affiliate_network TEXT,
  eligibility_age_tags TEXT[],
  is_partner BOOLEAN, disclosure_required BOOLEAN,
  ends_at TIMESTAMPTZ,
  already_claimed BOOLEAN
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    d.id,
    d.brand_name, d.brand_logo_url, d.hero_image_url,
    d.title, d.short_description, d.category,
    d.deal_type, d.redemption_method, d.discount_label,
    d.affiliate_network,
    d.eligibility_age_tags,
    d.is_partner, d.disclosure_required,
    d.ends_at,
    EXISTS (
      SELECT 1 FROM deal_claims c
      WHERE c.deal_id = d.id AND c.user_id = auth.uid()
    ) AS already_claimed
  FROM brand_deals d
  WHERE d.status = 'active'
    AND (d.starts_at IS NULL OR d.starts_at <= now())
    AND (d.ends_at   IS NULL OR d.ends_at   >  now())
    AND (p_country IS NULL OR p_country = ANY(d.eligibility_countries))
    AND (p_category IS NULL OR d.category = p_category)
    AND (
      p_age_tags IS NULL
      OR cardinality(d.eligibility_age_tags) = 0
      OR d.eligibility_age_tags && p_age_tags
    )
  ORDER BY d.is_partner DESC, d.sort_priority DESC, d.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_perks TO authenticated, anon;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: claim_perk — records click, returns redemption payload
-- Returns the resolved click_url (with SubID interpolated) and/or the discount code.
-- Idempotent per (user,deal,subid); we issue a fresh subid on each call to support re-clicks.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION claim_perk(p_deal_id UUID)
RETURNS TABLE (
  claim_id UUID,
  click_url TEXT,
  discount_code TEXT,
  deal_type TEXT,
  redemption_method TEXT,
  subid TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user UUID := auth.uid();
  v_deal brand_deals;
  v_subid TEXT;
  v_url TEXT;
  v_claim_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not signed in';
  END IF;

  SELECT * INTO v_deal FROM brand_deals WHERE id = p_deal_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'deal not found or inactive';
  END IF;

  -- SubID: stable per (user,deal) today, plus a random tail so re-clicks are distinguishable.
  v_subid := 'v_' || encode(substring(digest(v_user::text || ':' || p_deal_id::text, 'sha256') from 1 for 8), 'hex')
             || '_' || substring(md5(random()::text) from 1 for 6);

  -- Build click_url
  IF v_deal.deal_type IN ('affiliate_link','partner_offer') THEN
    IF v_deal.affiliate_url_template IS NOT NULL THEN
      v_url := replace(v_deal.affiliate_url_template, '{subid}', v_subid);
    ELSE
      v_url := v_deal.direct_url;
    END IF;
  ELSIF v_deal.deal_type = 'discount_code' THEN
    v_url := v_deal.direct_url;   -- optional landing page to use code on
  ELSE
    v_url := v_deal.direct_url;
  END IF;

  INSERT INTO deal_claims (user_id, deal_id, subid, click_url, revealed_code)
  VALUES (v_user, p_deal_id, v_subid, v_url, v_deal.discount_code)
  RETURNING id INTO v_claim_id;

  RETURN QUERY SELECT
    v_claim_id,
    v_url,
    v_deal.discount_code,
    v_deal.deal_type,
    v_deal.redemption_method,
    v_subid;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_perk TO authenticated;

-- pgcrypto (for digest) — used by claim_perk
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ────────────────────────────────────────────────────────────────────────────
-- RPC: list_my_claims — history
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_my_claims()
RETURNS TABLE (
  claim_id UUID, claimed_at TIMESTAMPTZ, status TEXT,
  webhook_confirmed_at TIMESTAMPTZ, converted_amount_cents INTEGER,
  revealed_code TEXT, click_url TEXT,
  deal_id UUID, brand_name TEXT, title TEXT, deal_type TEXT,
  brand_logo_url TEXT, category TEXT
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    c.id, c.claimed_at, c.status,
    c.webhook_confirmed_at, c.converted_amount_cents,
    c.revealed_code, c.click_url,
    d.id, d.brand_name, d.title, d.deal_type,
    d.brand_logo_url, d.category
  FROM deal_claims c
  JOIN brand_deals d ON d.id = c.deal_id
  WHERE c.user_id = auth.uid()
  ORDER BY c.claimed_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_my_claims TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- Seed: 4 sample deals (1 per deal_type)
-- ────────────────────────────────────────────────────────────────────────────
INSERT INTO brand_deals (
  brand_name, title, short_description, long_description, category,
  deal_type, redemption_method, discount_code, discount_label,
  affiliate_network, direct_url,
  eligibility_age_tags, is_partner, sort_priority, terms_url
) VALUES
  ('Comotomo',
   '20% off Comotomo bottles',
   'Soft silicone bottles loved by breastfed babies.',
   'Use code VILLAGE20 at checkout on comotomo.com. One use per customer. Excludes bundles.',
   'feeding',
   'discount_code', 'show_code', 'VILLAGE20', '20% off',
   'none', 'https://www.comotomo.com',
   ARRAY['pregnancy','0-3mo','3-6mo','6-12mo'], TRUE, 100,
   'https://www.comotomo.com/terms'),
  ('UPPAbaby',
   'Explore UPPAbaby strollers',
   'Premium strollers from a family-owned brand.',
   'Browse UPPAbaby''s current lineup. The Village may earn a commission on qualifying purchases.',
   'gear',
   'affiliate_link', 'tap_link', NULL, 'Shop now',
   'impact', 'https://uppababy.com/?subid={subid}',
   ARRAY['pregnancy','0-3mo','3-6mo','6-12mo','12mo+'], FALSE, 50,
   'https://uppababy.com/terms'),
  ('Bobbie Formula',
   'Free sample — Bobbie organic formula',
   'Request a free single-serve sample shipped to your door.',
   'Bobbie ships a free sample. Available to US addresses. Limit 1 per household.',
   'feeding',
   'free_sample', 'request_sample', NULL, 'Free sample',
   'none', 'https://hibobbie.com/free-sample',
   ARRAY['pregnancy','0-3mo'], TRUE, 80,
   'https://hibobbie.com/terms');

INSERT INTO brand_deals (
  brand_name, title, short_description, long_description, category,
  deal_type, redemption_method, discount_label,
  affiliate_network, affiliate_url_template, affiliate_advertiser_id,
  eligibility_age_tags, is_partner, disclosure_required, sort_priority
) VALUES
  ('The Nesting Co.',
   'Partner: $25 off first month',
   'Curated monthly box — activities, books, and gear matched to your baby''s age.',
   'Partner offer from The Nesting Co. The Village earns a referral fee on qualifying purchases.',
   'learning',
   'partner_offer', 'tap_link', '$25 off',
   'shareasale', 'https://shareasale.com/r.cfm?b=nesting&u=villagepartner&subid={subid}', 'SAS-NESTING-123',
   ARRAY['0-3mo','3-6mo','6-12mo','12mo+'], TRUE, TRUE, 120);
