// milk-questionnaire-coach — guides donor through each questionnaire question
// Returns { why_it_matters, concern? }
// Called after each question is answered in DonorQuestionnaireScreen.

import Anthropic from 'npm:@anthropic-ai/sdk';

import { getCallerUserId } from '../_shared/user-auth.ts';
import { consumeQuota } from '../_shared/rate-limit.ts';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a warm, knowledgeable guide helping breast milk donors complete a safety questionnaire.
For each question-answer pair, you provide:
1. "why_it_matters" — 1 short sentence explaining why THIS question protects the baby receiving the milk. Educational and specific to the question.
2. "concern" — optional: only include if the answer raises a potential issue worth gently flagging. Keep it non-alarmist. Otherwise null.

DO NOT thank, praise, or acknowledge the donor's answer. Never write "thanks for sharing", "thank you", "great", etc. — no acknowledgements of any kind. Give only the substance.

Return ONLY valid JSON:
{
  "why_it_matters": "<string>",
  "concern": "<string | null>"
}

Tone: warm, educational, never judgmental. Donors are moms helping other moms.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    // AUTH (2026-09-05): this was a PRESENCE check — any non-empty Authorization
    // header passed. Combined with `verify_jwt = true`, which the anon publishable
    // key (shipped in the mobile bundle) already satisfies, it authenticated
    // nobody: it just confirmed the gateway had let the request through. That made
    // this a free Haiku endpoint billed to Villie.
    //
    // Now validates the token against Supabase Auth and requires a real user. The
    // caller is the donor filling in her own questionnaire (api/milk.ts:482), so
    // she is always signed in. The quota below covers the remaining case: a
    // signed-in user looping the endpoint.
    const callerId = await getCallerUserId(req);
    if (!callerId) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Per-user quota (migration 135). Limit is deliberately generous (80/hr): the
    // donor questionnaire is ~12 questions and coaches EACH answer, so one honest
    // sitting is already a dozen calls and she may revise several.
    const quota = await consumeQuota(callerId, 'milk-questionnaire-coach');
    if (!quota.allowed) {
      return new Response(
        JSON.stringify({ error: 'rate_limited', retry_after_seconds: quota.retryAfterSeconds }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': String(quota.retryAfterSeconds) },
        },
      );
    }

    const { question_key, question_text, answer_value } = await req.json();
    if (!question_text || !answer_value) {
      return new Response('question_text and answer_value required', { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      temperature: 0.4,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Question: ${question_text}\nQuestion key: ${question_key ?? 'general'}\nDonor answered: ${answer_value}`,
      }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();
    let result: { why_it_matters: string; concern: string | null };
    try {
      result = JSON.parse(raw);
    } catch {
      result = {
        why_it_matters: 'This question helps ensure the milk is safe for the baby.',
        concern: null,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    console.error('milk-questionnaire-coach error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
