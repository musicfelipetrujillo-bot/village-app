// trending-publish-notify — fires the "The Buzz — this week" push when an
// issue transitions to published (invoked by the trending_items_after_review
// trigger in migration 105 via pg_net, body: { issue_id }). Queries the
// candidate audience directly (everyone who hasn't opted out of the
// 'trending' notif_prefs key) rather than relying on push-notify's own
// filterByPrefs to build the initial list, since push-notify has no
// broadcast-to-everyone addressing mode — this function supplies the full
// external_ids list, and push-notify's central pref/quiet-hours gate still
// re-checks each one as the safety net.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const issueId: string | undefined = body.issue_id;
    if (!issueId) return json({ error: 'issue_id required' }, 400);

    const { data: issue, error: issueErr } = await supabase
      .from('trending_issues')
      .select('id, title, intro')
      .eq('id', issueId)
      .eq('status', 'published')
      .maybeSingle();
    if (issueErr) throw issueErr;
    if (!issue) return json({ skipped: true, reason: 'issue not found or not published' });

    // Candidate audience: everyone who has NOT explicitly opted out.
    // push-notify's central gate re-filters this same set on quiet hours +
    // the 'trending' key, so an absent/true value here is safe to include.
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id')
      .or('notif_prefs->>trending.is.null,notif_prefs->>trending.eq.true');
    if (usersErr) throw usersErr;

    const externalIds = (users ?? []).map((u: { id: string }) => u.id);
    if (externalIds.length === 0) {
      return json({ skipped: true, reason: 'no_candidates' });
    }

    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        external_ids: externalIds,
        title: 'the buzz — this week',
        body: issue.title,
        url: 'village://home/the-buzz',
        data: { kind: 'the_buzz_published', issue_id: issue.id },
        pref_key: 'trending',
        respect_quiet_hours: true,
      }),
    });
    const pushResult = await res.json().catch(() => ({}));

    return json({ ok: true, notified_candidates: externalIds.length, push_result: pushResult });
  } catch (err) {
    console.error('trending-publish-notify fatal:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
