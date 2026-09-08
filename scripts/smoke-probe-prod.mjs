#!/usr/bin/env node
// Production smoke probe — test coverage plan, tier 3.
//
// Presents the PUBLIC key that ships inside every copy of the mobile app to
// every server-only endpoint, and requires each one to refuse it.
//
// WHY THIS TESTS PRODUCTION AND NOT A LOCAL DATABASE:
// This is the one failure class no unit test can catch by definition. Twice now
// a fix has been correct on the main branch and absent from the running system:
// the calendly-webhook fix sat merged and unshipped for five weeks while
// production served the vulnerable version, and a later deploy ran from a tree
// 23 files behind main, which would have reverted shipped work. `functions
// deploy` bundles the WORKING TREE, so the source being right proves nothing
// about what is running.
//
// WHY THE ANON KEY SPECIFICALLY:
// The load-bearing insight of the 2026-09-04 audit is that the platform's
// gateway JWT check is not authentication — the anon publishable key is itself
// a validly signed project JWT, and it ships in the app bundle and on the
// marketing site. So every "server-only" endpoint without its own in-code gate
// is internet-public regardless of gateway configuration. A probe using a
// garbage token would be rejected by the gateway and would prove nothing; only
// the real key exercises the real gate.
//
// EXIT CODES
//   0  every gated endpoint refused the key
//   1  SECURITY: at least one endpoint did not refuse it
//   2  CANNOT VERIFY: the project is unreachable, or the key is not valid, so
//      a green result would be meaningless. Deliberately distinct from 1 —
//      "everything returned 401 because the project is down" must never read
//      as "everything is locked down".

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FNS = join(ROOT, 'supabase/functions');

const URL_BASE = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY || '';
const CONCURRENCY = 6;
const TIMEOUT_MS = 20000;

if (!URL_BASE || !ANON) {
  console.error('✗ SUPABASE_URL and SUPABASE_ANON_KEY must both be set.');
  process.exit(2);
}

const headers = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

