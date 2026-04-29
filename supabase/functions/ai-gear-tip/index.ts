// V4 Phase G7 — Weekly gear tip.
// POST /functions/v1/ai-gear-tip
// Body: { user_id: string }
// Returns: { tip: string, category_hint: string | null }
//
// Generates a single short sentence ("This week you might start thinking about
// a high chair — here's what to look for") tuned to baby's current week.
// Haiku real-time. NEVER names a specific brand. NEVER recommends a recalled
// category (those are excluded by the gear_listings allowlist anyway).
// This fuels the `gear_tip` card on the home feed; tapping it deeplinks to
// the Gear tab pre-filtered to the suggested category.

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

// Mirrors the ALLOWLIST in migration 012. Mentioning a category outside this
// list (e.g. car_seat, breast_pump) is a policy violation — the prompt enforces.
const ALLOWED_CATEGORIES = [
  'stroller', 'carrier_wrap', 'high_chair', 'bouncer_swing', 'toy',
  'feeding_gear', 'clothing', 'book', 'activity_center', 'nursery_furniture',
];

const SYSTEM_PROMPT = `You write one-sentence gear tips for a maternal-health app's weekly home feed.

## Rules
1. ONE sentence, ≤22 words. Second person.
2. You MAY mention ONE of these categories exactly: ${ALLOWED_CATEGORIES.join(', ')}.
3. NEVER name a specific brand, model, price, or affiliate.
4. NEVER recommend a car seat, breast pump, sleep positioner, or helmet — those are excluded from our marketplace.
5. Phrase as an exploration, not a prescription. Good: "Around week 20 many families start scouting high chairs." Bad: "You need a high chair."

## Output JSON only:
{ "tip": "…one sentence…", "category_hint": "<one of the allowed categories or null>" }`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const userId: string = body.user_id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: baby } = await supabase
      .from('baby_profiles_with_week')
      .select('current_week_number, feeding_method')
      .eq('user_id', userId)
      .maybeSingle();

    const weekNum = baby?.current_week_number ?? null;

    if (weekNum == null) {
      return new Response(JSON.stringify({ tip: null, category_hint: null }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const userMsg = `Baby is at week ${weekNum}. Feeding: ${baby?.feeding_method ?? 'unknown'}.
Write the one-sentence gear tip. JSON only.`;

    const ai = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    });

    const raw = (ai.content[0] as { text: string }).text.trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned) as { tip?: string; category_hint?: string | null };

    let tip = (parsed.tip ?? '').trim();
    if (tip.length > 200) tip = tip.slice(0, 180) + '…';
    const hint = parsed.category_hint && ALLOWED_CATEGORIES.includes(parsed.category_hint)
      ? parsed.category_hint : null;

    return new Response(JSON.stringify({ tip, category_hint: hint }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ tip: null, category_hint: null, _error: err instanceof Error ? err.message : 'unknown' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
