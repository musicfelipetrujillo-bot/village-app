// V6 Milk Vault — AI bag scanner.
//
// POST /functions/v1/milk-vault-scan
// Body: { image_base64?: string, image_media_type?: string, image_url?: string }
// Returns: {
//   ounces: number | null,       // volume printed/written on the bag
//   pumped_date: string | null,  // ISO YYYY-MM-DD
//   frozen_date: string | null,  // ISO YYYY-MM-DD, only if clearly visible
//   notes: string | null,        // any handwritten note (e.g. "morning pump")
//   confidence: number,          // 0..1 model self-reported
//   reasoning: string            // 1 sentence — for logging, not shown to user
// }
//
// The user reviews + edits every field on a confirmation screen before the
// bag is saved, so this route is best-effort: it never blocks, and it
// fail-opens to all-nulls on any model/parse error (HTTP 200) so the client
// can drop straight into manual entry.
//
// Model: Claude Haiku 4.5 (multimodal, real-time). Prompt cached per
// CLAUDE.md rule 6. Env: ANTHROPIC_API_KEY in Supabase Edge Function Secrets.

import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You read photos of breast-milk storage bags (Lansinoh, Medela, Kiinde, generic, etc.) and extract the label details a mom writes or that are pre-printed on the bag.

Return ONLY a single JSON object, no prose, no code fences:
{
  "ounces": <number or null>,        // total volume. Convert mL to oz (1 oz = 29.5735 mL), round to 1 decimal. If a range, take the larger. null if not legible.
  "pumped_date": "<YYYY-MM-DD or null>",  // the date pumped/expressed. Assume the most recent plausible year if only month/day are written.
  "frozen_date": "<YYYY-MM-DD or null>",  // the date frozen, ONLY if clearly a separate visible date; otherwise null.
  "notes": "<string or null>",       // any other handwriting: baby name, side (L/R), "morning", "meds", "foremilk", time, etc. Keep it short. null if none.
  "confidence": <0..1>,              // how sure you are about ounces + pumped_date.
  "reasoning": "<one short sentence>"
}

Rules:
- Dates: interpret US-style M/D. "5/3" with no year → the most recent past May 3rd.
- Never invent a value you cannot see. Prefer null over a guess.
- If two dates are present and one is labeled "frozen"/"froze", use it for frozen_date; the other is pumped_date.
- Ounces printed as "4 oz" fill lines are the bag capacity, NOT the amount — only use a written/marked amount when present.`;

interface ScanResult {
  ounces: number | null;
  pumped_date: string | null;
  frozen_date: string | null;
  notes: string | null;
  confidence: number;
  reasoning: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function coerce(raw: unknown): ScanResult {
  const r = (raw ?? {}) as Record<string, unknown>;

  let ounces: number | null = null;
  const oz = typeof r.ounces === 'number' ? r.ounces : Number(r.ounces);
  if (Number.isFinite(oz) && oz > 0 && oz <= 100) ounces = Math.round(oz * 10) / 10;

  const clampDate = (v: unknown): string | null =>
    typeof v === 'string' && ISO_DATE.test(v.trim()) ? v.trim() : null;

  let confidence = typeof r.confidence === 'number' ? r.confidence : Number(r.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.max(0, Math.min(1, confidence));

  const notes =
    typeof r.notes === 'string' && r.notes.trim() && r.notes.trim().toLowerCase() !== 'null'
      ? r.notes.trim().slice(0, 280)
      : null;

  return {
    ounces,
    pumped_date: clampDate(r.pumped_date),
    frozen_date: clampDate(r.frozen_date),
    notes,
    confidence,
    reasoning: typeof r.reasoning === 'string' ? r.reasoning.slice(0, 200) : '',
  };
}

interface ScanBody {
  image_base64?: string;
  image_media_type?: string;
  image_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Auth: the scanner is a signed-in-only convenience. Reject anonymous calls
  // so the endpoint isn't a free vision proxy.
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let body: ScanBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

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
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: image },
          { type: 'text', text: 'Extract this milk bag label. JSON only.' },
        ],
      }],
    });

    const textBlock = resp.content.find((b) => b.type === 'text') as
      | { type: 'text'; text: string }
      | undefined;
    if (!textBlock) throw new Error('no text block in response');

    const cleaned = textBlock.text.trim()
      .replace(/^```(?:json)?\s*/, '')
      .replace(/\s*```$/, '');

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('[milk-vault-scan] non-json model output:', textBlock.text);
      return new Response(JSON.stringify(coerce({})), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(coerce(parsed)), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[milk-vault-scan] error', err);
    // Fail-open: return all-null so the client falls through to manual entry.
    return new Response(JSON.stringify(coerce({})), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
