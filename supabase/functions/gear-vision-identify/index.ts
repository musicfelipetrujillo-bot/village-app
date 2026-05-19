// V4 Phase G5 — AI vision product identify.
//
// POST /functions/v1/gear-vision-identify
// Body: { image_base64?: string, image_media_type?: string, image_url?: string }
// Returns: {
//   name: string,            // best guess product name, e.g. "UPPAbaby Vista stroller"
//   brand: string | null,
//   category_hint: string | null,  // one of our GearCategory enum values, or null
//   subcategory_hint: string | null,
//   condition_hint: string | null, // 'new'|'like_new'|'good'|'fair'|null
//   confidence: number,      // 0..1 model self-reported
//   reasoning: string        // 1 sentence — for our own logging, not for the user
// }
//
// Model: Claude Haiku 4.5 (multimodal). Prompt cached per CLAUDE.md rule 6.
// The GearSwap ToolStack doc lists GPT-4o Vision as primary, but the Village
// stack standardizes on Claude per `docs/source/Village_App_Tech_Spec.md`.

import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Mirrors the GearCategory enum in apps/mobile/src/api/gear.ts and the CHECK in
// migration 012. Prohibited categories are deliberately absent.
const ALLOWED_CATEGORIES = [
  'stroller',
  'carrier_wrap',
  'high_chair',
  'bouncer_swing',
  'toy',
  'feeding_gear',
  'clothing',
  'book',
  'activity_center',
  'nursery_furniture',
];

// Prohibited categories are the inverse of ALLOWED_CATEGORIES — items we will
// never accept on the marketplace regardless of how they're tagged. Mirrors
// the in-app PROHIBITED_CATEGORIES list and the policy section of the Gear
// Marketplace Addendum. If the model identifies one of these from the photo,
// the calling client is expected to hard-block the upload (see
// ProhibitedItemBlockModal). The model returns the matched key here so the
// modal can display the right rationale.
const PROHIBITED_CATEGORIES = [
  'car_seat',
  'breast_pump',
  'sleep_positioner',
  'inclined_sleeper',
  'helmet',
] as const;
type ProhibitedCategory = typeof PROHIBITED_CATEGORIES[number];

const SYSTEM_PROMPT = `You identify used baby gear from a photo for resale on a curated marketplace.

ALLOWED CATEGORIES (you MUST return one of these for category_hint, or null if the item is not baby gear or is prohibited):
${ALLOWED_CATEGORIES.join(', ')}

PROHIBITED CATEGORIES (if the item matches one of these, you MUST set category_hint=null AND set prohibited_category to the matching key below):
- car_seat (excluded for safety/expiration liability)
- breast_pump (FDA single-user medical device)
- sleep_positioner (linked to infant deaths)
- inclined_sleeper (banned under federal Safe Sleep Standard)
- helmet (invisible impact damage)

For condition, use these labels only: new | like_new | good | fair.
- new: unused, likely still in packaging
- like_new: minor signs of handling, no wear
- good: visible wear but fully functional
- fair: significant wear, may need cleaning

Output STRICT JSON only. No prose, no markdown, no code fences. Shape:
{
  "name": "<best product name, e.g. 'UPPAbaby Minu V2 stroller'>",
  "brand": "<brand or null>",
  "category_hint": "<one allowed category or null>",
  "subcategory_hint": "<string or null>",
  "condition_hint": "<new|like_new|good|fair or null>",
  "confidence": <0.0-1.0 float>,
  "prohibited_category": "<one of: car_seat|breast_pump|sleep_positioner|inclined_sleeper|helmet, OR null>",
  "reasoning": "<1 short sentence>"
}

Rules for prohibited_category:
- ONLY set it if you are confident (≥0.6) the photo shows a prohibited item.
- When set, category_hint MUST be null.
- When NOT set, return null. Do not guess.

If the photo is blurry, empty, or not identifiable, return name="", confidence=0, prohibited_category=null, and nulls for the rest.`;

interface Body {
  image_base64?: string;
  image_media_type?: string;
  image_url?: string;
}

interface IdentifyResult {
  name: string;
  brand: string | null;
  category_hint: string | null;
  subcategory_hint: string | null;
  condition_hint: 'new' | 'like_new' | 'good' | 'fair' | null;
  confidence: number;
  prohibited_category: ProhibitedCategory | null;
  reasoning: string;
}

function coerce(raw: unknown): IdentifyResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const cat = typeof r.category_hint === 'string' && ALLOWED_CATEGORIES.includes(r.category_hint)
    ? r.category_hint : null;
  const cond = typeof r.condition_hint === 'string' && ['new','like_new','good','fair'].includes(r.condition_hint)
    ? r.condition_hint as IdentifyResult['condition_hint'] : null;
  const conf = typeof r.confidence === 'number' ? Math.max(0, Math.min(1, r.confidence)) : 0;
  // Validate prohibited_category strictly against the enum. If category_hint
  // ALSO came back set (the model violated the "if prohibited, category_hint
  // must be null" rule), discard category_hint — the prohibited flag wins.
  const prohibited = typeof r.prohibited_category === 'string'
    && (PROHIBITED_CATEGORIES as readonly string[]).includes(r.prohibited_category)
    ? r.prohibited_category as ProhibitedCategory : null;
  return {
    name: typeof r.name === 'string' ? r.name : '',
    brand: typeof r.brand === 'string' && r.brand.length > 0 ? r.brand : null,
    category_hint: prohibited ? null : cat,
    subcategory_hint: typeof r.subcategory_hint === 'string' && r.subcategory_hint.length > 0 ? r.subcategory_hint : null,
    condition_hint: cond,
    confidence: conf,
    prohibited_category: prohibited,
    reasoning: typeof r.reasoning === 'string' ? r.reasoning : '',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: Body;
  try { body = await req.json() as Body; }
  catch { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }); }

  if (!body.image_base64 && !body.image_url) {
    return new Response(JSON.stringify({ error: 'image_base64 or image_url required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const image = body.image_base64
    ? {
        type: 'base64' as const,
        media_type: (body.image_media_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif') ?? 'image/jpeg',
        data: body.image_base64,
      }
    : { type: 'url' as const, url: body.image_url! };

  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: [{
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: image },
          { type: 'text', text: 'Identify this item. JSON only.' },
        ],
      }],
    });

    // First text block.
    const textBlock = resp.content.find((b) => b.type === 'text') as { type: 'text'; text: string } | undefined;
    if (!textBlock) throw new Error('no text block in response');

    // Model may wrap in ```json fences despite the system prompt — strip them.
    const cleaned = textBlock.text.trim()
      .replace(/^```(?:json)?\s*/, '')
      .replace(/\s*```$/, '');

    let parsed: unknown;
    try { parsed = JSON.parse(cleaned); }
    catch {
      console.error('[vision-identify] non-json model output:', textBlock.text);
      return new Response(JSON.stringify(coerce({})), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(coerce(parsed)), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[vision-identify] error', err);
    return new Response(JSON.stringify({ error: 'vision unavailable', ...coerce({}) }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
