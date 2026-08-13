#!/usr/bin/env node
/**
 * Safe production OTA publisher.
 *
 * WHY THIS EXISTS
 * ---------------
 * `eas update` inlines every EXPO_PUBLIC_* var from the local .env at bundle
 * time. The developer's apps/mobile/.env is a DEV env (EXPO_PUBLIC_APP_ENV=
 * development, EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED=1, etc.). Running a raw
 * `eas update --branch production` would ship the hidden internal Agents
 * tooling + a dev app-env to every TestFlight tester.
 *
 * This wrapper makes that impossible:
 *   1. Sets EXPO_NO_DOTENV=1 so Expo does NOT load .env at all — the dev file
 *      cannot leak, period.
 *   2. Sources the bundle env SOLELY from eas.json -> build.production.env,
 *      the same env a real production `eas build` uses (single source of
 *      truth — OTA and build can never drift).
 *   3. Hard-asserts the safety invariants before publishing and aborts loudly
 *      if they're ever violated.
 *
 * USAGE
 *   pnpm ota:prod "your update message"
 *   node scripts/ota-prod.mjs "your update message"
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Refuse to publish a working tree that is missing commits from `main`.
 *
 * WHY (2026-08-13): `eas update` bundles the WORKING TREE, not `main`. On
 * 2026-08-12 the baby-profile hydration fix landed on `main` and was published;
 * about an hour later a routine OTA went out from a feature branch that had been
 * cut before that fix. The branch was 34 commits behind, so publishing it
 * silently REVERTED the fix in production, and the founder's baby profile went
 * back to "resetting" on every force-quit — a bug she had already reported
 * twice. Nothing in the pipeline noticed, because every publish looks the same
 * from the outside.
 *
 * Publishing a feature branch is fine when it is deliberate. Doing it by
 * accident, on top of a fix, is what this catches. Override with
 * `OTA_ALLOW_BEHIND_MAIN=1` when it really is intended.
 */
function assertNotBehindMain(cwd) {
  const git = (args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (git(['rev-parse', '--git-dir']).status !== 0) return;   // not a repo — nothing to check

  // Prefer origin/main when it exists; fall back to the local ref.
  const base = git(['rev-parse', '--verify', '-q', 'origin/main']).status === 0
    ? 'origin/main'
    : (git(['rev-parse', '--verify', '-q', 'main']).status === 0 ? 'main' : null);
  if (!base) return;

  const missing = git(['rev-list', '--count', 'HEAD..' + base]).stdout?.trim();
  const count = Number.parseInt(missing ?? '', 10);
  if (!Number.isFinite(count) || count === 0) return;

  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout?.trim() || 'HEAD';
  const subjects = git(['log', '--oneline', '-8', 'HEAD..' + base]).stdout?.trimEnd();

  console.error(`\n✗ Refusing to publish: "${branch}" is missing ${count} commit(s) from ${base}.`);
  console.error('  eas update bundles the WORKING TREE, so publishing now would revert');
  console.error(`  everything on ${base} that this branch does not have, including any fix`);
  console.error('  already shipped to users. Most recent missing commits:\n');
  if (subjects) console.error(subjects.split('\n').map((l) => `    ${l}`).join('\n'));
  if (count > 8) console.error(`    … and ${count - 8} more`);
  console.error(`\n  Fix:      git merge ${base}      (then re-run)`);
  console.error('  Override: OTA_ALLOW_BEHIND_MAIN=1 pnpm ota:prod "…"   (only if deliberate)\n');
  process.exit(1);
}

const mobileDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const easJsonPath = resolve(mobileDir, 'eas.json');

const message = process.argv.slice(2).join(' ').trim();
if (!message) {
  console.error('✗ Provide an update message:  pnpm ota:prod "what changed"');
  process.exit(1);
}

let prodEnv;
try {
  const easJson = JSON.parse(readFileSync(easJsonPath, 'utf8'));
  prodEnv = easJson?.build?.production?.env;
} catch (err) {
  console.error(`✗ Could not read ${easJsonPath}: ${err.message}`);
  process.exit(1);
}
if (!prodEnv || typeof prodEnv !== 'object') {
  console.error('✗ eas.json build.production.env is missing — refusing to publish.');
  process.exit(1);
}

// Safety invariants — these are the flags that, if wrong, leak dev/internal
// surfaces to real users. Abort rather than ship a bad bundle.
const appEnv = prodEnv.EXPO_PUBLIC_APP_ENV;
const internalAgents = prodEnv.EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED;
if (appEnv !== 'production') {
  console.error(`✗ EXPO_PUBLIC_APP_ENV is "${appEnv}", expected "production". Aborting.`);
  process.exit(1);
}
if (internalAgents === '1') {
  console.error('✗ EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED is "1" — would expose internal tooling. Aborting.');
  process.exit(1);
}

// Code invariant: never ship a bundle that silently rolls production back.
if (process.env.OTA_ALLOW_BEHIND_MAIN !== '1') {
  assertNotBehindMain(mobileDir);
}

// Build the child env: start clean of dotenv, layer ONLY the production
// profile's vars on top of the inherited shell (which carries PATH, auth, etc.
// but — with EXPO_NO_DOTENV=1 — none of the .env values).
const childEnv = { ...process.env, ...prodEnv, EXPO_NO_DOTENV: '1' };

const publicKeys = Object.keys(prodEnv).filter((k) => k.startsWith('EXPO_PUBLIC_')).sort();
console.log('▸ Publishing production OTA with env from eas.json (dotenv disabled):');
for (const k of publicKeys) console.log(`    ${k}=${prodEnv[k]}`);
console.log(`▸ Branch: production   Message: ${message}\n`);

const result = spawnSync(
  'npx',
  // --clear-cache: bust the Metro transform cache so EXPO_PUBLIC_* changes are
  // always re-inlined. Without it, Metro can serve a stale transform and ship
  // an OTA with old env values (silent: the bundle hash stays identical).
  ['--yes', 'eas-cli@latest', 'update', '--branch', 'production', '--clear-cache', '--non-interactive', '--message', message],
  { cwd: mobileDir, env: childEnv, stdio: 'inherit' }
);

process.exit(result.status ?? 1);
