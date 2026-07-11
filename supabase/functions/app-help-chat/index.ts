// Global app-help AI chat — NOT a triage medical assistant.
// POST /functions/v1/app-help-chat
// Body: { messages: [{role, content}], user_context?: { pregnancy_stage?, due_date?, display_name? } }
// Returns: { reply: string, crisis: boolean, crisis_resources?: object }
// SAFETY: If user describes medical symptoms or crisis, punt to 988/911/PSI and suggest booking a specialist.
// Model: Haiku (real-time).

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

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

// AI-native Phase 1 — tool guidance appended as a second system block so the big
// SYSTEM_PROMPT stays untouched. Also corrects a few stale facts in that prompt.
const TOOL_GUIDE = `## Live look-ups (tools)
You can read the mom's OWN logged data. Call get_baby_tracking_stats when she asks about her baby's sleep / feeding / diaper PATTERNS — e.g. "is he ready to drop to 2 naps?", "how are his wake windows?", "is he sleeping enough?", "how many diapers is normal for us?". Then ground your answer in the numbers it returns, framed as supportive patterns from HER logs — NOT medical advice. If it returns has_data:false, tell her the Playbook tracker has nothing logged yet and invite her to start under Manual → Playbook. Do NOT call the tool for general-knowledge questions.

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
Always return ONLY the JSON object described above (even after using a tool). You MAY add the optional "quick_replies" key to that same JSON.`;

const TOOLS = [
  {
    name: 'get_baby_tracking_stats',
    description: "Read the mom's own recently logged baby data (naps, feeds, diapers) from the Playbook tracker and return aggregate patterns: average wake window, feed gap, nap length (all minutes) and diapers per day. Returns has_data:false when she hasn't logged enough yet.",
    input_schema: {
      type: 'object',
      properties: { days: { type: 'integer', description: 'Look-back window in days (default 7).' } },
    },
  },
  {
    name: 'find_specialists',
    description: "Find real maternal-health specialists near the mom and return the top matches (name, specialty, distance, rating). Use when she asks to find/see a provider. If a specialty is given it MUST be one of: OB/GYN, Doula, Midwife, Lactation Consultant, Pediatrician, Sleep Coach, Pelvic Floor PT, Perinatal Dietitian, PPD Therapist. Returns need_location:true if her location isn't available (then ask her to enable location or share her ZIP).",
    input_schema: {
      type: 'object',
      properties: { specialty: { type: 'string', description: 'One of the allowed specialties, or omit for all.' } },
    },
  },
  {
    name: 'search_gear',
    description: "Search gently-used baby gear listed near the mom (cash / P2P pickup, no in-app payment) and return top matches (title, price, distance). Use when she wants to find/buy used gear. Category optional, one of: stroller, carrier_wrap, high_chair, bouncer_swing, toy, feeding_gear, clothing, book, activity_center, nursery_furniture. Returns need_location:true if location is unavailable.",
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Optional gear category from the allowed list.' },
        max_price_usd: { type: 'number', description: 'Optional max price in dollars.' },
      },
    },
  },
  {
    name: 'find_donors',
    description: "Find verified breast-milk donors near the mom (cash / P2P pickup, no in-app payment) and return top matches (name, trust badge, distance). Use when she needs donor milk. Returns need_location:true if location is unavailable.",
    input_schema: { type: 'object', properties: {} },
  },
];

// Server-side mirror of the mobile getRecentStats aggregation (RLS-scoped via the
// caller's JWT client, so it only ever reads HER rows).
async function getTrackerStats(supabase: any, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [sleepR, feedR, diaperR] = await Promise.all([
    supabase.from('baby_sleep_logs').select('started_at, ended_at').gte('started_at', since).order('started_at', { ascending: true }),
    supabase.from('baby_feed_logs').select('started_at').gte('started_at', since).order('started_at', { ascending: true }),
    supabase.from('baby_diaper_logs').select('kind, occurred_at').gte('occurred_at', since),
  ]);
  const sleeps = ((sleepR.data ?? []) as any[]).filter((s) => s.ended_at);
  const naps = sleeps
    .map((s) => (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000)
    .filter((m) => m >= 3 && m <= 600);
  const wake: number[] = [];
  for (let i = 1; i < sleeps.length; i++) {
    const g = (new Date(sleeps[i].started_at).getTime() - new Date(sleeps[i - 1].ended_at).getTime()) / 60000;
    if (g >= 5 && g <= 300) wake.push(g);
  }
  const feeds = (feedR.data ?? []) as any[];
  const gaps: number[] = [];
  for (let i = 1; i < feeds.length; i++) {
    const g = (new Date(feeds[i].started_at).getTime() - new Date(feeds[i - 1].started_at).getTime()) / 60000;
    if (g >= 20 && g <= 420) gaps.push(g);
  }
  const feedDays = new Set(feeds.map((f) => String(f.started_at).slice(0, 10))).size || 1;
  const diapers = (diaperR.data ?? []) as any[];
  const diaperDays = new Set(diapers.map((d) => String(d.occurred_at).slice(0, 10))).size || 1;
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    has_data: naps.length > 0 || feeds.length > 0 || diapers.length > 0,
    window_days: days,
    naps_logged: naps.length,
    avg_nap_min: avg(naps),
    longest_nap_min: naps.length ? Math.round(Math.max(...naps)) : null,
    avg_wake_window_min: avg(wake),
    feeds_logged: feeds.length,
    feeds_per_day: feeds.length ? Math.round((feeds.length / feedDays) * 10) / 10 : null,
    avg_feed_gap_min: avg(gaps),
    diapers_per_day: diapers.length ? Math.round((diapers.length / diaperDays) * 10) / 10 : null,
  };
}

