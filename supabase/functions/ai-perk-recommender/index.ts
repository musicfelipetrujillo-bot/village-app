// V4 Phase G7 — Perk recommender.
// POST /functions/v1/ai-perk-recommender
// Body: { user_id: string, limit?: number }   (service-role call from home-feed-curator)
// Returns: { ranked: [{ deal_id, reason }] }
//
// Uses Haiku to pick top-N brand_deals active for user's stage/age_tags, with a
// 1-sentence "why you" reason. Never invents URLs or codes — the caller joins
// deal_id → brand_deals.* to render.
// FTC disclosure is rendered in the UI (PerkDetail/PerkClaim already do this);
// this endpoint does not add affiliate disclosures to `reason`.

import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';
import { createClient } from 'jsr:@supabase/supabase-js@2.115.0';

import { isServiceRoleRequest } from '../_shared/service-role.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You rank baby/maternal brand perks for a mom based on her current stage.

## Rules
- Pick at most N items from the provided candidate list. NEVER invent a deal.
- Output ONLY items from the candidates.
- Reason is ≤15 words, second person, concrete. NO hype, NO emoji, NO brand superlatives.
- If nothing fits her stage well, return fewer items (or zero).

## Output
Return ONLY valid JSON:
{ "ranked": [ { "deal_id": "<uuid>", "reason": "…" } ] }`;

interface Candidate {
  id: string;
  title: string;
  brand: string;
  category: string;
  short_description: string;
  eligibility_age_tags: string[] | null;
  sort_priority: number | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // AUTH (2026-09-05): no authorization check existed, and `verify_jwt = true` is
  // not one — the anon publishable key ships in the mobile bundle and satisfies the
  // gateway. This function ranks brand deals for a caller-supplied `user_id` using her stage, week and feeding method, so an unchecked `user_id` was both an inference
  // leak about another mother and a free Haiku endpoint.
  //
  // Only caller is home-feed-curator, which fans out server-side with
  // `Authorization: Bearer ${SERVICE_KEY}` (home-feed-curator/index.ts:59). No
  // mobile code calls this directly, so service-role-only is the exact contract —
  // and with the target now supplied only by trusted server code, `user_id` no
  // longer needs a per-caller ownership check.
  if (!isServiceRoleRequest(req, { gatewayVerifiesJwt: true })) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json();
    const userId: string = body.user_id;
    const limit: number = Math.min(Math.max(body.limit ?? 3, 1), 6);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('pregnancy_stage, preferred_language')
      .eq('id', userId)
      .maybeSingle();

    const { data: baby } = await supabase
      .from('baby_profiles_with_week')
      .select('current_week_number, feeding_method')
      .eq('user_id', userId)
      .maybeSingle();

    const { data: deals } = await supabase
      .from('brand_deals')
      .select('id, title, brand, category, short_description, eligibility_age_tags, sort_priority, is_active')
      .eq('is_active', true)
      .order('sort_priority', { ascending: false })
      .limit(25);

    const candidates: Candidate[] = (deals ?? []) as Candidate[];
    if (candidates.length === 0) {
      return new Response(JSON.stringify({ ranked: [] }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const userMsg = `Mom context:
- pregnancy_stage: ${userRow?.pregnancy_stage ?? 'unknown'}
- baby week: ${baby?.current_week_number ?? 'none yet'}
- feeding: ${baby?.feeding_method ?? 'unknown'}

Candidate deals (JSON):
${JSON.stringify(candidates.map((c) => ({
  deal_id: c.id, title: c.title, brand: c.brand, category: c.category,
  short_description: c.short_description, eligibility_age_tags: c.eligibility_age_tags,
})), null, 2)}

Pick the best ${limit} for her. JSON only.`;

    const ai = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    });

    const raw = (ai.content[0] as { text: string }).text.trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned) as { ranked?: Array<{ deal_id: string; reason: string }> };
    const validIds = new Set(candidates.map((c) => c.id));
    const ranked = (parsed.ranked ?? [])
      .filter((r) => r?.deal_id && validIds.has(r.deal_id))
      .slice(0, limit)
      .map((r) => ({ deal_id: r.deal_id, reason: String(r.reason ?? '').slice(0, 140) }));

    return new Response(JSON.stringify({ ranked }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ ranked: [], _error: err instanceof Error ? err.message : 'unknown' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
