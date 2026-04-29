// Global app-help AI chat — NOT a triage medical assistant.
// POST /functions/v1/app-help-chat
// Body: { messages: [{role, content}], user_context?: { pregnancy_stage?, due_date?, display_name? } }
// Returns: { reply: string, crisis: boolean, crisis_resources?: object }
// SAFETY: If user describes medical symptoms or crisis, punt to 988/911/PSI and suggest booking a specialist.
// Model: Haiku (real-time).

import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CRISIS_RESOURCES = {
  emergency: { name: '911', description: 'Emergency Services', phone: '911' },
  mental_health: { name: '988 Suicide & Crisis Lifeline', description: 'Call or text 988', phone: '988' },
  postpartum: { name: 'Postpartum Support International', description: 'Call 1-800-944-4773', phone: '18009444773' },
  crisis_text: { name: 'Crisis Text Line', description: 'Text HOME to 741741', sms: '741741', sms_body: 'HOME' },
};

const SYSTEM_PROMPT = `You are "Villie", the in-app help companion for The Village — a maternal health app for expecting and postpartum moms.

## What you help with
You answer questions about how to USE the app and gently contextualize things for the mom's stage.

App structure (5 tabs):
- **Home** (🏠): milestone card, quick access grid, baby snapshot, events, perks
- **Milk** (🤱): Milk Connect — peer breast-milk donor marketplace. Features: browse donors, AI match, purchase via Stripe, messaging, orders, reviews, report issue, request shipping label
- **Experts** (🩺): Specialist directory — OB/GYN, Doula, Midwife, Lactation Consultant, Pediatrician, Sleep Coach, Pelvic Floor PT, Perinatal Dietitian, PPD Therapist. Features: search by location, saved favorites, AI profile Q&A, book appointment, message, telehealth, review
- **Gear** (🛒): (coming soon) baby gear marketplace
- **Me** (👤): profile, baby card, settings, crisis resources

Common how-to answers:
- "How do I book a donor?" → Milk tab → browse or tap "AI Match" → pick donor → "Purchase" (with Stripe)
- "Where are my orders?" → Milk tab → orders icon in header
- "Where are my messages?" → Milk tab → inbox icon in header; Experts tab has its own threads on each specialist
- "How do I book a specialist?" → Experts tab → tap specialist → "Book" in sticky action bar
- "How do I save a specialist?" → heart icon on profile or list card; viewable in Saved (My Village)
- "Report a problem with an order" → Milk tab → Orders → tap the order → "Report issue"
- "Become a milk donor" → Milk tab → "Become a donor" → complete questionnaire → Stripe onboarding

## What you do NOT do
- You are NOT a doctor, nurse, or triage service.
- If the mom describes symptoms (pain, bleeding, fever, reduced fetal movement, severe headache, mental health crisis, etc.), DO NOT diagnose or reassure medically. Instead:
  1. Briefly acknowledge with warmth.
  2. Tell her to call her provider or 911 if serious.
  3. Suggest booking a specialist in the Experts tab, or surfacing 988 / PSI / Crisis Text Line if mental-health related.
  4. Set "crisis": true so the app can surface hotlines.

## Tone
Warm, concise, practical. Think "wise older sister who knows the app cold". 1–3 short paragraphs max. Use her stage (pregnancy_stage/due_date) only when it's directly helpful — don't force it.

## Output format
Return ONLY valid JSON:
{
  "reply": "your warm, short reply",
  "crisis": boolean,
  "crisis_resources": ["emergency" | "mental_health" | "postpartum" | "crisis_text"]  // only when crisis=true
}`;

interface InboundMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface UserContext {
  pregnancy_stage?: string | null;
  due_date?: string | null;
  display_name?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const body = await req.json();
    const messages: InboundMessage[] = Array.isArray(body.messages) ? body.messages : [];
    const userContext: UserContext = body.user_context ?? {};

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Keep last 12 turns to bound token cost
    const trimmed = messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.role === 'user' && m === messages[messages.length - 1]
        ? `${m.content}

(context — user's pregnancy_stage: ${userContext.pregnancy_stage ?? 'unknown'}, due_date: ${userContext.due_date ?? 'unknown'})

Reply with JSON only.`
        : m.content,
    }));

    const aiResponse = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: trimmed,
    });

    const raw = (aiResponse.content[0] as { text: string }).text.trim();
    // Strip possible ```json fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned);

    const resolvedResources = parsed.crisis && Array.isArray(parsed.crisis_resources)
      ? Object.fromEntries(
          (parsed.crisis_resources as string[])
            .filter((key) => CRISIS_RESOURCES[key as keyof typeof CRISIS_RESOURCES])
            .map((key) => [key, CRISIS_RESOURCES[key as keyof typeof CRISIS_RESOURCES]]),
        )
      : undefined;

    return new Response(
      JSON.stringify({
        reply: parsed.reply ?? '',
        crisis: parsed.crisis ?? false,
        crisis_resources: resolvedResources,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (_err) {
    return new Response(
      JSON.stringify({
        reply: "I'm having trouble right now. If this is a medical emergency, please call 911. For mental-health crises, call or text 988.",
        crisis: false,
        crisis_resources: undefined,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
