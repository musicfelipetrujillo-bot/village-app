#!/usr/bin/env node
// Conformance check over every edge function — test coverage plan, tier 2.
//
// Four rules, each one a defect that actually reached a commit in this repo.
//
//  1. CALLS A GATE BUT DOES NOT IMPORT IT.
//     Twice during the 2026-09-04 remediation a scripted edit added a call to
//     `isServiceRoleRequest` without adding the import. Both files still passed
//     the TypeScript PARSE check, because parsing does not resolve identifiers.
//     In production each would have thrown "isServiceRoleRequest is not
//     defined" on every invocation, taking down two crons. `deno check` now
//     catches this too — this rule is the cheap, dependency-free second pair of
//     eyes that runs in seconds on every push.
//
//  2. IMPORTS A GATE AND NEVER CALLS IT.
//     A dead import reads, to a reviewer skimming the file, exactly like a
//     function that is gated. It is worse than no import at all.
//
//  3. THE REGISTRY IS EXACTLY COMPLETE.
//     Every function has a `verify_jwt` entry in config.toml, and every entry
//     has a function. `pro-entitlement-reconcile` was the ONE function missing
//     from that file, and it was also the last one still trusting an unverified
//     `service_role` claim — the two facts were not a coincidence. A missing
//     entry means nothing establishes what the gateway does for that function.
//
//  4. THE FLAG MATCHES THE CONFIG.
//     `service-role.ts` is two-mode, and the mode is chosen by the
//     `gatewayVerifiesJwt` argument at the call site. Passing `true` where
//     config says `verify_jwt = false` means the gate accepts a completely
//     UNVERIFIED `service_role` claim — the original 2026-08-14 critical, back
//     again. The helper's own docs say the flag "is checkable against that file
//     in review". This is that check, mechanised, because review missed it once
//     already.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FNS = join(ROOT, 'supabase/functions');
const CONFIG = join(ROOT, 'supabase/config.toml');

const SERVICE_SYMBOLS = ['isServiceRoleRequest', 'constantTimeEquals'];
const USER_SYMBOLS = ['getCallerUserId', 'resolveTargetUser', 'isAuthenticatedUser'];

const problems = [];
const fail = (fn, msg) => problems.push({ fn, msg });

