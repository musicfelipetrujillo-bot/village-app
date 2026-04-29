// V4 Phase G7 — Event relevance ranker.
// POST /functions/v1/ai-event-relevance
// Body: { user_id: string, candidate_event_ids: string[], limit?: number }
// Returns: { ranked: [{ event_id, reason }] }
//
// Called by home-feed-curator with pre-filtered PostGIS-near events. Orders
// them with a mom-context aware Haiku prompt. Never invents events.

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

const SYSTEM_PROMPT = `You order upcoming baby/maternal events by fit for this specific mom.

## Rules
- Only order items from the candidate list — never invent events.
- Reason is ≤12 words, concrete, second person. No hype.
- Third-party/partner events are fine; do not reveal internal flags.

## Output JSON only:
{ "ranked": [ { "event_id": "<uuid>", "reason": "…" } ] }`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const userId: string = body.user_id;
    const candidateIds: string[] = Array.isArray(body.candidate_event_ids) ? body.candidate_event_ids : [];
    const limit: number = Math.min(Math.max(body.limit ?? 3, 1), 8);

    if (!userId || candidateIds.length === 0) {
      return new Response(JSON.stringify({ ranked: [] }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: userRow } = await supabase
      .from('users').select('pregnancy_stage').eq('id', userId).maybeSingle();
    const { data: baby } = await supabase
      .from('baby_profiles_with_week').select('current_week_number').eq('user_id', userId).maybeSingle();

    const { data: events } = await supabase
      .from('events')
      .select('id, title, summary, event_type, age_tags, starts_at, city')
      .in('id', candidateIds)
      .limit(25);

    const cands = events ?? [];
    if (cands.length === 0) {
      return new Response(JSON.stringify({ ranked: [] }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const userMsg = `Mom context: stage=${userRow?.pregnancy_stage ?? 'unknown'}, baby_week=${baby?.current_week_number ?? 'n/a'}.

Candidate events:
${JSON.stringify(cands.map((e) => ({
  event_id: e.id, title: e.title, summary: e.summary, type: e.event_type,
  age_tags: e.age_tags, when: e.starts_at, city: e.city,
})), null, 2)}

Pick top ${limit} for her. JSON only.`;

    const ai = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    });

    const raw = (ai.content[0] as { text: string }).text.trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned) as { ranked?: Array<{ event_id: string; reason: string }> };
    const allow = new Set(cands.map((e) => e.id));
    const ranked = (parsed.ranked ?? [])
      .filter((r) => r?.event_id && allow.has(r.event_id))
      .slice(0, limit)
      .map((r) => ({ event_id: r.event_id, reason: String(r.reason ?? '').slice(0, 120) }));

    return new Response(JSON.stringify({ ranked }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ranked: [], _error: err instanceof Error ? err.message : 'unknown' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
