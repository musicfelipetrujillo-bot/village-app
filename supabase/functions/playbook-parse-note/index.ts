// playbook-parse-note — Phase 2 of the Playbook tracker.
//
// Turns a mom's free-text / dictated jot ("fed 10 min on the left, wet diaper")
// into structured sleep / feed / diaper rows. POST with the caller's JWT; all
// writes go through a USER-SCOPED client so RLS enforces owner-only (auth.uid()
// = user_id, migration 093). The raw note is ALWAYS saved first, so nothing is
// lost even when the AI parse fails. Model: Haiku (real-time).
//
// Body: { raw_text: string, baby_profile_id: string, now?: ISO }
// Returns: { ok, note_id, counts: {sleep,feed,diaper}, events }
import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You extract structured baby-tracking events from a parent's short free-text note.
Return STRICT JSON only: {"events": Event[]}. No prose, no markdown fences.

Event types:
- sleep:  {"type":"sleep","started_at":ISO,"ended_at":ISO|null}
- feed:   {"type":"feed","method":"breast"|"bottle","side":"left"|"right"|null,"started_at":ISO,"ended_at":ISO|null,"amount_oz":number|null}
- diaper: {"type":"diaper","kind":"wet"|"dirty"|"both","occurred_at":ISO}

Rules:
- Resolve ALL times relative to NOW (given, UTC). "just now"/"now" = NOW. "10 min ago" = NOW-10m. "at 2pm" = today at 14:00 local of the parent — but you only have UTC NOW, so if a clock time is given without AM/PM certainty, prefer a relative interpretation close to NOW.
- Duration with no explicit end ("napped 45 min", "fed 12 min"): set ended_at=NOW and started_at = NOW - duration.
- Ongoing phrasing ("sleeping now", "down for a nap", "on the breast now"): started_at=NOW, ended_at=null.
- Breast side: "left"/"L" -> left, "right"/"R" -> right, else null. Bottle -> side null, capture amount_oz if a number of ounces is stated.
- Diaper: "pee"/"wet" -> wet, "poop"/"dirty"/"BM" -> dirty, "both" -> both.
- Only include events the note explicitly states. If nothing trackable, return {"events":[]}.
- All ISO timestamps in UTC.`;

type Ev =
  | { type: 'sleep'; started_at: string; ended_at: string | null }
  | { type: 'feed'; method: 'breast' | 'bottle'; side: 'left' | 'right' | null; started_at: string; ended_at: string | null; amount_oz: number | null }
  | { type: 'diaper'; kind: 'wet' | 'dirty' | 'both'; occurred_at: string };

function coerceEvents(raw: any): Ev[] {
  if (!raw || !Array.isArray(raw.events)) return [];
  const out: Ev[] = [];
  for (const e of raw.events) {
    if (e?.type === 'sleep' && typeof e.started_at === 'string') {
      out.push({ type: 'sleep', started_at: e.started_at, ended_at: typeof e.ended_at === 'string' ? e.ended_at : null });
    } else if (e?.type === 'feed' && typeof e.started_at === 'string' && (e.method === 'breast' || e.method === 'bottle')) {
      out.push({
        type: 'feed',
        method: e.method,
        side: e.method === 'breast' && (e.side === 'left' || e.side === 'right') ? e.side : null,
        started_at: e.started_at,
        ended_at: typeof e.ended_at === 'string' ? e.ended_at : null,
        amount_oz: e.method === 'bottle' && typeof e.amount_oz === 'number' ? e.amount_oz : null,
      });
    } else if (e?.type === 'diaper' && typeof e.occurred_at === 'string' && (e.kind === 'wet' || e.kind === 'dirty' || e.kind === 'both')) {
      out.push({ type: 'diaper', kind: e.kind, occurred_at: e.occurred_at });
    }
  }
  return out.slice(0, 12); // guard against runaway output
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const { raw_text, baby_profile_id, now } = await req.json();
    if (!raw_text || !baby_profile_id) return json({ error: 'raw_text_and_baby_profile_id_required' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return json({ error: 'unauthorized' }, 401);

    const nowIso = typeof now === 'string' ? now : new Date().toISOString();
    const text = String(raw_text).slice(0, 500);

    // 1) Always save the raw note first — never lose the mom's words.
    const { data: noteRow } = await supabase
      .from('baby_log_notes')
      .insert({ user_id: uid, baby_profile_id, raw_text: text })
      .select('id')
      .single();
    const noteId = noteRow?.id ?? null;

    // 2) Parse with Haiku (fail-soft → empty).
    let events: Ev[] = [];
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: `NOW (UTC): ${nowIso}\nNote: ${text}` }],
      });
      const out = (msg.content[0] as { text: string }).text
        .trim().replace(/^```json?/i, '').replace(/```$/,'').trim();
      events = coerceEvents(JSON.parse(out));
    } catch (e) {
      console.warn('playbook-parse-note: AI parse failed —', String(e));
    }

    // 3) Insert structured rows (RLS-scoped to this user via the JWT client).
    const counts = { sleep: 0, feed: 0, diaper: 0 };
    const inserts: Promise<unknown>[] = [];
    for (const e of events) {
      if (e.type === 'sleep') {
        inserts.push(supabase.from('baby_sleep_logs').insert({ user_id: uid, baby_profile_id, started_at: e.started_at, ended_at: e.ended_at, source: 'note' }));
        counts.sleep++;
      } else if (e.type === 'feed') {
        inserts.push(supabase.from('baby_feed_logs').insert({ user_id: uid, baby_profile_id, method: e.method, side: e.side, started_at: e.started_at, ended_at: e.ended_at, amount_oz: e.amount_oz, source: 'note' }));
        counts.feed++;
      } else if (e.type === 'diaper') {
        inserts.push(supabase.from('baby_diaper_logs').insert({ user_id: uid, baby_profile_id, kind: e.kind, occurred_at: e.occurred_at, source: 'note' }));
        counts.diaper++;
      }
    }
    await Promise.allSettled(inserts);

    // 4) Stamp the note with what we extracted (audit + future undo).
    if (noteId) {
      await supabase.from('baby_log_notes')
        .update({ parsed: { events, model: 'haiku-4.5', at: nowIso } })
        .eq('id', noteId);
    }

    return json({ ok: true, note_id: noteId, counts, events });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
