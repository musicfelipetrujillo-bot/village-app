// trending-ingest — service-role-only ingest endpoint for The Buzz's
// Step B (sourcing + ingest) scheduled agent. Never called by the mobile
// app. Auth is a shared secret (TRENDING_INGEST_SECRET), not a Supabase
// JWT — this function is invoked by an external Claude Code agent session,
// not a signed-in user. The DB-side allowlist trigger (migration 105) is
// the real enforcement point for source URLs regardless of what this
// function's caller believes it verified.
//
// POST /functions/v1/trending-ingest
// Header: x-village-webhook-token: <TRENDING_INGEST_SECRET>
// Body: {
//   issue_date: "YYYY-MM-DD",
//   issue_title: string,
//   issue_intro: string,
//   items: [{
//     kind: "news" | "myth_buster",
//     rank: number,
//     is_medical_claim: boolean,
//     trend_source_name: string, trend_source_url: string,
//     evidence_source_name: string, evidence_source_url: string,
//     title_en: string, title_es?: string,
//     summary_en: string, summary_es?: string,
//     myth_claim_en?: string, myth_claim_es?: string,
//     fact_en?: string, fact_es?: string,
//     ask_provider_en: string, ask_provider_es?: string,
//   }]
// }

import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-village-webhook-token',
};

const TEXT_ENCODER = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = TEXT_ENCODER.encode(a);
  const bBytes = TEXT_ENCODER.encode(b);
  const len = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    const av = i < aBytes.length ? aBytes[i] : 0;
    const bv = i < bBytes.length ? bBytes[i] : 0;
    diff |= av ^ bv;
  }
  return diff === 0;
}

function verifyToken(req: Request): boolean {
  const expected = Deno.env.get('TRENDING_INGEST_SECRET');
  if (!expected) return false;
  const provided = req.headers.get('x-village-webhook-token');
  if (!provided) return false;
  return timingSafeEqual(expected, provided);
}

interface IncomingItem {
  kind: 'news' | 'myth_buster';
  rank: number;
  is_medical_claim: boolean;
  trend_source_name: string;
  trend_source_url: string;
  evidence_source_name: string;
  evidence_source_url: string;
  title_en: string;
  title_es?: string;
  summary_en: string;
  summary_es?: string;
  myth_claim_en?: string;
  myth_claim_es?: string;
  fact_en?: string;
  fact_es?: string;
  ask_provider_en: string;
  ask_provider_es?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  if (!verifyToken(req)) {
    console.warn('[trending-ingest] rejected: bad or missing token');
    return json({ error: 'forbidden' }, 403);
  }

  let body: {
    issue_date?: string;
    issue_title?: string;
    issue_intro?: string;
    items?: IncomingItem[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  const { issue_date, issue_title, issue_intro, items } = body;
  if (!issue_date || !issue_title || !issue_intro || !Array.isArray(items) || items.length === 0) {
    return json({ error: 'issue_date, issue_title, issue_intro, items[] required' }, 400);
  }

  const { data: issue, error: issueErr } = await supabase
    .from('trending_issues')
    .upsert({ issue_date, title: issue_title, intro: issue_intro }, { onConflict: 'issue_date' })
    .select('id')
    .single();

  if (issueErr || !issue) {
    return json({ error: issueErr?.message ?? 'failed to upsert issue' }, 500);
  }

  const results: { rank: number; ok: boolean; reason?: string }[] = [];

  for (const item of items) {
    // Medical-claim items go straight to the human queue; non-medical
    // items land as 'draft' for trending-compliance-pass to clear.
    const initialStatus = item.is_medical_claim ? 'in_review' : 'draft';

    const { error } = await supabase.from('trending_items').insert({
      issue_id: issue.id,
      kind: item.kind,
      rank: item.rank,
      status: initialStatus,
      is_medical_claim: item.is_medical_claim,
      trend_source_name: item.trend_source_name,
      trend_source_url: item.trend_source_url,
      evidence_source_name: item.evidence_source_name,
      evidence_source_url: item.evidence_source_url,
      title_en: item.title_en,
      title_es: item.title_es ?? null,
      summary_en: item.summary_en,
      summary_es: item.summary_es ?? null,
      myth_claim_en: item.myth_claim_en ?? null,
      myth_claim_es: item.myth_claim_es ?? null,
      fact_en: item.fact_en ?? null,
      fact_es: item.fact_es ?? null,
      ask_provider_en: item.ask_provider_en,
      ask_provider_es: item.ask_provider_es ?? null,
    });

    // A rejected insert here is almost always the allowlist trigger firing
    // (off-allowlist domain) — surface the DB error message as-is so the
    // agent's sourcing step can see exactly which URL failed.
    results.push({ rank: item.rank, ok: !error, reason: error?.message });
  }

  return json({ issue_id: issue.id, results });
});
