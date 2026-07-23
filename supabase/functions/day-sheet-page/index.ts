// day-sheet-page — public, read-only web render of a Day Sheet.
//
// GET /functions/v1/day-sheet-page?t=<share_token>
// Returns an HTML page (no app needed) so a nanny/grandparent can scan the QR
// and see baby's routine, always current. Token-gated + revoke + expiry aware.
// Reads with the SERVICE ROLE (the table is owner-RLS'd; anon never touches
// it). No auth required by the caregiver — the unguessable token IS the access.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (standard secrets).

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type RowKind = 'wake' | 'bottle' | 'nap' | 'meal' | 'bath' | 'bed' | 'note';
// Feeds (rose) + naps (honey) get a soft row tint + bold ink so they pop;
// wake/bath/bed are muted grey and recede. rowBg:'' = not highlighted.
const ROW_META: Record<RowKind, { emoji: string; chip: string; rowBg: string; tc: string; wc: string }> = {
  wake:   { emoji: '☀️', chip: '#EDEAF6', rowBg: '',        tc: '#A99C7E', wc: '#9A8264' },
  bottle: { emoji: '🍼', chip: '#FBD9E1', rowBg: '#FDEFF2', tc: '#C2556F', wc: '#3D2116' },
  nap:    { emoji: '💤', chip: '#F6E2AE', rowBg: '#FCF3DC', tc: '#B98A1E', wc: '#3D2116' },
  meal:   { emoji: '🍽️', chip: '#FBD9E1', rowBg: '#FDEFF2', tc: '#C2556F', wc: '#3D2116' },
  bath:   { emoji: '🛁', chip: '#E7EDEF', rowBg: '',        tc: '#A99C7E', wc: '#9A8264' },
  bed:    { emoji: '🌙', chip: '#EDEAF6', rowBg: '',        tc: '#A99C7E', wc: '#9A8264' },
  note:   { emoji: '📝', chip: '#F1E7D3', rowBg: '',        tc: '#A99C7E', wc: '#9A8264' },
};

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}

