// milk-questionnaire-coach — guides donor through each questionnaire question
// Returns { why_it_matters, acknowledgement, concern? }
// Called after each question is answered in DonorQuestionnaireScreen.

import Anthropic from 'npm:@anthropic-ai/sdk';

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a warm, knowledgeable guide helping breast milk donors complete a safety questionnaire.
For each question-answer pair, you provide:
1. "why_it_matters" — 1 sentence explaining why this question protects the baby receiving the milk
2. "acknowledgement" — 1 warm sentence acknowledging the donor's answer
3. "concern" — optional: only include if the answer raises a potential issue worth gently flagging. Keep it non-alarmist.

Return ONLY valid JSON:
{
  "why_it_matters": "<string>",
  "acknowledgement": "<string>",
  "concern": "<string | null>"
}

Tone: warm, educational, never judgmental. Donors are moms helping other moms.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response('Unauthorized', { status: 401 });

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
    let result: { why_it_matters: string; acknowledgement: string; concern: string | null };
    try {
      result = JSON.parse(raw);
    } catch {
      result = {
        why_it_matters: 'This question helps ensure the milk is safe for the baby.',
        acknowledgement: 'Thank you for sharing that.',
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
