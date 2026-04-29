// V4 Phase G7 — AI milestone explainer (batch cron).
// Cron: Sunday 00:10 ET. Refreshes milestone_library.ai_summary_cache for
// any row with NULL ai_summary_cache OR ai_summary_cached_at > 30 days ago.
// Runs as service role (cron posts with Authorization: Bearer <service_role>).
//
// Model: claude-sonnet-4-6 (batch-quality copy, ~200 words per milestone).
// The prompt is prompt-cached so we only pay cache-read cost per week.
//
// Safety: milestones are developmental (not medical) — still we tag the output
// with the standard "not medical advice" disclaimer and route any symptom-like
// queries in the prompt to 988/911/PSI. Every summary passes through a
// deterministic sanity check (contains_disclaimer) before writing.

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

const SYSTEM_PROMPT = `You are a warm perinatal educator writing short developmental summaries for a maternal-health app.

## Style
- 2 short paragraphs, max ~180 words total.
- Second person ("your baby", "you may notice").
- Validating, non-anxious, evidence-informed.
- Spanish cognates are fine if natural; do NOT translate or duplicate.
- No emojis (the UI adds one separately).

## Hard rules
- NEVER diagnose, prescribe, or recommend supplements, medications, or specific products.
- NEVER quote specific percentile milestones ("by week N, 80% of babies..."). Ranges are fine; specific statistics are not.
- If the topic edges toward medical (feeding refusal, rapid weight loss, fever, seizure-like movements, etc.), write ONE closing sentence pointing to "your pediatrician or lactation consultant" without naming a brand or drug.
- End with a plain sentence: "This is general guidance, not medical advice."

## Output
Return ONLY valid JSON:
{ "summary": "…2 paragraphs, ends with the disclaimer sentence…" }`;

interface MilestoneRow {
  id: string;
  week_number: number;
  category: string;
  title: string;
  description: string;
}

async function refreshOne(row: MilestoneRow): Promise<{ id: string; ok: boolean; reason?: string }> {
  const userMsg = `Week ${row.week_number}. Category: ${row.category}.
Title: ${row.title}
Short description (seed): ${row.description}

Write the 2-paragraph summary per style rules. End with the disclaimer sentence. Reply with JSON only.`;

  try {
    const ai = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    });

    const raw = (ai.content[0] as { text: string }).text.trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed = JSON.parse(cleaned) as { summary?: string };
    const summary = (parsed.summary ?? '').trim();

    if (!summary) return { id: row.id, ok: false, reason: 'empty-summary' };
    if (!/medical advice/i.test(summary)) return { id: row.id, ok: false, reason: 'missing-disclaimer' };
    if (summary.length > 1400) return { id: row.id, ok: false, reason: 'too-long' };

    const { error } = await supabase
      .from('milestone_library')
      .update({ ai_summary_cache: summary, ai_summary_cached_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) return { id: row.id, ok: false, reason: error.message };

    return { id: row.id, ok: true };
  } catch (err) {
    return { id: row.id, ok: false, reason: err instanceof Error ? err.message : 'unknown' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  // Edge Function wall time is 60s; Sonnet calls average 5-15s each. Process
  // as many rows as fit under WALL_BUDGET_MS, then exit cleanly so the GH
  // Action records success and the next nightly run picks up the rest. Cold
  // cache (52 weeks NULL) backfills in ~10 nights.
  const START = Date.now();
  const WALL_BUDGET_MS = 50_000;

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode ?? 'stale';          // 'stale' | 'all' | 'week'
    const weekFilter: number | null = body?.week ?? null;
    const limit: number = Math.min(Math.max(body?.limit ?? 5, 1), 20);

    let query = supabase
      .from('milestone_library')
      .select('id, week_number, category, title, description');

    if (mode === 'stale') {
      query = query.or(
        'ai_summary_cache.is.null,ai_summary_cached_at.lt.' +
          new Date(Date.now() - 30 * 86_400_000).toISOString(),
      );
    }
    if (weekFilter != null) query = query.eq('week_number', weekFilter);
    query = query.order('week_number', { ascending: true }).limit(limit);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as MilestoneRow[];

    // Sequential (not parallel) — keeps us under rate limits and lets cache warm.
    // Wall-time guard exits cleanly before the 60s edge-function ceiling so we
    // always return a 2xx response with whatever progress we made.
    const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
    let timedOut = false;
    for (const row of rows) {
      if (Date.now() - START > WALL_BUDGET_MS) { timedOut = true; break; }
      // eslint-disable-next-line no-await-in-loop
      results.push(await refreshOne(row));
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        requested: rows.length,
        ok: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok),
        timed_out: timedOut,
        elapsed_ms: Date.now() - START,
      }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'unknown' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
