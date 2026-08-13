#!/usr/bin/env node
// Month-long baby-log seed harness.
//
// DRY RUN BY DEFAULT. Prints the month it would write and inserts nothing.
// Writing requires --commit. Every inserted row id is appended to the undo file
// as each batch lands, so a crash mid-run still leaves a usable undo.
//
//   node scripts/seed-baby-logs.mjs --email you@example.com
//   node scripts/seed-baby-logs.mjs --email you@example.com --commit
//   node scripts/seed-baby-logs.mjs --unseed
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const COMMIT = flag('commit');
const UNSEED = flag('unseed');
const DAYS = Number(value('days', '30'));
const EMAIL = value('email', null);
const OUT = value('out', 'scratchpad/seeded-log-ids.json');

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const db = createClient(URL, KEY, { auth: { persistSession: false } });

const TABLES = {
  sleep: 'baby_sleep_logs',
  feed: 'baby_feed_logs',
  diaper: 'baby_diaper_logs',
  note: 'baby_log_notes',
};

// Mirrors wakeWindowMinutes() in apps/mobile/src/utils/sleepAlarm.ts. Kept in
// sync by hand — this is seed data, not production logic.
const wakeWindow = (week) =>
  week <= 1 ? 60 : week <= 6 ? 75 : week <= 12 ? 90 : week <= 25 ? 120 : 150;

// Deterministic PRNG so a dry run and the committing run produce the same month.
let seed = 20260813;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const jitter = (base, pct) => base * (1 + (rand() - 0.5) * 2 * pct);
const pick = (xs) => xs[Math.floor(rand() * xs.length)];

async function resolveTargets() {
  const { data: users, error: uErr } = await db
    .from('users').select('id, email').eq('email', EMAIL).limit(1);
  if (uErr) throw new Error(`user lookup failed: ${uErr.message}`);
  if (!users?.length) throw new Error(`no user with email ${EMAIL}`);
  const userId = users[0].id;

  const { data: babies, error: bErr } = await db
    .from('baby_profiles_with_week').select('id, baby_name, current_week_number')
    .eq('user_id', userId).limit(1);
  if (bErr) throw new Error(`baby lookup failed: ${bErr.message}`);
  if (!babies?.length) throw new Error(`user ${EMAIL} has no baby profile — create one in the app first`);
  return { userId, baby: babies[0] };
}

