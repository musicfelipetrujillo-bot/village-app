// "Baby's week" retention pushes — sender.
// POST /functions/v1/week-nudge-notify   (service role; GH Actions cron)
// Body: { mode?: 'week' | 'winback' | 'both', local_hour?: number,
//         limit?: number, dry_run?: boolean }
//
// Runs HOURLY. Each invocation asks the DB "who is at 10am local right now
// AND rolls into a new baby-week today?" — so every mother gets her nudge on
// her own baby's rollover day, at a civilized hour in her own timezone,
// rather than everyone getting blasted at one UTC moment.
//
// Idempotency is NOT optional here: the GH Actions workflow retries once on
// any non-2xx, and this job fires 24×/day. `push_sends` has
// UNIQUE(user_id, kind, dedupe_key); we INSERT the ledger row BEFORE calling
// push-notify and treat a 23505 as "someone already sent it" and skip. That
// ordering means a crash mid-send can at worst DROP a nudge — never
// double-send one. For a postpartum audience, a missed nudge is a
// non-event and a duplicate is an unsubscribe.
//
// Delivery goes through push-notify with pref_key:'baby_week', so the
// central pref + quiet-hours gate applies on top of the RPC's own opt-out
// filter (defense in depth — see push-notify's header).

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_LOCAL_HOUR = 10;

interface Recipient {
  user_id: string;
  preferred_language: string | null;
  current_week: number | null;
  baby_first_name: string | null;
  tz: string | null;
  dedupe_key?: string;
}

interface Nudge {
  id: string;
  week_number: number | null;
  locale: string;
  title: string;
  body: string;
  deeplink: string;
}

// Personalization is deliberately light: swapping the baby's first name in
// when we have it, nothing more. Cached copy can't know gender or feeding
// method, and a half-personalized push reads worse than a clean generic one.
function personalize(text: string, babyName: string | null): string {
  if (!babyName) return text;
  // Only the EN/ES generic subject phrases are swapped, and only the first
  // occurrence, so we never produce "Mia's Mia".
  return text
    .replace(/\byour baby\b/i, babyName)
    .replace(/\btu bebé\b/i, babyName);
}

async function sendOne(
  r: Recipient,
  nudge: Nudge,
  kind: 'week' | 'winback',
  dedupeKey: string,
  dryRun: boolean,
): Promise<'sent' | 'duplicate' | 'failed' | 'dry'> {
  const title = personalize(nudge.title, r.baby_first_name);
  const body = personalize(nudge.body, r.baby_first_name);

  if (dryRun) return 'dry';

  // Claim the slot FIRST — see the idempotency note in the header.
  const { error: ledgerErr } = await supabase.from('push_sends').insert({
    user_id: r.user_id,
    kind,
    dedupe_key: dedupeKey,
    nudge_id: nudge.id,
    title,
    body,
    deeplink: nudge.deeplink,
    outcome: 'sent',
  });
  if (ledgerErr) {
    if (ledgerErr.code === '23505') return 'duplicate';
    console.error('[week-nudge-notify] ledger insert failed', ledgerErr.message);
    return 'failed';
  }

  // In-app feed row, so the nudge is still discoverable if the push was
  // suppressed by the OS, by quiet hours, or by a disabled system permission.
  // `milestone_alert` has been a valid type since migration 008 with no
  // writer until now.
  await supabase.from('user_notifications_feed').insert({
    user_id: r.user_id,
    type: 'milestone_alert',
    title,
    body,
    deeplink: nudge.deeplink,
    is_sent: true,
    sent_at: new Date().toISOString(),
  }).then(({ error }) => {
    if (error) console.warn('[week-nudge-notify] feed insert failed', error.message);
  });

  const res = await fetch(`${SUPABASE_URL}/functions/v1/push-notify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: r.user_id,
      title,
      body,
      url: nudge.deeplink,
      data: { kind: `nudge_${kind}`, week: nudge.week_number, url: nudge.deeplink },
      pref_key: 'baby_week',
      respect_quiet_hours: true,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[week-nudge-notify] push failed ${res.status} ${detail.slice(0, 200)}`);
    await supabase.from('push_sends')
      .update({ outcome: 'failed' })
      .eq('user_id', r.user_id).eq('kind', kind).eq('dedupe_key', dedupeKey);
    return 'failed';
  }

  // push-notify answers 200 with { skipped: true } when the user was filtered
  // by prefs or quiet hours. Record that distinctly — an opted-out user
  // should not be re-evaluated every hour, and "skipped" vs "sent" is the
  // difference between a delivery bug and a working opt-out.
  const payload = await res.json().catch(() => ({}));
  if (payload?.skipped) {
    await supabase.from('push_sends')
      .update({ outcome: payload.reason === 'all_filtered' ? 'skipped_prefs' : 'skipped_quiet' })
      .eq('user_id', r.user_id).eq('kind', kind).eq('dedupe_key', dedupeKey);
  }
  return 'sent';
}

