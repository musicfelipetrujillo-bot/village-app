// room-alias-generate — V3 C3 anonymous alias generator
//
// Generates a warm, postpartum-themed handle for anonymous community
// participation. Uses Claude Haiku for the language work, then upserts
// the result into user_anonymous_identities via the upsert_anon_identity
// RPC (migration 069).
//
// Two modes:
//   - { preview: true }              → returns a proposed alias WITHOUT
//                                      persisting. Used by the onboarding
//                                      screen for "here's what your name
//                                      could look like" previews. No room
//                                      membership required.
//   - { room_id: <uuid>, regenerate? } → generates AND upserts. Requires
//                                      room membership (enforced by the
//                                      RPC). regenerate=true updates an
//                                      existing identity instead of
//                                      collision-erroring.
//
// Body shape:
//   { preview: true } | { room_id: string, regenerate?: boolean }
//
// Returns:
//   { alias: string, avatar_seed: string, persisted: boolean }
//
// Persistence model: we save only (alias + avatar_seed) per room — no
// generation prompts, no LLM transcripts. The DB row is the source of
// truth; this function can be re-run to regenerate without retaining any
// history of past aliases.
//
// Auth: authenticated user JWT (verify_jwt: true default).

import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANTHROPIC_KEY    = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

const anthropic = ANTHROPIC_KEY ? new Anthropic({ apiKey: ANTHROPIC_KEY }) : null;

// Prompt is small + ephemeral-cached so repeat calls stay fast + cheap.
// Constraints on the output are strict because we use the raw response
// as the alias — no parsing, no scrubbing beyond a regex check.
const SYSTEM_PROMPT = `You generate warm, anonymous community handles for a postpartum mom support app.

Style: ONE proper-cased nature/light/comfort word + ONE supportive descriptor word, joined by no separator. Optional postpartum stage suffix like _4w (week 4 postpartum) or _PP (general postpartum).

Examples of good aliases:
- TulipMama
- WillowWarrior_4w
- GoldenMornings
- SunsetMother_PP
- CedarSister_8w
- VioletSoul

Rules:
- NO emoji, NO numbers other than week marker
- NO references to the user's real name, location, race, religion, condition
- NO sexual, violent, religious, or political terms
- 6-22 characters total
- ASCII only (no accents)
- Must NOT match any of these (taken in this room): {taken_aliases}

Return EXACTLY one alias. No quotes, no explanation, no leading/trailing whitespace.`;

const ALIAS_RE = /^[A-Za-z][A-Za-z0-9_]{5,21}$/;

// Avatar seed — deterministic-ish input for client-side avatar rendering
// (DiceBear, etc.). We use a derived hash of (user_id + alias) so the
// same user with the same alias gets the same avatar across sessions,
// but regenerating the alias regenerates the avatar.
async function deriveAvatarSeed(userId: string, alias: string): Promise<string> {
  const data = new TextEncoder().encode(`${userId}:${alias}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

interface Body {
  preview?: boolean;
  room_id?: string;
  regenerate?: boolean;
}

async function generateAlias(takenAliases: string[]): Promise<string | null> {
  if (!anthropic) return null;
  // Up to 3 attempts to avoid a collision retry storm.
  for (let attempt = 0; attempt < 3; attempt++) {
    const taken = takenAliases.length ? takenAliases.join(', ') : '(none yet)';
    const sys = SYSTEM_PROMPT.replace('{taken_aliases}', taken);
    try {
      const res = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 30,
        temperature: 0.9,
        system: [{ type: 'text', text: sys, cache_control: { type: 'ephemeral' } as any }],
        messages: [{ role: 'user', content: 'Generate one alias now.' }],
      });
      const raw = (res.content[0] as any)?.text?.trim() ?? '';
      // Strip code fences, quotes, trailing punctuation defensively.
      const candidate = raw.replace(/^["'`]+|["'`]+$/g, '').split(/\s/)[0];
      if (ALIAS_RE.test(candidate) && !takenAliases.includes(candidate)) {
        return candidate;
      }
    } catch (e) {
      console.warn('alias gen attempt failed', attempt, (e as Error).message);
    }
  }
  return null;
}

// Hand-curated fallbacks for the unhappy path (Anthropic outage / quota /
// retries exhausted). Hardcoded so the feature never fully fails open with
// "Anonymous_<uuid>" or similar pii-leaky fallback. Picks one at random
// and falls through to numbered variants if all are taken.
const FALLBACK_BASE = [
  'TulipMama', 'WillowWarrior', 'GoldenMornings', 'SunsetMother',
  'CedarSister', 'VioletSoul', 'AmberMoon', 'DaisyHeart',
  'IvyMornings', 'JasperLight', 'LavenderDay', 'MorningMother',
  'OakenSister', 'PrimroseMama', 'QuincePath', 'RoseLight',
];
function pickFallbackAlias(takenAliases: string[]): string {
  const free = FALLBACK_BASE.filter((a) => !takenAliases.includes(a));
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)];
  // All bases taken → append a small index. Won't realistically happen
  // in a healthy room (16 bases × tiny room cohort = plenty of headroom).
  for (let n = 2; n < 99; n++) {
    for (const base of FALLBACK_BASE) {
      const candidate = `${base}${n}`;
      if (!takenAliases.includes(candidate)) return candidate;
    }
  }
  // Last resort. Should never reach.
  return `Anon${Date.now().toString(36)}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // User-scoped client — RLS on upsert_anon_identity / get_my_anon_identity
  // does the auth.uid()-as-membership check.
  const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Identify caller (for the avatar seed). Decode user_id from the JWT.
  let userId: string | null = null;
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload?.sub ?? null;
  } catch {
    /* fall through */
  }
  if (!userId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Build the taken-aliases list. For room_id mode we query the room;
  // for preview mode we skip (any alias is fine since we don't persist).
  let takenAliases: string[] = [];
  if (body.room_id) {
    // Service-role read to avoid RLS issues (the existing RLS on
    // user_anonymous_identities is USING(FALSE) for self-protection;
    // we only need alias strings, not user_ids).
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const { data } = await adminClient
      .from('user_anonymous_identities')
      .select('anon_alias')
      .eq('room_id', body.room_id);
    takenAliases = (data ?? []).map((r) => r.anon_alias);
  }

  // Generate. Fallback on AI failure.
  const alias = (await generateAlias(takenAliases)) ?? pickFallbackAlias(takenAliases);
  const avatarSeed = await deriveAvatarSeed(userId, alias);

  // Preview-only path: return without persisting. No room membership
  // check needed.
  if (body.preview === true || !body.room_id) {
    return new Response(JSON.stringify({ alias, avatar_seed: avatarSeed, persisted: false }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Persist via the RPC (membership-gated).
  const { data: row, error } = await supabase.rpc('upsert_anon_identity', {
    p_room_id: body.room_id,
    p_alias: alias,
    p_avatar_seed: avatarSeed,
  });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    alias: row?.anon_alias ?? alias,
    avatar_seed: row?.anon_avatar_seed ?? avatarSeed,
    persisted: true,
  }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
