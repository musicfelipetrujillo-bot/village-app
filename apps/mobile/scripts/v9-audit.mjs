#!/usr/bin/env node
// V9 design-consistency audit
// ─────────────────────────────────────────────────────────────────────────
// Scans every .tsx / .ts file under apps/mobile/src for kit-ban violations
// and color/font drift from the canonical v9 brand kit (villie · May 2026).
// Reference: docs/V9_BRAND_ROLLOUT.md + memory/project_brand_kit_v2.md
//
// Run:    node scripts/v9-audit.mjs
//         node scripts/v9-audit.mjs > V9_AUDIT.md   # capture as file
//         node scripts/v9-audit.mjs --severity=BAN  # filter to bans only
//
// Output: Markdown report grouped by severity (BAN / DRIFT / NIT) with
// file:line links. Re-run after fixes to track progress incrementally.
// ─────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

const args = process.argv.slice(2);
const severityFilter = args.find((a) => a.startsWith('--severity='))?.split('=')[1];

// ── Scope ──────────────────────────────────────────────────────────────
// Skip internal/admin (not in design scope), Community RoomChat (tab hidden),
// node_modules, the audit script itself, and contexts where pure-black /
// pure-white IS the design intent (camera viewports, video surfaces, SVG
// masking gradients).
const SKIP_PATTERNS = [
  /\/internal\//,
  /\/community\/Room/,
  /\/node_modules\//,
  /v9-audit\.mjs$/,
];

// Files exempt from pure-black/pure-white bans (camera/video surfaces where
// black IS the design intent, gradient-backdrop components where rgba on
// pure white is the math).
const FILE_EXEMPT_PURE_COLORS = [
  /BarcodeScannerModal\.tsx$/,
  /ManualVideoScreen\.tsx$/,
  /ManualTileArt\.tsx$/,      // SVG mask stops + raster fills (math, not visible)
  /WarmGlowBackdrop\.tsx$/,   // root layer of a gradient backdrop
];

// ── Checks ─────────────────────────────────────────────────────────────
// Each check: { id, severity, label, scan(line, lineNo, fullFile, filePath) }
// returns null or { col, snippet, hint }

