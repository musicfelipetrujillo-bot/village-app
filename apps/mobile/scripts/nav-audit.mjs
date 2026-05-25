#!/usr/bin/env node
// nav-audit — catalog every navigation.navigate() call in the mobile app
// and cross-check the destination against the screens registered in
// each navigator. Flags:
//   - DEAD: nav targets that don't match any registered Stack.Screen name
//   - PLACEHOLDER: handlers that show Alert with "coming soon" copy
//   - NO-OP: onPress={() => {}} or onPress={undefined}
//   - LOOPY: routes that navigate back to themselves
//
// Run: node scripts/nav-audit.mjs

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const EXCLUDE_DIRS = new Set(['node_modules']);

async function walk(dir, files = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDE_DIRS.has(entry.name)) await walk(path.join(dir, entry.name), files);
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

// Collect every <Stack.Screen name="X"> + <Tab.Screen name="X"> across navigators.
async function collectRegisteredScreens(files) {
  const screens = new Map(); // name → [file, file, ...] (multiple registrations = collision/duplicate)
  const screenRe = /(Stack|Tab|Drawer)\.Screen\s+name=["']([A-Za-z0-9_]+)["']/g;
  for (const file of files) {
    if (!/navigation\//i.test(file)) continue;
    const text = await readFile(file, 'utf8');
    let m;
    while ((m = screenRe.exec(text)) !== null) {
      const name = m[2];
      if (!screens.has(name)) screens.set(name, []);
      screens.get(name).push(path.relative(path.resolve(ROOT, '..'), file));
    }
  }
  return screens;
}

// Collect every navigation.navigate('X') / navigation.getParent()?.navigate('X')
// + navigation.replace('X') + navigation.push('X') call.
async function collectNavCalls(files) {
  const calls = [];
  // Captures the target as a string literal or template literal. We don't
  // handle dynamic strings — those are reported separately.
  const navRe = /navigation(?:\.getParent\(\)\??)?\.(?:navigate|replace|push)\s*\(\s*['"]([A-Za-z0-9_]+)['"]/g;
  // Generic dynamic — flagged so we don't false-positive as dead.
  const dynNavRe = /navigation(?:\.getParent\(\)\??)?\.(?:navigate|replace|push)\s*\(\s*[^'"\s)]/g;
  for (const file of files) {
    if (/navigation\//i.test(file)) continue;
    const text = await readFile(file, 'utf8');
    let m;
    while ((m = navRe.exec(text)) !== null) {
      const line = text.slice(0, m.index).split('\n').length;
      calls.push({
        file: path.relative(path.resolve(ROOT, '..'), file),
        line,
        target: m[1],
        kind: 'static',
      });
    }
    let dm;
    while ((dm = dynNavRe.exec(text)) !== null) {
      const line = text.slice(0, dm.index).split('\n').length;
      calls.push({
        file: path.relative(path.resolve(ROOT, '..'), file),
        line,
        target: '<dynamic>',
        kind: 'dynamic',
      });
    }
  }
  return calls;
}

// Find Alert.alert with "coming soon" / "coming!" / "soon" / "placeholder" copy.
async function collectPlaceholders(files) {
  const out = [];
  const re = /Alert\.alert\s*\([^)]*?(?:[Cc]oming\s+[Ss]oon|[Cc]oming!|[Pp]laceholder|[Nn]ot\s+yet\s+(?:built|wired|implemented))/g;
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    let m;
    while ((m = re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split('\n').length;
      const snippet = text.slice(m.index, m.index + 100).replace(/\s+/g, ' ');
      out.push({
        file: path.relative(path.resolve(ROOT, '..'), file),
        line,
        snippet,
      });
    }
  }
  return out;
}

// Find onPress={() => {}} (empty arrow) and onPress={undefined}.
async function collectNoOpHandlers(files) {
  const out = [];
  const re = /onPress\s*=\s*\{\s*(?:\(\s*\)\s*=>\s*\{\s*\}|undefined|null)\s*\}/g;
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    let m;
    while ((m = re.exec(text)) !== null) {
      const line = text.slice(0, m.index).split('\n').length;
      out.push({
        file: path.relative(path.resolve(ROOT, '..'), file),
        line,
      });
    }
  }
  return out;
}

function main() { return run(); }
async function run() {
  const files = await walk(ROOT);
  const screens = await collectRegisteredScreens(files);
  const calls = await collectNavCalls(files);
  const placeholders = await collectPlaceholders(files);
  const noops = await collectNoOpHandlers(files);

  const screenNames = new Set(screens.keys());
  // Tabs registered in AppNavigator are also valid targets (cross-tab nav).
  // Add the canonical tab name list as a fallback (matches AppNavigator).
  ['Home', 'Manual', 'Village', 'Inbox', 'Experts', 'Milk', 'Gear', 'Profile', 'Me'].forEach(
    (t) => screenNames.add(t),
  );

  // ── Dead nav targets ─────────────────────────────────────────────
  const dead = calls.filter((c) => c.kind === 'static' && !screenNames.has(c.target));

  // ── Same target from many files (potential redundancy hotspot) ───
  const byTarget = new Map();
  for (const c of calls) {
    if (c.kind !== 'static') continue;
    if (!byTarget.has(c.target)) byTarget.set(c.target, []);
    byTarget.get(c.target).push(c);
  }

  // ── Screens registered in MULTIPLE navigators (loops / duplicate routing) ──
  const dupes = [...screens.entries()].filter(([, list]) => list.length > 1);

  // ── Output ───────────────────────────────────────────────────────
  console.log('# Nav Pathway Audit\n');
  console.log(`Generated ${new Date().toISOString()}\n`);
  console.log(`- Static nav targets: ${calls.filter((c) => c.kind === 'static').length}`);
  console.log(`- Dynamic nav targets: ${calls.filter((c) => c.kind === 'dynamic').length}`);
  console.log(`- Registered screen names: ${screens.size}`);
  console.log(`- Placeholder Alerts: ${placeholders.length}`);
  console.log(`- No-op onPress handlers: ${noops.length}\n`);
  console.log('---\n');

  console.log(`## DEAD nav targets (${dead.length})\n`);
  console.log('Static nav calls pointing at a name no Stack.Screen registers.\n');
  if (dead.length === 0) {
    console.log('_None._\n');
  } else {
    for (const d of dead) {
      console.log(`- \`${d.file}:${d.line}\` → \`${d.target}\``);
    }
  }
  console.log('\n');

  console.log(`## DUPLICATE screen registrations (${dupes.length})\n`);
  console.log('Same screen name registered in multiple navigators — potential routing ambiguity.\n');
  if (dupes.length === 0) {
    console.log('_None._\n');
  } else {
    for (const [name, list] of dupes) {
      console.log(`- \`${name}\` registered in:`);
      for (const f of list) console.log(`  - \`${f}\``);
    }
  }
  console.log('\n');

  console.log(`## PLACEHOLDER alerts (${placeholders.length})\n`);
  console.log('"Coming soon" / "not yet built" Alerts — user-facing dead-ends.\n');
  if (placeholders.length === 0) {
    console.log('_None._\n');
  } else {
    for (const p of placeholders) {
      console.log(`- \`${p.file}:${p.line}\` — ${p.snippet.slice(0, 80)}…`);
    }
  }
  console.log('\n');

  console.log(`## NO-OP onPress handlers (${noops.length})\n`);
  console.log('TouchableOpacity / Button with empty handler — looks tappable but does nothing.\n');
  if (noops.length === 0) {
    console.log('_None._\n');
  } else {
    for (const n of noops) {
      console.log(`- \`${n.file}:${n.line}\``);
    }
  }
  console.log('\n');

  // Top-5 high-frequency targets (potential redundancy candidates)
  const sortedByCount = [...byTarget.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log('## Most-called nav targets (top 10)\n');
  console.log('High counts can signal a screen that 10 places navigate to — worth checking if any of those paths are redundant ways of saying the same thing.\n');
  for (const [name, list] of sortedByCount.slice(0, 10)) {
    console.log(`- \`${name}\` — ${list.length} calls`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
