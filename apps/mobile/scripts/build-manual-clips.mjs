#!/usr/bin/env node
/**
 * Build the offline Manual-clip bundle.
 *
 * WHY
 * ---
 * The Manual video clips are animated HTML/React pieces. As authored for the
 * website they pull React + ReactDOM + Babel from unpkg.com and transform JSX
 * in the browser — so they only work online. To make the app play them offline
 * (hospital-discharge users on poor connectivity), we precompile each clip into
 * a single self-contained HTML string with NO CDN and NO on-device Babel, then
 * embed those strings in the JS bundle (no native module, fully OTA-able).
 *
 * Fidelity: JSX is transformed with @babel/standalone@7.29.0 — the EXACT
 * transformer the clips already use in-browser (classic `react` preset →
 * React.createElement) — so the compiled output renders identically. React +
 * ReactDOM come from the website's own vendor/ (production builds). Google
 * Fonts stay remote (degrade to system fonts offline).
 *
 * OUTPUT  -> src/manual/localManualClips.generated.ts
 *   MANUAL_CLIP_VENDOR    : React + ReactDOM (stored once, injected at runtime)
 *   MANUAL_CLIP_HTML      : { slug: "<self-contained html with <!--VENDOR--> token>" }
 *
 * RUN
 *   npm i @babel/standalone@7.29.0   # build-time only; not a runtime dep
 *   node scripts/build-manual-clips.mjs [path/to/village-website/manual-videos]
 *   # (or point BABEL_STANDALONE_PATH at an installed copy)
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Babel = require(process.env.BABEL_STANDALONE_PATH || '@babel/standalone');

const scriptDir = dirname(fileURLToPath(import.meta.url));            // apps/mobile/scripts
const mobileDir = resolve(scriptDir, '..');                          // apps/mobile
const defaultSrc = resolve(scriptDir, '../../../../village-website/manual-videos');
const SRC = resolve(process.argv[2] || defaultSrc);
const OUT = join(mobileDir, 'src/manual/localManualClips.generated.ts');

if (!existsSync(SRC)) {
  console.error(`✗ source dir not found: ${SRC}`);
  process.exit(1);
}

// The 11 clips seeded by migration 088, keyed by slug (= html filename stem).
const CLIPS = [
  'ep01-5ss', 'ep02-tears-mood', 'ep03-contact-nap', 'ep04-enough-milk',
  'tip01-3am', 'tip02-555', 'tip03-witching', 'tip04-latch',
  'tip05-pump', 'tip06-hydration', 'tip07-crying',
];

// `</script>` inside an injected <script> body would close the tag early.
const escClose = (s) => s.replace(/<\/script/gi, '<\\/script');

function transformJsx(code, filename) {
  return Babel.transform(code, { presets: ['react'], filename }).code;
}

// Parse <script> tags IN ORDER and return the clip's app scripts as an ORDERED
// ARRAY (one entry per original script). They are emitted as SEPARATE <script>
// tags — NOT concatenated — because the clips rely on the browser's classic
// multi-script model: e.g. animations.jsx defines components, then
// scenes.jsx does `const { Stage, ... } = window`. Collapsing them into one
// scope causes top-level `const` redeclaration collisions; separate tags keep
// each script's scope exactly as it runs online.
//  - remote (unpkg/http) + vendor/ scripts  -> skipped (vendor injected separately)
//  - type="text/babel" (src or inline)      -> transformed via Babel
//  - local *.app.js (already compiled)       -> included verbatim
function buildAppParts(html, slug) {
  const parts = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1];
    const body = m[2];
    const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
    const src = srcMatch ? srcMatch[1] : null;
    const isBabel = /type\s*=\s*["']text\/babel["']/i.test(attrs);
    const isJson = /type\s*=\s*["']application\/json["']/i.test(attrs);

    if (src && /^https?:\/\//i.test(src)) continue;       // CDN (react/react-dom/babel)
    if (src && /(^|\/)vendor\//i.test(src)) continue;      // vendor handled separately
    if (isJson) continue;                                  // vo-script reference block

    if (isBabel) {
      const code = src ? readFileSync(join(SRC, src), 'utf8') : body;
      parts.push(transformJsx(code, src || `${slug}-inline`));
    } else if (src && /\.app\.js$/i.test(src)) {
      parts.push(readFileSync(join(SRC, src), 'utf8'));     // precompiled, verbatim
    }
    // any other <script> (none expected) is intentionally dropped
  }
  if (parts.length === 0) throw new Error(`no app scripts found for ${slug}`);
  return parts;
}

// Strip every <script> from the clip HTML and inject a VENDOR token followed by
// each app script as its OWN <script> tag (preserving classic per-script
// scope). The token is replaced with the shared vendor bundle at runtime.
function buildTemplate(html, parts) {
  const stripped = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const scriptTags = parts.map((p) => `<script>${escClose(p)}</script>`).join('\n');
  const inject = `<!--VENDOR-->\n${scriptTags}\n`;
  if (/<\/body>/i.test(stripped)) {
    return stripped.replace(/<\/body>/i, `${inject}</body>`);
  }
  return stripped + inject; // defensive: no </body>
}

// ── vendor: React + ReactDOM (production), stored once ──
const vendorFiles = ['vendor/react.production.min.js', 'vendor/react-dom.production.min.js'];
for (const f of vendorFiles) {
  if (!existsSync(join(SRC, f))) { console.error(`✗ missing ${f}`); process.exit(1); }
}
const vendor = escClose(vendorFiles.map((f) => readFileSync(join(SRC, f), 'utf8')).join('\n;\n'));

// ── per-clip templates ──
const out = {};
for (const slug of CLIPS) {
  const htmlPath = join(SRC, `${slug}.html`);
  if (!existsSync(htmlPath)) { console.error(`✗ missing ${slug}.html`); process.exit(1); }
  const html = readFileSync(htmlPath, 'utf8');
  const parts = buildAppParts(html, slug);
  out[slug] = buildTemplate(html, parts);
  const kb = (out[slug].length / 1024).toFixed(0);
  console.log(`  ✓ ${slug}  (${kb} KB template)`);
}

const banner = `// AUTO-GENERATED by scripts/build-manual-clips.mjs — DO NOT EDIT BY HAND.
// Self-contained offline Manual clips (vendor React/ReactDOM injected at the
// <!--VENDOR--> token at runtime). Regenerate when clips change:
//   npm i @babel/standalone@7.29.0 && node scripts/build-manual-clips.mjs
/* eslint-disable */
`;
const body =
  `${banner}\nexport const MANUAL_CLIP_VENDOR: string = ${JSON.stringify(vendor)};\n\n` +
  `export const MANUAL_CLIP_HTML: Record<string, string> = ${JSON.stringify(out)};\n`;

writeFileSync(OUT, body);
const totalKb = (body.length / 1024).toFixed(0);
console.log(`\n▸ wrote ${OUT} (${totalKb} KB, vendor ${(vendor.length / 1024).toFixed(0)} KB + ${CLIPS.length} clips)`);
