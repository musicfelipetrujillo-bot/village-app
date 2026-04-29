// Edge Function: refresh-stale-summaries
// Called by pg_cron daily at 3am ET
// Finds specialists with new reviews in past 24h → regenerates AI review summary
// Uses get_specialists_needing_summary_refresh() SQL function

import { createClient } from 'npm:@supabase/supabase-js';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async () => {
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
