// V4 Phase B — AI weekly-journey content backfill (cron + on-demand).
// Fills weeks 13–104 of the Weekly Journey content set (maternal_insights +
// village_supports + week_checklists, EN + ES side tables) with Sonnet.
//
// Pattern lifted from `ai-milestone-explainer` (G7): service-role inserts,
// prompt-cached system, sequential per week to keep under rate limits.
//
// **Stricter clinical workflow** — every row written here lands as
// `review_status='pending'` + `clinical_advisor_reviewed=FALSE`. Public RLS
// only exposes 'approved' rows, so AI output is invisible to users until a
// licensed clinical advisor flips it via the review dashboard.
//
// **CTA discipline** — `village_supports.cta_target` follows the
// `<tab>:<screen>:<param>` format. The original founder seed shipped 21
// broken CTAs (migration 038 had to rewrite all of them); to prevent a
// repeat, every AI-generated CTA passes through `validateCtaTarget()` which
// allow-lists tabs, route names, and SpecialtyType params. Anything that
// doesn't match is dropped (the row keeps its body but renders text-only).
//
// **Connect tab hidden** — `community:*` deeplinks are NEVER produced (per
// `feedback_connect_tab_hidden` standing rule). The prompt forbids them and
// the validator rejects them as a defense-in-depth.
//
// Modes:
// - `missing` (default) — fills any week 13–104 that has zero
//   maternal_insights rows. Idempotent.
// - `week` — fills exactly `body.week` if missing.
// - `range` — fills weeks `body.start_week..body.end_week`.
// All modes respect `limit` (default 5) to stay inside Edge Function timeout
// budget. Sequential AI calls average ~10–15s each → 5 weeks ≈ 60–80s.

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

// ────────────────────────────────────────────────────────────────────────────
// Allow-lists (must mirror migration 036 CHECK enums + SpecialtyType union).
// Adding a new value here without also updating the DB will fail the insert.

const INSIGHT_CATEGORIES = ['recovery', 'emotional', 'sleep', 'feeding', 'relationships', 'identity'] as const;
const SUPPORT_TYPES = ['peer', 'expert', 'community', 'professional'] as const;
const CHECKLIST_CATEGORIES = ['medical', 'practical', 'emotional', 'household'] as const;

const VALID_TABS = ['home', 'milk', 'experts', 'gear', 'me'] as const; // Connect omitted on purpose
const VALID_SPECIALTIES = [
  'ob_gyn', 'midwife', 'doula', 'lactation_consultant', 'pediatrician',
  'sleep_coach', 'pelvic_floor_pt', 'perinatal_dietitian', 'ppd_therapist',
] as const;

// Routes we know are wired up + safe to deeplink into. Keep tight — anything
// off this list is a silent no-op tap (G4 lesson).
const VALID_ROUTES: Record<string, string[]> = {
  home:    ['HomeRoot', 'WeeklyJourney', 'EventsList', 'PerksList'],
  milk:    ['MilkConnectHome', 'DonorSearchList'],
  experts: ['ExpertsHome'],
  gear:    ['GearBrowse'],
  me:      ['MeRoot'],
};

// ────────────────────────────────────────────────────────────────────────────
// Prompt — bilingual single-call generator. Returns EN + ES in one shot so
// we don't double-bill on the system-prompt cache read.

