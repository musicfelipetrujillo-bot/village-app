-- 071_v4_gear_auto_withdraw_fix.sql
--
-- HOTFIX: auto_withdraw_p0_overdue_listings() has been throwing
-- "column listing_status does not exist" 500s on every */15 cron firing
-- since the function landed in migration 063. Caught during 2026-05-24
-- post-deploy log review.
--
-- Root cause: the function was authored against a stale schema. The
-- actual gear_listings table uses:
--   - `status` (not `listing_status`)
--   - no separate `withdrawn_at` column — `updated_at` is auto-stamped
--     by the gear_listings_updated_at trigger
--
-- Fix: rebuild the function body with the correct column names.
-- Behaviour is otherwise identical to migration 063:
--   - Picks P0 + open + not-auto-escalated reports older than 4hr
--   - Withdraws the linked listing
--   - Stamps removed_reason with the per-reason-code action label
--   - Marks the report under_review + auto_escalated
--   - Inserts the FDUTPA/CPSIA §19 audit_log row
--   - Sends the system message to the existing thread (EN-only template
--     matches the moderator-driven path; full EN/ES localization lives
--     in gear-takedown-template-dispatch)
--
-- User-impact assessment for the 6-day failure window: gear marketplace
-- is effectively zero listings pre-launch, so no real listings ever hit
-- the auto-withdraw path during the failure. Defense file (admin_audit_log)
-- is intact for everything else; this gap is invisible from a compliance
-- standpoint because there's nothing to log.

CREATE OR REPLACE FUNCTION public.auto_withdraw_p0_overdue_listings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec     RECORD;
  thread  RECORD;
  withdraw_count INTEGER := 0;   -- renamed from `count` to avoid shadow
  reason  TEXT;
BEGIN
  FOR rec IN
    SELECT r.id AS report_id, r.listing_id, r.reason_code, r.severity,
           r.reporter_user_id, l.seller_id, l.title
    FROM   gear_listing_reports r
    JOIN   gear_listings l ON l.id = r.listing_id
    WHERE  r.severity = 'P0'
      AND  r.status   = 'open'
      AND  r.auto_escalated = FALSE
      AND  r.created_at < NOW() - INTERVAL '4 hours'
      AND  l.status = 'active'   -- was l.listing_status
  LOOP
    -- 1. Withdraw the listing.
    reason := CASE rec.reason_code
      WHEN 'recalled_item'       THEN 'auto_p0_recall_sla_miss'
      WHEN 'harassment_or_abuse' THEN 'auto_p0_abuse_sla_miss'
      ELSE                            'auto_p0_sla_miss'
    END;
    UPDATE gear_listings
      SET status         = 'withdrawn',  -- was listing_status
          removed_reason = reason
          -- updated_at stamped by the gear_listings_updated_at trigger
      WHERE id = rec.listing_id
        AND status = 'active';

    -- 2. Mark the report as auto-escalated + acknowledged. Status moves
    --    to 'under_review' so the moderator still has to triage; we just
    --    block the listing pending that review.
    UPDATE gear_listing_reports
      SET auto_escalated       = TRUE,
          auto_acknowledged_at = NOW(),
          status               = 'under_review'
      WHERE id = rec.report_id;

    -- 3. Audit log entry — the FDUTPA / CPSIA §19 defense file.
    INSERT INTO admin_audit_log (action, target_table, target_id, performed_by, metadata)
    VALUES (
      'gear_report_auto_escalated',
      'gear_listing_reports',
      rec.report_id,
      'system',
      jsonb_build_object(
        'listing_id',     rec.listing_id,
        'reason_code',    rec.reason_code,
        'severity',       rec.severity,
        'action_taken',   'auto_withdraw_listing',
        'reason_text',    reason,
        'seller_user_id', rec.seller_id
      )
    );

    -- 4. Send a system message to the seller in their existing thread for
    --    this listing (if any). Skip when no thread exists — they'll see
    --    the withdrawal in their own MyListings view.
    SELECT t.id AS thread_id INTO thread
    FROM   gear_message_threads t
    WHERE  t.listing_id = rec.listing_id
    ORDER  BY t.created_at ASC
    LIMIT  1;

    IF FOUND THEN
      INSERT INTO gear_messages (thread_id, sender_id, body, message_type)
      VALUES (
        thread.thread_id,
        NULL,
        CASE rec.reason_code
          WHEN 'recalled_item'
            THEN 'We''ve withdrawn this listing while we verify a reported CPSC recall match. This isn''t a strike on your account. A moderator will follow up.'
          WHEN 'harassment_or_abuse'
            THEN 'This listing has been paused while we review a safety-related report. A moderator will follow up.'
          ELSE 'This listing has been paused pending moderator review.'
        END,
        'system'
      );
    END IF;

    withdraw_count := withdraw_count + 1;
  END LOOP;

  RETURN withdraw_count;
END;
$$;

COMMENT ON FUNCTION public.auto_withdraw_p0_overdue_listings() IS
  'Cron-target: withdraws gear_listings tied to P0 reports past the 4hr SLA. '
  'Rewritten in 071 to use the correct status column (was listing_status). '
  'Idempotent — only acts on active listings + open, not-auto-escalated reports.';
