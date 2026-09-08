#!/usr/bin/env node
// Guards the three migration-numbering mistakes that have actually cost this
// project time. All three are silent — the CLI reports success either way.
//
//  1. A NON-NUMERIC PREFIX (`001b_…`). The Supabase CLI skips such files
//     without a word, so the migration never runs and nothing says so.
//     Recorded in CLAUDE.md as "numeric-prefix-only".
//
//  2. A DUPLICATE NUMBER. Two files claiming the same version means one of
//     them is not tracked as applied; which one is undefined.
//
//  3. A GAP IN THE SEQUENCE. This is the expensive one. A number missing
//     locally usually means the migration EXISTS AND IS APPLIED ON PRODUCTION
//     but its file lives on an unmerged branch — the exact shape of the 132
//     incident, which blocked `supabase db push` for every session until the
//     file was restored. `db push` refuses to run when a remote version has no
//     local file, so a gap is a broken deploy waiting to happen.
//
//     The fix is always to restore the file from the branch that has it:
//         git show <branch>:supabase/migrations/<file> > supabase/migrations/<file>
//     and never `supabase migration repair --status reverted`, which lies to
//     the ledger about a migration that really is applied.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(ROOT, 'supabase/migrations');
const NAME = /^(\d+)_[a-z0-9_]+\.sql$/;

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

if (files.length === 0) {
  console.error('✗ no migrations found — is the path right?');
  process.exit(1);
}

let failed = false;
const fail = (msg, lines = []) => {
  failed = true;
  console.error(`\n✗ ${msg}`);
  for (const l of lines) console.error(`    ${l}`);
};

// 1 — filename shape
const malformed = files.filter((f) => !NAME.test(f));
if (malformed.length) {
  fail(
    'migration filenames the CLI will SKIP SILENTLY (need <digits>_snake_case.sql)',
    malformed,
  );
}

const numbered = files
  .filter((f) => NAME.test(f))
  .map((f) => ({ file: f, n: Number(f.match(NAME)[1]) }));

// 2 — duplicate versions
const seen = new Map();
for (const { file, n } of numbered) {
  if (!seen.has(n)) seen.set(n, []);
  seen.get(n).push(file);
}
const dupes = [...seen.entries()].filter(([, fs]) => fs.length > 1);
if (dupes.length) {
  fail(
    'duplicate migration numbers — only one of each pair is tracked as applied',
    dupes.map(([n, fs]) => `${String(n).padStart(3, '0')}: ${fs.join(', ')}`),
  );
}

// 3 — gaps
const numbers = [...seen.keys()].sort((a, b) => a - b);
const first = numbers[0];
const last = numbers[numbers.length - 1];
const gaps = [];
for (let n = first; n <= last; n++) if (!seen.has(n)) gaps.push(String(n).padStart(3, '0'));

if (gaps.length) {
  fail(
    `gap(s) in the migration sequence: ${gaps.join(', ')}`,
    [
      'A missing number usually means that migration IS APPLIED ON PRODUCTION but',
      'its .sql lives on an unmerged branch. `supabase db push` refuses to run while',
      'any remote version has no local file, so this blocks every deploy.',
      '',
      'Find it and restore the file — do not renumber, and do not run',
      '`supabase migration repair --status reverted`:',
      '    git log --all --diff-filter=A --name-only -- "supabase/migrations/*"',
      '    git show <branch>:supabase/migrations/<file> > supabase/migrations/<file>',
    ],
  );
}

if (failed) {
  console.error('');
  process.exit(1);
}

console.log(
  `✓ migrations: ${numbered.length} files, ${String(first).padStart(3, '0')}–${String(last).padStart(3, '0')}, no gaps or duplicates`,
);
console.log(`  next free number: ${String(last + 1).padStart(3, '0')}`);
