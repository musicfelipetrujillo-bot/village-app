// trending-compliance-pass — automated brand-safety/tone/legal pass for
// The Buzz items tagged is_medical_claim=false. This is NOT a medical
// fact-check (medical-claim items always require a human, see migration
// 105's list_pending_review filter) — it checks the copy reads as
// conversational-not-directive, carries no sensational framing, and has
// no brand-safety concerns, per docs/THE_BUZZ_TRENDING.md §4/§6.
//
// POST /functions/v1/trending-compliance-pass
// Body: { mode: 'all', limit?: number } | { mode: 'item', item_id: string }
//
// Fail-soft: any AI error leaves the row 'in_review' for a human to catch
// via the normal review queue — never auto-approves on failure, and never
// silently drops a row.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `You are a brand-safety and editorial-tone reviewer for "The Buzz," a weekly non-medical trending-topics digest inside a maternal-health app. These items have already been tagged as NOT making a health/medical claim — your job is brand safety and tone only, never medical fact-checking.

## Approve (cleared=true) when the item:
- Reads as conversational commentary, not a directive or guideline
- Has no sensational, alarming, or clickbait framing
- Is genuinely about a cultural/product/parenting trend, not a disguised medical claim
- Contains nothing that could embarrass a hospital-partner brand

## Flag (cleared=false) when ANY of:
- The copy actually does make or imply a health/medical claim (it was mis-tagged)
- Sensational or fear-based framing
- Anything that reads as an ad, MLM pitch, or off-brand content
- Copy contradicts the trend/evidence sources provided

## Output JSON only:
{
  "cleared": <boolean>,
  "rationale": "<one sentence, ≤40 chars>"
}`;

interface ItemRow {
  id: string;
  title_en: string;
  summary_en: string;
  kind: string;
  trend_source_name: string;
  evidence_source_name: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function screenOne(item: ItemRow) {
  const userPrompt = JSON.stringify({
    kind: item.kind,
    title: item.title_en,
    summary: item.summary_en,
    trend_source: item.trend_source_name,
    evidence_source: item.evidence_source_name,
  });

  let cleared = false;
  let rationale = '';
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      temperature: 0.2,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userPrompt }],
    });
    const text = resp.content.map((c) => (c.type === 'text' ? c.text : '')).join('').trim();
    const stripped = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(stripped);
    cleared = parsed.cleared === true;
    rationale = typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 200) : '';
  } catch (err) {
    console.warn(`trending-compliance-pass failed ${item.id}:`, (err as Error).message);
    const { error } = await supabase
      .from('trending_items')
      .update({ status: 'in_review', review_notes: 'compliance-pass ai_unavailable' })
      .eq('id', item.id)
      .eq('status', 'draft');
    return { item_id: item.id, outcome: 'in_review', reason: 'ai_unavailable', db_error: error?.message };
  }

  const nextStatus = cleared ? 'agent_cleared' : 'in_review';
  const { error } = await supabase
    .from('trending_items')
    .update({ status: nextStatus, review_notes: rationale })
    .eq('id', item.id)
    .eq('status', 'draft');

  return { item_id: item.id, outcome: nextStatus, reason: rationale, db_error: error?.message };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const mode: 'all' | 'item' = body.mode === 'item' ? 'item' : 'all';

    let items: ItemRow[] = [];
    if (mode === 'item') {
      if (!body.item_id) return json({ error: 'item_id required' }, 400);
      const { data, error } = await supabase
        .from('trending_items')
        .select('id, title_en, summary_en, kind, trend_source_name, evidence_source_name, status, is_medical_claim')
        .eq('id', body.item_id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: 'item not found' }, 404);
      if (data.status !== 'draft' || data.is_medical_claim) {
        return json({ skipped: true, reason: `status=${data.status} is_medical_claim=${data.is_medical_claim}` });
      }
      items = [data as ItemRow];
    } else {
      const limit = Math.min(Math.max(body.limit ?? 50, 1), 200);
      const { data, error } = await supabase
        .from('trending_items')
        .select('id, title_en, summary_en, kind, trend_source_name, evidence_source_name')
        .eq('status', 'draft')
        .eq('is_medical_claim', false)
        .order('created_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      items = (data ?? []) as ItemRow[];
    }

    const results = [];
    for (const item of items) {
      results.push(await screenOne(item));
    }

    return json({ mode, processed: results.length, results });
  } catch (err) {
    console.error('trending-compliance-pass fatal:', err);
    return json({ error: (err as Error).message }, 500);
  }
});
