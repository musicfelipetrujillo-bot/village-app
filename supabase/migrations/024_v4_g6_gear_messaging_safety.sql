-- V4 Phase G6 — Gear messaging + reporting + legal disclosures + safe-meeting gate.
-- Spec:
--   docs/source/Village_Risk_and_Compliance.md §2.7 non-negotiables #6 (Safe
--     Meeting Guide before any contact reveal) and #7 (in-app Report mechanism
--     with 24hr human review of flagged items).
--   docs/source/Village_Risk_and_Compliance.md §3.1 — Gear Marketplace Addendum
--     (no-warranty, seller representations, platform-not-seller, safe-meeting
--     advisory) requires audit trail of informed acceptance.
--
-- What this migration does:
--   1. gear_message_threads + gear_messages — buyer↔seller chat scoped to a
--      listing. Threads are {buyer_user_id, seller_user_id, listing_id}; the
--      buyer is the party who tapped "Message seller" on a listing detail page.
--   2. gear_listing_reports — structured "Report this listing" submissions with
--      a reason_code enum, free-text description, and review status pipeline.
--      Feeds a future moderator dashboard; Risk & Compliance commits to 24hr
--      human review.
--   3. gear_legal_acceptances — audit trail of Gear Marketplace Addendum
--      acceptances (informed-consent pattern, mirrors milk_legal_acceptances).
--   4. gear_analytics_events — server-side log of compliance-relevant events
--      (safe_meeting_ack_shown, safe_meeting_ack_accepted, listing_reported,
--      legal_addendum_accepted) that survives client analytics outages.
--   5. Triggers + RPCs + RLS policies.

