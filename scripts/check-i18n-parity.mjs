#!/usr/bin/env node
// Fails when en.json and es.json disagree on which keys exist.
//
// WHY THIS IS A SCRIPT AND NOT A CONVENTION:
// i18n here is hand-rolled — `t()` reads a nested JSON object per locale, and a
// key that exists in one file and not the other does not throw. It renders the
// raw key path to the user, or falls through to undefined. Both look like a
// content bug, not a code bug, so they reach TestFlight.
//
// Every audit and release pass in this repo has re-counted these keys BY HAND
// ("2,134 each, nothing removed"). This is that count, automated, plus the two
// things a count alone cannot catch: which keys drifted, and a path that is an
// object on one side and a string on the other.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'apps/mobile/src/i18n');
const LOCALES = ['en', 'es'];

/** Flatten to dotted paths. Records the leaf TYPE so we can catch shape drift. */
function flatten(node, prefix = '', out = new Map()) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flatten(value, path, out);
    } else {
      out.set(path, Array.isArray(value) ? 'array' : typeof value);
    }
  }
  return out;
}

function load(locale) {
  const file = join(DIR, `${locale}.json`);
  try {
    return flatten(JSON.parse(readFileSync(file, 'utf8')));
  } catch (err) {
    console.error(`✗ ${locale}.json could not be read or parsed: ${err.message}`);
    process.exit(1);
  }
}

const maps = Object.fromEntries(LOCALES.map((l) => [l, load(l)]));
const [base, ...others] = LOCALES;

let failed = false;

function report(label, items) {
  if (items.length === 0) return;
  failed = true;
  console.error(`\n✗ ${label} (${items.length})`);
  for (const line of items.slice(0, 40)) console.error(`    ${line}`);
  if (items.length > 40) console.error(`    … and ${items.length - 40} more`);
}

for (const other of others) {
  const a = maps[base];
  const b = maps[other];

  report(
    `present in ${base}.json but missing from ${other}.json`,
    [...a.keys()].filter((k) => !b.has(k)).sort(),
  );
  report(
    `present in ${other}.json but missing from ${base}.json`,
    [...b.keys()].filter((k) => !a.has(k)).sort(),
  );
  report(
    `shape differs between ${base}.json and ${other}.json`,
    [...a.keys()]
      .filter((k) => b.has(k) && a.get(k) !== b.get(k))
      .map((k) => `${k}  (${base}: ${a.get(k)}, ${other}: ${b.get(k)})`)
      .sort(),
  );
}

// An empty string renders as blank UI — almost always an unfinished translation
// rather than an intentional value. Surfaced as a warning, not a failure, so it
// cannot block a release over a deliberately blank label.
for (const locale of LOCALES) {
  const blanks = [];
  const raw = JSON.parse(readFileSync(join(DIR, `${locale}.json`), 'utf8'));
  for (const [path, type] of maps[locale]) {
    if (type !== 'string') continue;
    const value = path.split('.').reduce((o, k) => (o == null ? o : o[k]), raw);
    if (typeof value === 'string' && value.trim() === '') blanks.push(path);
  }
  if (blanks.length) {
    console.warn(`\n⚠ ${locale}.json has ${blanks.length} empty string(s): ${blanks.slice(0, 8).join(', ')}${blanks.length > 8 ? ' …' : ''}`);
  }
}

if (failed) {
  console.error('\ni18n parity check FAILED — add the missing keys to both files.\n');
  process.exit(1);
}

console.log(`✓ i18n parity: ${maps[base].size} keys, identical across ${LOCALES.join(' / ')}`);
