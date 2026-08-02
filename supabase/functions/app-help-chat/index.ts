// Global app-help AI chat — NOT a triage medical assistant.
// POST /functions/v1/app-help-chat
// Body: { messages: [{role, content}], user_context?: { pregnancy_stage?, due_date?, display_name? } }
// Returns: { reply: string, crisis: boolean, crisis_resources?: object }
// SAFETY: If user describes medical symptoms or crisis, punt to 988/911/PSI and suggest booking a specialist.
// Model: Haiku (real-time).

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import { dispatch, TOOLS } from './tools/registry.ts';
import { isNavigate } from './tools/types.ts';
import type { BabyCtx, Loc } from './tools/types.ts';
import { NAV_TARGETS } from './tools/navigate.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

// Haiku occasionally answers in prose instead of the JSON envelope — usually on
// the turn straight after a tool call. That used to throw to the catch at the
// bottom, which told the mom to call 911 for what was really a parse error
// (photographed 2026-08-02: three times in one eval run, and retyping the same
// sentence worked every time — so a perfectly good answer was being binned).
// Try strict parse, then a JSON object embedded in prose, before giving up.
function extractJson(raw: string): any | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  if (!cleaned) return null;
  try { return JSON.parse(cleaned); } catch { /* try the embedded-object path */ }
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(cleaned.slice(first, last + 1)); } catch { /* give up */ }
  }
  return null;
}

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