const SYSTEM_PROMPT = `You are a perinatal educator writing weekly postpartum content for a maternal-health app distributed via hospital discharge. The reader is a postpartum mom 0–24 months out. Spanish copy is for clinician handoff — formal-warm, second-person familiar ("tú"), never machine-translated cadence.

## Voice & style
- Validating, non-anxious, evidence-informed. Writes as if the reader's tired and one-handed with a baby.
- Second person ("you may notice", "tú puedes notar").
- No emojis in body text. Hero emoji is a separate field.
- Spanish must read like it was written by a bilingual perinatal nurse, not translated. Use "tú" not "usted".

## Hard rules (drop the row if violated)
- NEVER diagnose, prescribe, or recommend supplements, medications, or specific products.
- NEVER quote percentile statistics ("80% of babies by week N…"). Ranges OK.
- If the topic is medical-edge (PPD, mastitis, fever, bleeding, intrusive thoughts), end with ONE sentence pointing to "your OB, midwife, or pediatrician" — never a brand or drug.
- The 'recovery', 'emotional' categories on weeks 1–8 frequently warrant requires_crisis_footer=true (PPD/PPA window). Use judgment.

## Schema (return ONLY this JSON — no prose, no code fences)
{
  "maternal_insights": [
    {
      "category": "recovery|emotional|sleep|feeding|relationships|identity",
      "title": "≤120 chars",
      "body": "≤1200 chars, 2–4 short paragraphs",
      "hero_emoji": "single emoji or null",
      "requires_crisis_footer": false,
      "es": { "title": "...", "body": "..." }
    }
    // 2–3 rows per week, ideally one per category
  ],
  "village_supports": [
    {
      "support_type": "peer|expert|community|professional",
      "title": "≤120 chars",
      "body": "≤600 chars, 1–2 paragraphs explaining who can help and when",
      "hero_emoji": "single emoji or null",
      "cta_label": "≤60 chars action verb e.g. 'Find a doula' or null",
      "cta_target": "experts:ExpertsHome:<specialty> | milk:DonorSearchList | home:EventsList | home:PerksList | null",
      "es": { "title": "...", "body": "...", "cta_label": "..." }
    }
    // 2–3 rows per week
  ],
  "week_checklists": [
    {
      "category": "medical|practical|emotional|household",
      "item_text": "≤240 chars actionable item",
      "is_essential": false,
      "es": { "item_text": "..." }
    }
    // 3–5 rows per week
  ]
}

## CTA target rules (CRITICAL — wrong CTAs are silent no-op taps)
- ONLY use these formats:
  - experts:ExpertsHome:<specialty>  where specialty ∈ ob_gyn, midwife, doula, lactation_consultant, pediatrician, sleep_coach, pelvic_floor_pt, perinatal_dietitian, ppd_therapist
  - milk:DonorSearchList   (no param)
  - home:EventsList        (no param)
  - home:PerksList         (no param)
- NEVER produce \`community:*\` (Connect tab is hidden by product decision).
- NEVER invent route or tab names. If unsure, set cta_target to null and the card renders text-only.
- cta_label must always be paired with cta_target. If one is null, the other must also be null.

## Bilingual quality
- ES title length should be similar to EN (±20%). Never exceed 120 chars.
- ES body must convey the same clinical content; small cultural adaptations are fine (e.g. mentioning consejera de lactancia for IBCLC, the term Latino moms recognize).`;

// ────────────────────────────────────────────────────────────────────────────
// Output validation

interface AiInsight {
  category: string;
  title: string;
  body: string;
  hero_emoji: string | null;
  requires_crisis_footer: boolean;
  es: { title: string; body: string };
}
interface AiSupport {
  support_type: string;
  title: string;
  body: string;
  hero_emoji: string | null;
  cta_label: string | null;
  cta_target: string | null;
  es: { title: string; body: string; cta_label: string | null };
}
interface AiChecklist {
  category: string;
  item_text: string;
  is_essential: boolean;
  es: { item_text: string };
}
interface AiPayload {
  maternal_insights: AiInsight[];
  village_supports: AiSupport[];
  week_checklists: AiChecklist[];
}

function validateCtaTarget(target: string | null): string | null {
  if (target == null) return null;
  const parts = target.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  const [tab, route, param] = parts;
  if (!VALID_TABS.includes(tab as typeof VALID_TABS[number])) return null;
  const routes = VALID_ROUTES[tab];
  if (!routes || !routes.includes(route)) return null;
  if (tab === 'experts') {
    if (!param || !VALID_SPECIALTIES.includes(param as typeof VALID_SPECIALTIES[number])) return null;
  } else if (param != null && param.length > 0) {
    // Other tabs don't take params right now — drop rather than guess.
    return null;
  }
  return target;
}

function clampLen(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…';
}