/**
 * Remove comments before scanning. Without this, prose like
 * "`gatewayVerifiesJwt: true` MUST match verify_jwt" in a doc comment is read
 * as a call site — and several functions carry exactly that sentence.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')          // block comments
    .replace(/^[ \t]*\/\/.*$/gm, '')            // whole-line comments
    .replace(/([^:'"`\\])\/\/.*$/gm, '$1');     // trailing comments, sparing ://
}

// ── config.toml: the verify_jwt registry ───────────────────────────────────
// Parsed line by line rather than with a section regex. The first version used
// a lookahead ending in `\Z`, which is not a JavaScript escape — it matched a
// literal "Z", so the FINAL section in the file never terminated and was
// silently dropped. That made week-nudge-notify look unregistered on the first
// run: a checker bug presenting as a security finding. Hence the completeness
// assertion below — a parser that reads less than the file contains must fail
// loudly, not quietly under-report.
function readRegistry() {
  const toml = readFileSync(CONFIG, 'utf8');
  const registry = new Map();
  let current = null;

  for (const line of toml.split(/\r?\n/)) {
    const section = /^\s*\[([^\]]+)\]\s*$/.exec(line);
    if (section) {
      const fn = /^functions\.([a-z0-9-]+)$/.exec(section[1]);
      current = fn ? fn[1] : null;
      if (current && !registry.has(current)) registry.set(current, null);
      continue;
    }
    if (!current) continue;
    const flag = /^\s*verify_jwt\s*=\s*(true|false)\s*$/.exec(line);
    if (flag) registry.set(current, flag[1] === 'true');
  }

  // Self-check: the parser must have seen every section header in the file.
  const declared = (toml.match(/^\s*\[functions\.[a-z0-9-]+\]\s*$/gm) || []).length;
  if (declared !== registry.size) {
    console.error(`✗ config.toml parser read ${registry.size} of ${declared} [functions.*] sections — refusing to report on a partial read.`);
    process.exit(2);
  }
  return registry;
}

const registry = readRegistry();

const functions = readdirSync(FNS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
  .map((d) => d.name)
  .sort();

// ── rule 3: registry completeness, both directions ─────────────────────────
for (const name of functions) {
  if (!registry.has(name)) {
    fail(name, 'has no [functions.<name>] entry in supabase/config.toml — nothing records whether the gateway verifies its JWT');
  } else if (registry.get(name) === null) {
    fail(name, 'has a config.toml section but no verify_jwt value');
  }
}
for (const name of registry.keys()) {
  if (!functions.includes(name)) {
    fail(name, 'is pinned in config.toml but has no function directory (orphan entry)');
  }
}

// ── rules 1, 2, 4: per-function source analysis ────────────────────────────
let gatedCount = 0;
let flagChecks = 0;

for (const name of functions) {
  const entry = join(FNS, name, 'index.ts');
  if (!existsSync(entry)) {
    fail(name, 'has no index.ts');
    continue;
  }

  const raw = readFileSync(entry, 'utf8');
  const src = stripComments(raw);

  const importsService = /from\s+['"][^'"]*_shared\/service-role\.ts['"]/.test(src);
  const importsUser = /from\s+['"][^'"]*_shared\/user-auth\.ts['"]/.test(src);

  const calls = (sym) => new RegExp(`\\b${sym}\\s*\\(`).test(src);
  const importedSymbols = (module) => {
    const m = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"][^'"]*_shared/${module}\\.ts['"]`).exec(src);
    return m ? m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean) : [];
  };

  const calledService = SERVICE_SYMBOLS.filter(calls);
  const calledUser = USER_SYMBOLS.filter(calls);

  // rule 1 — call without import
  if (calledService.length && !importsService) {
    fail(name, `calls ${calledService.join(', ')} but never imports _shared/service-role.ts — this throws at RUNTIME and still passes a parse check`);
  }
  if (calledUser.length && !importsUser) {
    fail(name, `calls ${calledUser.join(', ')} but never imports _shared/user-auth.ts — this throws at RUNTIME and still passes a parse check`);
  }

  // rule 2 — import without call
  for (const [module, symbols] of [['service-role', SERVICE_SYMBOLS], ['user-auth', USER_SYMBOLS]]) {
    for (const sym of importedSymbols(module)) {
      if (symbols.includes(sym) && !calls(sym)) {
        fail(name, `imports ${sym} from _shared/${module}.ts but never calls it — the file LOOKS gated and is not`);
      }
    }
  }

  if (calledService.length || calledUser.length) gatedCount++;

  // rule 4 — the flag must equal the config
  const configured = registry.get(name);
  for (const m of src.matchAll(/gatewayVerifiesJwt\s*:\s*(true|false)/g)) {
    flagChecks++;
    const passed = m[1] === 'true';
    if (configured === undefined || configured === null) continue; // already reported
    if (passed !== configured) {
      fail(
        name,
        `passes gatewayVerifiesJwt: ${passed} but config.toml pins verify_jwt = ${configured}. ` +
        (passed
          ? 'The gate will accept an UNVERIFIED service_role claim — a forged token is enough.'
          : 'The gate will reject every key but the exact injected one, which 401s the crons.'),
      );
    }
  }
}

// ── report ─────────────────────────────────────────────────────────────────
if (problems.length) {
  console.error(`\n✗ edge gate conformance: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error(`  ${p.fn}\n      ${p.msg}\n`);
  process.exit(1);
}

console.log(
  `✓ edge gates: ${functions.length} functions, ${functions.length} verify_jwt entries (no gaps, no orphans); ` +
  `${gatedCount} carry a shared gate; ${flagChecks} gatewayVerifiesJwt flag(s) agree with config.toml`,
);