// AI-native Phase 1 — tool guidance appended as a second system block so the big
// SYSTEM_PROMPT stays untouched. Also corrects a few stale facts in that prompt.
const TOOL_GUIDE = `## Live look-ups (tools)
You can read the mom's OWN logged data. Call get_baby_tracking_stats when she asks about her baby's sleep / feeding / diaper PATTERNS or "how were his feeds/naps today" — CALL IT IMMEDIATELY, never ask her whether she has a baby profile or logged data first (the tool tells you). Ground your answer in the numbers it returns, framed as supportive patterns from HER logs — NOT medical advice. If it returns has_data:false, say nothing's logged yet and invite her to start (cta "playbook"). Do NOT call the tool for general-knowledge questions.

Call find_specialists / search_gear / find_donors when she asks to FIND a provider, used gear, or donor milk near her — then summarize the top few results warmly (name, distance, price/rating) and tell her where to tap to go further (Experts / Gear / Milk tab). If a tool returns need_location:true, don't guess — ask her to enable location for the app or tell you her ZIP/city, and offer to still explain how to search that tab herself. If count is 0, say nothing's listed nearby right now and suggest widening later or checking the tab.

## Current facts (override anything above that conflicts)
- Milk Hub and Gear are CASH / P2P only, arranged at pickup — there is NO in-app Stripe payment for milk or gear.
- The Gear tab IS live (browse + list gently-used baby gear).
- "Playbook" (under the Manual tab) is a real sleep/feed/diaper tracker with a live nap timer.

## Tappable quick-replies (make it effortless — like Flo)
When your reply asks the mom a question that has a SMALL, COMMON set of answers — the kind of question that's the same for almost everyone — ALSO include a "quick_replies" array of 2–5 SHORT tappable options (each ≤4 words) so she can just TAP instead of typing. She taps one and it's sent as her next message.
- Trip / milk planning → e.g. "Are you bringing milk?" → ["Pumped milk", "Donor milk", "Just my stash", "Something else"]
- Yes/no forks → ["Yes", "No", "Not sure yet"]
- Picking a baby age / stage / count when you need it and don't already know.
Rules: options must be things SHE would say (first person / short noun), mutually distinct, and genuinely answer the question you just asked. OMIT quick_replies entirely for open-ended questions, for statements, or when you're giving info rather than asking. Never pad with a filler option just to hit a count.

## Her baby + what you remember (context you already have)
The context line on her message may include her baby (name, week, feeding_method) and "things you've learned" from past chats. USE them: call the baby by name, and NEVER re-ask anything already there. Logging rules: when she asks to log something and gave you the essentials (kind + amount/duration), log it IMMEDIATELY with log_baby_event — no follow-up questions. Never ask what was in a bottle (contents aren't recorded; her feeding_method is already in context).
When she tells you a small durable practical fact about her routines or preferences ("he only takes pumped-milk bottles", "we do bath at 7", "she naps in the carrier"), silently call remember_fact so future chats know it. NEVER store medical symptoms, crisis content, or another person's personal details.

## Plain text, short
"reply" is rendered VERBATIM — plain text only, no markdown (**bold**, bullets, headers). 1–2 short paragraphs max.

## Tappable open-button (cta)
You MAY add an optional "cta" key to the response JSON: {"label": "short label ≤24 chars", "screen": "one of: playbook | booking | appointment_book | gear_create | box_checkout | gear_boost | become_donor | donor_profile_edit | account_settings | baby_profile_setup | write_review | message_specialist | create_milk_listing | milk_messages | vault_create_listing | gear_status | gear_messages | report_gear | day_sheet | milk_vault"}. Use it whenever a screen lets her SEE or FINISH what you just did. NOT optional after logging: EVERY successful log_baby_event reply MUST carry {"label":"Open Playbook","screen":"playbook"} (label "See the timer" when a timer is running). At most one cta; omit when irrelevant.

## Do-it-for-me asks = navigate, EVERY time
When she asks you to DO one of these, ALWAYS call the navigate tool. Never answer with how-to directions alone ("head to the Experts tab and tap…") — that is the one failure mode moms notice, because she asked you to handle it and got homework instead. Same sentence must produce the same pill every time:
- book / schedule an appointment → 'booking'
- message / ask / contact a provider, OB, midwife, doula, lactation consultant → 'message_specialist'
- review / rate a provider → 'write_review'
- sell / list / post gear → 'gear_create'   · mark sold / withdraw / relist → 'gear_status'
- boost / promote a listing → 'gear_boost'  · report / flag a listing → 'report_gear'
- post / list milk → 'create_milk_listing'  · message a donor → 'milk_messages'
- become a donor → 'become_donor'           · edit donor profile → 'donor_profile_edit'
- sell or donate stashed milk → 'vault_create_listing'
You may ALSO mention relevant nearby matches from a find_* tool, but never let search results stand in for the pill — even when nothing is nearby, since the destination lets her widen the search herself. If you cannot do the thing yourself, say that in one short clause and give her the pill; do not apologize at length or list manual steps.
Always return ONLY the JSON object described above (even after using a tool). You MAY add the optional "quick_replies" and "cta" keys to that same JSON.`;

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
    const userLocation: Loc = (body.user_location && typeof body.user_location.lat === 'number' && typeof body.user_location.lng === 'number')
      ? { lat: body.user_location.lat, lng: body.user_location.lng }
      : null;
    // Calendar free/busy (times only, no event titles) — powers "fits my schedule".
    const busyWindows: { start: string; end: string }[] = Array.isArray(body.user_availability?.busy)
      ? body.user_availability.busy.filter((b: any) => b?.start && b?.end).slice(0, 50)
      : [];
    const availabilityLine = busyWindows.length
      ? `\n(the mom's calendar BUSY windows — free/busy only, no details — for the next few days: ${busyWindows.map((b) => `${b.start}–${b.end}`).join('; ')}. For anything that must "fit her schedule", pick a time OUTSIDE these windows and say why it fits. Never reveal you can see event details — you only see busy/free.)`
      : '';

    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // User-scoped client so every tool reads/writes ONLY her rows (RLS).
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Baby profile + learned memories, fetched fresh each request (both RLS-scoped,
    // both fail-soft so chat keeps working if either is missing or the memories
    // table hasn't been migrated yet).
    const [babyR, memR] = await Promise.all([
      supabase.from('baby_profiles_with_week')
        .select('id, baby_name, feeding_method, current_week_number')
        .order('created_at', { ascending: true }).limit(1).maybeSingle()
        .then((r: any) => r?.data ?? null).catch(() => null),
      supabase.from('villie_memories')
        .select('fact').order('created_at', { ascending: false }).limit(20)
        .then((r: any) => (r?.data ?? []) as { fact: string }[]).catch(() => []),
    ]);
    const baby: BabyCtx = babyR?.id
      ? { id: babyR.id, name: babyR.baby_name ?? null, feeding_method: babyR.feeding_method ?? null, week: babyR.current_week_number ?? null }
      : null;
    const babyLine = baby
      ? `\n(her baby: name ${baby.name ?? 'not set'}, week ${baby.week ?? '?'}, feeding_method ${baby.feeding_method ?? 'unknown'} — a baby profile EXISTS; never ask whether she has one, and never re-ask anything listed here.)`
      : '';
    const memoryLine = memR.length
      ? `\n(things you've learned about her from past chats — use naturally, never re-ask: ${memR.map((m) => m.fact).join(' | ')})`
      : '';

    // Keep last 12 turns to bound token cost
    const trimmed = messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.role === 'user' && m === messages[messages.length - 1]
        ? `${m.content}

(context — user's pregnancy_stage: ${userContext.pregnancy_stage ?? 'unknown'}, due_date: ${userContext.due_date ?? 'unknown'})${babyLine}${memoryLine}${availabilityLine}

Reply with JSON only.`
        : m.content,
    }));

    const systemBlocks = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: TOOL_GUIDE },
    ];

    // Tool-use loop — the model may call get_baby_tracking_stats (bounded to a few
    // hops), then must reply with the JSON contract. Non-tool questions break out
    // on the first turn, so how-to/crisis handling is unchanged.
    const convo: any[] = trimmed;
    let aiResponse: any = null;
    let navigateAction: { screen: string; params?: Record<string, unknown> } | null = null;
    for (let hop = 0; hop < 4; hop++) {
      const resp = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 700,
        system: systemBlocks as any,
        tools: TOOLS as any,
        messages: convo,
      });
      const toolUses = resp.content.filter((b: any) => b.type === 'tool_use');
      if (toolUses.length === 0) { aiResponse = resp; break; }
      convo.push({ role: 'assistant', content: resp.content });
      const toolResults: any[] = [];
      const ctx = { supabase, loc: userLocation, baby };
      for (const tu of toolUses as any[]) {
        const out = await dispatch(tu.name, ctx, tu.input);
        if (isNavigate(out)) {
          navigateAction = out.__navigate;
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ ok: true, navigating: true }) });
        } else {
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
        }
      }
      convo.push({ role: 'user', content: toolResults });
    }
    // Safety net: force a final tool-less JSON reply if the loop never resolved.
    if (!aiResponse) {
      aiResponse = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 500,
        system: systemBlocks as any, messages: convo,
      });
    }

    const textBlock = aiResponse.content.find((b: any) => b.type === 'text');
    const raw = (textBlock?.text ?? '').trim();
    let parsed = extractJson(raw);
    if (!parsed) {
      // Repair turn — hand the model its own malformed output back and ask for
      // the contract. We RE-ASK rather than salvage the prose because the crisis
      // flag only exists inside the envelope; shipping loose prose would quietly
      // drop crisis detection for that turn. Costs one cheap Haiku call, and
      // only on the rare turns that miss the format.
      const repair = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001', max_tokens: 700,
        system: systemBlocks as any,
        messages: [
          ...convo,
          { role: 'assistant', content: raw || '(empty)' },
          { role: 'user', content: 'That was not valid JSON. Send the SAME answer again as the required JSON object only — no prose, no code fences.' },
        ],
      });
      const repairText = repair.content.find((b: any) => b.type === 'text');
      parsed = extractJson((repairText?.text ?? '').trim());
    }
    if (!parsed) throw new Error('unparseable_reply');

    const resolvedResources = parsed.crisis && Array.isArray(parsed.crisis_resources)
      ? Object.fromEntries(
          (parsed.crisis_resources as string[])
            .filter((key) => CRISIS_RESOURCES[key as keyof typeof CRISIS_RESOURCES])
            .map((key) => [key, CRISIS_RESOURCES[key as keyof typeof CRISIS_RESOURCES]]),
        )
      : undefined;

    const quickReplies = Array.isArray(parsed.quick_replies)
      ? (parsed.quick_replies as unknown[])
          .filter((x) => typeof x === 'string' && x.trim().length > 0)
          .map((x) => String(x).trim().slice(0, 40))
          .slice(0, 5)
      : undefined;

    // Optional tappable "open" button — allowlist-validated against NAV_TARGETS,
    // suppressed on crisis turns (the crisis card must be the only reach).
    const cta = (!parsed.crisis
        && parsed.cta && typeof parsed.cta.label === 'string'
        && (NAV_TARGETS as readonly string[]).includes(String(parsed.cta.screen)))
      ? { label: String(parsed.cta.label).trim().slice(0, 28), screen: String(parsed.cta.screen) }
      : undefined;

    return new Response(
      JSON.stringify({
        reply: parsed.reply ?? '',
        crisis: parsed.crisis ?? false,
        crisis_resources: resolvedResources,
        quick_replies: quickReplies && quickReplies.length > 0 ? quickReplies : undefined,
        navigate: navigateAction ?? undefined,
        cta,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (_err) {
    // This is a TRANSPORT/PARSE failure, not a medical one — so it must not
    // impersonate a crisis response. The old copy led with "call 911", which
    // read as though Billy had flagged her message when he had simply failed to
    // answer it (and it masked the JSON bug above for weeks). Say what actually
    // happened, invite a retry, and keep the hotlines as a quiet footer.
    return new Response(
      JSON.stringify({
        reply: "Sorry — I lost that one on my end. Say it again and I'll pick it right up.\n\nIf you need someone this second: 988 for a mental-health crisis, 911 for an emergency.",
        crisis: false,
        crisis_resources: undefined,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
