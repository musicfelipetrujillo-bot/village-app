// V1 AI Skill #3 — Translate Specialist Profiles
// POST /functions/v1/ai-translate
// Body: { specialist_id, field_name, field_content, target_lang: 'es' | 'ht' }
// Returns: { translated_text: string }
// Caches by content_hash in specialist_translations table
// Model: Haiku (fast, cost-effective for translation)

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import { createHash } from 'node:crypto';

import { getCallerUserId } from '../_shared/user-auth.ts';
import { consumeQuota, tooManyRequests } from '../_shared/rate-limit.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LANG_NAMES: Record<string, string> = {
  es: 'Spanish',
  ht: 'Haitian Creole',
};

const SYSTEM_PROMPT = `You are a certified medical translator specializing in maternal and perinatal health.
Translate the provided text faithfully and accurately into the target language.

Rules:
- Preserve all medical terminology accurately — never simplify clinical terms
- Maintain the same tone (warm/professional) as the original
- Keep proper names (doctor names, practice names, drug names) unchanged
- Do not add, remove, or editorialize any content
- Output: the translated text only — no explanations, no quotation marks`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // AUTH (2026-09-05): no authorization check existed, and `verify_jwt = true` is
  // not one — the anon publishable key ships in the mobile bundle and satisfies the
  // gateway. This function translates specialist copy via Haiku and writes rows to specialist_translations, so anyone who extracted that key had a free,
  // unmetered endpoint billed to Villie's account.
  //
  // The real caller is the mobile app as a signed-in user (it already sends her
  // JWT), so requiring a valid user breaks nothing. The gate alone would still
  // leave a signed-in user free to loop the endpoint; the quota below closes that.
  const callerId = await getCallerUserId(req);
  if (!callerId) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Per-user quota (migration 135 + _shared/rate-limit.ts). The gate above says
  // WHO is calling; this says HOW MUCH they may have. Without it one real account
  // could loop this endpoint and bill Villie without limit. Decided atomically in
  // SQL, so concurrent requests cannot all pass the same check. Fails OPEN on a
  // ledger error — this is a cost control, and a DB blip must not block a mother
  // mid-flow.
  const quota = await consumeQuota(callerId, 'ai-translate');
  if (!quota.allowed) return tooManyRequests(quota, CORS);

  try {
    const { specialist_id, field_name, field_content, target_lang } = await req.json();

    if (!specialist_id || !field_name || !field_content || !target_lang) {
      return new Response(
        JSON.stringify({ error: 'specialist_id, field_name, field_content, target_lang required' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    if (!LANG_NAMES[target_lang]) {
      return new Response(
        JSON.stringify({ error: `Unsupported language: ${target_lang}` }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // Content hash for cache lookup (~90% cost reduction at scale)
    const content_hash = createHash('sha256').update(`${target_lang}:${field_content}`).digest('hex');

    // Check cache
    const { data: cached } = await supabase
      .from('specialist_translations')
      .select('translated_text')
      .eq('specialist_id', specialist_id)
      .eq('language_code', target_lang)
      .eq('field_name', field_name)
      .eq('content_hash', content_hash)
      .single();

    if (cached) {
      return new Response(JSON.stringify({ translated_text: cached.translated_text, cached: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Translate with Haiku
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
          content: `Translate to ${LANG_NAMES[target_lang]}:

${field_content}`,
        },
      ],
    });

    const translated_text = (message.content[0] as { text: string }).text.trim();

    // Cache the result
    await supabase
      .from('specialist_translations')
      .upsert(
        {
          specialist_id,
          language_code: target_lang,
          field_name,
          content_hash,
          translated_text,
        },
        { onConflict: 'specialist_id,language_code,field_name,content_hash' },
      );

    return new Response(JSON.stringify({ translated_text, cached: false }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