/** Build the month in memory. Returns { rows: {kind, payload}[], cases: string[] }. */
function generate(userId, babyProfileId, startWeek) {
  const rows = [];
  const cases = [];
  const push = (kind, payload) => rows.push({ kind, payload: { user_id: userId, baby_profile_id: babyProfileId, ...payload } });

  const midnightToday = new Date();
  midnightToday.setHours(0, 0, 0, 0);
  const EMPTY_DAY_OFFSET = 11;  // failure case 7

  for (let d = DAYS; d >= 1; d--) {
    if (d === EMPTY_DAY_OFFSET) continue;

    const dayStart = new Date(midnightToday.getTime() - d * 86400000);
    const week = startWeek + Math.floor((DAYS - d) / 7);
    const ww = wakeWindow(week);
    const at = (h, m = 0) => new Date(dayStart.getTime() + h * 3600000 + m * 60000).toISOString();

    // Naps: consolidate as the baby ages — more, shorter early; fewer, longer later.
    const napCount = week <= 6 ? 5 : week <= 12 ? 4 : 3;
    const napLen = week <= 6 ? 45 : week <= 12 ? 70 : 95;
    let clock = 7 * 60 + Math.floor(jitter(20, 0.8));
    for (let n = 0; n < napCount; n++) {
      const len = Math.max(20, Math.round(jitter(napLen, 0.35)));
      const s = new Date(dayStart.getTime() + clock * 60000);
      push('sleep', {
        started_at: s.toISOString(),
        ended_at: new Date(s.getTime() + len * 60000).toISOString(),
        source: 'manual',
      });
      clock += len + Math.round(jitter(ww, 0.25));
    }
    // Overnight sleep, tapering wake-ups as the month goes on.
    const nightWakes = week <= 6 ? 2 : week <= 12 ? 1 : 0;
    let nightClock = 20 * 60 + Math.floor(jitter(30, 0.6));
    for (let n = 0; n <= nightWakes; n++) {
      const len = Math.round(jitter(nightWakes ? 180 : 400, 0.2));
      const s = new Date(dayStart.getTime() + nightClock * 60000);
      push('sleep', {
        started_at: s.toISOString(),
        ended_at: new Date(s.getTime() + len * 60000).toISOString(),
        source: 'manual',
      });
      nightClock += len + Math.round(jitter(30, 0.5));
    }

    // Feeds thin out as solids come in. A newborn cluster-feeds around the
    // clock; by ~6 months the night feeds drop; by ~10 months milk feeds are
    // bracketing meals we don't track here.
    const feedHours = week <= 12
      ? [7, 10, 13, 16, 18, 19, 20, 23, 3]      // newborn: cluster + night feeds
      : week <= 25
        ? [7, 10, 13, 16, 19, 22, 3]            // one night feed left
        : [7, 11, 15, 19, 21];                  // milk around meals, sleeps through
    for (const h of feedHours) {
      const bottle = rand() < 0.3;
      const s = at(h, Math.floor(rand() * 40));
      const len = Math.round(jitter(bottle ? 12 : 18, 0.4));
      push('feed', {
        method: bottle ? 'bottle' : 'breast',
        side: bottle ? null : pick(['left', 'right']),
        started_at: s,
        ended_at: new Date(Date.parse(s) + len * 60000).toISOString(),
        amount_oz: bottle ? Math.round(jitter(3.5, 0.4) * 2) / 2 : null,
        source: 'manual',
      });
    }

    // 6-10 diapers.
    const diaperCount = 6 + Math.floor(rand() * 5);
    for (let i = 0; i < diaperCount; i++) {
      push('diaper', {
        kind: pick(['wet', 'wet', 'wet', 'dirty', 'both']),
        occurred_at: at(6 + Math.floor(rand() * 17), Math.floor(rand() * 60)),
        source: 'manual',
      });
    }

    // An occasional jot.
    if (rand() < 0.25) {
      push('note', {
        raw_text: pick([
          'fussy all afternoon, maybe a growth spurt',
          'slept through the 3am feed for once',
          'so many smiles today',
          'spit up more than usual after the 4pm bottle',
        ]),
        occurred_at: at(21, Math.floor(rand() * 50)),
      });
    }
  }

  // ── Deliberate failure cases — the point of the exercise ────────────────
  const now = Date.now();

  cases.push('1. sleep session left open 26h ago (above the 12h ceiling — escalated rescue prompt)');
  push('sleep', { started_at: new Date(now - 26 * 3600000).toISOString(), ended_at: null, source: 'manual' });

  cases.push('2. a 5h nap that was closed but is implausibly long (below the ceiling — always-available "ended at…")');
  push('sleep', {
    started_at: new Date(now - 30 * 3600000).toISOString(),
    ended_at: new Date(now - 25 * 3600000).toISOString(), source: 'manual',
  });

  cases.push('3. duplicate feed logged twice within a minute');
  const dupStart = new Date(now - 5 * 3600000).toISOString();
  for (let i = 0; i < 2; i++) {
    push('feed', {
      method: 'breast', side: 'left', started_at: dupStart,
      ended_at: new Date(Date.parse(dupStart) + 15 * 60000).toISOString(),
      amount_oz: null, source: 'manual',
    });
  }

  cases.push('4. breast feed recorded on the wrong side');
  push('feed', {
    method: 'breast', side: 'right',
    started_at: new Date(now - 9 * 3600000).toISOString(),
    ended_at: new Date(now - 9 * 3600000 + 20 * 60000).toISOString(),
    amount_oz: null, source: 'manual',
  });

  cases.push('5. note whose parsed rows landed on the wrong half of the day (mis-heard "3")');
  push('note', { raw_text: 'fed her at 3 and she went down after', occurred_at: new Date(now - 12 * 3600000).toISOString() });
  push('feed', {
    method: 'breast', side: 'left',
    started_at: new Date(now - 12 * 3600000).toISOString(),
    ended_at: new Date(now - 12 * 3600000 + 18 * 60000).toISOString(),
    amount_oz: null, source: 'note',
  });

  cases.push('6. bottle with a nonsense ounce value');
  push('feed', {
    method: 'bottle', side: null,
    started_at: new Date(now - 7 * 3600000).toISOString(),
    ended_at: new Date(now - 7 * 3600000 + 10 * 60000).toISOString(),
    amount_oz: 11.5, source: 'manual',
  });

  cases.push(`7. a day with no logs at all (${EMPTY_DAY_OFFSET} days ago)`);

  return { rows, cases };
}

