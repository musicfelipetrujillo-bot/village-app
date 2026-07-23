// import-daycares.mjs — one-shot loader for the Miami-Dade Open Data daycare
// roster (DCF-sourced) into public.daycares. Idempotent (upsert on
// source+external_id). Run: node scripts/import-daycares.mjs <path-to-csv>
//
// Reads EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from apps/mobile/.env.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
  const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1] ?? '').trim().replace(/^["']|["']$/g, '');
  return { url: get('EXPO_PUBLIC_SUPABASE_URL'), key: get('SUPABASE_SERVICE_ROLE_KEY') };
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields + embedded commas/quotes).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  const t = text.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQ) {
      if (c === '"') { if (t[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const parseDate = (s) => {
  if (!s) return null;
  const m = String(s).trim().split(/\s+/)[0].match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, mo, d, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
};
const clean = (s) => { const v = String(s ?? '').trim(); return v && v !== ' ' ? v : null; };

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) { console.error('usage: node scripts/import-daycares.mjs <csv>'); process.exit(1); }
  const { url, key } = loadEnv();
  if (!url || !key) { console.error('missing EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
  const supa = createClient(url, key, { auth: { persistSession: false } });

  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const header = rows.shift().map((h) => h.trim());
  const col = Object.fromEntries(header.map((h, i) => [h, i]));
  const at = (r, name) => r[col[name]];

  const records = [];
  let skipped = 0;
  for (const r of rows) {
    if (!r.length || r.every((c) => !c.trim())) continue;
    const name = clean(at(r, 'NAME'));
    const lat = parseFloat(at(r, 'LAT')), lng = parseFloat(at(r, 'LON'));
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < 24 || lat > 27 || lng < -81.5 || lng > -79.5) { skipped++; continue; }
    const cap = parseInt(at(r, 'CAPACITY'), 10);
    records.push({
      source: 'mdc_dcf',
      external_id: clean(at(r, 'DACRID')),
      name,
      address: clean(at(r, 'ADDRESS')),
      unit: clean(at(r, 'UNIT')),
      city: clean(at(r, 'CITY')),
      zip: clean(at(r, 'ZIPCODE')),
      phone: clean(at(r, 'PHONE')),
      license_number: clean(at(r, 'LICNUM')),
      license_issued: parseDate(at(r, 'LICDATE')),
      license_expires: parseDate(at(r, 'LICEXP')),
      capacity: Number.isFinite(cap) ? cap : null,
      lat, lng,
      region: 'miami_dade',
    });
  }
  // De-dupe on external_id (upsert conflict target can't have dupes in one batch).
  const seen = new Set();
  const deduped = records.filter((r) => {
    const k = r.external_id ?? `${r.name}|${r.lat}|${r.lng}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  }).map((r) => ({ ...r, external_id: r.external_id ?? `${r.name}|${r.lat.toFixed(5)}|${r.lng.toFixed(5)}` }));

  console.log(`parsed ${records.length} valid rows (skipped ${skipped}); ${deduped.length} after de-dupe. upserting…`);
  let done = 0;
  for (let i = 0; i < deduped.length; i += 500) {
    const chunk = deduped.slice(i, i + 500);
    const { error } = await supa.from('daycares').upsert(chunk, { onConflict: 'source,external_id' });
    if (error) { console.error('upsert error:', error.message); process.exit(1); }
    done += chunk.length;
    console.log(`  ${done}/${deduped.length}`);
  }
  const { count } = await supa.from('daycares').select('*', { count: 'exact', head: true });
  console.log(`✅ done. daycares table now has ${count} rows.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
