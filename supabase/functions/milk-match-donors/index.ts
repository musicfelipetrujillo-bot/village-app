// milk-match-donors — AI-ranked donor matches for a recipient
// Takes recipient preferences + nearby donors, returns Haiku-ranked top 5
// with a one-line "why this donor" narrative for each.
// NOTE: transaction-free donor ranking — retained through the migration-098
// Stripe Connect retirement. Its former caller (MilkMatchScreen) was removed
// with the purchase funnel; the callMatchDonors() client in api/milk.ts stays
// available for a future cash-only re-wire of AI discovery.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic();
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const SYSTEM_PROMPT = `You rank breast milk donors for a recipient based on objective fit.
You receive recipient preferences and a list of nearby donors with their profile data.

Rank by these factors (weighted):
1. Trust badge level (verified_bloodwork > verified > basic > none)
2. Diet match (recipient diet flags ⊆ donor diet flags)
3. Distance (closer is better)
4. Supply availability (must have ≥ recipient need_oz)
5. Price within budget
6. Rating (higher = better tiebreaker)

Return STRICT JSON only:
{
  "matches": [
    { "donor_profile_id": "uuid", "rank": 1, "fit_score": 92, "reason": "one sentence why this donor fits" }
  ]
}

Return at most 5 donors, in rank order. Reason ≤ 20 words. No markdown.`;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return new Response('Unauthorized', { status: 401, headers: CORS });

    const {
      lat, lng,
      need_oz = 32,
      max_price_per_oz = 3.00,
      diet_flags = [] as string[],
      fulfillment = 'pickup' as 'pickup' | 'shipping',
      pregnancy_stage = 'newborn',
      radius_miles = 25,
    } = await req.json();

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(JSON.stringify({ error: 'lat/lng required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Pull candidate donors via existing search RPC
    const { data: candidates, error: searchErr } = await supabase.rpc('search_donors_near', {
      user_lat: lat,
      user_lng: lng,
      radius_miles,
      filter_badge: null,
      max_price: max_price_per_oz,
    });
    if (searchErr) throw searchErr;

    const candidateList = (candidates ?? []).slice(0, 15); // cap context window

    if (candidateList.length === 0) {
      return new Response(JSON.stringify({ matches: [] }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Hydrate diet flags for ranking
    const ids = candidateList.map((c: any) => c.id);
    const { data: dietRows } = await supabase
      .from('milk_donor_diet_flags')
      .select('donor_profile_id, flag_key')
      .in('donor_profile_id', ids)
      .eq('is_active', true);

    const dietMap = new Map<string, string[]>();
    for (const r of dietRows ?? []) {
      const arr = dietMap.get(r.donor_profile_id) ?? [];
      arr.push(r.flag_key);
      dietMap.set(r.donor_profile_id, arr);
    }

    const donorSummary = candidateList.map((d: any) => ({
      donor_profile_id: d.id,
      display_name: d.display_name,
      badge_level: d.badge_level,
      distance_miles: Number(d.distance_miles).toFixed(1),
      price_per_oz: d.price_per_oz,
      supply_oz_available: d.supply_oz_available,
      rating_avg: d.rating_avg,
      review_count: d.review_count,
      diet_flags: dietMap.get(d.id) ?? [],
    }));

    const userMessage = JSON.stringify({
      recipient: {
        need_oz, max_price_per_oz, diet_flags, fulfillment, pregnancy_stage,
      },
      donors: donorSummary,
    });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      temperature: 0.3,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });

    const text = (message.content[0] as { type: string; text: string }).text.trim();
    let parsed: { matches: Array<{ donor_profile_id: string; rank: number; fit_score: number; reason: string }> };
    try {
      parsed = JSON.parse(text);
    } catch {
      // Strip code fences if Haiku added them
      const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
      parsed = JSON.parse(cleaned);
    }

    // Hydrate matches with full donor cards for the client
    const byId = new Map(candidateList.map((c: any) => [c.id, c]));
    const enriched = (parsed.matches ?? [])
      .filter((m) => byId.has(m.donor_profile_id))
      .map((m) => ({ ...m, donor: byId.get(m.donor_profile_id) }));

    return new Response(JSON.stringify({ matches: enriched }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('milk-match-donors error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
