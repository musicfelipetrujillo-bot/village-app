// Edge Function: refresh-stale-summaries
// Called by pg_cron daily at 3am ET
// Finds specialists with new reviews in past 24h → regenerates AI review summary
// Uses get_specialists_needing_summary_refresh() SQL function

import { createClient } from 'npm:@supabase/supabase-js@2.115.0';
import { isServiceRoleRequest } from '../_shared/service-role.ts';

import { secretKey } from '../_shared/keys.ts';
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  secretKey(),
);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = secretKey();

// AUTH (2026-09-04): this function had no authorization check, and the handler did
// not even accept the Request — so there was nothing to check it against.
// `verify_jwt = true` is not a gate: the anon publishable key ships in the mobile
// bundle and satisfies the gateway. Anyone could drive the whole summary-refresh
// sweep, which fans out one Anthropic call per stale specialist — an open tap on
// the Anthropic bill.
//
// Only caller: pg_cron daily at 3am ET (014_v1_cron_jobs.sql:38), which sends
// `Bearer <current_setting('app.service_role_key')>`, so this gate breaks nothing.
//
// gatewayVerifiesJwt: true matches this function's verify_jwt pin in config.toml.
Deno.serve(async (req) => {
  if (!isServiceRoleRequest(req, { gatewayVerifiesJwt: true })) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // Get specialists needing refresh
    const { data: rows, error } = await supabase.rpc('get_specialists_needing_summary_refresh');
    if (error) throw error;

    const ids: string[] = (rows ?? []).map((r: any) => r.specialist_id);
    const results: { id: string; status: string }[] = [];

    // Refresh summaries one at a time to avoid rate limits
    for (const specialist_id of ids) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-review-summary`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({ specialist_id }),
        });
        const ok = res.ok;
        results.push({ id: specialist_id, status: ok ? 'refreshed' : 'failed' });
      } catch {
        results.push({ id: specialist_id, status: 'error' });
      }
    }

    return new Response(JSON.stringify({ processed: ids.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