function report(rows, cases, baby) {
  const counts = rows.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {});
  console.log(`\nBaby: ${baby.baby_name ?? '(unnamed)'} · currently week ${baby.current_week_number}`);
  console.log(`Window: ${DAYS} days ending yesterday\n`);
  console.log('Rows that would be written:');
  for (const [kind, n] of Object.entries(counts)) console.log(`  ${kind.padEnd(7)} ${n}`);
  console.log(`  ${'TOTAL'.padEnd(7)} ${rows.length}\n`);

  const sampleDay = rows
    .filter((r) => r.payload.started_at?.startsWith(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10))
      || r.payload.occurred_at?.startsWith(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)))
    .slice(0, 12);
  console.log('Sample day (3 days ago, first 12 entries):');
  for (const r of sampleDay) {
    const ts = r.payload.started_at ?? r.payload.occurred_at;
    console.log(`  ${ts}  ${r.kind}`);
  }

  console.log('\nDeliberate failure cases:');
  for (const c of cases) console.log(`  ${c}`);
}

function appendIds(kind, ids) {
  mkdirSync(dirname(OUT), { recursive: true });
  const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
  existing[kind] = [...(existing[kind] ?? []), ...ids];
  writeFileSync(OUT, JSON.stringify(existing, null, 2));
}

async function commit(rows) {
  const byKind = rows.reduce((acc, r) => {
    (acc[r.kind] ??= []).push(r.payload);
    return acc;
  }, {});
  for (const [kind, payloads] of Object.entries(byKind)) {
    for (let i = 0; i < payloads.length; i += 200) {
      const batch = payloads.slice(i, i + 200);
      const { data, error } = await db.from(TABLES[kind]).insert(batch).select('id');
      if (error) {
        console.error(`\nINSERT FAILED on ${kind}: ${error.message}`);
        console.error(`Rows written so far are recorded in ${OUT} — run --unseed to remove them.`);
        process.exit(1);
      }
      // Record ids BEFORE moving on, so a crash still leaves a usable undo.
      appendIds(kind, data.map((r) => r.id));
      process.stdout.write(`  ${kind}: ${Math.min(i + 200, payloads.length)}/${payloads.length}\r`);
    }
    console.log(`  ${kind}: ${payloads.length}/${payloads.length} written`);
  }
}

async function unseed() {
  if (!existsSync(OUT)) { console.error(`No undo file at ${OUT}.`); process.exit(1); }
  const ids = JSON.parse(readFileSync(OUT, 'utf8'));
  for (const [kind, list] of Object.entries(ids)) {
    if (!list.length) continue;
    for (let i = 0; i < list.length; i += 200) {
      const { error } = await db.from(TABLES[kind]).delete().in('id', list.slice(i, i + 200));
      if (error) { console.error(`delete failed on ${kind}: ${error.message}`); process.exit(1); }
    }
    console.log(`  ${kind}: ${list.length} deleted`);
  }
  writeFileSync(OUT, JSON.stringify({}, null, 2));
  console.log('\nUnseeded. Undo file cleared.');
}

async function main() {
  if (UNSEED) return unseed();
  if (!EMAIL) { console.error('Pass --email <address>.'); process.exit(1); }

  const { userId, baby } = await resolveTargets();
  const startWeek = Math.max(1, (baby.current_week_number ?? 4) - Math.floor(DAYS / 7));
  const { rows, cases } = generate(userId, baby.id, startWeek);
  report(rows, cases, baby);

  if (!COMMIT) {
    console.log('\nDRY RUN — nothing was written. Re-run with --commit to insert.\n');
    return;
  }
  if (existsSync(OUT) && Object.keys(JSON.parse(readFileSync(OUT, 'utf8'))).length) {
    console.error(`\n${OUT} still holds ids from a previous run. Run --unseed first.`);
    process.exit(1);
  }
  console.log('\nWriting…');
  await commit(rows);
  console.log(`\nDone. Undo with: node scripts/seed-baby-logs.mjs --unseed\n`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
