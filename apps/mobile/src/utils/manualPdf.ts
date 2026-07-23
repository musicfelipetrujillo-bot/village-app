// Manual chapter → PDF export.
//
// Generates a brand-styled HTML document of the current chapter that
// can be piped through expo-print's printToFileAsync to land a .pdf
// file on disk, then shared via expo-sharing. The HTML embeds inline
// CSS so the resulting PDF needs no external assets.
//
// CALLER STATUS: this utility is ready to use, but the actual
// expo-print + expo-sharing wiring lives behind a feature flag because
// both libraries have native iOS frameworks that require a fresh build
// (Build 12+). Until then, callers should keep their `placeholder()`
// fallback. Once Build 12 lands, swap the placeholder for:
//
//   import * as Print from 'expo-print';
//   import * as Sharing from 'expo-sharing';
//   import { buildManualChapterHtml } from '@utils/manualPdf';
//
//   async function exportChapterPdf(opts) {
//     const html = buildManualChapterHtml(opts);
//     const { uri } = await Print.printToFileAsync({ html, base64: false });
//     await Sharing.shareAsync(uri, {
//       dialogTitle: 'Save your chapter',
//       mimeType: 'application/pdf',
//       UTI: 'com.adobe.pdf',
//     });
//   }

// Match the v3 brand kit palette (kept inline so the HTML stays
// self-contained and renders identically in iOS Quick Look + Books +
// any PDF reader).
const PALETTE = {
  cream: '#FCF7EF',
  paper: '#FFFCF6',
  parchment: '#F2E6DD',
  cinnamon: '#E84B79',
  salmon: '#F7C5CB',
  cocoa: '#43260F',
  walnut: '#7A4A28',
  amber: '#7A4A24',
};

// Display + body type stacks. PDF renderers fall back through these,
// so we don't depend on Plus Jakarta being installed on the recipient
// device — the cascade keeps the editorial feel even when villie's
// custom families aren't available.
const FONT_DISPLAY =
  "'Plus Jakarta Sans', 'Helvetica Neue', 'Helvetica', system-ui, sans-serif";
const FONT_BODY =
  "'Plus Jakarta Sans', 'Helvetica Neue', 'Helvetica', system-ui, sans-serif";
const FONT_MONO =
  "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace";

export type ManualPdfPiece =
  | { kind: 'video'; num: string; title: string; dur?: string; expert?: string }
  | { kind: 'article'; num: string; title: string; dur?: string; excerpt: string }
  | { kind: 'illustration'; num: string; title: string; caption?: string }
  | { kind: 'checklist'; num: string; title: string; steps: string[] };

export interface BuildManualChapterHtmlInput {
  /** "Sleep", "Feed", etc. */
  chapterName: string;
  /** Lead-in line under the chapter title. */
  chapterIntro?: string;
  /** 1..52 */
  week: number;
  /** Audience switch — affects the masthead phrasing. */
  who: 'mom' | 'baby';
  /** First name (or "Your") used in the masthead — e.g. "Liam's manual". */
  ownerName: string;
  /** The pieces from the screen — video + article + illustration + checklist. */
  pieces: ManualPdfPiece[];
  /** Generated-at timestamp for the footer. */
  generatedAt?: Date;
}

/**
 * Builds a self-contained HTML document for the current chapter.
 *
 * The returned string is meant to be passed straight to
 * `Print.printToFileAsync({ html })`. The styling is print-friendly:
 * cream background lifts to white when printed on physical paper, type
 * is sized so a tablet PDF reader hits the same visual rhythm as the
 * in-app screen.
 */
