-- ─────────────────────────────────────────────────────────────
-- 018_v2_m3_purchase.sql
-- V2 Milk Connect — Phase M3 (purchase flow + address reveal)
--
-- Adds:
--   • Tracking columns on milk_transactions for SMS + address-reveal lifecycle
--   • Indexes for recipient/donor order history queries
--   • Trigger: on transaction INSERT, decrement listing supply atomically
--   • RPC: get_donor_pickup_address (service-role only — used by SMS reveal)
--   • RPC: list_my_orders (recipient order history)
-- ─────────────────────────────────────────────────────────────

-- 1a. Add address + phone to donor profile (post-payment reveal)
ALTER TABLE milk_donor_profiles
  ADD COLUMN IF NOT EXISTS address_line TEXT,
  ADD COLUMN IF NOT EXISTS phone        VARCHAR(30);

-- 1b. Add lifecycle tracking columns to transactions
ALTER TABLE milk_transactions
  ADD COLUMN IF NOT EXISTS donor_notified_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recipient_notified_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS address_revealed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pickup_confirmed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recipient_address_line TEXT,
  ADD COLUMN IF NOT EXISTS recipient_city         TEXT,
  ADD COLUMN IF NOT EXISTS recipient_state        TEXT,
  ADD COLUMN IF NOT EXISTS recipient_zip          TEXT,
  ADD COLUMN IF NOT EXISTS recipient_notes        TEXT;

-- 2. Indexes for order-history queries
CREATE INDEX IF NOT EXISTS idx_milk_tx_recipient_created
  ON milk_transactions (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_milk_tx_donor_created
  ON milk_transactions (donor_profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_milk_tx_status
  ON milk_transactions (status)
  WHERE status IN ('pending','paid');

-- 3. Atomic listing-supply decrement on transaction PAID
CREATE OR REPLACE FUNCTION decrement_listing_supply()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only run when status transitions INTO 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    UPDATE milk_listings
       SET oz_available = GREATEST(oz_available - NEW.oz_purchased, 0),
           status = CASE
             WHEN oz_available - NEW.oz_purchased <= 0 THEN 'sold_out'
             ELSE status
           END
     WHERE id = NEW.listing_id;

    UPDATE milk_donor_profiles
       SET supply_oz_available = GREATEST(supply_oz_available - NEW.oz_purchased, 0)
     WHERE id = NEW.donor_profile_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_listing_supply ON milk_transactions;
CREATE TRIGGER trg_decrement_listing_supply
  AFTER INSERT OR UPDATE OF status ON milk_transactions
  FOR EACH ROW EXECUTE FUNCTION decrement_listing_supply();

-- 4. RPC: order history for current recipient
CREATE OR REPLACE FUNCTION list_my_orders(p_user_id UUID)
RETURNS TABLE (
  id                    UUID,
  donor_profile_id      UUID,
  donor_display_name    TEXT,
  donor_avatar_url      TEXT,
  oz_purchased          INTEGER,
  total_charged_cents   INTEGER,
  fulfillment_method    TEXT,
  status                TEXT,
  address_revealed_at   TIMESTAMPTZ,
  created_at            TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
  SELECT
    t.id,
    t.donor_profile_id,
    p.display_name,
    p.avatar_url,
    t.oz_purchased,
    t.total_charged_cents,
    t.fulfillment_method::TEXT,
    t.status::TEXT,
    t.address_revealed_at,
    t.created_at
  FROM milk_transactions t
  JOIN milk_donor_profiles p ON p.id = t.donor_profile_id
  WHERE t.recipient_user_id = p_user_id
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION list_my_orders(UUID) TO authenticated;

-- 5. RPC: pickup address fetch — SECURITY DEFINER, only callable by transaction parties
CREATE OR REPLACE FUNCTION get_transaction_pickup_address(p_transaction_id UUID)
RETURNS TABLE (
  donor_address_line   TEXT,
  donor_city           TEXT,
  donor_state          TEXT,
  donor_zip            TEXT,
  donor_phone          TEXT,
  donor_display_name   TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_recipient UUID;
  v_status    TEXT;
BEGIN
  SELECT recipient_user_id, status INTO v_recipient, v_status
  FROM milk_transactions WHERE id = p_transaction_id;

  -- Only the paying recipient may see address, and only after payment
  IF v_recipient <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_status NOT IN ('paid','fulfilled') THEN
    RAISE EXCEPTION 'Address not yet revealed';
  END IF;

  RETURN QUERY
  SELECT p.address_line, p.city, p.state, p.zip_code, p.phone, p.display_name
  FROM milk_transactions t
  JOIN milk_donor_profiles p ON p.id = t.donor_profile_id
  WHERE t.id = p_transaction_id;
END;
$$;

GRANT EXECUTE ON FUNCTION get_transaction_pickup_address(UUID) TO authenticated;