type Loc = { lat: number; lng: number } | null;
const num = (n: any) => (typeof n === 'number' ? Math.round(n * 10) / 10 : undefined);

async function findSpecialists(supabase: any, loc: Loc, specialty?: string) {
  if (!loc) return { need_location: true };
  const { data, error } = await supabase.rpc('specialists_near', {
    lat: loc.lat, lng: loc.lng, radius_miles: 25,
    specialty_filter: specialty || null, language_filter: null, insurance_filter: null, telehealth_only: false,
  });
  if (error) return { error: error.message };
  const rows = (data ?? []) as any[];
  return {
    count: rows.length,
    results: rows.slice(0, 5).map((s) => ({
      name: s.full_name ?? s.name ?? s.display_name,
      specialty: s.specialty,
      distance_mi: num(s.distance_miles ?? s.distance_mi ?? s.distance),
      rating: num(s.rating_avg ?? s.rating),
      city: s.city,
      telehealth: s.telehealth ?? s.telehealth_available,
    })),
  };
}

async function searchGear(supabase: any, loc: Loc, input: any) {
  if (!loc) return { need_location: true };
  const { data, error } = await supabase.rpc('list_gear_near', {
    p_lat: loc.lat, p_lng: loc.lng, p_radius_km: 40,
    p_category: input?.category || null, p_age_tags: null,
    p_max_price_cents: input?.max_price_usd ? Math.round(Number(input.max_price_usd) * 100) : null,
    p_include_free: true,
  });
  if (error) return { error: error.message };
  const rows = (data ?? []) as any[];
  return {
    count: rows.length,
    results: rows.slice(0, 6).map((g) => ({
      title: g.title,
      price: g.is_free ? 'free' : (g.price_cents != null ? `$${Math.round(g.price_cents / 100)}` : undefined),
      distance_mi: g.distance_km != null ? num(g.distance_km * 0.621) : num(g.distance_mi),
      category: g.category,
      condition: g.condition,
    })),
  };
}

async function findDonors(supabase: any, loc: Loc) {
  if (!loc) return { need_location: true };
  const { data, error } = await supabase.rpc('search_donors_near', {
    user_lat: loc.lat, user_lng: loc.lng, radius_miles: 25, filter_badge: null, max_price: null,
  });
  if (error) return { error: error.message };
  const rows = (data ?? []) as any[];
  return {
    count: rows.length,
    results: rows.slice(0, 5).map((d) => ({
      name: d.display_name ?? d.donor_name ?? d.name,
      badge: d.badge_level,
      distance_mi: num(d.distance_miles ?? d.distance_mi ?? d.distance),
      price_per_oz: d.price_per_oz != null ? `$${d.price_per_oz}/oz` : undefined,
    })),
  };
}

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

    // User-scoped client so the tracking tool reads ONLY her rows (RLS).
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const systemBlocks = [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: TOOL_GUIDE },
    ];

    // Tool-use loop — the model may call get_baby_tracking_stats (bounded to a few
    // hops), then must reply with the JSON contract. Non-tool questions break out
    // on the first turn, so how-to/crisis handling is unchanged.
    const convo: any[] = trimmed;
    let aiResponse: any = null;
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
      for (const tu of toolUses as any[]) {
        let out: unknown;
        try {
          out = tu.name === 'get_baby_tracking_stats'
            ? await getTrackerStats(supabase, Number(tu.input?.days) || 7)
            : tu.name === 'find_specialists'
            ? await findSpecialists(supabase, userLocation, tu.input?.specialty)
            : tu.name === 'search_gear'
            ? await searchGear(supabase, userLocation, tu.input)
            : tu.name === 'find_donors'
            ? await findDonors(supabase, userLocation)
            : { error: 'unknown_tool' };
        } catch (e) { out = { error: String(e) }; }
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
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

    const quickReplies = Array.isArray(parsed.quick_replies)
      ? (parsed.quick_replies as unknown[])
          .filter((x) => typeof x === 'string' && x.trim().length > 0)
          .map((x) => String(x).trim().slice(0, 40))
          .slice(0, 5)
      : undefined;

    return new Response(
      JSON.stringify({
        reply: parsed.reply ?? '',
        crisis: parsed.crisis ?? false,
        crisis_resources: resolvedResources,
        quick_replies: quickReplies && quickReplies.length > 0 ? quickReplies : undefined,
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
