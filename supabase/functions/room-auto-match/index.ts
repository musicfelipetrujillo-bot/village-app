// V3 Phase C5 — Auto-match rooms for a user.
// POST /functions/v1/room-auto-match
// Body: { user_id: string }
// Returns: { primary_room_id, secondary_room_ids[], reason }
//
// Called on profile updates (stage / due_date / city change) and optionally
// right after onboarding. Haiku 4.5 temp 0.2.
//
// Hard rule (per MASTER_PLAN Table of AI skills): PPD / support rooms are
// NEVER set as `primary_room` — they belong in `secondary_room_ids` at most.
// The user must always opt into a support room themselves.

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

const SYSTEM_PROMPT = `You are the room matcher for The Village (a maternal peer-support app).

You'll get:
- the user's profile context (stage, week, city)
- a JSON array of candidate rooms (id, slug, name, room_type, stage_week_min/max, city)

Your job: pick ONE primary room (never a support room) and up to 2 secondary rooms (support rooms allowed). Explain why in ≤ 25 words.

## Rules
1. Primary MUST NOT be room_type='support'. Support rooms only go in secondary_room_slugs.
2. If a stage_local room matches the user's city AND current pregnancy week is inside its stage window, strongly prefer it as primary.
3. Otherwise prefer a topic room whose stage window contains the user's week, else any topic room.
4. Skip rooms the user is already in (they won't be in the candidate list).
5. Never invent a slug. Only use slugs you were given.
6. Don't mention "I" or "AI". Speak plainly about why these rooms fit.

Return ONLY JSON:
{
  "primary_room_slug": "slug-or-null",
  "secondary_room_slugs": ["slug1","slug2"],
  "reason": "short human explanation"
}`;

function stripFence(s: string): string {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const { user_id: userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('pregnancy_stage, due_date, city')
      .eq('id', userId)
      .maybeSingle();

    // Compute current week the same way list_rooms_for_discovery does.
    let currentWeek: number | null = null;
    if (userRow?.due_date) {
      const due = new Date(userRow.due_date);
      const now = new Date();
      const daysUntilDue = Math.floor((due.getTime() - now.getTime()) / 86_400_000);
      const weeksUntilDue = Math.floor(daysUntilDue / 7);
      currentWeek = Math.max(0, 40 - weeksUntilDue);
    }

    // Candidate rooms = active rooms the user isn't already in.
    const { data: already } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId);
    const joinedIds = new Set((already ?? []).map((r: { room_id: string }) => r.room_id));

    const { data: rooms } = await supabase
      .from('rooms')
      .select('id, slug, name, room_type, stage_week_min, stage_week_max, city, description')
      .eq('is_active', true);

    const candidates = (rooms ?? []).filter((r) => !joinedIds.has(r.id));
    if (candidates.length === 0) {
      return new Response(JSON.stringify({
        primary_room_id: null, secondary_room_ids: [], reason: 'No rooms available to suggest yet.',
      }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const userPrompt = `User profile:
- stage: ${userRow?.pregnancy_stage ?? 'unknown'}
- current pregnancy week: ${currentWeek ?? 'unknown'}
- city: ${userRow?.city ?? 'unknown'}

Candidate rooms (JSON):
${JSON.stringify(candidates.map((r) => ({
  slug: r.slug, name: r.name, room_type: r.room_type,
  stage_week_min: r.stage_week_min, stage_week_max: r.stage_week_max,
  city: r.city, description: r.description,
})))}

Pick per rules. JSON only.`;

    const ai = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      temperature: 0.2,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = (ai.content[0] as { text: string }).text;
    const parsed = JSON.parse(stripFence(raw)) as {
      primary_room_slug: string | null;
      secondary_room_slugs?: string[];
      reason?: string;
    };

    // Resolve slugs → ids, enforcing the hard "no support as primary" rule.
    const bySlug = new Map(candidates.map((r) => [r.slug, r]));
    let primary = parsed.primary_room_slug ? bySlug.get(parsed.primary_room_slug) ?? null : null;
    if (primary && primary.room_type === 'support') {
      primary = null;
    }

    const secondaryIds: string[] = [];
    for (const slug of (parsed.secondary_room_slugs ?? []).slice(0, 2)) {
      const r = bySlug.get(slug);
      if (r && (!primary || r.id !== primary.id)) secondaryIds.push(r.id);
    }

    const reason = (parsed.reason ?? '').slice(0, 400);

    // Upsert one row per user.
    await supabase
      .from('room_match_suggestions')
      .upsert(
        {
          user_id: userId,
          primary_room_id: primary?.id ?? null,
          secondary_room_ids: secondaryIds,
          reason,
          generator_version: 'haiku-4.5-v1',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    return new Response(JSON.stringify({
      primary_room_id: primary?.id ?? null,
      secondary_room_ids: secondaryIds,
      reason,
    }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(
      JSON.stringify({
        primary_room_id: null,
        secondary_room_ids: [],
        reason: '',
        _error: err instanceof Error ? err.message : 'unknown',
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
