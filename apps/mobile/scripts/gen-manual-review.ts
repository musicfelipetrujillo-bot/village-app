// Generates docs/MANUAL_CLINICAL_REVIEW.md from the single source of truth
// (src/manual/manualWeekContent.ts) so the review doc never drifts from the app.
// Run:  npx --yes tsx scripts/gen-manual-review.ts
import { getManualContent, type Info } from '../src/manual/manualWeekContent';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DATE = '2026-06-11';
const WEEKS = [
  { week: 0, title: 'WEEK 0 — Before baby (prep)', cats: ['hospital', 'sleep', 'feed', 'care'] },
  { week: 1, title: 'WEEK 1 — Newborn (first week home)', cats: ['sleep', 'feed', 'grow', 'care'] },
];

const oneLine = (s: string) => s.replace(/\n/g, ' ').trim();

function infoBlock(info: Info): string {
  let o = `**Infographic — ${info.title}**\n\n`;
  if (info.kind === 'wakewindows') o += info.rows.map((r) => `- ${r.age}: ${r.val}`).join('\n');
  else if (info.kind === 'milkstorage') o += info.cols.map((c) => `- ${c.w}: ${c.v} ${c.u}`).join('\n');
  else if (info.kind === 'milestones') o += info.items.map((m) => `- ${m.age}: ${m.label}`).join('\n');
  else if (info.kind === 'diapercolor') o += info.cols.map((c) => `- ${c.d}: ${c.ds}`).join('\n');
  else if (info.kind === 'fives') o += info.items.map((f) => `- ${f}`).join('\n');
  o += `\n\n_Footnote:_ ${info.foot}`;
  return o;
}

let md = `# The Village — Manual · Clinical Review\n\n`;
md += `_Generated ${DATE} from \`manualWeekContent.ts\` (single source of truth — re-run the generator after edits)._\n\n`;
md += `## How to use this doc\n`;
md += `Please review every line for **clinical accuracy** and **safe phrasing**. Mark up inline or leave comments. Three specific asks:\n\n`;
md += `1. **Flag anything inaccurate, outdated, or unsafe** — especially anything that could be read as medical advice for an individual baby.\n`;
md += `2. **The expert names below are PLACEHOLDERS** (e.g. "Dr. Priya Nair, MD", "Dana Reyes, IBCLC") that I invented while building. Each "Ask the expert" card shows a **✓ Verified** badge. Before launch these must become **real, consenting, credentialed experts** — or be re-attributed to a generic "villie clinical team". Please advise.\n`;
md += `3. **Disclaimer posture** — confirm the app's "not a substitute for medical care / call your provider" framing is sufficient for this content.\n\n`;
md += `Structure: 2 weeks seeded so far (Week 0 prep + Week 1 newborn), 4 chapters each. Per chapter: a story deck, a checklist, 3 expert Q&A cards, an infographic (Week 1), and "ask your specialist" questions.\n\n`;
md += `---\n\n`;

for (const wk of WEEKS) {
  md += `# ${wk.title}\n\n`;
  for (const cat of wk.cats) {
    const c = getManualContent(wk.week, cat);
    if (!c) continue;
    md += `## ${wk.week}.${cat} — ${c.label}\n\n`;

    md += `### Story deck\n`;
    c.story.forEach((card, i) => {
      const say = card.say ? ` _(handwritten: “${card.say}”)_` : '';
      const link = card.link ? `  \n   ↳ link sticker: **${card.link.label}** (${card.link.kind})` : '';
      md += `${i + 1}. **${oneLine(card.title)}**${say} — ${card.body}${link}\n`;
    });
    md += `\n`;

    md += `### Checklist — “${c.checklist.title}”\n`;
    c.checklist.items.forEach((it) => {
      md += `- [ ] ${it.label}${it.note ? ` — _${it.note}_` : ''}\n`;
    });
    md += `\n`;

    md += `### Expert Q&A cards  ⚠️ _names are placeholders — see top of doc_\n`;
    c.articles.forEach((a, i) => {
      md += `${i + 1}. **Q — ${a.question}**\n`;
      md += `   - **A:** ${a.answer}\n`;
      md += `   - _attributed to:_ ${a.name} · ${a.role}\n`;
    });
    md += `\n`;

    if (c.info) md += `### ${infoBlock(c.info)}\n\n`;

    if (c.specialistQs?.length) {
      md += `### "Ask your specialist" — bring these three\n`;
      c.specialistQs.forEach((q) => { md += `- ${q}\n`; });
      md += `\n`;
    }

    md += `---\n\n`;
  }
}

const out = 'docs/MANUAL_CLINICAL_REVIEW.md';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, md);
console.log(`wrote ${out} (${md.length} chars)`);