interface Tuning {
  /** Dormancy window for the winback nudge. Past `maxDays` she has churned
   *  and a push reads as spam — that's a re-onboarding email problem. */
  minDays: number;
  maxDays: number;
  /** How recently she must have signed in to get the weekly nudge. */
  activeDays: number;
}

async function runKind(
  kind: 'week' | 'winback',
  localHour: number,
  limit: number,
  dryRun: boolean,
  tuning: Tuning,
) {
  const rpc = kind === 'week' ? 'list_week_nudge_recipients' : 'list_winback_recipients';
  const args = kind === 'week'
    ? { p_local_hour: localHour, p_max_week: 52, p_active_days: tuning.activeDays }
    : { p_local_hour: localHour, p_min_days: tuning.minDays, p_max_days: tuning.maxDays };

  const { data, error } = await supabase.rpc(rpc, args);
  if (error) throw new Error(`${rpc}: ${error.message}`);

  const recipients = ((data ?? []) as Recipient[]).slice(0, limit);
  if (!recipients.length) return { kind, eligible: 0, sent: 0, duplicate: 0, failed: 0, no_copy: 0 };

  // Load the copy this batch needs in one query.
  const weeks = [...new Set(recipients.map((r) => r.current_week).filter((w): w is number => !!w))];
  const q = supabase.from('week_nudges')
    .select('id, week_number, locale, title, body, deeplink')
    .eq('kind', kind).eq('is_active', true);
  const { data: nudgeRows, error: nudgeErr } = kind === 'week'
    ? await q.in('week_number', weeks.length ? weeks : [-1])
    : await q;
  if (nudgeErr) throw new Error(`week_nudges: ${nudgeErr.message}`);

  const byKey = new Map<string, Nudge>();
  for (const n of (nudgeRows ?? []) as Nudge[]) {
    byKey.set(`${n.week_number ?? 'x'}:${n.locale}`, n);
  }

  let sent = 0, duplicate = 0, failed = 0, noCopy = 0;
  const preview: Record<string, unknown>[] = [];

  for (const r of recipients) {
    const locale = r.preferred_language === 'es' ? 'es' : 'en';
    const key = kind === 'week' ? `${r.current_week}:${locale}` : `x:${locale}`;
    // Fall back to EN copy rather than skipping a user whose locale row is
    // missing — a nudge in the wrong language beats silence.
    const nudge = byKey.get(key) ?? byKey.get(kind === 'week' ? `${r.current_week}:en` : 'x:en');
    if (!nudge) { noCopy++; continue; }

    const dedupeKey = kind === 'week' ? `week:${r.current_week}` : (r.dedupe_key ?? 'winback:unknown');
    const outcome = await sendOne(r, nudge, kind, dedupeKey, dryRun);
    if (outcome === 'sent') sent++;
    else if (outcome === 'duplicate') duplicate++;
    else if (outcome === 'failed') failed++;
    if (dryRun) {
      preview.push({
        user_id: r.user_id, week: r.current_week, locale, tz: r.tz,
        title: personalize(nudge.title, r.baby_first_name),
        body: personalize(nudge.body, r.baby_first_name),
        dedupe_key: dedupeKey,
      });
    }
  }

  return {
    kind, eligible: recipients.length, sent, duplicate, failed, no_copy: noCopy,
    ...(dryRun ? { preview } : {}),
  };
}

