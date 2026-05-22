#!/usr/bin/env node
// specialist-invite.mjs
//
// CLI helper for issuing specialist invites (V1 Option C invite-only flow,
// migration 060). Calls the specialist-invite-create edge function with
// the service-role key.
//
// Usage:
//   pnpm specialist:invite                     # interactive (prompts)
//   pnpm specialist:invite -- --email='dr@x' --name='Dr Reyes' --specialty=midwife
//   pnpm specialist:invite -- --csv invites.csv  # batch mode (one row per invite)
//
// Required env (read from apps/mobile/.env or process env):
//   EXPO_PUBLIC_SUPABASE_URL              — Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY             — service role key (NOT the anon key)
//
// On success, prints:
//   - the full invite URL (https://villieapp.com/onboard/<token>) so the
//     admin can hand-deliver if email bounces
//   - whether the Resend email actually sent (vs. fell back to logging)
//
// Specialty allowlist mirrors the DB CHECK in migration 060:
//   ob_gyn | midwife | doula | lactation_consultant | pediatrician |
//   sleep_coach | pelvic_floor_pt | perinatal_dietitian | ppd_therapist

import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '..', '.env');

// ── Minimal .env loader so we don't add a dep ──
async function loadEnv() {
  try {
    const txt = await readFile(ENV_PATH, 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        // Strip surrounding quotes if present
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // .env optional — caller might have exported in shell
  }
}

const SPECIALTIES = new Set([
  'ob_gyn', 'midwife', 'doula', 'lactation_consultant', 'pediatrician',
  'sleep_coach', 'pelvic_floor_pt', 'perinatal_dietitian', 'ppd_therapist',
]);

// ── Arg parsing — minimal, no deps ──
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) {
        args[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        args[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      }
    }
  }
  return args;
}

async function prompt(rl, label, fallback = '') {
  const tail = fallback ? ` [${fallback}]` : '';
  const answer = (await rl.question(`${label}${tail}: `)).trim();
  return answer || fallback;
}

async function interactiveOne(rl, defaults = {}) {
  console.log('\n── New specialist invite ──');
  const email = await prompt(rl, 'Email', defaults.email);
  if (!email) {
    console.error('  · email is required, skipping');
    return null;
  }
  const fullName = await prompt(rl, 'Full name (optional)', defaults.full_name);
  const credentials = await prompt(rl, 'Credentials (e.g. "MD, IBCLC") (optional)', defaults.credentials);
  console.log('  Specialties:', [...SPECIALTIES].join(', '));
  const specialty = await prompt(rl, 'Specialty (optional, from list above)', defaults.specialty);
  if (specialty && !SPECIALTIES.has(specialty)) {
    console.error(`  · "${specialty}" not in allowlist; submitting without.`);
  }
  const npi = await prompt(rl, 'NPI number (optional)', defaults.npi_number);
  const note = await prompt(rl, 'Personal note (optional, ≤500 chars)', defaults.personal_note);
  return {
    email,
    full_name: fullName || null,
    credentials: credentials || null,
    specialty: SPECIALTIES.has(specialty) ? specialty : null,
    npi_number: npi || null,
    personal_note: note || null,
  };
}

async function send(body, { url, key }) {
  const res = await fetch(`${url}/functions/v1/specialist-invite-create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
  return { ok: res.ok, status: res.status, body: parsed };
}

async function main() {
  await loadEnv();
  const args = parseArgs(process.argv);

  const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Set them in apps/mobile/.env or your shell. SERVICE_ROLE_KEY is in the Supabase dashboard → Project Settings → API.');
    process.exit(1);
  }
  const ctx = { url: SUPABASE_URL, key: SERVICE_ROLE_KEY };

  // ── Batch mode ──
  if (args.csv) {
    const csvPath = path.resolve(process.cwd(), args.csv);
    const raw = await readFile(csvPath, 'utf8');
    const rows = raw.trim().split('\n');
    const headers = rows[0].split(',').map((s) => s.trim().toLowerCase());
    console.log(`Batch mode: ${rows.length - 1} invites from ${csvPath}`);
    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i].split(',').map((s) => s.trim());
      const body = Object.fromEntries(headers.map((h, j) => [h, cells[j] || null]));
      console.log(`\n→ ${body.email}`);
      const r = await send(body, ctx);
      if (r.ok) {
        console.log(`  ✓ ${r.body.invite_url}`);
        console.log(`    email_sent=${r.body.email_sent}`);
      } else {
        console.error(`  ✗ ${r.status}: ${r.body?.error ?? JSON.stringify(r.body)}`);
      }
    }
    return;
  }

  // ── CLI-arg one-off mode ──
  if (args.email) {
    const body = {
      email: args.email,
      full_name: args.name || args['full-name'] || null,
      credentials: args.credentials || null,
      specialty: args.specialty || null,
      npi_number: args.npi || args['npi-number'] || null,
      personal_note: args.note || args['personal-note'] || null,
    };
    if (body.specialty && !SPECIALTIES.has(body.specialty)) {
      console.error(`specialty must be one of: ${[...SPECIALTIES].join(', ')}`);
      process.exit(1);
    }
    const r = await send(body, ctx);
    if (r.ok) {
      console.log('\n✓ Invite created');
      console.log(`  URL:        ${r.body.invite_url}`);
      console.log(`  Token:      ${r.body.token}`);
      console.log(`  Email sent: ${r.body.email_sent}`);
      console.log(`  Expires:    ${r.body.expires_at}`);
    } else {
      console.error(`\n✗ ${r.status}: ${r.body?.error ?? JSON.stringify(r.body)}`);
      process.exit(1);
    }
    return;
  }

  // ── Interactive mode ──
  const rl = createInterface({ input, output });
  try {
    while (true) {
      const body = await interactiveOne(rl);
      if (!body) {
        const again = (await rl.question('Skip this one. Another? (y/N): ')).trim().toLowerCase();
        if (again !== 'y') break;
        continue;
      }
      console.log('\nSending…');
      const r = await send(body, ctx);
      if (r.ok) {
        console.log(`✓ Invite created for ${body.email}`);
        console.log(`  URL:        ${r.body.invite_url}`);
        console.log(`  Email sent: ${r.body.email_sent}`);
        console.log(`  Expires:    ${r.body.expires_at}`);
      } else {
        console.error(`✗ ${r.status}: ${r.body?.error ?? JSON.stringify(r.body)}`);
      }
      const again = (await rl.question('\nAnother invite? (y/N): ')).trim().toLowerCase();
      if (again !== 'y') break;
    }
  } finally {
    rl.close();
  }
}

main().catch((e) => {
  console.error(e?.stack ?? e);
  process.exit(1);
});
