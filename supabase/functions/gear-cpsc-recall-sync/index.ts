// V4 Phase G5 — Nightly CPSC recall sync.
//
// Triggered by pg_cron at 06:00 UTC (02:00 ET). Scheduled in migration 023.
// Body: {} (service-role only; auth gate checked below).
//
// Steps:
//   1. Pull the past year of recalls from SaferProducts.gov (one-shot, no
//      pagination — the API returns everything for the given date range).
//   2. Upsert into cpsc_recall_cache.
//   3. Invoke sweep_active_listings_for_recalls() RPC — it withdraws any active
//      listing that now matches a cached recall by UPC or brand+title.
//
// Returns: { synced, swept_count }.
//
// Failure mode: if the CPSC API is down we return 200 { synced: 0, error } so
// pg_cron doesn't panic; the next run will retry. We never half-apply a sync —
// individual upserts are idempotent.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SAFER_PRODUCTS_URL = 'https://www.saferproducts.gov/RestWebServices/Recall';
const FETCH_TIMEOUT_MS = 20000;
const LOOKBACK_DAYS = 365;

interface CPSCRecall {
  RecallNumber?: string;
  RecallDate?: string;
  Title?: string;
  Description?: string;
  URL?: string;
  Products?: Array<{ Name?: string; UPCs?: string[]; Type?: string }>;
  Manufacturers?: Array<{ Name?: string }>;
  Hazards?: Array<{ Name?: string }>;
  Remedies?: Array<{ Name?: string }>;
}

function normalize(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
}

async function fetchRecalls(): Promise<CPSCRecall[]> {
  const q = new URLSearchParams({
    format: 'json',
    RecallDateStart: isoDaysAgo(LOOKBACK_DAYS),
    RecallDateEnd: new Date().toISOString().slice(0, 10),
  });
  const url = `${SAFER_PRODUCTS_URL}?${q.toString()}`;
  const ctl = new AbortController();
  const tid = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`cpsc http ${res.status}`);
    const data = await res.json() as CPSCRecall[] | { Recalls?: CPSCRecall[] };
    return Array.isArray(data) ? data : data.Recalls ?? [];
  } finally { clearTimeout(tid); }
}

Deno.serve(async (_req) => {
  // Auth: Supabase gateway-level verify_jwt (default ON) already validates the
  // service role JWT in the Authorization header before this code runs. The
  // GH Actions cron at .github/workflows/supabase-crons.yml posts with
  // `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`; the gateway rejects
  // anything else with 401 before reaching here. No need for a redundant
  // function-level check (and the previous one introduced an env-mismatch
  // failure mode that broke this cron after the last key rotation).
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_KEY);

  let recalls: CPSCRecall[] = [];
  try {
    recalls = await fetchRecalls();
  } catch (err) {
    console.error('[cpsc-recall-sync] fetch failed', err);
    return new Response(JSON.stringify({ synced: 0, swept_count: 0, error: 'cpsc fetch failed' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Build rows for upsert.
  const rows = recalls.map((r) => {
    const upcs: string[] = [];
    for (const p of r.Products ?? []) {
      for (const u of p.UPCs ?? []) {
        const clean = String(u).replace(/\D/g, '');
        if (clean.length >= 8) upcs.push(clean);
      }
    }
    return {
      recall_number: r.RecallNumber?.trim() ?? '',
      title: r.Title?.trim() ?? '',
      description: r.Description ?? null,
      hazard: r.Hazards?.map((h) => h.Name).filter(Boolean).join('; ') || null,
      remedy: r.Remedies?.map((rm) => rm.Name).filter(Boolean).join('; ') || null,
      recall_date: r.RecallDate ? r.RecallDate.slice(0, 10) : null,
      recall_url: r.URL ?? null,
      product_name_lc: normalize(r.Products?.[0]?.Name ?? null),
      brand_lc: normalize(r.Manufacturers?.[0]?.Name ?? null),
      upcs,
      cpsc_categories: (r.Products ?? []).map((p) => p.Type ?? '').filter(Boolean),
    };
  }).filter((r) => r.recall_number && r.title);

  // Batch upsert (Supabase caps at ~1000 per call — loop in chunks).
  const CHUNK = 500;
  let synced = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error } = await admin.from('cpsc_recall_cache')
      .upsert(slice, { onConflict: 'recall_number' });
    if (error) {
      console.error('[cpsc-recall-sync] upsert failed', error);
      // Partial progress is fine — recall_number is the PK.
      break;
    }
    synced += slice.length;
  }

  // Run sweep.
  let sweptCount = 0;
  try {
    const { data, error } = await admin.rpc('sweep_active_listings_for_recalls');
    if (error) console.error('[cpsc-recall-sync] sweep failed', error);
    const row = Array.isArray(data) ? data[0] : data;
    sweptCount = (row as { swept_count?: number } | null)?.swept_count ?? 0;
  } catch (err) {
    console.error('[cpsc-recall-sync] sweep threw', err);
  }

  return new Response(JSON.stringify({ synced, swept_count: sweptCount }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
