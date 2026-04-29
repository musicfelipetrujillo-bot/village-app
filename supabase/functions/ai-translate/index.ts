// V1 AI Skill #3 — Translate Specialist Profiles
// POST /functions/v1/ai-translate
// Body: { specialist_id, field_name, field_content, target_lang: 'es' | 'ht' }
// Returns: { translated_text: string }
// Caches by content_hash in specialist_translations table
// Model: Haiku (fast, cost-effective for translation)

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';
import { createHash } from 'node:crypto';

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
