// V1 AI Skill #1 — Match Mom to Specialist
// POST /functions/v1/ai-match
// Body: { user_id, lat, lng, radius_miles?, specialty? }
// Returns: { recommendations: [{ specialist_id, name, specialty, reason }] }

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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
    const { user_id, lat, lng, radius_miles = 10, specialty } = await req.json();

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