export function buildManualChapterHtml(opts: BuildManualChapterHtmlInput): string {
  const generatedAt = opts.generatedAt ?? new Date();
  const masthead = opts.who === 'baby'
    ? `${escapeHtml(opts.ownerName)}'s <em>manual</em>`
    : `Your <em>manual</em>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(opts.chapterName)} · Week ${opts.week} · villie</title>
<style>
  @page { size: Letter; margin: 0.6in 0.7in 0.8in 0.7in; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: ${PALETTE.cream};
    color: ${PALETTE.cocoa};
    font-family: ${FONT_BODY};
    font-size: 12pt;
    line-height: 1.55;
  }

  /* Masthead — small eyebrow + the chapter title + week marker */
  .masthead-eyebrow {
    font-family: ${FONT_MONO};
    font-size: 9pt;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: ${PALETTE.amber};
    margin-bottom: 6pt;
  }
  .masthead {
    font-family: ${FONT_DISPLAY};
    font-weight: 700;
    font-size: 28pt;
    line-height: 1.1;
    color: ${PALETTE.cocoa};
    margin: 0 0 18pt 0;
  }
  .masthead em {
    font-style: italic;
    color: ${PALETTE.salmon};
    font-weight: 600;
  }

  /* Chapter band — colored hero card matching the in-app surface */
  .chapter-band {
    background: ${PALETTE.parchment};
    border-radius: 14pt;
    padding: 20pt 22pt;
    margin: 6pt 0 22pt 0;
  }
  .chapter-band-eyebrow {
    font-family: ${FONT_MONO};
    font-size: 8.5pt;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: ${PALETTE.cocoa};
    margin-bottom: 8pt;
    opacity: 0.8;
  }
  .chapter-band-title {
    font-family: ${FONT_DISPLAY};
    font-weight: 700;
    font-size: 26pt;
    line-height: 1.05;
    color: ${PALETTE.cocoa};
    margin: 0 0 8pt 0;
  }
  .chapter-band-title .dot { color: ${PALETTE.cinnamon}; }
  .chapter-band-intro {
    font-size: 11pt;
    color: ${PALETTE.walnut};
    margin: 0;
  }

  /* Piece sections */
  .piece {
    border-top: 1pt solid rgba(122, 74, 40, 0.18);
    padding: 14pt 0 6pt 0;
    margin-top: 14pt;
    page-break-inside: avoid;
  }
  .piece-label {
    font-family: ${FONT_MONO};
    font-size: 8.5pt;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: ${PALETTE.amber};
    margin-bottom: 6pt;
  }
  .piece-title {
    font-family: ${FONT_DISPLAY};
    font-weight: 700;
    font-size: 16pt;
    line-height: 1.2;
    color: ${PALETTE.cocoa};
    margin: 0 0 6pt 0;
  }
  .piece-excerpt {
    font-size: 11pt;
    color: ${PALETTE.walnut};
    margin: 4pt 0 6pt 0;
  }
  .piece-meta {
    font-size: 10pt;
    color: ${PALETTE.amber};
    margin: 0;
  }

  /* Checklist piece — gets its own card treatment */
  .checklist-card {
    background: ${PALETTE.paper};
    border-radius: 10pt;
    padding: 12pt 14pt;
    margin-top: 8pt;
  }
  .checklist-step {
    display: flex;
    align-items: flex-start;
    padding: 6pt 0;
    border-top: 1pt solid rgba(122, 74, 40, 0.10);
    font-size: 11.5pt;
  }
  .checklist-step:first-child { border-top: none; }
  .checklist-step .box {
    display: inline-block;
    width: 11pt; height: 11pt;
    border: 1.4pt solid ${PALETTE.cocoa};
    border-radius: 3pt;
    margin: 2pt 10pt 0 0;
    flex-shrink: 0;
  }

  /* Footer */
  .footer {
    margin-top: 28pt;
    padding-top: 12pt;
    border-top: 1pt solid rgba(122, 74, 40, 0.18);
    font-family: ${FONT_MONO};
    font-size: 8.5pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: ${PALETTE.amber};
    text-align: center;
  }
</style>
</head>
<body>
  <div class="masthead-eyebrow">Week ${opts.week} of 52 · ${opts.who === 'baby' ? "Baby's categories" : 'Your categories'}</div>
  <h1 class="masthead">${masthead}</h1>

  <section class="chapter-band">
    <div class="chapter-band-eyebrow">${escapeHtml(opts.chapterName)} · week ${opts.week} of 52</div>
    <h2 class="chapter-band-title">${escapeHtml(opts.chapterName)}<span class="dot">.</span></h2>
    ${opts.chapterIntro ? `<p class="chapter-band-intro">${escapeHtml(opts.chapterIntro)}</p>` : ''}
  </section>

  ${opts.pieces.map(renderPiece).join('\n')}

  <div class="footer">
    ${formatFooterDate(generatedAt)} · villie · a village for every mom
  </div>
</body>
</html>`;
}

// ── helpers ──────────────────────────────────────────────────────────

function renderPiece(p: ManualPdfPiece): string {
  switch (p.kind) {
    case 'video':
      return `<section class="piece">
        <div class="piece-label">Watch · ${escapeHtml(p.num)}${p.dur ? ` · ${escapeHtml(p.dur)}` : ''}</div>
        <h3 class="piece-title">${escapeHtml(p.title)}</h3>
        ${p.expert ? `<p class="piece-meta">${escapeHtml(p.expert)}</p>` : ''}
      </section>`;

    case 'article':
      return `<section class="piece">
        <div class="piece-label">Read · ${escapeHtml(p.num)}${p.dur ? ` · ${escapeHtml(p.dur)}` : ''}</div>
        <h3 class="piece-title">${escapeHtml(p.title)}</h3>
        <p class="piece-excerpt">${escapeHtml(p.excerpt)}</p>
      </section>`;

    case 'illustration':
      return `<section class="piece">
        <div class="piece-label">See · ${escapeHtml(p.num)}</div>
        <h3 class="piece-title">${escapeHtml(p.title)}</h3>
        ${p.caption ? `<p class="piece-meta">${escapeHtml(p.caption)}</p>` : ''}
      </section>`;

    case 'checklist':
      return `<section class="piece">
        <div class="piece-label">Do · ${escapeHtml(p.num)}</div>
        <h3 class="piece-title">${escapeHtml(p.title)}</h3>
        <div class="checklist-card">
          ${(p.steps ?? []).map((s) => `
            <div class="checklist-step"><span class="box"></span><span>${escapeHtml(s)}</span></div>
          `).join('')}
        </div>
      </section>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatFooterDate(d: Date): string {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
}
