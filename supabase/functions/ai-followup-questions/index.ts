// V1 AI Skill #6 — Follow-up Questions Generator
// POST /functions/v1/ai-followup-questions
// Body: { specialist_id, pregnancy_stage, preferred_language? }
// Returns: { questions: string[] }
// Model: Haiku (real-time)

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are The Village's maternal health assistant helping moms prepare for appointments.
Generate specific, practical questions a mom should ask this provider at her appointment.

Rules:
- Generate exactly 5-7 questions
- Questions must be specific to the provider's specialty AND the mom's pregnancy stage
- Questions should be things moms genuinely want to know but forget to ask
- No generic "what are your hours" questions — these should be clinically relevant
- Tone: conversational, from the perspective of the mom asking
- Match the mom's language (en or es)
- Return ONLY valid JSON: { "questions": ["...", "..."] } — no markdown`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const { specialist_id, pregnancy_stage, preferred_language = 'en' } = await req.json();

    if (!specialist_id || !pregnancy_stage) {
      return new Response(
        JSON.stringify({ error: 'specialist_id and pregnancy_stage required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const { data: spec } = await supabase
      .from('specialists')
      .select('full_name, specialty, credentials, bio, specialist_services(service_name)')
      .eq('id', specialist_id)
      .single();

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
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
          content: `Provider: ${spec?.full_name} (${spec?.credentials})
Specialty: ${spec?.specialty}
Services: ${spec?.specialist_services?.map((s: any) => s.service_name).join(', ') || 'general'}
Mom's stage: ${pregnancy_stage}
Language: ${preferred_language}

Generate 5-7 questions the mom should ask at her appointment. Return JSON only.`,
        },
      ],
    });

    const raw = (message.content[0] as { text: string }).text.trim();
    const parsed = JSON.parse(raw);

    return new Response(JSON.stringify(parsed), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