/**
 * Drain the daily check-in reminder queue.
 *
 * The `daily-checkin-reminder` pg_cron job (migration 025) has been INSERTing
 * `user_notifications_feed` rows with `is_sent = FALSE` since G7 — and nothing
 * ever drained them into a push. The `idx_notif_feed_scheduled … WHERE
 * is_sent = FALSE` index was built for a drainer that was never written, so
 * the queue just grew (one row per dormant user per day).
 *
 * This drains TODAY's rows only and marks everything older as sent without
 * pushing: nobody wants a notification about a check-in from three weeks ago,
 * and back-blasting the backlog would be the worst possible first impression.
 */
async function runCheckinDrain(localHour: number, limit: number, dryRun: boolean) {
  const since = new Date(Date.now() - 36 * 3600 * 1000).toISOString();

  // Retire the backlog first (older than 36h) — no push, just stop the queue
  // from growing forever.
  let retired = 0;
  if (!dryRun) {
    const { data: old } = await supabase
      .from('user_notifications_feed')
      .update({ is_sent: true })
      .eq('type', 'daily_checkin').eq('is_sent', false).lt('created_at', since)
      .select('id');
    retired = old?.length ?? 0;
  }

  const { data: rows, error } = await supabase
    .from('user_notifications_feed')
    .select('id, user_id, title, body, deeplink')
    .eq('type', 'daily_checkin').eq('is_sent', false).gte('created_at', since)
    .limit(limit);
  if (error) throw new Error(`checkin queue: ${error.message}`);

  let sent = 0, failed = 0;
  for (const row of rows ?? []) {
    if (dryRun) { sent++; continue; }
    const res = await fetch(`${SUPABASE_URL}/functions/v1/push-notify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: row.user_id,
        title: row.title,
        body: row.body,
        url: row.deeplink ?? 'villie://home/checkin',
        data: { kind: 'daily_checkin', url: row.deeplink ?? 'villie://home/checkin' },
        pref_key: 'ai',
        respect_quiet_hours: true,
      }),
    });
    // Mark sent either way — a failed push must not leave the row to be
    // retried hourly forever (that's how the backlog happened).
    await supabase.from('user_notifications_feed')
      .update({ is_sent: true, sent_at: new Date().toISOString() })
      .eq('id', row.id);
    if (res.ok) sent++; else failed++;
  }

  return { kind: 'checkin', eligible: rows?.length ?? 0, sent, failed, retired_backlog: retired };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const body = await req.json().catch(() => ({}));
  const mode: 'week' | 'winback' | 'checkin' | 'both' =
    body.mode === 'week' || body.mode === 'winback' || body.mode === 'checkin'
      ? body.mode : 'both';
  const localHour = Number.isInteger(body.local_hour)
    ? Math.max(0, Math.min(23, body.local_hour))
    : DEFAULT_LOCAL_HOUR;
  const limit = Number.isFinite(body.limit) ? Math.max(1, Math.min(500, body.limit)) : 200;
  const dryRun = body.dry_run === true;

  // Tunable so ops can widen/narrow the windows (and so a dry run can be
  // pointed at a cohort that exists) without a redeploy.
  const tuning: Tuning = {
    minDays:    Number.isFinite(body.min_days)    ? Math.max(1, Math.min(365, body.min_days))    : 7,
    maxDays:    Number.isFinite(body.max_days)    ? Math.max(2, Math.min(365, body.max_days))    : 45,
    activeDays: Number.isFinite(body.active_days) ? Math.max(1, Math.min(365, body.active_days)) : 60,
  };

  const kinds: ('week' | 'winback' | 'checkin')[] =
    mode === 'both' ? ['week', 'winback', 'checkin'] : [mode];
  const results = [];
  for (const kind of kinds) {
    try {
      results.push(kind === 'checkin'
        ? await runCheckinDrain(localHour, limit, dryRun)
        : await runKind(kind, localHour, limit, dryRun, tuning));
    } catch (e) {
      console.error(`[week-nudge-notify] ${kind} failed`, (e as Error).message);
      results.push({ kind, error: String((e as Error).message).slice(0, 200) });
    }
  }

  return new Response(JSON.stringify({ ok: true, local_hour: localHour, dry_run: dryRun, results }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