const CHECKS = [
  // ── BAN ────────────────────────────────────────────────────────────
  {
    id: 'side-stripe',
    severity: 'BAN',
    label: 'Side-stripe border (borderLeft/RightWidth ≥ 2)',
    re: /border(Left|Right)Width:\s*([2-9]|\d{2,})/,
    hint: 'Rewrite with full hairline border in the accent color, OR background tint, OR a leading icon. Never the stripe.',
  },
  {
    id: 'pure-white',
    severity: 'BAN',
    label: 'Pure white literal (as bg or text color)',
    re: /(['"])#(?:fff|FFF|ffffff|FFFFFF)\1|(['"])white\2/,
    hint: 'Use paper #FDFBF6 (page) or card #FEFAF6 (substitute) for bg; paper #FDFBF6 for button text. Never pure white per kit.',
    // Don't flag inside rgba(255,255,255,...) — alpha-tinted overlays are math.
    skipIfLineMatches: /rgba\s*\(\s*255\s*,\s*255\s*,\s*255/,
    skipIfFileMatches: FILE_EXEMPT_PURE_COLORS,
  },
  {
    id: 'pure-black-shadow',
    severity: 'DRIFT',
    label: 'shadowColor: \'#000\' (kit prefers cocoa-tinted shadow)',
    re: /shadowColor:\s*['"]#(?:000|000000)['"]|shadowColor:\s*['"]black['"]/,
    hint: 'Use cocoa-tinted shadow #6B2E0E or action-deep #945A41 for cinnamon CTAs. Pure black drop reads cold against warm paper.',
    skipIfFileMatches: FILE_EXEMPT_PURE_COLORS,
  },
  {
    id: 'pure-black-visible',
    severity: 'BAN',
    label: 'Pure black literal (visible color, not shadow)',
    // Black as a visible bg/text/border color — but NOT as shadowColor (separate check above).
    re: /(?:backgroundColor|color|borderColor):\s*['"]#(?:000|000000)['"]|(?:backgroundColor|color|borderColor):\s*['"]black['"]/,
    hint: 'Use cocoa #3D1F0E. Never pure black per kit.',
    skipIfLineMatches: /rgba\s*\(\s*0\s*,\s*0\s*,\s*0/,
    skipIfFileMatches: FILE_EXEMPT_PURE_COLORS,
  },
  {
    id: 'synthetic-italic',
    severity: 'BAN',
    label: 'Synthetic italic on Playfair Bold',
    // Same line is the easy case; cross-line is harder — flag both same-style-block patterns
    re: /headerBold[\s\S]{0,80}fontStyle:\s*['"]italic['"]/,
    hint: 'Use FONTS.headerItalic instead of FONTS.headerBold + fontStyle:italic.',
  },

  // ── DRIFT ──────────────────────────────────────────────────────────
  {
    id: 'retired-rust',
    severity: 'DRIFT',
    label: 'Retired old-rust hex',
    re: /['"]#(?:B85C38|9A4A2B)['"]/i,
    hint: 'Old rust palette retired. Use cinnamon #C07840 (action) or action-deep #945A41 (shadow under fill).',
  },
  {
    id: 'retired-paper',
    severity: 'DRIFT',
    label: 'Old paper hex #FDFAF5',
    re: /['"]#FDFAF5['"]/i,
    hint: 'Kit canonical paper is #FDFBF6 (1 hex off in green channel).',
  },
  {
    id: 'action-deep-as-text',
    severity: 'DRIFT',
    label: 'Action-deep #945A41 used as text/border color',
    // Flag when it appears as `color:` or `borderColor:` — NOT `shadowColor:`.
    // Lookbehind `(?<![a-zA-Z])` prevents matching the "Color" in "shadowColor".
    re: /(?<![a-zA-Z])(?:color|borderColor):\s*['"]#945A41['"]/i,
    hint: 'Action-deep is the shadow tone under cinnamon fill. For text/borders use cinnamon #C07840 or amber #A77349.',
    // Action-deep as a darker rim AROUND a cinnamon-filled control is the
    // canonical v9 button recipe — both colors come from the same family.
    // Action-deep as a secondary-CTA border/text (outline button, not filled)
    // is also intentional — cinnamon would compete with the primary CTA.
    skipIfLineContext: [
      /moodChipActive|weekBtnActive|checkboxChecked/i, // cinnamon-filled controls with action-deep rim
      /ctaSecondary|ctaLabelSecondary|btnSecondary|secondaryCta|secondaryBtn/i, // outline secondary buttons
      /weekHeroCtaText/i,         // explicit WCAG-AA documented choice in HomeScreen
    ],
  },
  {
    id: 'coco-as-cta-bg',
    severity: 'DRIFT',
    label: 'COLORS.coco used as CTA backgroundColor',
    re: /backgroundColor:\s*COLORS\.coco/,
    hint: 'Primary CTAs use cinnamon #C07840. Soft-active states (filter chips, progress fills, hero bgs, avatar fallbacks, badges, dots) keep caramel by design — see "Kept-by-design" section in V9_BRAND_ROLLOUT.md.',
    // After the curated sweep, the remaining COLORS.coco usages are KEPT BY
    // DESIGN. Exempt the contexts so the audit doesn't keep flagging them.
    skipIfLineContext: [
      /chipActive/i,            // filter chip active states (scoping ≠ action)
      /dotActive/i,             // progress dot indicators
      /progressFill/i,          // progress bar fills
      /checkboxOn/i,            // form checkbox selected
      /captionPillActive/i,     // video caption pill
      /avatar|Avatar/i,         // avatar bgs / fallbacks
      /badge|Badge/i,           // notification count badges
      /hero:\s*{/,              // full hero bgs
      /AccentBar|accentBar/i,   // decorative bars
      /accentBarMomThin/i,      // greeting accent bar
      /greetingDateBar/i,
      /sectionAccentBar/i,
      /twinAccentBar/i,
      /combinedTile/i,          // tile bg, not button
      /dangerBtn/i,             // destructive — caramel is softer than red (keep)
      /matchBadge/i,            // ranking badge
      /resourceName|resourceDesc/i,
      /ageCheckActive/i,        // chip-active variant
      /toggleOn/i,              // form toggle (not segmented control)
      /cocoSoft/i,              // cocoSoft = lighter caramel variant (avatar bgs etc.)
      /successCircle|trophyCircle/i,
      /circle:\s*{/,             // generic decorative circle (e.g. OnboardingComplete)
      /unreadDot/i,              // notification badge (round count container)
      /matchAccent/i,            // 4×36 decorative accent bar
      /buyerTag|sellerTag/i,     // identity tags on chat thread rows
    ],
  },
  {
    id: 'sand-as-cta-bg',
    severity: 'DRIFT',
    label: 'COLORS.sandSoft used as CTA backgroundColor',
    re: /backgroundColor:\s*COLORS\.sandSoft.*(?:Btn|Button|Cta|CTA)/i,
    hint: 'Tan/sand isn\'t a CTA color. Use cinnamon.',
  },
  {
    id: 'generic-card-border',
    severity: 'DRIFT',
    label: 'Card with generic rgba(0,0,0,X) border (should be rust hairline)',
    re: /borderColor:\s*['"]rgba\(0\s*,\s*0\s*,\s*0\s*,\s*0?\.[0-9]+\)['"]/,
    hint: 'Card hairlines should be rust-tinted: borderColor: \'rgba(150,80,50,0.18)\'.',
  },

  // ── NIT ────────────────────────────────────────────────────────────
  {
    id: 'old-wordmark',
    severity: 'NIT',
    label: 'Old wordmark asset (villie-wordmark.png or -sm.png)',
    re: /villie-wordmark(?:-sm)?\.png/,
    hint: 'Kit canonical is villie-wordmark-v2.png.',
  },
];

// ── Walker ─────────────────────────────────────────────────────────────
function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(ROOT, full);
    if (SKIP_PATTERNS.some((p) => p.test(rel))) continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walk(full);
    } else if (/\.(tsx?|jsx?)$/.test(name)) {
      yield full;
    }
  }
}

// ── Scan ───────────────────────────────────────────────────────────────
const findings = []; // { severity, id, label, hint, file, line, snippet }

for (const file of walk(SRC)) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment-only lines (no false positives from doc comments)
    if (/^\s*(?:\/\/|\*|\/\*)/.test(line)) continue;
    for (const check of CHECKS) {
      if (check.skipIfLineMatches && check.skipIfLineMatches.test(line)) continue;
      if (check.skipIfFileMatches && check.skipIfFileMatches.some((p) => p.test(file))) continue;
      // skipIfLineContext: look at this line + the 5 preceding lines for any
      // pattern. Used to exempt style names that sit on the line above their
      // properties (e.g. `chipActive: {\n  backgroundColor: COLORS.coco\n}`).
      // 5-line lookback covers typical RN multi-property style blocks.
      if (check.skipIfLineContext) {
        const context = [
          lines[i - 5] || '', lines[i - 4] || '', lines[i - 3] || '',
          lines[i - 2] || '', lines[i - 1] || '', line,
        ].join('\n');
        if (check.skipIfLineContext.some((p) => p.test(context))) continue;
      }
      const m = line.match(check.re);
      if (m) {
        findings.push({
          severity: check.severity,
          id: check.id,
          label: check.label,
          hint: check.hint,
          file: relative(ROOT, file),
          line: i + 1,
          snippet: line.trim().slice(0, 120),
        });
      }
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────
const filtered = severityFilter
  ? findings.filter((f) => f.severity === severityFilter)
  : findings;

const bySev = { BAN: [], DRIFT: [], NIT: [] };
for (const f of filtered) bySev[f.severity].push(f);

const counts = {
  BAN: bySev.BAN.length,
  DRIFT: bySev.DRIFT.length,
  NIT: bySev.NIT.length,
  total: filtered.length,
};

const sevEmoji = { BAN: '🚫', DRIFT: '⚠️', NIT: '💡' };

let md = '';
md += `# V9 Design Consistency Audit\n\n`;
md += `Generated ${new Date().toISOString()}\n\n`;
md += `**Total: ${counts.total}** — 🚫 ${counts.BAN} bans · ⚠️ ${counts.DRIFT} drift · 💡 ${counts.NIT} nits\n\n`;
md += `Scope: \`apps/mobile/src/**\` (excluding \`internal/\`, \`community/Room*\`, node_modules)\n\n`;
md += `---\n\n`;

for (const sev of ['BAN', 'DRIFT', 'NIT']) {
  if (bySev[sev].length === 0) continue;
  md += `## ${sevEmoji[sev]} ${sev} (${bySev[sev].length})\n\n`;
  // Group by check.id within severity
  const byId = {};
  for (const f of bySev[sev]) {
    (byId[f.id] = byId[f.id] || []).push(f);
  }
  for (const id of Object.keys(byId).sort()) {
    const group = byId[id];
    md += `### \`${id}\` — ${group[0].label} (${group.length})\n\n`;
    md += `**Hint:** ${group[0].hint}\n\n`;
    // Sort by file then line
    group.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
    for (const f of group) {
      md += `- \`${f.file}:${f.line}\` — \`${f.snippet.replace(/`/g, '\\`')}\`\n`;
    }
    md += `\n`;
  }
}

if (filtered.length === 0) {
  md += `🎉 **Zero violations.** Every screen is on canon.\n`;
}

process.stdout.write(md);
