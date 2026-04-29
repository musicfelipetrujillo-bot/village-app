// V3 Phase C5 — Weekly room summary (Sonnet batch).
// POST /functions/v1/room-weekly-summary
// Body: { mode?: 'batch' | 'single', room_id?: string }
//   - 'batch' (default): summarize all active rooms for the trailing 7 days.
//   - 'single' + room_id: summarize one room on demand (manual QA / admin).
//
// For each room we:
//   1. Load cleared, non-deleted user messages from the last 7 days (cap 400).
//   2. Ask Sonnet for a 3–4 sentence ANONYMIZED digest — never quote users
//      or names; speak in aggregate patterns ("several moms shared…").
//   3. Insert into room_weekly_summaries (UNIQUE on room_id+period_start).
//   4. Post as a message_type='system' row so it shows up inline in the feed.
//   5. Fan out a OneSignal push to every member via push-notify.
//
// Fail-soft per room: a single room's failure does not abort the batch.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are writing a weekly digest for a maternal peer-support room. The digest is shown to every member as a gentle reminder of what the community has been discussing.

## Rules
1. 3 to 4 sentences total. No lists. No headings.
2. NEVER quote a member directly. NEVER mention a name or alias. Speak only in aggregate ("a few moms…", "several members shared…", "the most-discussed topic was…").
3. Warm, second-person-plural tone ("we", "you all"). No emoji.
4. No medical advice, no diagnosis, no specific product recommendations.
5. If the week was quiet (< 5 messages), write a one-sentence "quiet week — here whenever you need us" note instead.
6. End with one short sentence inviting members back this week. Do not include the word "summary" or "digest".

Return ONLY JSON: { "summary": "your 3–4 sentence digest" }`;

function stripFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

async function summarizeRoom(room: { id: string; name: string; slug: string }) {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Skip if we already have a summary for this exact period_start (idempotent).
  const { data: existing } = await supabase
    .from('room_weekly_summaries')
    .select('id')
    .eq('room_id', room.id)
    .eq('period_start', periodStart.toISOString())
    .maybeSingle();
  if (existing) return { room_id: room.id, skipped: true };

  const { data: msgs } = await supabase
    .from('room_messages')
    .select('body, message_type, created_at')
    .eq('room_id', room.id)
    .eq('ai_scan_status', 'clear')
    .eq('is_deleted', false)
    .eq('message_type', 'user')
    .gte('created_at', periodStart.toISOString())
    .order('created_at', { ascending: true })
    .limit(400);

  const count = msgs?.length ?? 0;

  let summary: string;
  if (count < 5) {
    summary = "Quiet week in the room — not every week needs many words. We're here when you are.";
  } else {
    const context = (msgs ?? [])
      .map((m) => m.body)
      .join('\n')
      .slice(0, 8000);
    const userPrompt = `Room: ${room.name}
Messages this week (oldest → newest, anonymized — DO NOT echo any verbatim):
${context}

Write the digest per the rules. JSON only.`;

    try {
      const ai = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt }],
      });
      const raw = (ai.content[0] as { text: string }).text;
      const parsed = JSON.parse(stripFence(raw)) as { summary?: string };
      summary = (parsed.summary ?? '').trim() || "This week brought a mix of check-ins and support. Come back when you need us.";
      if (summary.length > 800) summary = summary.slice(0, 780) + '…';
    } catch {
      summary = "This week brought a mix of check-ins and support. Come back when you need us.";
    }
  }

  const { data: saved, error: saveErr } = await supabase
    .from('room_weekly_summaries')
    .insert({
      room_id:       room.id,
      period_start:  periodStart.toISOString(),
      period_end:    periodEnd.toISOString(),
      summary,
      message_count: count,
    })
    .select('id')
    .single();

  if (saveErr || !saved) return { room_id: room.id, error: saveErr?.message ?? 'insert_failed' };

  // In-room system card. Trusted by the C4 trigger → marked 'clear' inline.
  await supabase.from('room_messages').insert({
    room_id:        room.id,
    sender_user_id: null,
    sender_anon_id: null,
    body:           `📮 Weekly digest\n\n${summary}`,
    message_type:   'system',
    ai_scan_status: 'clear',
  });

  // Fan-out push to every member via push-notify. Two-layer gate:
  //   1. Room-level: `room_members.notif_pref='all'` (per-room subscription).
  //      We filter here because push-notify has no concept of rooms.
  //   2. User-level: `notif_prefs.groups` + quiet hours. We delegate this to
  //      push-notify by passing `pref_key:'groups'` — the central A2.b gate
  //      handles both the opt-out and the per-recipient quiet-hours window.
  // The system digest card still posts to the room feed regardless — we
  // don't withhold content, just the proactive ping.
  const { data: memberRows } = await supabase
    .from('room_members')
    .select('user_id')
    .eq('room_id', room.id)
    .eq('notif_pref', 'all');
  const candidateIds = (memberRows ?? []).map((r: { user_id: string }) => r.user_id);
  if (candidateIds.length > 0) {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/push-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        external_ids: candidateIds,
        title: `This week in ${room.name}`,
        body: summary.length > 140 ? summary.slice(0, 137) + '…' : summary,
        url: `village://community/room/${room.slug}`,
        data: { kind: 'room_weekly_summary', room_id: room.id, slug: room.slug },
        pref_key: 'groups',
        respect_quiet_hours: true,
      }),
    }).catch(() => null);
  }

  await supabase
    .from('room_weekly_summaries')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', saved.id);

  return { room_id: room.id, summary_id: saved.id, message_count: count };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    let payload: { mode?: 'batch' | 'single'; room_id?: string } = { mode: 'batch' };
    try { payload = await req.json(); } catch { /* body optional */ }
    const mode = payload.mode ?? 'batch';

    let rooms: Array<{ id: string; name: string; slug: string }> = [];
    if (mode === 'single') {
      if (!payload.room_id) {
        return new Response(JSON.stringify({ error: 'room_id required for single mode' }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
      }
      const { data: r } = await supabase
        .from('rooms')
        .select('id, name, slug')
        .eq('id', payload.room_id)
        .eq('is_active', true)
        .maybeSingle();
      if (r) rooms = [r];
    } else {
      const { data: all } = await supabase
        .from('rooms')
        .select('id, name, slug')
        .eq('is_active', true);
      rooms = all ?? [];
    }

    const results = [];
    for (const r of rooms) {
      try {
        results.push(await summarizeRoom(r));
      } catch (err) {
        results.push({ room_id: r.id, error: err instanceof Error ? err.message : 'unknown' });
      }
    }

    return new Response(JSON.stringify({ mode, rooms: results.length, results }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
