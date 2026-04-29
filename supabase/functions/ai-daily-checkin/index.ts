// V4 Phase G7 — Daily check-in AI responder.
// POST /functions/v1/ai-daily-checkin
// Body: { checkin_id: string, mood_score: 1..5, energy_score?: 1..5, user_response?: string }
// Returns: { reply: string, crisis: boolean, crisis_resources?: object }
//
// Flow: mobile writes user row via upsert_daily_checkin → calls this function →
// function reads checkin row as service role → generates Haiku reply →
// PATCHes row (ai_reply / crisis_flagged / crisis_resources).
//
// SAFETY (Risk & Compliance §medical-safety):
//   - Haiku real-time with crisis-routing prompt (988 / 911 / PSI / Crisis Text).
//   - Every reply ends with "Not medical advice — call your provider or 911 if urgent."
//   - crisis_flagged=TRUE persists to DB so moderator audit can retrieve.
//   - Never prescribe, diagnose, or interpret symptoms.

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

const CRISIS_RESOURCES = {
  emergency:    { name: '911',                                   description: 'Emergency Services',               phone: '911' },
  mental_health:{ name: '988 Suicide & Crisis Lifeline',         description: 'Call or text 988',                 phone: '988' },
  postpartum:   { name: 'Postpartum Support International',      description: 'Call 1-800-944-4773',              phone: '18009444773' },
  crisis_text:  { name: 'Crisis Text Line',                      description: 'Text HOME to 741741',              sms: '741741', sms_body: 'HOME' },
};

// Language-keyed disclaimer text. The edge function appends the matching one
// post-hoc (prompt-side enforcement is unreliable across languages), and the
// mobile splitter (`splitDisclaimer` in CheckinResponseScreen) detects both
// leading phrases via a single regex so the disclaimer renders as a footnote
// regardless of which language the AI reply came back in.
const DISCLAIMERS = {
  en: 'This is a check-in, not medical advice — call your provider or 911 if urgent.',
  es: 'Esto es un chequeo, no consejo médico — llama a tu proveedor o al 911 si es urgente.',
} as const;

function buildSystemPrompt(lang: 'en' | 'es'): string {
  const langLine = lang === 'es'
    ? 'IMPORTANT: Reply entirely in Spanish (es-US, warm and clinically calm). The mom prefers Spanish.'
    : 'IMPORTANT: Reply in English unless the mom switches to Spanish — match her language.';
  const disclaimerLine = `ALWAYS end the reply with one single plain sentence: "${DISCLAIMERS[lang]}"`;
  return `You are "Villie", the daily check-in companion for The Village — a maternal health app for expecting and postpartum moms.

## Role
Respond to a mom's daily check-in with 2–4 warm sentences. You are NOT her therapist, doctor, or lactation consultant. You are a kind presence who validates her, suggests one tiny next step if appropriate, and points her to real help when warranted.

## Language
${langLine}

## Hard rules
1. NEVER diagnose, prescribe, or interpret medical symptoms. If the check-in mentions bleeding, severe pain, fever, reduced fetal movement, seizure-like symptoms, baby-shaking urges, self-harm, suicidal ideation, or any form of abuse — set crisis=true, name at least one appropriate resource, and keep the reply ≤3 sentences.
2. NEVER recommend specific medications, supplements, or products.
3. ${disclaimerLine}
4. Match her tone: if she said "exhausted", don't be chipper; if she said "great!", don't be somber.
5. Keep reply under 120 words. Shorter is almost always better.

## Crisis routing
- Suicidal ideation / self-harm / intrusive thoughts about harming baby → crisis_resources: ["mental_health", "crisis_text", "postpartum"]
- Postpartum depression / severe mood → crisis_resources: ["postpartum", "mental_health"]
- Medical emergency (bleeding, severe pain, baby not breathing normally) → crisis_resources: ["emergency"]
- Abuse / domestic violence → crisis_resources: ["emergency", "crisis_text"]

## Output
Return ONLY valid JSON:
{
  "reply": "your warm 2–4-sentence reply ending with the disclaimer",
  "crisis": boolean,
  "crisis_resources": ["emergency"|"mental_health"|"postpartum"|"crisis_text"]  // only if crisis=true
}`;
}