-- ────────────────────────────────────────────────────────────────────────────
-- 1. gear_message_threads
-- One row per (buyer, seller, listing). The buyer is always the one who taps
-- "Message seller"; the seller is gear_listings.seller_id. The listing_id is
-- required (unlike Milk, which allowed a nullable listing) because every Gear
-- conversation is anchored to a specific item.
--
-- safe_meeting_ack_at records when the buyer dismissed the Safe Meeting Guide
-- modal — we persist it so returning buyers on the same thread don't have to
-- re-ack on every message, but the gate still runs when they open a new thread
-- for a different listing.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gear_message_threads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id          UUID NOT NULL REFERENCES gear_listings(id) ON DELETE CASCADE,
  buyer_user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  safe_meeting_ack_at TIMESTAMPTZ,
  last_message_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gear_threads_no_self_chat CHECK (buyer_user_id <> seller_user_id),
  UNIQUE (listing_id, buyer_user_id)
);
ALTER TABLE gear_message_threads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gear_threads_buyer_last
  ON gear_message_threads (buyer_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_gear_threads_seller_last
  ON gear_message_threads (seller_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_gear_threads_listing
  ON gear_message_threads (listing_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. gear_messages
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gear_messages (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES gear_message_threads(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body      TEXT NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 2000),
  is_read   BOOLEAN NOT NULL DEFAULT FALSE,
  sent_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE gear_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gear_messages_thread_sent
  ON gear_messages (thread_id, sent_at DESC);

-- Trigger: bump thread.last_message_at when a message lands.
CREATE OR REPLACE FUNCTION bump_gear_thread_last_message()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE gear_message_threads
     SET last_message_at = NEW.sent_at
   WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_gear_thread_last_message ON gear_messages;
CREATE TRIGGER trg_bump_gear_thread_last_message
  AFTER INSERT ON gear_messages
  FOR EACH ROW EXECUTE FUNCTION bump_gear_thread_last_message();

-- ────────────────────────────────────────────────────────────────────────────
-- 3. gear_listing_reports — "Report this listing" with 24hr review SLA.
-- reason_code is a controlled vocabulary so the moderator queue can filter +
-- triage. `status` tracks the review pipeline: open → under_review → resolved
-- (or dismissed). A report ALSO auto-notifies service-role via a future
-- moderator cron — not wired here.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gear_listing_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id        UUID NOT NULL REFERENCES gear_listings(id) ON DELETE CASCADE,
  reporter_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason_code       TEXT NOT NULL CHECK (reason_code IN (
    'recalled_item',          -- buyer suspects it's under CPSC recall
    'prohibited_category',    -- car seat / pump / sleep positioner, etc.
    'counterfeit_or_fake',
    'damaged_or_unsafe',
    'misleading_description',
    'price_or_scam',
    'harassment_or_abuse',
    'other'
  )),
  description       TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 10 AND 2000),
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'under_review', 'resolved', 'dismissed'
  )),
  resolution_note   TEXT,
  resolved_at       TIMESTAMPTZ,
  resolved_by       UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE gear_listing_reports ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gear_reports_status_created
  ON gear_listing_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gear_reports_listing
  ON gear_listing_reports (listing_id);
CREATE INDEX IF NOT EXISTS idx_gear_reports_reporter
  ON gear_listing_reports (reporter_user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. gear_legal_acceptances — audit trail for Gear Marketplace Addendum.
-- Mirrors milk_legal_acceptances (Risk & Compliance §3.2 informed-consent).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gear_legal_acceptances (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_key     VARCHAR(60) NOT NULL,
  -- 'gear_marketplace_addendum_v1', 'gear_safe_meeting_v1'
  document_version VARCHAR(20) NOT NULL,
  accepted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address       INET,
  user_agent       TEXT,
  context          JSONB,   -- e.g. { "listing_id": "..." }
  UNIQUE (user_id, document_key, document_version)
);
ALTER TABLE gear_legal_acceptances ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gear_legal_user_doc
  ON gear_legal_acceptances (user_id, document_key);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. gear_analytics_events — server-side log (mirrors milk_analytics_events).
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gear_analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name  VARCHAR(80) NOT NULL,
  properties  JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE gear_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_gear_events_name_time
  ON gear_analytics_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_gear_events_user_time
  ON gear_analytics_events (user_id, occurred_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. RLS policies
-- ────────────────────────────────────────────────────────────────────────────

-- Threads: participants read + update; buyer-side inserts only (seller can't
-- cold-message a stranger). Service role full.
CREATE POLICY "gear_threads_select_party" ON gear_message_threads
  FOR SELECT TO authenticated
  USING (buyer_user_id = auth.uid() OR seller_user_id = auth.uid());

CREATE POLICY "gear_threads_insert_buyer" ON gear_message_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    buyer_user_id = auth.uid()
    AND seller_user_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM gear_listings l
      WHERE l.id = gear_message_threads.listing_id
        AND l.seller_id = gear_message_threads.seller_user_id
        AND l.status IN ('active','pending','sold')
    )
  );

-- Only the buyer can stamp safe_meeting_ack_at. last_message_at is bumped by
-- the trigger running SECURITY DEFINER (table owner) so authenticated policy
-- here just needs to allow the buyer's own ack.
CREATE POLICY "gear_threads_update_buyer_ack" ON gear_message_threads
  FOR UPDATE TO authenticated
  USING (buyer_user_id = auth.uid())
  WITH CHECK (buyer_user_id = auth.uid());

CREATE POLICY "gear_threads_service" ON gear_message_threads
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Messages: thread participants read + insert own.
CREATE POLICY "gear_messages_select_party" ON gear_messages
  FOR SELECT TO authenticated
  USING (
    thread_id IN (
      SELECT id FROM gear_message_threads
      WHERE buyer_user_id = auth.uid() OR seller_user_id = auth.uid()
    )
  );

CREATE POLICY "gear_messages_insert_party" ON gear_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND thread_id IN (
      SELECT id FROM gear_message_threads
      WHERE buyer_user_id = auth.uid() OR seller_user_id = auth.uid()
    )
  );