function sanitizePayload(p: AiPayload): AiPayload {
  return {
    maternal_insights: (p.maternal_insights ?? [])
      .filter((mi) => INSIGHT_CATEGORIES.includes(mi.category as typeof INSIGHT_CATEGORIES[number]))
      .filter((mi) => mi.title && mi.body && mi.es?.title && mi.es?.body)
      .map((mi) => ({
        ...mi,
        title: clampLen(mi.title, 120),
        body: clampLen(mi.body, 1200),
        requires_crisis_footer: Boolean(mi.requires_crisis_footer),
        es: {
          title: clampLen(mi.es.title, 120),
          body: clampLen(mi.es.body, 1200),
        },
      })),
    village_supports: (p.village_supports ?? [])
      .filter((vs) => SUPPORT_TYPES.includes(vs.support_type as typeof SUPPORT_TYPES[number]))
      .filter((vs) => vs.title && vs.body && vs.es?.title && vs.es?.body)
      .map((vs) => {
        const cta_target = validateCtaTarget(vs.cta_target);
        const cta_label = cta_target ? (vs.cta_label ? clampLen(vs.cta_label, 60) : null) : null;
        return {
          ...vs,
          title: clampLen(vs.title, 120),
          body: clampLen(vs.body, 600),
          cta_target,
          cta_label,
          es: {
            title: clampLen(vs.es.title, 120),
            body: clampLen(vs.es.body, 600),
            cta_label: cta_label && vs.es.cta_label ? clampLen(vs.es.cta_label, 60) : null,
          },
        };
      }),
    week_checklists: (p.week_checklists ?? [])
      .filter((wc) => CHECKLIST_CATEGORIES.includes(wc.category as typeof CHECKLIST_CATEGORIES[number]))
      .filter((wc) => wc.item_text && wc.es?.item_text)
      .map((wc) => ({
        ...wc,
        item_text: clampLen(wc.item_text, 240),
        is_essential: Boolean(wc.is_essential),
        es: { item_text: clampLen(wc.es.item_text, 240) },
      })),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// AI call + insert per week

const REVIEW_NOTES = 'AI-generated draft (Sonnet) — pending clinical advisor review';

async function fillWeek(week: number): Promise<{ week: number; ok: boolean; reason?: string; counts?: { mi: number; vs: number; wc: number } }> {
  // Skip if any of the three parent tables already has rows for this week.
  // Checking all three (not just maternal_insights) catches partial-state weeks
  // left behind by a prior failed run — re-filling those would create
  // duplicates. Operator must clean up partial-state weeks manually before
  // re-running. See `idx_maternal_insights_review_dashboard` for triage.
  const [miCount, vsCount, wcCount] = await Promise.all([
    supabase.from('maternal_insights').select('id', { count: 'exact', head: true }).eq('week_number', week),
    supabase.from('village_supports').select('id', { count: 'exact', head: true }).eq('week_number', week),
    supabase.from('week_checklists').select('id', { count: 'exact', head: true }).eq('week_number', week),
  ]);
  if (miCount.error) return { week, ok: false, reason: `precount-mi: ${miCount.error.message}` };
  if (vsCount.error) return { week, ok: false, reason: `precount-vs: ${vsCount.error.message}` };
  if (wcCount.error) return { week, ok: false, reason: `precount-wc: ${wcCount.error.message}` };
  const mi = miCount.count ?? 0;
  const vs = vsCount.count ?? 0;
  const wc = wcCount.count ?? 0;
  if (mi > 0 && vs > 0 && wc > 0) return { week, ok: false, reason: 'already-populated' };
  if (mi > 0 || vs > 0 || wc > 0) {
    // Partial state — needs human cleanup before retry to avoid dupes.
    return { week, ok: false, reason: `partial-state (mi=${mi} vs=${vs} wc=${wc}) — manual cleanup required` };
  }

  const userMsg = `Week ${week} postpartum. Generate the full content set for this week per the schema.

Tone calibration:
- Weeks 1–6: heavy recovery + emotional + sleep, identity emerging, partner/relationships strain
- Weeks 7–12: practical rhythms, returning-to-self, feeding adjustments
- Weeks 13–26: 4-month sleep regression possible, weaning starts, body changes plateau
- Weeks 27–52: solids, mobility, social comparison, identity reintegration
- Weeks 53–104: toddlerhood, weaning fully, second-baby fertility questions, partner relationship rebuild

Reply with JSON only.`;

  let aiPayload: AiPayload;
  try {
    const ai = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    });
    const raw = (ai.content[0] as { text: string }).text.trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    aiPayload = JSON.parse(cleaned) as AiPayload;
  } catch (err) {
    return { week, ok: false, reason: `ai: ${err instanceof Error ? err.message : 'unknown'}` };
  }

  const sane = sanitizePayload(aiPayload);
  if (sane.maternal_insights.length === 0 && sane.village_supports.length === 0 && sane.week_checklists.length === 0) {
    return { week, ok: false, reason: 'empty-after-sanitize' };
  }

  // Insert maternal_insights + ES siblings
  for (const mi of sane.maternal_insights) {
    const { data, error } = await supabase
      .from('maternal_insights')
      .insert({
        week_number: week,
        category: mi.category,
        title: mi.title,
        body: mi.body,
        hero_emoji: mi.hero_emoji,
        requires_crisis_footer: mi.requires_crisis_footer,
        review_status: 'pending',
        clinical_advisor_reviewed: false,
        review_notes: REVIEW_NOTES,
      })
      .select('id')
      .single();
    if (error) return { week, ok: false, reason: `mi-insert: ${error.message}` };
    const insightId = data!.id;
    const { error: i18nErr } = await supabase.from('maternal_insights_i18n').insert({
      insight_id: insightId,
      locale: 'es',
      title: mi.es.title,
      body: mi.es.body,
    });
    if (i18nErr) return { week, ok: false, reason: `mi-i18n: ${i18nErr.message}` };
  }

  // Insert village_supports + ES siblings
  for (const vs of sane.village_supports) {
    const { data, error } = await supabase
      .from('village_supports')
      .insert({
        week_number: week,
        support_type: vs.support_type,
        title: vs.title,
        body: vs.body,
        hero_emoji: vs.hero_emoji,
        cta_label: vs.cta_label,
        cta_target: vs.cta_target,
        review_status: 'pending',
        clinical_advisor_reviewed: false,
        review_notes: REVIEW_NOTES,
      })
      .select('id')
      .single();
    if (error) return { week, ok: false, reason: `vs-insert: ${error.message}` };
    const supportId = data!.id;
    const { error: i18nErr } = await supabase.from('village_supports_i18n').insert({
      support_id: supportId,
      locale: 'es',
      title: vs.es.title,
      body: vs.es.body,
      cta_label: vs.es.cta_label,
    });
    if (i18nErr) return { week, ok: false, reason: `vs-i18n: ${i18nErr.message}` };
  }

  // Insert week_checklists + ES siblings (sort_order = array index for stable ordering)
  for (let idx = 0; idx < sane.week_checklists.length; idx += 1) {
    const wc = sane.week_checklists[idx];
    const { data, error } = await supabase
      .from('week_checklists')
      .insert({
        week_number: week,
        category: wc.category,
        item_text: wc.item_text,
        is_essential: wc.is_essential,
        sort_order: idx,
        review_status: 'pending',
        clinical_advisor_reviewed: false,
        review_notes: REVIEW_NOTES,
      })
      .select('id')
      .single();
    if (error) return { week, ok: false, reason: `wc-insert: ${error.message}` };
    const checklistId = data!.id;
    const { error: i18nErr } = await supabase.from('week_checklists_i18n').insert({
      checklist_item_id: checklistId,
      locale: 'es',
      item_text: wc.es.item_text,
    });
    if (i18nErr) return { week, ok: false, reason: `wc-i18n: ${i18nErr.message}` };
  }

  return {
    week, ok: true,
    counts: {
      mi: sane.maternal_insights.length,
      vs: sane.village_supports.length,
      wc: sane.week_checklists.length,
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// HTTP handler

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  try {
    const body = await req.json().catch(() => ({}));
    const mode: 'missing' | 'week' | 'range' = body?.mode ?? 'missing';
    const limit: number = Math.max(1, Math.min(20, body?.limit ?? 5));

    let weeks: number[] = [];
    if (mode === 'week') {
      const w = Number(body?.week);
      if (!Number.isInteger(w) || w < 13 || w > 104) {
        return new Response(JSON.stringify({ error: 'week must be integer 13..104' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      weeks = [w];
    } else if (mode === 'range') {
      const s = Math.max(13, Number(body?.start_week ?? 13));
      const e = Math.min(104, Number(body?.end_week ?? 104));
      if (s > e) {
        return new Response(JSON.stringify({ error: 'start_week > end_week' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      for (let w = s; w <= e && weeks.length < limit; w += 1) weeks.push(w);
    } else {
      // 'missing' — pull weeks 13..104 that have zero maternal_insights rows.
      const { data, error } = await supabase
        .from('maternal_insights')
        .select('week_number')
        .gte('week_number', 13)
        .lte('week_number', 104);
      if (error) throw error;
      const present = new Set((data ?? []).map((r) => r.week_number as number));
      for (let w = 13; w <= 104 && weeks.length < limit; w += 1) {
        if (!present.has(w)) weeks.push(w);
      }
    }

    const results: Awaited<ReturnType<typeof fillWeek>>[] = [];
    for (const w of weeks) {
      // eslint-disable-next-line no-await-in-loop
      results.push(await fillWeek(w));
    }

    return new Response(
      JSON.stringify({
        mode,
        attempted: results.length,
        ok: results.filter((r) => r.ok).length,
        skipped: results.filter((r) => !r.ok && r.reason === 'already-populated').length,
        failed: results.filter((r) => !r.ok && r.reason !== 'already-populated'),
        succeeded_weeks: results.filter((r) => r.ok).map((r) => ({ week: r.week, counts: r.counts })),
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
