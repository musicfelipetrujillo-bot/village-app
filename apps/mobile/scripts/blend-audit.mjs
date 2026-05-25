#!/usr/bin/env node
// blend-audit — flag card-shaped View surfaces that blend into the cream
// page wash. A card "blends" when it has:
//   • backgroundColor of cream/parchment family (same hue as page wash)
//   • AND no shadowColor OR weak shadow (opacity < 0.12)
//
// Card-shaped = has borderRadius >= 10 OR padding{Vertical,Horizontal,} present.
// Hand-rolled — meant to complement v9-audit.mjs which focuses on tokens.
//
// Run: node scripts/blend-audit.mjs [--screen=path/substring]
//
// Output: markdown to stdout. Pipe to docs/BLEND_AUDIT.md as needed.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const EXCLUDE_DIRS = new Set(['node_modules', 'internal', 'community']);

const BLEND_BG_HEX = new Set([
  '#F4ECD8', '#EAE0C8', '#FCF6EF', '#F2DDD0',
  // Stale golden→blush family — was retinted to cream-paper in 2026-05-16
  // but per-screen overrides survive. Memory: project_v9_brand_rollout.md.
  '#F2E9C4', '#EADBA8', '#E8C4B6', '#FEFAF6', '#FDFBF6',
]);
const BLEND_BG_TOKENS = new Set([
  'COLORS.cream', 'COLORS.parchment', 'COLORS.v2_cream', 'COLORS.v2_parchment',
  'T.cream', 'T.parchment',
]);

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

// Extract style object literals: { ...keys: values } blocks
// Naive regex parser — good enough for StyleSheet.create({ key: { ... } })
function extractStyleBlocks(text) {
  const blocks = [];
  const styleNameRe = /^\s*([a-zA-Z_][a-zA-Z0-9_]*):\s*\{/gm;
  let m;
  while ((m = styleNameRe.exec(text)) !== null) {
    const name = m[1];
    const startBracket = text.indexOf('{', m.index + name.length);
    if (startBracket < 0) continue;
    // Walk forward matching braces
    let depth = 1, i = startBracket + 1;
    while (i < text.length && depth > 0) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') depth--;
      i++;
    }
    if (depth !== 0) continue;
    const body = text.slice(startBracket, i);
    const line = text.slice(0, m.index).split('\n').length;
    blocks.push({ name, body, line });
  }
  return blocks;
}

function isCardShaped(body) {
  // borderRadius >= 10 OR meaningful padding (presence implies inset content)
  const br = body.match(/borderRadius:\s*(\d+)/);
  if (br && Number(br[1]) >= 10) return true;
  if (/padding(Vertical|Horizontal)?\s*:\s*(?:1[6-9]|[2-9]\d)/.test(body)) return true;
  if (/padding:\s*(?:1[6-9]|[2-9]\d)/.test(body)) return true;
  return false;
}

function hasBlendBg(body) {
  for (const tok of BLEND_BG_TOKENS) {
    if (new RegExp(`backgroundColor:\\s*${tok.replace('.', '\\.')}(?!\\w)`).test(body)) return tok;
  }
  const hexMatch = body.match(/backgroundColor:\s*['"](#[A-Fa-f0-9]{6})['"]/);
  if (hexMatch && BLEND_BG_HEX.has(hexMatch[1].toUpperCase())) return hexMatch[1];
  return null;
}

function shadowStrength(body) {
  // Spread of the canonical cardLift mixin counts as 'ok' — no need to
  // look at inline shadow tokens.
  if (/\.\.\.cardLift(Deep)?\b/.test(body)) return 'ok';
  if (!/shadowColor/.test(body)) return 'none';
  const opMatch = body.match(/shadowOpacity:\s*(0?\.\d+|0|1)/);
  if (!opMatch) return 'unknown';
  const op = Number(opMatch[1]);
  if (op < 0.12) return 'weak';
  return 'ok';
}

async function main() {
  const screenArg = process.argv.find((a) => a.startsWith('--screen='));
  const screenFilter = screenArg ? screenArg.split('=')[1] : null;

  const files = await walk(ROOT);
  const findings = [];

  // Only flag names that read as a content surface (card / panel / block /
  // section / sheet / dashboard / list). Skip everything else — most are
  // buttons / badges / icon circles / chips that don't need lift.
  const CONTENT_NAME_RE = /(card|panel|block|section|sheet|dashboard|listRow|noteCard|tile)/i;
  // ...except chrome variants of those:
  const CHROME_NAME_RE = /(thumb|cover|iconBtn|avatar|mapBtn|videoBtn|reference|weekBtn|langChip|toggleTrack|recallCard|reasonCard|menuBadge|scrollCueBox|ackRow|successIcon)/i;

  for (const file of files) {
    if (screenFilter && !file.includes(screenFilter)) continue;
    const text = await readFile(file, 'utf8');
    const blocks = extractStyleBlocks(text);
    for (const b of blocks) {
      if (!isCardShaped(b.body)) continue;
      if (!CONTENT_NAME_RE.test(b.name)) continue;
      if (CHROME_NAME_RE.test(b.name)) continue;
      if (!/backgroundColor:/.test(b.body)) continue;
      // Skip surfaces explicitly using the page-wash itself
      if (/backgroundColor:\s*['"]transparent['"]/.test(b.body)) continue;
      const sh = shadowStrength(b.body);
      if (sh === 'ok') continue;
      const bg = hasBlendBg(b.body) ?? '<other>';
      const rel = path.relative(path.resolve(ROOT, '..'), file);
      findings.push({ file: rel, line: b.line, name: b.name, bg, sh });
    }
  }

  findings.sort((a, b) => {
    if (a.sh !== b.sh) return a.sh === 'none' ? -1 : 1;
    return a.file.localeCompare(b.file);
  });

  console.log('# Blend Audit\n');
  console.log(`Generated ${new Date().toISOString()}\n`);
  console.log(`**Total candidates: ${findings.length}**\n`);
  console.log('Card-shaped surfaces with cream/parchment bg AND no/weak shadow.');
  console.log('These risk blending into the page wash.\n');
  console.log('---\n');

  let lastFile = null;
  for (const f of findings) {
    if (f.file !== lastFile) {
      console.log(`\n## \`${f.file}\`\n`);
      lastFile = f.file;
    }
    console.log(`- L${f.line} \`${f.name}\` — bg \`${f.bg}\` · shadow \`${f.sh}\``);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
