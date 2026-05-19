// V4 Gear · Moderation pager
//
// Pulls P0 reports past their 4-hour SLA and fires a push notification to
// each configured moderator (env-driven external_ids). Reuses the existing
// push-notify edge function for the actual OneSignal call.
//
// Triggered:
//   - Every 5 minutes by .github/workflows/supabase-crons.yml (Free Tier path)
//   - Every 5 minutes by pg_cron migration 063 (when GUCs are configured;
//     no-op on Free Tier)
//   - Manually via authenticated POST for testing
//
// Auth: service-role bearer token required.
//
// Env vars:
//   GEAR_MODERATOR_EXTERNAL_IDS  - comma-separated list of OneSignal external
//                                   IDs (= Supabase user IDs in this codebase
//                                   per useOneSignal hook). Founder +
//                                   co-founder for the transitional posture
//                                   per V4_GEAR_TAKEDOWN_SOP.md §3.
//   SUPABASE_URL                  - injected by Supabase Edge runtime
//   SUPABASE_SERVICE_ROLE_KEY     - injected
//
// Idempotency: every fired pager writes to admin_audit_log and ALSO sets
// gear_listing_reports.auto_acknowledged_at = NOW(), which the sweep RPC's
// implicit WHERE clause uses (status='open' AND auto_acknowledged_at IS NULL
// after migration 063 adds the column). Once acknowledged, the report
// won't re-fire from this pager — but the auto-withdraw cron will still
// act if no human moves the status off 'open' in time.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const MODERATOR_EXTERNAL_IDS = (Deno.env.get('GEAR_MODERATOR_EXTERNAL_IDS') ?? '')
  .split(',').map((s) => s.trim()).filter(Boolean);

interface OverdueReport {
  report_id: string;
  listing_id: string;
  listing_title: string;
  seller_user_id: string;
  reporter_user_id: string;
  reason_code: string;
  severity: string;
  description: string;
  status: string;
  auto_escalated: boolean;
  created_at: string;
  age_minutes: number;
}

function reasonLabel(code: string): string {
  switch (code) {
    case 'recalled_item':         return 'CPSC recall match';
    case 'harassment_or_abuse':   return 'Harassment / abuse';
    default:                       return code;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Auth: require service-role bearer. The cron call from GH Action carries
  // SUPABASE_SERVICE_ROLE_KEY in the Authorization header; manual test calls
  // can use the same.
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  if (MODERATOR_EXTERNAL_IDS.length === 0) {
    // No moderators configured. Log it and return cleanly — don't fail the
    // cron run, just no-op (the SOP's three structural risks are documented
    // and aware of this state).
    console.warn('[gear-moderation-pager] GEAR_MODERATOR_EXTERNAL_IDS empty; no-op');
    return new Response(JSON.stringify({
      ok: true, paged: 0, reason: 'no_moderators_configured',
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Pull overdue P0 reports via the SECURITY DEFINER sweep RPC.
  const { data: overdue, error: sweepErr } = await supabase
    .rpc('sweep_p0_overdue_reports');
  if (sweepErr) {
    console.error('[gear-moderation-pager] sweep failed', sweepErr);
    return new Response(JSON.stringify({ error: 'sweep_failed', detail: sweepErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const reports = (overdue ?? []) as OverdueReport[];
  // Only page on reports we haven't already paged for. The sweep returns
  // all P0 reports past 4hr regardless; we filter to !auto_escalated here
  // because the auto-withdraw cron flips that flag when it acts.
  const unpaged = reports.filter((r) => !r.auto_escalated);

  if (unpaged.length === 0) {
    return new Response(JSON.stringify({ ok: true, paged: 0, total_overdue: reports.length }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // 2. Fan out one push per overdue report. Batched would be more efficient
  // but we want each notification's body to carry the specific report context
  // (which listing, which reason) so the moderator can act without opening
  // an inbox first.
  let paged = 0;
  for (const r of unpaged) {
    const ageHours = Math.floor(r.age_minutes / 60);
    const title = r.reason_code === 'recalled_item'
      ? `CPSC recall report · ${ageHours}hr overdue`
      : `Safety report · ${ageHours}hr overdue`;
    const body = `${reasonLabel(r.reason_code)} on "${r.listing_title}". Tap to review.`;

    try {
      // Reuse the existing push-notify edge fn. It handles preference gating
      // but we pass bypass_prefs=true because this is a safety-tier
      // operational page, not a marketing/lifecycle push.
      const pushRes = await fetch(`${SUPABASE_URL}/functions/v1/push-notify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          external_ids: MODERATOR_EXTERNAL_IDS,
          title,
          body,
          data: {
            type: 'gear_moderation_p0',
            report_id: r.report_id,
            listing_id: r.listing_id,
            reason_code: r.reason_code,
          },
          bypass_prefs: true,
          respect_quiet_hours: false, // P0 wakes you up
        }),
      });
      if (!pushRes.ok) {
        console.warn(`[gear-moderation-pager] push failed for report ${r.report_id}: ${pushRes.status}`);
        continue;
      }

      // Audit-log the page. The chain of custody for the FDUTPA defense
      // file: we did, in fact, notify a human at this timestamp.
      await supabase.from('admin_audit_log').insert({
        action: 'gear_report_pager_fired',
        target_table: 'gear_listing_reports',
        target_id: r.report_id,
        performed_by: 'system',
        metadata: {
          listing_id: r.listing_id,
          reason_code: r.reason_code,
          severity: r.severity,
          age_minutes: r.age_minutes,
          paged_external_ids: MODERATOR_EXTERNAL_IDS,
        },
      });

      // Mark the report as acknowledged by the system so we don't re-page
      // every 5 minutes for the same report. The status stays 'open' —
      // human still has to triage.
      await supabase
        .from('gear_listing_reports')
        .update({ auto_acknowledged_at: new Date().toISOString() })
        .eq('id', r.report_id)
        .is('auto_acknowledged_at', null);

      paged += 1;
    } catch (err: any) {
      console.error(`[gear-moderation-pager] error processing report ${r.report_id}`, err);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    paged,
    total_overdue: reports.length,
    skipped_already_escalated: reports.length - unpaged.length,
  }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
