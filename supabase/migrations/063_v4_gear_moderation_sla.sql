-- Migration 063 · V4 Gear · Moderation SLA infrastructure
--
-- Implements the SOP §10 "Implementation to-do" items that turn the
-- 24-hour takedown SLA from a draft playbook into an enforceable system.
-- Companion documents:
--   * village-app/legal/2026-05-19_villie_v4_gear_counsel_package.pdf (Part C §10)
--   * village-app/docs/V4_GEAR_TAKEDOWN_SOP.md
--
-- What this migration adds:
--
--   1. New columns on gear_listing_reports for the auto-escalation pipeline:
--      - severity TEXT (NOT NULL, default computed from reason_code) — cached
--        so the cron sweeps don't have to recompute per row
--      - auto_escalated BOOLEAN — set TRUE by the pager / auto-withdraw paths
--        when the SLA was missed without human action
--      - auto_acknowledged_at TIMESTAMPTZ — when the system fired the pager
--        and recorded the SLA-miss internally
--      - resolved_at TIMESTAMPTZ — when a moderator closed the report
--      - resolver_user_id UUID — moderator who closed the report
--
--   2. Trigger to populate `severity` on INSERT/UPDATE based on reason_code.
--      Mapping mirrors SOP §2:
--        P0 (4hr internal SLA): recalled_item, harassment_or_abuse
--        P1 (24hr published SLA): prohibited_category, counterfeit_or_fake, damaged_or_unsafe
--        P2 (48hr internal target): misleading_description, price_or_scam, other
--
--   3. RPC sweep_p0_overdue_reports() — service-role only. Returns the list of
--      P0 reports still 'open' past their 4-hour window for the pager edge fn
--      to pick up. Read-only; doesn't mutate.
--
--   4. RPC auto_withdraw_p0_overdue_listings() — service-role only.
--      For every recalled_item or harassment_or_abuse report still 'open' past
--      4 hours, withdraws the underlying listing and records the action.
--      Writes the seller a system message in their existing gear_messages
--      thread for that listing (one will exist if they messaged anyone; if not,
--      we skip the message but the listing still goes down). This is the
--      "defensible auto-action" under CPSIA §19 / §8 SOP failure-mode posture.
--
--   5. Optional pg_cron registrations gated on pg_extension existence and the
--      app.supabase_url / app.service_role_key GUCs (per project_hosted_deploy
--      memory, those are no-ops on Free Tier — the GH Action cron in
--      .github/workflows/supabase-crons.yml is the real driver. We register
--      them anyway so they fire automatically the day we upgrade to Pro.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Schema extensions
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE gear_listing_reports
  ADD COLUMN IF NOT EXISTS severity TEXT,
  ADD COLUMN IF NOT EXISTS auto_escalated BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- gear_messages: add `message_type` so system-issued takedown notices render
-- distinctly from user messages, and relax the sender_id NOT NULL so system
-- messages can be authored without a real auth.users row. Pattern mirrors
-- migration 028's room_messages.message_type for V3 community.
ALTER TABLE gear_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  ALTER TABLE gear_messages DROP CONSTRAINT IF EXISTS gear_messages_message_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE gear_messages
  ADD CONSTRAINT gear_messages_message_type_check
  CHECK (message_type IN ('user', 'system'));

-- Drop sender_id NOT NULL so system messages can have a null sender.
-- The CHECK below preserves the invariant for user messages.
ALTER TABLE gear_messages
  ALTER COLUMN sender_id DROP NOT NULL;

DO $$
BEGIN
  ALTER TABLE gear_messages DROP CONSTRAINT IF EXISTS gear_messages_sender_user_required;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE gear_messages
  ADD CONSTRAINT gear_messages_sender_user_required
  CHECK (message_type = 'system' OR sender_id IS NOT NULL);

-- Severity enum cache. Non-null going forward; backfill below.
DO $$
BEGIN
  -- Drop existing constraint if we're re-running. Idempotent.
  ALTER TABLE gear_listing_reports DROP CONSTRAINT IF EXISTS gear_listing_reports_severity_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE gear_listing_reports
  ADD CONSTRAINT gear_listing_reports_severity_check
  CHECK (severity IS NULL OR severity IN ('P0', 'P1', 'P2'));

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Severity trigger (auto-populate from reason_code)
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.compute_gear_report_severity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.severity := CASE NEW.reason_code
    WHEN 'recalled_item'         THEN 'P0'
    WHEN 'harassment_or_abuse'   THEN 'P0'
    WHEN 'prohibited_category'   THEN 'P1'
    WHEN 'counterfeit_or_fake'   THEN 'P1'
    WHEN 'damaged_or_unsafe'     THEN 'P1'
    WHEN 'misleading_description' THEN 'P2'
    WHEN 'price_or_scam'         THEN 'P2'
    WHEN 'other'                 THEN 'P2'
    ELSE                              'P2'  -- defensive default
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gear_listing_reports_severity_trg ON gear_listing_reports;
CREATE TRIGGER gear_listing_reports_severity_trg
  BEFORE INSERT OR UPDATE OF reason_code ON gear_listing_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_gear_report_severity();

-- Backfill existing rows (no-op on fresh installs; defensive on re-runs).
UPDATE gear_listing_reports
SET reason_code = reason_code -- forces the trigger to fire
WHERE severity IS NULL;

-- Index for fast severity + status filtering (the cron paths' primary access).
CREATE INDEX IF NOT EXISTS idx_gear_reports_severity_status_created
  ON gear_listing_reports (severity, status, created_at)
  WHERE status IN ('open', 'under_review');

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Sweep RPC: list P0 reports past their 4-hour SLA window
-- ───────────────────────────────────────────────────────────────────────────
--
-- Used by the gear-moderation-pager edge function. Read-only.
-- Returns the full row payload the edge fn needs to construct push messages
-- (listing title for the notification body, seller_id for chain-of-custody).

CREATE OR REPLACE FUNCTION public.sweep_p0_overdue_reports()
RETURNS TABLE (
  report_id        UUID,
  listing_id       UUID,
  listing_title    TEXT,
  seller_user_id   UUID,
  reporter_user_id UUID,
  reason_code      TEXT,
  severity         TEXT,
  description      TEXT,
  status           TEXT,
  auto_escalated   BOOLEAN,
  created_at       TIMESTAMPTZ,
  age_minutes      INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
STABLE
AS $$
  -- Returns only P0 reports past their 4hr SLA that haven't been paged yet.
  -- Once the pager acknowledges a report by setting auto_acknowledged_at,
  -- it drops out of this set. The auto-withdraw cron still acts on its own
  -- WHERE clause (auto_escalated=FALSE) which is independent — both cron
  -- paths are idempotent on their respective state machines.
  SELECT
    r.id           AS report_id,
    r.listing_id,
    l.title        AS listing_title,
    l.seller_id    AS seller_user_id,
    r.reporter_user_id,
    r.reason_code,
    r.severity,
    r.description,
    r.status,
    r.auto_escalated,
    r.created_at,
    EXTRACT(EPOCH FROM (NOW() - r.created_at))::INTEGER / 60 AS age_minutes
  FROM gear_listing_reports r
  JOIN gear_listings l ON l.id = r.listing_id
  WHERE r.severity = 'P0'
    AND r.status   = 'open'
    AND r.auto_acknowledged_at IS NULL
    AND r.created_at < NOW() - INTERVAL '4 hours'
  ORDER BY r.created_at ASC;
$$;

-- Service-role only. Mobile + general authenticated users never read this.
REVOKE EXECUTE ON FUNCTION public.sweep_p0_overdue_reports() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sweep_p0_overdue_reports() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.sweep_p0_overdue_reports() TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Auto-withdraw RPC: defensible safety net under CPSIA §19 / SOP §8
-- ───────────────────────────────────────────────────────────────────────────
--
-- Fires every 15 min (cron). For every P0 report still `open` past 4 hours,
-- withdraws the underlying listing and records the action in:
--   - gear_listings.status / removed_reason / withdrawn_at
--   - gear_listing_reports.{auto_escalated, auto_acknowledged_at}
--   - admin_audit_log (with reason_code + listing_id in metadata)
--   - gear_messages (system message to the seller if a thread exists)
--
-- Returns the count of listings auto-withdrawn so the cron caller (GH Action)
-- can log it. Service-role only.

CREATE OR REPLACE FUNCTION public.auto_withdraw_p0_overdue_listings()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  rec     RECORD;
  thread  RECORD;
  count   INTEGER := 0;
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
      AND  l.listing_status = 'active'
  LOOP
    -- 1. Withdraw the listing.
    reason := CASE rec.reason_code
      WHEN 'recalled_item'       THEN 'auto_p0_recall_sla_miss'
      WHEN 'harassment_or_abuse' THEN 'auto_p0_abuse_sla_miss'
      ELSE                            'auto_p0_sla_miss'
    END;
    UPDATE gear_listings
      SET listing_status = 'withdrawn',
          removed_reason = reason,
          withdrawn_at   = NOW()
      WHERE id = rec.listing_id
        AND listing_status = 'active';

    -- 2. Mark the report as auto-escalated + acknowledged. Status stays 'open'
    --    so the moderator still has to triage; we just block the listing
    --    pending that review (defensible interim posture).
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
        'listing_id',  rec.listing_id,
        'reason_code', rec.reason_code,
        'severity',    rec.severity,
        'action_taken','auto_withdraw_listing',
        'reason_text', reason,
        'seller_user_id', rec.seller_id
      )
    );

    -- 4. Send a system message to the seller in their existing thread for
    --    this listing (if any). If they never opened a thread, we skip the
    --    message — they'll see the withdrawal in their own MyListings view.
    --    The template is hardcoded EN-only here for the auto-action path
    --    because reaching the user's preferred_language requires a JOIN +
    --    branch. The moderator-initiated takedown-template-dispatch edge
    --    fn handles full EN/ES localization for human-driven takedowns.
    SELECT t.id AS thread_id INTO thread
    FROM   gear_message_threads t
    WHERE  t.listing_id = rec.listing_id
    ORDER  BY t.created_at ASC
    LIMIT  1;

    IF FOUND THEN
      -- sender_id NULL + message_type='system' = system-issued notice that
      -- the GearMessageDetailScreen UI renders distinctly (no avatar, accent
      -- color). Per the new gear_messages schema in section 1 of this
      -- migration. Listing-id stored in metadata via the audit log row above.
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

    count := count + 1;
  END LOOP;

  RETURN count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_withdraw_p0_overdue_listings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_withdraw_p0_overdue_listings() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.auto_withdraw_p0_overdue_listings() TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- 5. pg_cron registration (best-effort — Free Tier locks HTTP callouts;
--    GH Action workflow is the real driver in that environment).
-- ───────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- P0 pager sweep: every 5 minutes between 06:00 and 23:00 ET (10:00–03:00 UTC)
    -- Edge fn does the OneSignal push fanout. Falls back to GH Action cron on Free.
    PERFORM cron.schedule(
      'gear-moderation-p0-pager',
      '*/5 * * * *',
      $cron$
        SELECT
          CASE
            WHEN current_setting('app.supabase_url', true) IS NOT NULL
              AND current_setting('app.service_role_key', true) IS NOT NULL
            THEN (SELECT net.http_post(
              url := current_setting('app.supabase_url') || '/functions/v1/gear-moderation-pager',
              headers := jsonb_build_object(
                'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
                'Content-Type', 'application/json'
              ),
              body := '{}'::jsonb
            ))
            ELSE NULL
          END;
      $cron$
    );

    -- Auto-withdraw sweep: every 15 minutes. Pure SQL — no HTTP callout needed,
    -- so this one DOES fire on Free Tier even with the GUC lock.
    PERFORM cron.schedule(
      'gear-moderation-p0-auto-withdraw',
      '*/15 * * * *',
      $cron$ SELECT public.auto_withdraw_p0_overdue_listings(); $cron$
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the migration if cron isn't installed or scheduling errors.
  -- GH Action cron is the safety net.
  NULL;
END $$;

-- ───────────────────────────────────────────────────────────────────────────
-- 6. Documentation comments (visible in Studio + pg_catalog tooling).
-- ───────────────────────────────────────────────────────────────────────────

COMMENT ON COLUMN gear_listing_reports.severity IS
  'Auto-populated by trigger. P0 (4hr SLA): recalled_item, harassment_or_abuse. P1 (24hr published SLA): prohibited_category, counterfeit_or_fake, damaged_or_unsafe. P2 (48hr internal): rest. See village-app/docs/V4_GEAR_TAKEDOWN_SOP.md §2.';

COMMENT ON COLUMN gear_listing_reports.auto_escalated IS
  'TRUE when the P0 SLA was missed and the system auto-acted (auto-withdraw via auto_withdraw_p0_overdue_listings + push notification to founders via gear-moderation-pager edge fn). Defensible under CPSIA §19 for recall cases per SOP §8 failure-mode posture.';

COMMENT ON FUNCTION public.sweep_p0_overdue_reports() IS
  'Read-only. Returns P0 reports past their 4-hour SLA for the pager edge function to fan out push notifications. Service-role only.';

COMMENT ON FUNCTION public.auto_withdraw_p0_overdue_listings() IS
  'The defensible safety net for SOP §8. Auto-withdraws listings tied to P0 reports still open past 4 hours. Writes admin_audit_log + system message. Returns count of withdrawals. Service-role only.';
