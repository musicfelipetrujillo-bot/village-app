#!/usr/bin/env node
/**
 * import-week-intros.mjs — load `manual_week_intro` rows from a CSV.
 *
 * The day the videos land, this is the whole job: export a sheet, run this,
 * check readiness. No SQL by hand, no Studio clicking, no engineer required.
 *
 * Why it exists: on 2026-07-30 the paywall was advertising "every week's
 * specialist video — all 52 weeks" while the table held ZERO rows, and there
 * was no supported way to load it. Content arriving is not supposed to be the
 * moment we discover there's no ingest path.
 *
 * CSV columns (header row required):
 *   week_number,audience,locale,title,expert_name,expert_role,mux_playback_id,duration_seconds,poster_url,is_published
 *
 *   audience  mom | baby
 *   locale    en | es
 *   is_published  true|false — defaults true. Set false to stage a week early.
 *   poster_url    optional
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=… node apps/mobile/scripts/import-week-intros.mjs weeks.csv
 *   …                                                                    --dry-run
 *
 * Idempotent: upserts on (audience, week_number, locale), so re-running a
 * corrected sheet fixes rows instead of duplicating them.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL ??
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  'https://albyndcruwopulazvpjs.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const csvPath = args.find((a) => !a.startsWith('--'));

if (!csvPath) {
  console.error('usage: import-week-intros.mjs <file.csv> [--dry-run]');
  process.exit(1);
}
if (!SERVICE_KEY && !dryRun) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required (or pass --dry-run to validate only)');
  process.exit(1);
}

/** Minimal RFC-4180 parser — handles quoted fields and embedded commas. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim().length));
}

const raw = parseCsv(readFileSync(csvPath, 'utf8'));
const header = raw[0].map((h) => h.trim());
const REQUIRED = ['week_number', 'audience', 'locale', 'title', 'mux_playback_id'];
const missingCols = REQUIRED.filter((c) => !header.includes(c));
if (missingCols.length) {
  console.error(`CSV is missing required column(s): ${missingCols.join(', ')}`);
  process.exit(1);
}

const problems = [];
const rows = raw.slice(1).map((cells, idx) => {
  const line = idx + 2;
  const get = (col) => {
    const at = header.indexOf(col);
    return at === -1 ? '' : (cells[at] ?? '').trim();
  };

  const week = Number(get('week_number'));
  const audience = get('audience').toLowerCase();
  const locale = get('locale').toLowerCase();
  const title = get('title');
  const playback = get('mux_playback_id');
  const durRaw = get('duration_seconds');
  const dur = durRaw ? Number(durRaw) : null;
  const publishedRaw = get('is_published').toLowerCase();

  if (!Number.isInteger(week) || week < 1 || week > 52) problems.push(`line ${line}: week_number must be 1–52, got "${get('week_number')}"`);
  if (!['mom', 'baby'].includes(audience)) problems.push(`line ${line}: audience must be mom|baby, got "${audience}"`);
  if (!['en', 'es'].includes(locale)) problems.push(`line ${line}: locale must be en|es, got "${locale}"`);
  if (!title) problems.push(`line ${line}: title is required`);
  if (!playback) problems.push(`line ${line}: mux_playback_id is required — a row without one is invisible to the app and to the readiness check`);
  if (durRaw && (!Number.isFinite(dur) || dur <= 0)) problems.push(`line ${line}: duration_seconds must be a positive number`);

  return {
    week_number: week,
    audience,
    locale,
    title,
    expert_name: get('expert_name') || null,
    expert_role: get('expert_role') || null,
    mux_playback_id: playback,
    duration_seconds: dur,
    poster_url: get('poster_url') || null,
    is_published: publishedRaw ? publishedRaw === 'true' : true,
  };
});

// Duplicate (audience, week, locale) inside one sheet means the upsert would
// silently keep whichever landed last — almost never what was intended.
const seen = new Map();
rows.forEach((r, i) => {
  const key = `${r.audience}/${r.locale}/${r.week_number}`;
  if (seen.has(key)) problems.push(`line ${i + 2}: duplicate ${key} (also on line ${seen.get(key)})`);
  else seen.set(key, i + 2);
});

if (problems.length) {
  console.error(`\n${problems.length} problem(s) — nothing was written:\n`);
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}

const byCombo = rows.reduce((acc, r) => {
  const k = `${r.audience}/${r.locale}`;
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});
console.log(`Parsed ${rows.length} row(s) from ${csvPath}:`);
Object.entries(byCombo).sort().forEach(([k, n]) => console.log(`  ${k}: ${n} week(s)`));

if (dryRun) {
  console.log('\n--dry-run — validated only, nothing written.');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase
  .from('manual_week_intro')
  .upsert(rows, { onConflict: 'audience,week_number,locale' });

if (error) {
  console.error('\nUpsert failed:', error.message);
  process.exit(1);
}

console.log(`\nWrote ${rows.length} row(s).`);

const { data: readiness, error: rErr } = await supabase.rpc('pro_launch_readiness');
if (rErr) {
  console.log('Could not read readiness:', rErr.message);
} else {
  console.log('\nvillie pro launch readiness:');
  for (const c of readiness ?? []) {
    console.log(`  ${c.ok ? 'PASS' : 'FAIL'}  ${c.check_name.padEnd(22)} ${c.actual}/${c.target}  ${c.detail}`);
  }
  const blocking = (readiness ?? []).filter((c) => c.blocking && !c.ok);
  console.log(
    blocking.length
      ? `\n${blocking.length} blocking check(s) still failing — pro_video_gate will refuse to turn on.`
      : '\nAll blocking checks pass. pro_video_gate can be enabled.',
  );
}
