// V1 AI Skill #1 — Match Mom to Specialist
// POST /functions/v1/ai-match
// Body: { user_id, lat, lng, radius_miles?, specialty? }
// Returns: { recommendations: [{ specialist_id, name, specialty, reason }] }

import Anthropic from 'npm:@anthropic-ai/sdk@0.124.0';
import { createClient } from 'npm:@supabase/supabase-js@2.115.0';

import { isServiceRoleRequest } from '../_shared/service-role.ts';
import { resolveTargetUser } from '../_shared/user-auth.ts';

import { consumeQuota, tooManyRequests } from '../_shared/rate-limit.ts';

import { secretKey } from '../_shared/keys.ts';
const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  secretKey()
);

const SYSTEM_PROMPT = `You are The Village's warm, knowledgeable maternal health assistant.
Your job is to match moms to the right specialist based on their needs and location.
Always respond in the mom's preferred language (en or es).
Return ONLY valid JSON — no markdown, no prose.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { user_id: bodyUserId, lat, lng, radius_miles = 10, specialty } = await req.json();

    // IDOR (fixed 2026-09-05): `user_id` was taken on trust and the profile read
    // below uses the service-role client, bypassing RLS. Any anon-key holder could
    // pass another mother's id and have her pregnancy_stage and insurance_provider
    // fed into the LLM prompt — then read them back out of the returned match
    // reasons. An inference leak of health and insurance data.
    const target = await resolveTargetUser(
      req,
      bodyUserId,
      isServiceRoleRequest(req, { gatewayVerifiesJwt: true }),
    );
    if (!target.ok) {
      return new Response(JSON.stringify({ error: target.error }), {
        status: target.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
    const user_id = target.userId;
    
    // Per-user quota (migration 135). The gate above establishes WHO; this bounds
    // HOW MUCH. Placed immediately after auth and before any model call so it
    // covers every downstream branch — deferring it deeper risks a path that skips
    // it. Atomic in SQL, so concurrent requests cannot all pass the same check.
    // Fails OPEN on ledger error: a cost control must not block a mother mid-flow.
    const quota = await consumeQuota(user_id, 'ai-match');
    if (!quota.allowed) return tooManyRequests(quota, { 'Access-Control-Allow-Origin': '*' });

    // Fetch user profile
    const { data: user } = await supabase
      .from('users')
      .select('pregnancy_stage, preferred_language, insurance_provider')
      .eq('id', user_id)
      .single();

    // Fetch nearby specialists using earthdistance
    let query = supabase.rpc('specialists_near', { lat, lng, radius_miles });
    if (specialty) query = query.eq('specialty', specialty);
    const { data: specialists } = await query.limit(10);

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Mom profile: ${JSON.stringify(user)}
Nearby specialists: ${JSON.stringify(specialists)}

Recommend 2-3 specialists. Return JSON: { "recommendations": [{ "specialist_id": "uuid", "name": "string", "specialty": "string", "reason": "warm 1-2 sentence reason in ${user?.preferred_language ?? 'en'}" }] }`,
        },
      ],
    });

    const result = JSON.parse((message.content[0] as { text: string }).text);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
});
