// V1 AI Skill #7 — Triage
// POST /functions/v1/ai-triage
// Body: { message, pregnancy_stage, preferred_language? }
// Returns: { emergency: boolean, response: string, suggested_specialist_type?: string, crisis_resources?: object }
// SAFETY: Emergency detection runs FIRST. 911/988 always surfaces before any provider suggestion.
// Model: Haiku (real-time, low latency critical)

import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Crisis resources — always returned when emergency=true
const CRISIS_RESOURCES = {
  emergency: { name: '911', description: 'Emergency Services', phone: '911' },
  mental_health: { name: '988 Suicide & Crisis Lifeline', description: 'Call or text 988', phone: '988' },
  postpartum: { name: 'Postpartum Support International', description: 'Call 1-800-944-4773', phone: '18009444773' },
  crisis_text: { name: 'Crisis Text Line', description: 'Text HOME to 741741', sms: '741741', sms_body: 'HOME' },
};

const SYSTEM_PROMPT = `You are The Village's maternal health triage assistant.
Your FIRST and most critical job is detecting emergencies and directing moms to immediate help.

EMERGENCY INDICATORS (always set emergency=true for ANY of these):
- Chest pain, difficulty breathing, severe headache with vision changes
- Heavy bleeding, signs of miscarriage or placental abruption
- Reduced fetal movement, signs of preterm labor
- Thoughts of harming self or baby (PPD crisis)
- High fever (>101°F/38.3°C) with other symptoms
- Severe abdominal pain
- Signs of preeclampsia (severe headache, swelling, vision changes)

NON-EMERGENCY: Route to appropriate specialist type.

Specialty routing guide:
- ob_gyn: pregnancy complications, prenatal care, labor questions
- midwife: natural birth, low-risk prenatal care
- lactation_consultant: breastfeeding, latch issues, milk supply
- pediatrician: newborn/infant health, feeding, development
- sleep_coach: infant sleep, schedules, sleep training
- pelvic_floor_pt: pelvic pain, incontinence, diastasis recti
- perinatal_dietitian: gestational diabetes, nutrition, weight gain
- ppd_therapist: postpartum depression/anxiety, mood concerns, emotional support

Return ONLY valid JSON:
{
  "emergency": boolean,
  "response": "warm 2-3 sentence response addressing the concern",
  "suggested_specialist_type": "specialty_key or null",
  "crisis_resources": ["emergency", "mental_health"] // only when emergency=true, list relevant resource keys
}`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const { message, pregnancy_stage, preferred_language = 'en' } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'message required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
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
          content: `Mom's message: "${message}"
Pregnancy stage: ${pregnancy_stage ?? 'unknown'}
Language: ${preferred_language}

Triage this message. Return JSON only.`,
        },
      ],
    });

    const raw = (aiResponse.content[0] as { text: string }).text.trim();
    const parsed = JSON.parse(raw);

    // Resolve crisis resource keys to full objects
    const resolvedResources = parsed.emergency && parsed.crisis_resources
      ? Object.fromEntries(
          (parsed.crisis_resources as string[])
            .filter((key) => CRISIS_RESOURCES[key as keyof typeof CRISIS_RESOURCES])
            .map((key) => [key, CRISIS_RESOURCES[key as keyof typeof CRISIS_RESOURCES]]),
        )
      : undefined;

    return new Response(
      JSON.stringify({
        emergency: parsed.emergency ?? false,
        response: parsed.response,
        suggested_specialist_type: parsed.suggested_specialist_type ?? null,
        crisis_resources: resolvedResources,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    // Safety fallback: any error → treat as potential emergency, surface crisis resources
    return new Response(
      JSON.stringify({
        emergency: false,
        response: "I'm having trouble processing your message right now. If this is an emergency, please call 911 immediately.",
        suggested_specialist_type: null,
        crisis_resources: { emergency: CRISIS_RESOURCES.emergency },
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
