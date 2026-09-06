// V1 AI Skill #4 — Summarize Reviews
// POST /functions/v1/ai-review-summary
// Body: { specialist_id }
// Returns: { summary: string }
// Also writes summary to specialists.review_summary_cache
// Model: Sonnet (batch, high quality)

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

import { isServiceRoleRequest } from '../_shared/service-role.ts';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are The Village's maternal health content assistant.
Your job is to synthesize patient reviews into a concise, warm, honest summary for expecting and postpartum moms.

Rules:
- Write exactly 2-3 sentences starting with "Moms say..."
- Highlight the top praise (what patients love most)
- Mention the top concern (any recurring criticism), stated neutrally and briefly
- Do not invent anything not in the reviews
- Tone: warm, trustworthy, peer-to-peer — like a friend sharing her experience
- Output: plain prose only — no headers, no bullets, no JSON`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // AUTH (2026-09-05): no authorization check existed, and `verify_jwt = true` is
  // not one — the anon publishable key ships in the mobile bundle and satisfies the
  // gateway. This function regenerates a specialist's cached, all-users-visible review summary, so it was a billable model endpoint open to the
  // internet (and, where it writes, a way to churn shared content on demand).
  //
  // Only caller: refresh-stale-summaries (service-role fan-out) — service role. No mobile code calls it.
  //
  // gatewayVerifiesJwt: true matches this function's verify_jwt pin in config.toml.
  if (!isServiceRoleRequest(req, { gatewayVerifiesJwt: true })) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { specialist_id } = await req.json();
    if (!specialist_id) {
      return new Response(JSON.stringify({ error: 'specialist_id required' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const [{ data: specialist }, { data: reviews }] = await Promise.all([
      supabase
        .from('specialists')
        .select('full_name, specialty, credentials')
        .eq('id', specialist_id)
        .single(),
      supabase
        .from('reviews')
        .select('rating, body, verified_patient, created_at')
        .eq('specialist_id', specialist_id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (!reviews || reviews.length === 0) {
      return new Response(JSON.stringify({ summary: null }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const reviewText = reviews
      .map((r: any) =>
        `[${r.rating}★${r.verified_patient ? ' verified' : ''}] ${r.body ?? '(rating only, no text)'}`,
      )
      .join('\n');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
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
          content: `Provider: ${specialist?.full_name} (${specialist?.credentials}, ${specialist?.specialty})

Reviews (${reviews.length} total, avg ${(reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length).toFixed(1)}★):
${reviewText}

Write the 2-3 sentence "Moms say..." summary now.`,
        },
      ],
    });

    const summary = (message.content[0] as { text: string }).text.trim();

    // Cache on specialist row
    await supabase
      .from('specialists')
      .update({
        review_summary_cache: summary,
        review_summary_cached_at: new Date().toISOString(),
      })
      .eq('id', specialist_id);

    return new Response(JSON.stringify({ summary }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