async function req(url, { method = 'GET', key = ANON, body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: headers(key),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    let text = '';
    try { text = (await res.text()).slice(0, 160); } catch { /* body optional */ }
    return { status: res.status, text };
  } catch (err) {
    return { status: 0, text: err.name === 'AbortError' ? 'timeout' : String(err.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

// ── controls ───────────────────────────────────────────────────────────────
// `rooms` is public-read by design (migration 007), so it is the cheapest proof
// that the project is up AND the key is accepted. Both controls must behave, or
// the probe refuses to report on anything else.
const LIVENESS = `${URL_BASE}/rest/v1/rooms?select=id&limit=1`;

async function controls() {
  const bogus = await req(LIVENESS, { key: 'not-a-real-key' });
  if (bogus.status !== 401) {
    console.error(`✗ CONTROL FAILED: a bogus key returned ${bogus.status}, expected 401.`);
    console.error('  The probe cannot distinguish accepted from rejected. Refusing to report.');
    return 2;
  }

  const real = await req(LIVENESS);
  if (real.status !== 200) {
    console.error(`✗ CANNOT VERIFY: the public key returned ${real.status} on a public table, expected 200.`);
    console.error('  Either the project is unreachable or the key has changed. If every endpoint');
    console.error('  below also returned 401, that would mean nothing — so this run is inconclusive,');
    console.error('  NOT a pass.');
    return 2;
  }

  console.log('✓ controls: bogus key rejected (401), public key accepted (200)\n');
  return 0;
}

// ── the endpoint list, derived from the repo ───────────────────────────────
// Derived rather than hard-coded so a NEW gated function is probed the day it
// lands. A checked-in list would silently stop covering new work — the same
// shape of rot as a path filter that skips itself.
function gatedFunctions() {
  return readdirSync(FNS, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .filter((name) => {
      const entry = join(FNS, name, 'index.ts');
      if (!existsSync(entry)) return false;
      const src = readFileSync(entry, 'utf8');
      return src.includes('_shared/service-role') || src.includes('_shared/user-auth');
    })
    .sort();
}

async function pool(items, worker, size) {
  const out = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) out.push(await worker(items[i++]));
    }),
  );
  return out;
}

// ── run ────────────────────────────────────────────────────────────────────
const controlCode = await controls();
if (controlCode !== 0) process.exit(controlCode);

const fns = gatedFunctions();
console.log(`Probing ${fns.length} gated endpoints with the app's public key…\n`);

// A UUID-shaped value for synthesised probe bodies. Deliberately an id that
// cannot exist, so a second-pass probe can never act on real data.
const NULL_UUID = '00000000-0000-4000-8000-000000000000';
const GATEWAY_404 = 'Requested function was not found';

// Some functions validate their body BEFORE authorising, so `{}` earns a 400
// that says nothing about the gate. Rather than hard-code a body per function —
// which rots the moment a field is renamed — the second pass reads the field
// names out of the function's OWN error message and fills them with an id that
// cannot exist.
function synthesiseBody(text) {
  const fields = [...text.matchAll(/([a-z][a-z0-9_]{1,40})\s+required/gi)].map((m) => m[1]);
  if (fields.length === 0) return null;
  return Object.fromEntries(fields.map((f) => [f, NULL_UUID]));
}

function classify({ status, text }) {
  if (status === 401 || status === 403) return 'refused';
  if (status === 0) return 'unreachable';
  if (status === 404) {
    return text.includes(GATEWAY_404) ? 'not-deployed' : 'refused-after-lookup';
  }
  return 'OPEN';
}

const results = await pool(
  fns,
  async (name) => {
    const url = `${URL_BASE}/functions/v1/${name}`;
    let r = await req(url, { method: 'POST', body: {} });
    let verdict = classify(r);
    let secondPass = false;

    if (verdict === 'OPEN' && r.status === 400) {
      const body = synthesiseBody(r.text);
      if (body) {
        secondPass = true;
        r = await req(url, { method: 'POST', body });
        verdict = classify(r);
      }
    }
    return { name, ...r, verdict, secondPass };
  },
  CONCURRENCY,
);

results.sort((a, b) => a.name.localeCompare(b.name));

const open        = results.filter((r) => r.verdict === 'OPEN');
const missing     = results.filter((r) => r.verdict === 'not-deployed');
const unreachable = results.filter((r) => r.verdict === 'unreachable');
const afterLookup = results.filter((r) => r.verdict === 'refused-after-lookup');
const refused     = results.filter((r) => r.verdict === 'refused');

for (const r of results) {
  if (r.verdict === 'refused') continue;
  const tag = r.secondPass ? ' (2nd pass)' : '';
  console.log(`  ${r.verdict.padEnd(20)} ${String(r.status).padStart(3)}  ${r.name}${tag}  ${r.text.replace(/\s+/g, ' ').slice(0, 80)}`);
}

console.log(
  `\n  refused ${refused.length} · refused-after-lookup ${afterLookup.length} · ` +
  `not-deployed ${missing.length} · unreachable ${unreachable.length} · OPEN ${open.length}`,
);

// Refused, but only after the function had already done work with the service
// key. The gate holds, so this is not a failure — but the ordering means an
// unauthenticated caller can drive a database read, and can tell "exists" from
// "does not exist" by the status it gets back. Worth seeing, not worth blocking.
if (afterLookup.length) {
  console.log(`\n⚠ ${afterLookup.length} function(s) authorise AFTER looking up the record:`);
  for (const r of afterLookup) console.log(`    ${r.name}`);
  console.log('  The gate still refuses the caller. The ordering lets an unauthenticated');
  console.log('  request trigger a lookup, and distinguishes a real id from a fake one.');
}

if (missing.length) {
  console.log(`\n⚠ ${missing.length} function(s) exist in the repo but are not deployed. Not a security`);
  console.log('  failure, but they are invisible to every live review until deployed.');
}

if (unreachable.length) {
  console.error(`\n✗ ${unreachable.length} endpoint(s) could not be reached — treating as INCONCLUSIVE.`);
  process.exit(2);
}

if (open.length) {
  console.error(`\n✗ SECURITY: ${open.length} endpoint(s) did not refuse the public app key:`);
  for (const r of open) console.error(`    ${r.name} → ${r.status}  ${r.text.replace(/\s+/g, ' ').slice(0, 80)}`);
  console.error('\n  Each of these is reachable by anyone holding the key that ships inside the app.');
  process.exit(1);
}

console.log('\n✓ every gated endpoint refused the public app key.');