function shell(inner: string): string {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Day sheet · villie</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,600&family=Caveat:wght@700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{color-scheme:light}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Plus Jakarta Sans',system-ui,sans-serif;background:#FCF7EF;color:#3D2116;padding:14px;-webkit-text-size-adjust:100%}
.doc{max-width:520px;margin:0 auto;background:#FFFDF9;border:1px solid #ECE0C6;border-radius:16px;overflow:hidden;box-shadow:0 12px 34px rgba(122,74,40,.1)}
.serif{font-family:'Playfair Display',serif}.script{font-family:'Caveat',cursive}
.eye{font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:700}
.hdr{background:linear-gradient(135deg,#FCEFC7,#FBDDE4);padding:20px 18px}
.hrow{display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;color:#8A6A55}
.dot{width:7px;height:7px;border-radius:50%;background:#F5C842}
.who{display:flex;align-items:center;gap:12px;margin-top:14px}
.av{width:54px;height:54px;border-radius:27px;background:#EAD9A8;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:24px;color:#8A6A1E;flex-shrink:0}
.name{font-family:'Playfair Display',serif;font-size:27px;line-height:1}
.for{font-size:12px;color:#7A5A3E;margin-top:5px}
.sec{padding:16px 18px 0}.sec h3{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#8A6A55;font-weight:700;margin-bottom:10px}
.kt{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.ktc{border-radius:12px;padding:11px 12px}
.ktc .k{font-size:9px;letter-spacing:1px;text-transform:uppercase;font-weight:700}
.ktc .v{font-size:14px;font-weight:700;margin-top:4px;line-height:1.25}
.ess{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.essc{background:#FFFCF6;border:1px solid #EFE4CE;border-radius:11px;padding:10px 12px}
.essc .k{font-size:9px;letter-spacing:1px;text-transform:uppercase;color:#B98A1E;font-weight:700}
.essc .v{font-size:13px;font-weight:500;margin-top:3px}
.row{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:11px;margin-top:4px}
.chip{width:34px;height:34px;border-radius:10px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:17px}
.row .t{width:56px;flex-shrink:0;font-weight:700;font-size:12px}
.row .w{flex:1;font-size:14px;line-height:1.35}
.legend{display:flex;flex-wrap:wrap;gap:12px;padding:12px 2px 0;font-size:11px;color:#8A6A55}
.tip{border-radius:12px;padding:12px;margin-top:9px;display:flex;gap:12px}
.tip img{width:72px;height:72px;border-radius:9px;object-fit:cover;flex-shrink:0}
.tip .b{font-size:13.5px;line-height:1.4}
.ft{padding:18px;text-align:center;color:#9A8264;font-size:11px}
.ft .m{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:#8A6A55;font-weight:600;margin-bottom:6px}
.gate{max-width:420px;margin:16vh auto 0;text-align:center;padding:0 24px}
.gate .big{font-family:'Playfair Display',serif;font-size:26px;margin:14px 0 8px}
.gate p{color:#7A5A3E;font-size:14px;line-height:1.5}
</style></head><body>${inner}</body></html>`;
}

function gate(msg: string): string {
  return shell(`<div class="gate"><div class="brand" style="justify-content:center"><span class="dot"></span>villie</div>
    <div class="big">Day sheet unavailable</div><p>${esc(msg)}</p></div>`);
}

function render(d: any): string {
  const baby = esc(d.baby_name || 'Baby');
  const kt = d.key_times || {};
  const ess = d.essentials || {};
  const schedule: any[] = Array.isArray(d.schedule) ? d.schedule : [];
  const tips: any[] = Array.isArray(d.tips) ? d.tips : [];
  const napTimes: string[] = schedule.filter((r) => r.kind === 'nap').map((r) => r.time);
  const bedTime: string = (schedule.find((r) => r.kind === 'bed')?.time) || kt.bed || '';
  const feedTimes: string[] = schedule.filter((r) => r.kind === 'bottle' || r.kind === 'meal').map((r) => r.time);

  const ktCell = (k: string, v: string, bg: string, bd: string, kc: string) =>
    v ? `<div class="ktc" style="background:${bg};border:1px solid ${bd}"><div class="k" style="color:${kc}">${k}</div><div class="v">${esc(v)}</div></div>` : '';
  const keyTimes = `<div class="kt">
    ${ktCell('💤 naps', napTimes.join(' · '), '#FBEFD0', '#F0DBA6', '#B98A1E')}
    ${ktCell('🌙 bed', bedTime, '#EAE7F5', '#D3CDEB', '#6E5FA0')}
    ${feedTimes.length ? `<div class="ktc" style="grid-column:1/-1;background:#FDECEF;border:1px solid #F3C9D3"><div class="k" style="color:#C2556F">🍼 feeds</div><div class="v">${esc(feedTimes.join(' · '))}</div></div>` : ''}
  </div>`;

  const essCell = (k: string, v: string) => v ? `<div class="essc"><div class="k">${k}</div><div class="v">${esc(v)}</div></div>` : '';
  const essentials = `<div class="ess">
    ${essCell('emergency', ess.emergency)}${essCell('allergies', ess.allergies)}
    ${essCell('pediatrician', ess.pediatrician)}${essCell('comfort', ess.comfort)}
    ${ess.meds ? `<div class="essc" style="grid-column:1/-1"><div class="k">meds</div><div class="v">${esc(ess.meds)}</div></div>` : ''}
  </div>`;

  const rows = schedule.map((r) => {
    const meta = ROW_META[(r.kind as RowKind)] || ROW_META.note;
    const w = meta.rowBg ? 700 : 400;
    return `<div class="row" style="background:${meta.rowBg || 'transparent'}"><div class="chip" style="background:${meta.chip}">${meta.emoji}</div>` +
      `<div class="t" style="color:${meta.tc}">${esc(r.time)}</div><div class="w" style="color:${meta.wc};font-weight:${w}">${esc(r.text)}</div></div>`;
  }).join('');
  const legend = rows ? `<div class="legend"><span>🍼 feed</span><span>💤 sleep</span><span style="color:#A99C7E">others muted</span></div>` : '';

  const tipEls = tips.filter((t) => (t.text || '').trim()).map((t) => t.photo_url
    ? `<div class="tip" style="background:#FDECEF"><img src="${esc(t.photo_url)}" alt=""><div class="b">${esc(t.text)}</div></div>`
    : `<div class="tip" style="background:#FBEFC9"><div class="b">💡 ${esc(t.text)}</div></div>`).join('');

  const range = [d.starts_on, d.ends_on].filter(Boolean).join(' – ');
  return shell(`<div class="doc">
    <div class="hdr">
      <div class="hrow"><span class="eye" style="color:#B98A1E">day sheet</span><span class="brand"><span class="dot"></span>villie</span></div>
      <div class="who"><div class="av">${esc((d.baby_name || 'B').charAt(0))}</div>
        <div><div class="name">${baby}<span class="script" style="font-size:22px;color:#C2556F">'s day</span></div>
        <div class="for">${d.for_whom ? 'for <b>' + esc(d.for_whom) + '</b>' : ''}${range ? ' · ' + esc(range) : ''}</div></div></div>
    </div>
    ${(napTimes.length || bedTime || feedTimes.length) ? `<div class="sec"><h3>★ key times</h3>${keyTimes}</div>` : ''}
    ${(ess.emergency || ess.allergies || ess.pediatrician || ess.comfort || ess.meds) ? `<div class="sec"><h3>essentials</h3>${essentials}</div>` : ''}
    ${rows ? `<div class="sec"><h3>the full day</h3>${rows}${legend}</div>` : ''}
    ${tipEls ? `<div class="sec"><h3>pro tips from mom</h3>${tipEls}</div>` : ''}
    <div class="ft"><div class="m"><span class="dot"></span>made with villie</div><br>This is a live sheet — it updates when ${baby}'s parent makes changes.</div>
  </div>`);
}

Deno.serve(async (req) => {
  try {
    const token = new URL(req.url).searchParams.get('t');
    if (!token) return html(gate('This link is missing its code.'), 400);
    const { data, error } = await supabase.from('day_sheets').select('*').eq('share_token', token).maybeSingle();
    if (error || !data) return html(gate("We couldn't find this day sheet. Ask the parent for a fresh link."), 404);
    if (data.revoked_at) return html(gate('The parent turned this link off.'), 410);
    if (data.ends_on) {
      const end = new Date(data.ends_on + 'T23:59:59').getTime();
      if (Date.now() > end + 2 * 86400000) return html(gate('This day sheet has ended.'), 410);
    }
    return html(render(data));
  } catch (e) {
    return html(gate('Something went wrong loading this sheet.'), 500);
  }
});