function stageContext(row: {
  mood_score: number;
  energy_score: number | null;
  user_response: string | null;
  pregnancy_stage: string | null;
  current_week_number: number | null;
}): string {
  const parts: string[] = [];
  parts.push(`mood ${row.mood_score}/5`);
  if (row.energy_score != null) parts.push(`energy ${row.energy_score}/5`);
  if (row.pregnancy_stage) parts.push(`stage ${row.pregnancy_stage}`);
  if (row.current_week_number != null) parts.push(`baby week ${row.current_week_number}`);
  return parts.join(' · ');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json();
    const checkinId: string = body.checkin_id;
    if (!checkinId) {
      return new Response(JSON.stringify({ error: 'checkin_id required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Load check-in + user stage context (service role — bypasses RLS).
    const { data: checkin, error: checkinErr } = await supabase
      .from('daily_checkins')
      .select('id, user_id, mood_score, energy_score, user_response')
      .eq('id', checkinId)
      .maybeSingle();
    if (checkinErr || !checkin) {
      return new Response(JSON.stringify({ error: 'checkin not found' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const { data: userRow } = await supabase
      .from('users')
      .select('pregnancy_stage, preferred_language')
      .eq('id', checkin.user_id)
      .maybeSingle();
    const lang: 'en' | 'es' = userRow?.preferred_language === 'es' ? 'es' : 'en';

    const { data: bpw } = await supabase
      .from('baby_profiles_with_week')
      .select('current_week_number')
      .eq('user_id', checkin.user_id)
      .maybeSingle();

    const contextLine = stageContext({
      mood_score: checkin.mood_score,
      energy_score: checkin.energy_score,
      user_response: checkin.user_response,
      pregnancy_stage: userRow?.pregnancy_stage ?? null,
      current_week_number: bpw?.current_week_number ?? null,
    });

    const userMsg = `Today's check-in — ${contextLine}
She wrote: ${checkin.user_response?.trim() || '(no text — tapped mood only)'}

Reply per rules. JSON only.`;

    const ai = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: [{ type: 'text', text: buildSystemPrompt(lang), cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    });

    const raw = (ai.content[0] as { text: string }).text.trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned) as {
      reply?: string; crisis?: boolean; crisis_resources?: string[];
    };

    let reply = (parsed.reply ?? '').trim();
    // Enforce disclaimer as a deterministic post-processor. Detect either
    // language's variant so we don't double-append when the AI followed the
    // prompt and already included it.
    if (!/medical advice|consejo médico/i.test(reply)) {
      reply += `\n\n${DISCLAIMERS[lang]}`;
    }
    if (reply.length > 800) reply = reply.slice(0, 780) + '…';

    const crisis = Boolean(parsed.crisis);
    const resources = crisis && Array.isArray(parsed.crisis_resources)
      ? Object.fromEntries(
          parsed.crisis_resources
            .filter((k) => k in CRISIS_RESOURCES)
            .map((k) => [k, CRISIS_RESOURCES[k as keyof typeof CRISIS_RESOURCES]]),
        )
      : null;

    // Persist the AI reply back onto the check-in row.
    await supabase
      .from('daily_checkins')
      .update({
        ai_reply: reply,
        ai_reply_model: 'claude-haiku-4-5-20251001',
        crisis_flagged: crisis,
        crisis_resources: resources,
      })
      .eq('id', checkinId);

    return new Response(
      JSON.stringify({
        reply,
        crisis,
        crisis_resources: resources ?? undefined,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    // Safety default: never leave the user without a baseline reply. We don't
    // know `lang` here (the failure may have been before the user-row lookup),
    // so render a bilingual fallback — front-end will render whichever half
    // matches her preferred_language fine, and showing both is safer than
    // showing the wrong one.
    return new Response(
      JSON.stringify({
        reply: "Thanks for checking in. If something feels urgent, please call your provider or 911. For mental-health support, call or text 988. This is a check-in, not medical advice.\n\nGracias por responder. Si algo se siente urgente, llama a tu proveedor o al 911. Para apoyo de salud mental, llama o escribe al 988. Esto es un chequeo, no consejo médico.",
        crisis: false,
        _error: err instanceof Error ? err.message : 'unknown',
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
