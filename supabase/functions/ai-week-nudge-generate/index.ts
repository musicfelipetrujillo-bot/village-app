// "Baby's week" push copy generator (batch, one-time-ish).
// POST /functions/v1/ai-week-nudge-generate   (service role)
// Body: { mode?: 'missing' | 'all', weeks?: number[], locales?: ('en'|'es')[],
//         limit?: number, dry_run?: boolean }
//
// Writes `week_nudges` rows: a question-shaped push hook per (week, locale)
// grounded in the already-approved milestone_library / maternal_insights copy
// for that week (via the week_nudge_source RPC), so we never invent
// developmental claims.
//
// WHY QUESTION-SHAPED: Felipe's brief — "has your baby started solids yet?",
// "has your baby shown signs of walking yet? here are some tips!". A question
// opens a loop the app can close, which is what brings her back; a statement
// ("week 26 is here") does not.
//
// ⚠️ THE ANXIETY PROBLEM — the whole reason this prompt is so constrained.
// Milestone notifications are sent to postpartum women, many with PPA/PPD.
// "Has your baby started X yet?" lands as an accusation the moment it implies
// a deadline. Every rule below exists to keep the hook curious rather than
// evaluative, and to make the "not yet" answer feel as normal as the "yes".
// Migration 111's `week_nudges_copy_safe` CHECK re-blocks the worst phrasings
// at write time, so a prompt regression fails loudly instead of shipping.
//
// Model: Haiku 4.5 — short, high-volume, deterministic-ish (temp 0.7 for copy
// variety). Prompt-cached; ~104 calls for a full EN+ES 52-week fill.

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

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `You write push notifications for villie, a maternal-health app, in the voice of a warm friend who has been through it.

You are given one week of a baby's life and the app's already-approved educational content for that week. You return ONE push notification: a curious, open question about what the baby might be doing, plus a line that promises something useful inside the app.

## Voice
- Lowercase, texting tone. Warm, never clinical, never corporate.
- Validate first. She is tired; she is doing fine.
- One idea. A push is read in half a second on a lock screen.
- No emoji (the OS shows the app icon already).
- Title: 3-45 characters. Body: 20-150 characters.

## The question
The title (or the body's first clause) should be an open question about the baby — the kind a friend asks, not a checklist item:
  good: "rolling over yet?"  ·  "any interest in your dinner?"  ·  "sleeping any longer stretches?"
  bad:  "your baby should be rolling by now"  ·  "milestone check: week 18"

## The baby's gender is UNKNOWN — this copy is sent to every family
One row is reused for every mother at this week, so gendered language WILL be
wrong for roughly half of them.
- EN: never "he/she/him/her/his". Use "your baby", "they/them", or drop the
  subject entirely ("rolling over yet?").
- ES: never "el bebé"/"la bebé", "niño"/"niña", and no gendered adjective or
  participle agreement anywhere it refers to the BABY. "algunas bebés",
  "cuando esté lista", "está listo", "cansadito" are all WRONG. Use "tu bebé"
  / "tu peque" and restructure so no adjective has to agree — e.g. "cuando
  tenga ganas" instead of "cuando esté lista", "cuando llegue el momento"
  instead of "cuando esté preparado".
- ES: watch number agreement too — "a las 40 semanas", not "a los 40 semanas".
- The MOTHER may be addressed as "tú"/"you" — that's fine, the audience is
  mothers. Only the BABY must stay ungendered.

## HARD RULES — anxiety safety (these override everything else)
Mothers receiving these may have postpartum anxiety or depression. A milestone
notification that reads as a test causes real harm.
- NEVER imply a deadline, a norm, or a comparison. Banned in any language:
  "should", "should be", "by now", "already", "behind", "on track", "on
  schedule", "other babies", "most babies", "normal babies", "delayed".
- NEVER state or imply that not-yet-doing-X is a problem, or that doing X
  early is better.
- Frame every milestone as OPTIONAL and WIDE-RANGING: "some babies start
  around now", "any day between X and Y is typical", "whenever she's ready".
- The "no" answer must feel as good as the "yes". If a mother reads it and
  her baby is not doing the thing, she should feel calm, not measured.
- NEVER diagnose, prescribe, name a medication/supplement/brand, or promise a
  health outcome.
- NEVER use guilt or fear-of-missing-out to drive the tap ("don't miss…",
  "you haven't…", "we miss you").
- No statistics, no percentiles, no ages-in-months as thresholds.

## Language
Write in the requested locale ONLY. For "es": natural Latin-American Spanish
as a real mother would text it — not a literal translation of English idiom.

## Output
Return ONLY valid JSON, no markdown fence:
{ "title": "…", "body": "…", "hook_category": "sleep|feed|motor|social|communication|cognitive|sensory|other" }`;

interface SourceRow {
  week_number: number;
  milestone_title: string | null;
  milestone_body: string | null;
  milestone_cat: string | null;
  insight_titles: string | null;
}

// Belt-and-braces mirror of migration 111's CHECK. Catching it here means a
// bad generation is retried/skipped with a clear reason instead of surfacing
// as an opaque constraint violation.
const BANNED = /(should be|should have|should already|must be|by now|falling behind|is behind|on track|other babies|most babies|than other|normal babies|debería|deberia|atrasad|retrasad|otros bebés|otros bebes|ya tendría|ya tendria|la mayoría de los bebés)/i;

// The baby's gender is unknown at generation time (one row serves every
// family), so gendered references are a correctness bug, not a style nit.
// Word-boundary matched so "there"/"them" and Spanish "la" inside other words
// don't false-positive. "your baby"/"tu bebé" remain the intended phrasings.
const GENDERED = /\b(he|she|him|her|hers|his|himself|herself|el bebé|la bebé|los bebés|las bebés|niño|niña|nene|nena)\b/i;