-- `is_read` flips: a participant can mark messages they RECEIVED as read.
-- We allow the row owner's counterpart to update — RLS can't express "only
-- toggle is_read", so we keep the rule simple and rely on the mark-read RPC.
CREATE POLICY "gear_messages_update_recipient" ON gear_messages
  FOR UPDATE TO authenticated
  USING (
    sender_id <> auth.uid()
    AND thread_id IN (
      SELECT id FROM gear_message_threads
      WHERE buyer_user_id = auth.uid() OR seller_user_id = auth.uid()
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND thread_id IN (
      SELECT id FROM gear_message_threads
      WHERE buyer_user_id = auth.uid() OR seller_user_id = auth.uid()
    )
  );

CREATE POLICY "gear_messages_service" ON gear_messages
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Reports: reporter reads + inserts own; service role reads all + resolves.
-- Reported listing's seller deliberately does NOT have read access — the
-- report pipeline is silent to the seller until moderation acts on it.
CREATE POLICY "gear_reports_select_own" ON gear_listing_reports
  FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());

CREATE POLICY "gear_reports_insert_own" ON gear_listing_reports
  FOR INSERT TO authenticated
  WITH CHECK (
    reporter_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM gear_listings l WHERE l.id = listing_id)
  );

CREATE POLICY "gear_reports_service" ON gear_listing_reports
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Legal acceptances: user reads + writes own; service role reads all.
CREATE POLICY "gear_legal_own" ON gear_legal_acceptances
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "gear_legal_service" ON gear_legal_acceptances
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Analytics: user inserts own; service reads all.
CREATE POLICY "gear_events_insert_own" ON gear_analytics_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "gear_events_service" ON gear_analytics_events
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ────────────────────────────────────────────────────────────────────────────
-- 7. RPC get_or_create_gear_thread
-- Returns an existing (listing, buyer) thread or creates a new one. Calling
-- user must be authenticated and CANNOT open a thread on their own listing.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_or_create_gear_thread(p_listing_id UUID)
RETURNS TABLE (
  thread_id         UUID,
  listing_id        UUID,
  seller_user_id    UUID,
  buyer_user_id     UUID,
  safe_meeting_ack_at TIMESTAMPTZ
)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_seller UUID;
  v_status TEXT;
  v_buyer  UUID := auth.uid();
  v_thread UUID;
BEGIN
  IF v_buyer IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT l.seller_id, l.status INTO v_seller, v_status
  FROM gear_listings l WHERE l.id = p_listing_id;

  IF v_seller IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;
  IF v_seller = v_buyer THEN
    RAISE EXCEPTION 'You cannot message your own listing';
  END IF;
  IF v_status NOT IN ('active','pending','sold') THEN
    RAISE EXCEPTION 'Listing is not available';
  END IF;

  SELECT t.id INTO v_thread
  FROM gear_message_threads t
  WHERE t.listing_id = p_listing_id AND t.buyer_user_id = v_buyer;

  IF v_thread IS NULL THEN
    INSERT INTO gear_message_threads (listing_id, buyer_user_id, seller_user_id)
    VALUES (p_listing_id, v_buyer, v_seller)
    RETURNING id INTO v_thread;
  END IF;

  RETURN QUERY
    SELECT t.id, t.listing_id, t.seller_user_id, t.buyer_user_id, t.safe_meeting_ack_at
    FROM gear_message_threads t WHERE t.id = v_thread;
END;
$$;

