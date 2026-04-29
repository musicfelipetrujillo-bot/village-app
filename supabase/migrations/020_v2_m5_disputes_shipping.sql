-- ─────────────────────────────────────────────────────────────
-- 020_v2_m5_disputes_shipping.sql
-- V2 Milk Connect — Phase M5 (disputes + shipping + analytics + legal acceptance)
--
-- Adds:
--   • milk_disputes — recipient or donor opens a dispute with reason + status
--   • milk_shipping_labels — Shippo-issued shipping labels per transaction
--   • milk_legal_acceptances — audit trail of accepted legal disclosures
--   • milk_analytics_events — server-side event log (analytics fallback)
--   • Trigger: open dispute marks tx.status = 'disputed'
--   • RLS for new tables
-- ─────────────────────────────────────────────────────────────

-- 1. Disputes
CREATE TABLE IF NOT EXISTS milk_disputes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      UUID NOT NULL REFERENCES milk_transactions(id),
  opened_by_user_id   UUID NOT NULL REFERENCES auth.users(id),
  opened_by_role      VARCHAR(20) NOT NULL CHECK (opened_by_role IN ('recipient','donor')),
  reason_code         VARCHAR(40) NOT NULL,
  -- reason_code: 'never_received','quality_concern','wrong_quantity','spoiled','no_show_pickup','other'
  description         TEXT NOT NULL,
  evidence_urls       TEXT[],
  status              VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','investigating','resolved_recipient','resolved_donor','withdrawn')),
  resolution_notes    TEXT,
  resolved_at         TIMESTAMPTZ,
  refund_amount_cents INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transaction_id)
);
ALTER TABLE milk_disputes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_milk_disputes_status ON milk_disputes (status);

CREATE TRIGGER trg_milk_disputes_updated_at
  BEFORE UPDATE ON milk_disputes
  FOR EACH ROW EXECUTE FUNCTION update_milk_updated_at();

-- 2. Trigger: opening a dispute marks the transaction
CREATE OR REPLACE FUNCTION mark_transaction_disputed()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE milk_transactions SET status = 'disputed' WHERE id = NEW.transaction_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_tx_disputed ON milk_disputes;
CREATE TRIGGER trg_mark_tx_disputed
  AFTER INSERT ON milk_disputes
  FOR EACH ROW EXECUTE FUNCTION mark_transaction_disputed();

-- 3. Shipping labels (Shippo)
CREATE TABLE IF NOT EXISTS milk_shipping_labels (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id           UUID NOT NULL REFERENCES milk_transactions(id) UNIQUE,
  shippo_transaction_id    TEXT NOT NULL,
  carrier                  VARCHAR(40),         -- 'usps','ups','fedex'
  service_level            VARCHAR(60),         -- 'usps_priority_express'
  tracking_number          TEXT,
  tracking_url             TEXT,
  label_url                TEXT,                -- PDF
  rate_cents               INTEGER,
  insurance_cents          INTEGER,
  status                   VARCHAR(30) NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','in_transit','delivered','exception','cancelled')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE milk_shipping_labels ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_milk_shipping_tx ON milk_shipping_labels (transaction_id);

CREATE TRIGGER trg_milk_shipping_updated_at
  BEFORE UPDATE ON milk_shipping_labels
  FOR EACH ROW EXECUTE FUNCTION update_milk_updated_at();

-- 4. Legal acceptances (audit trail)
CREATE TABLE IF NOT EXISTS milk_legal_acceptances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_key    VARCHAR(60) NOT NULL,
  -- 'milk_purchase_disclaimer_v1', 'donor_agreement_v1', 'shipping_disclosure_v1'
  document_version VARCHAR(20) NOT NULL,
  accepted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      INET,
  user_agent      TEXT,
  context         JSONB,        -- e.g. { "transaction_id": "..." }
  UNIQUE (user_id, document_key, document_version)
);
ALTER TABLE milk_legal_acceptances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_milk_legal_user_doc
  ON milk_legal_acceptances (user_id, document_key);

-- 5. Analytics events (server-side log — survives client analytics outages)
CREATE TABLE IF NOT EXISTS milk_analytics_events (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name   VARCHAR(80) NOT NULL,
  properties   JSONB,
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE milk_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_milk_events_name_time
  ON milk_analytics_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_milk_events_user_time
  ON milk_analytics_events (user_id, occurred_at DESC);

-- 6. RLS policies

-- Disputes: parties may see + open
CREATE POLICY "milk_disputes_select_party" ON milk_disputes
  FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM milk_transactions
      WHERE recipient_user_id = auth.uid()
         OR donor_profile_id IN (SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "milk_disputes_insert_party" ON milk_disputes
  FOR INSERT TO authenticated
  WITH CHECK (
    opened_by_user_id = auth.uid()
    AND transaction_id IN (
      SELECT id FROM milk_transactions
      WHERE recipient_user_id = auth.uid()
         OR donor_profile_id IN (SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "milk_disputes_service" ON milk_disputes
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Shipping labels: parties may read; only service writes (Shippo Edge Fn)
CREATE POLICY "milk_shipping_select_party" ON milk_shipping_labels
  FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM milk_transactions
      WHERE recipient_user_id = auth.uid()
         OR donor_profile_id IN (SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "milk_shipping_service" ON milk_shipping_labels
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Legal acceptances: user reads + writes own
CREATE POLICY "milk_legal_own" ON milk_legal_acceptances
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "milk_legal_service" ON milk_legal_acceptances
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Analytics: user inserts own events; service reads all
CREATE POLICY "milk_events_insert_own" ON milk_analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "milk_events_service" ON milk_analytics_events
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- 7. RPC: dispute view for a transaction
CREATE OR REPLACE FUNCTION get_dispute_for_transaction(p_transaction_id UUID)
RETURNS milk_disputes LANGUAGE sql STABLE AS $$
  SELECT * FROM milk_disputes WHERE transaction_id = p_transaction_id LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION get_dispute_for_transaction(UUID) TO authenticated;