function coerce(raw: string): { title: string; body: string; hook_category: string } | null {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(cleaned); } catch { return null; }
  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  const body  = typeof parsed.body  === 'string' ? parsed.body.trim()  : '';
  const cat   = typeof parsed.hook_category === 'string' ? parsed.hook_category.trim() : 'other';
  if (title.length < 3 || title.length > 48) return null;
  if (body.length < 10 || body.length > 160) return null;
  const full = `${title} ${body}`;
  if (BANNED.test(full)) return null;
  if (GENDERED.test(full)) return null;
  return { title, body, hook_category: cat };
}

async function generateOne(
  week: number,
  locale: 'en' | 'es',
  src: SourceRow | null,
): Promise<{ ok: boolean; reason?: string; row?: Record<string, unknown> }> {
  const context = src
    ? `Milestone focus: ${src.milestone_title ?? '—'} (${src.milestone_cat ?? 'general'})
What the app already tells her this week: ${(src.milestone_body ?? '').slice(0, 900)}
Other approved topics this week: ${src.insight_titles || '—'}`
    : 'No specific milestone content exists for this week — write a gentle, non-specific check-in about how the week is going.';

  const userMsg = `Week ${week} of the baby's life. Locale: ${locale}.

${context}

Write the push notification per the rules. JSON only.`;

  // Two attempts: a generation that trips the safety regex gets one retry
  // with an explicit correction before we give up on the week.
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 300,
      temperature: 0.7,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: attempt === 0
          ? userMsg
          : `${userMsg}\n\nYour previous attempt broke a hard rule: it used deadline/comparison language ("should", "by now", "on track", "most babies"), OR referred to the baby with a gender ("she"/"he"/"la bebé"/"niña" — the baby's gender is unknown), OR broke the length limits. Rewrite it as a purely curious question, with the baby referred to only as "your baby"/"tu bebé" or with no subject at all.`,
      }],
    });
    const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
    const out = coerce(text);
    if (out) {
      return {
        ok: true,
        row: {
          kind: 'week',
          week_number: week,
          locale,
          variant: 1,
          title: out.title,
          body: out.body,
          hook_category: out.hook_category,
          deeplink: `villie://home/week/${week}`,
          generator: `${MODEL}-v1`,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
      };
    }
  }
  return { ok: false, reason: 'unsafe_or_malformed_after_retry' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const body = await req.json().catch(() => ({}));
  const mode: 'missing' | 'all' = body.mode === 'all' ? 'all' : 'missing';
  const locales: ('en' | 'es')[] = Array.isArray(body.locales) && body.locales.length
    ? body.locales.filter((l: string) => l === 'en' || l === 'es')
    : ['en', 'es'];
  const limit = Number.isFinite(body.limit) ? Math.max(1, Math.min(120, body.limit)) : 20;
  const dryRun = body.dry_run === true;

  const requestedWeeks: number[] = Array.isArray(body.weeks) && body.weeks.length
    ? body.weeks.filter((w: number) => Number.isInteger(w) && w >= 1 && w <= 52)
    : Array.from({ length: 52 }, (_, i) => i + 1);

  // Which (week, locale) pairs still need copy?
  const { data: existing, error: exErr } = await supabase
    .from('week_nudges')
    .select('week_number, locale')
    .eq('kind', 'week')
    .eq('variant', 1);
  if (exErr) {
    return new Response(JSON.stringify({ error: exErr.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  const have = new Set((existing ?? []).map((r) => `${r.week_number}:${r.locale}`));

  const jobs: { week: number; locale: 'en' | 'es' }[] = [];
  for (const week of requestedWeeks) {
    for (const locale of locales) {
      if (mode === 'missing' && have.has(`${week}:${locale}`)) continue;
      jobs.push({ week, locale });
      if (jobs.length >= limit) break;
    }
    if (jobs.length >= limit) break;
  }

  if (!jobs.length) {
    return new Response(JSON.stringify({ ok: true, generated: 0, remaining: 0, note: 'nothing to do' }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Source content per week (one lookup per distinct week in this batch).
  const weeks = [...new Set(jobs.map((j) => j.week))];
  const sources = new Map<number, SourceRow | null>();
  await Promise.all(weeks.map(async (w) => {
    const { data } = await supabase.rpc('week_nudge_source', { p_week: w });
    sources.set(w, Array.isArray(data) && data.length ? (data[0] as SourceRow) : null);
  }));

  const results: Record<string, unknown>[] = [];
  const failures: { week: number; locale: string; reason: string }[] = [];

  // Sequential: keeps us well inside Anthropic rate limits and the function's
  // wall-clock budget, and a full fill is a one-time ~104-call job.
  for (const job of jobs) {
    try {
      const out = await generateOne(job.week, job.locale, sources.get(job.week) ?? null);
      if (out.ok && out.row) results.push(out.row);
      else failures.push({ week: job.week, locale: job.locale, reason: out.reason ?? 'unknown' });
    } catch (e) {
      failures.push({ week: job.week, locale: job.locale, reason: String((e as Error).message).slice(0, 120) });
    }
  }

  if (dryRun) {
    return new Response(JSON.stringify({ ok: true, dry_run: true, generated: results.length, rows: results, failures }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  let written = 0;
  if (results.length) {
    const { error: upErr } = await supabase
      .from('week_nudges')
      .upsert(results, { onConflict: 'kind,week_number,locale,variant' });
    if (upErr) {
      return new Response(JSON.stringify({ error: upErr.message, generated: results.length, failures }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    written = results.length;
  }

  const totalNeeded = 52 * locales.length;
  return new Response(JSON.stringify({
    ok: true,
    written,
    failures,
    remaining: Math.max(0, totalNeeded - (have.size + written)),
  }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
});