GRANT EXECUTE ON FUNCTION get_or_create_gear_thread(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. RPC list_my_gear_threads — inbox view for buyer + seller sides.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION list_my_gear_threads()
RETURNS TABLE (
  thread_id          UUID,
  listing_id         UUID,
  listing_title      TEXT,
  listing_cover_url  TEXT,
  listing_status     TEXT,
  other_user_id      UUID,
  other_display_name TEXT,
  other_avatar_url   TEXT,
  is_seller_side     BOOLEAN,
  last_message_body  TEXT,
  last_message_at    TIMESTAMPTZ,
  unread_count       INTEGER
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  WITH my_threads AS (
    SELECT
      t.*,
      (t.seller_user_id = auth.uid()) AS is_seller_side,
      CASE WHEN t.seller_user_id = auth.uid() THEN t.buyer_user_id
           ELSE t.seller_user_id END AS other_user_id
    FROM gear_message_threads t
    WHERE t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid()
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.thread_id)
      m.thread_id, m.body, m.sent_at
    FROM gear_messages m
    WHERE m.thread_id IN (SELECT id FROM my_threads)
    ORDER BY m.thread_id, m.sent_at DESC
  ),
  unread AS (
    SELECT m.thread_id, COUNT(*)::INT AS unread_count
    FROM gear_messages m
    WHERE m.thread_id IN (SELECT id FROM my_threads)
      AND m.is_read = FALSE
      AND m.sender_id <> auth.uid()
    GROUP BY m.thread_id
  ),
  cover AS (
    SELECT DISTINCT ON (i.listing_id) i.listing_id, i.image_url
    FROM gear_listing_images i
    WHERE i.listing_id IN (SELECT listing_id FROM my_threads)
    ORDER BY i.listing_id, i.sort_order ASC
  )
  SELECT
    t.id                                           AS thread_id,
    t.listing_id                                   AS listing_id,
    l.title                                        AS listing_title,
    c.image_url                                    AS listing_cover_url,
    l.status                                       AS listing_status,
    t.other_user_id                                AS other_user_id,
    COALESCE(u.raw_user_meta_data->>'full_name',
             u.email, 'Village member')            AS other_display_name,
    u.raw_user_meta_data->>'avatar_url'            AS other_avatar_url,
    t.is_seller_side                               AS is_seller_side,
    lm.body                                        AS last_message_body,
    COALESCE(lm.sent_at, t.last_message_at, t.created_at) AS last_message_at,
    COALESCE(un.unread_count, 0)                   AS unread_count
  FROM my_threads t
  JOIN gear_listings l ON l.id = t.listing_id
  LEFT JOIN cover    c ON c.listing_id = t.listing_id
  LEFT JOIN last_msg lm ON lm.thread_id = t.id
  LEFT JOIN unread   un ON un.thread_id = t.id
  LEFT JOIN auth.users u ON u.id = t.other_user_id
  ORDER BY COALESCE(lm.sent_at, t.last_message_at, t.created_at) DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION list_my_gear_threads() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 9. RPC mark_gear_thread_read
-- Flips is_read on every message in a thread that the caller did NOT send.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_gear_thread_read(p_thread_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM gear_message_threads t
    WHERE t.id = p_thread_id
      AND (t.buyer_user_id = auth.uid() OR t.seller_user_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE gear_messages
     SET is_read = TRUE
   WHERE thread_id = p_thread_id
     AND sender_id <> auth.uid()
     AND is_read = FALSE;
END;
$$;

REVOKE ALL ON FUNCTION mark_gear_thread_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_gear_thread_read(UUID) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. RPC ack_gear_safe_meeting
-- Stamps gear_message_threads.safe_meeting_ack_at so the buyer doesn't re-ack
-- on every message in the same thread. Caller must be the buyer.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ack_gear_safe_meeting(p_thread_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_ack TIMESTAMPTZ;
BEGIN
  UPDATE gear_message_threads
     SET safe_meeting_ack_at = COALESCE(safe_meeting_ack_at, now())
   WHERE id = p_thread_id
     AND buyer_user_id = auth.uid()
  RETURNING safe_meeting_ack_at INTO v_ack;

  IF v_ack IS NULL THEN
    RAISE EXCEPTION 'Thread not found or not owned by buyer';
  END IF;

  RETURN v_ack;
END;
$$;

GRANT EXECUTE ON FUNCTION ack_gear_safe_meeting(UUID) TO authenticated;
