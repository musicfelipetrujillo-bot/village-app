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
