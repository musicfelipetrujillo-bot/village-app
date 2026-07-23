// beforeBaby.ts — the "before baby arrives" prep checklists (hospital bag +
// home ready). Static content, grouped by who/what it's for. Check-state is
// personal + persisted locally (AsyncStorage) — no backend row needed. Printable
// / shareable via expo-print, reusing the Day Sheet output pattern.
//
// EN only for v1 (Spanish is a follow-up pass, same posture as manualWeekContent).

export type CheckItem = { id: string; label: string; note?: string };
export type CheckGroup = { title: string; items: CheckItem[] };
export type BeforeBabyList = { key: 'hospital' | 'home'; label: string; blurb: string; groups: CheckGroup[] };

export const BEFORE_BABY: BeforeBabyList[] = [
  {
    key: 'hospital',
    label: 'hospital bag',
    blurb: 'pack it around 36 weeks — babies keep their own schedule.',
    groups: [
      { title: 'for you', items: [
        { id: 'you_id', label: 'photo ID + insurance card', note: 'plus any hospital paperwork' },
        { id: 'you_outfit', label: 'going-home outfit', note: 'loose + comfy — you’ll still look a few months along' },
        { id: 'you_bras', label: 'nursing bras + high-waist undies' },
        { id: 'you_toiletries', label: 'toiletries + glasses', note: 'toothbrush, lip balm, hair ties' },
        { id: 'you_charger', label: 'phone charger', note: 'extra-long cord — outlets are never close' },
        { id: 'you_socks', label: 'grippy socks + slippers' },
        { id: 'you_pads', label: 'nursing pads + postpartum pads', note: 'the hospital gives some, bring your favorites' },
        { id: 'you_snacks', label: 'snacks + refillable water bottle' },
      ] },
      { title: 'for baby', items: [
        { id: 'baby_outfit', label: 'coming-home outfit + hat + mittens' },
        { id: 'baby_carseat', label: 'installed rear-facing car seat', note: 'check the install before you go' },
        { id: 'baby_swaddles', label: '2–3 swaddle blankets' },
        { id: 'baby_onesies', label: 'a few onesies', note: 'newborn + 0–3mo — sizes surprise you' },
      ] },
      { title: 'for your partner', items: [
        { id: 'p_snacks', label: 'snacks + refillable water bottle' },
        { id: 'p_pillow', label: 'pillow + change of clothes' },
        { id: 'p_charger', label: 'their own phone charger' },
        { id: 'p_cash', label: 'cash / card for parking' },
      ] },
    ],
  },
  {
    key: 'home',
    label: 'home ready',
    blurb: 'the essentials to have set up before baby comes home.',
    groups: [
      { title: 'sleep', items: [
        { id: 'h_bassinet', label: 'bare bassinet / crib set up', note: 'firm flat mattress, fitted sheet only' },
        { id: 'h_roomshare', label: 'room-share spot next to your bed' },
        { id: 'h_sound', label: 'sound machine' },
      ] },
      { title: 'feeding', items: [
        { id: 'h_station', label: 'a feeding station within reach', note: 'water, snacks, burp cloths, charger' },
        { id: 'h_bottles', label: 'bottles + sterilizer', note: 'if bottle or combo feeding' },
        { id: 'h_pillow', label: 'nursing pillow' },
        { id: 'h_pump', label: 'breast pump ordered', note: 'often covered by insurance — check early' },
        { id: 'h_formula', label: 'a little formula as backup', note: 'good to have even if breastfeeding' },
      ] },
      { title: 'diapering', items: [
        { id: 'h_changing', label: 'changing area stocked', note: 'newborn diapers, wipes, cream, spare clothes' },
        { id: 'h_pail', label: 'diaper pail + liners' },
      ] },
      { title: 'the bigger stuff', items: [
        { id: 'h_pediatrician', label: 'pediatrician chosen + first visit booked' },
        { id: 'h_carseat_check', label: 'car seat checked', note: 'many fire stations / CPSTs do it free' },
        { id: 'h_meals', label: 'a few freezer meals for you' },
        { id: 'h_recovery', label: 'postpartum recovery kit', note: 'pads, peri bottle, comfy underwear' },
        { id: 'h_help', label: 'help lined up for the first 2 weeks', note: 'partner leave, family, a meal train' },
      ] },
    ],
  },
];

// Who sees the pinned entry + Home card: a mom who's still expecting. Signal =
// a future due date (postpartum moms have a past due date) or a prenatal stage.
// Onboarding is postpartum-only today, so this is near-zero now but correct the
// moment prenatal onboarding returns; the screen stays reachable for everyone.
export function isExpecting(dueDate?: string | null, stage?: string | null): boolean {
  if (stage && /trimester|expecting|prenatal|pregnan/i.test(stage)) return true;
  if (!dueDate) return false;
  const due = new Date(dueDate).getTime();
  if (Number.isNaN(due)) return false;
  const days = (due - Date.now()) / 86400000;
  return days > 0 && days <= 300;
}

export const BEFORE_BABY_TOTAL = BEFORE_BABY.reduce(
  (n, list) => n + list.groups.reduce((m, g) => m + g.items.length, 0), 0,
);

// Printable HTML — mirrors the Day Sheet output tone (warm, simple). `checked`
// is the set of item ids the mom has ticked.
export function beforeBabyHtml(checked: Set<string>, babyName?: string): string {
  const rows = (list: BeforeBabyList) => list.groups.map((g) => `
    <div class="grp">${g.title}</div>
    ${g.items.map((it) => {
      const on = checked.has(it.id);
      return `<div class="row"><span class="bx ${on ? 'on' : ''}">${on ? '✓' : ''}</span>
        <span class="lbl ${on ? 'done' : ''}">${it.label}${it.note ? `<span class="note"> · ${it.note}</span>` : ''}</span></div>`;
    }).join('')}`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <style>
    body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#3D2116;margin:0;padding:28px 26px;}
    h1{font-size:24px;margin:0 0 2px;}
    .sub{color:#8A6A55;font-size:13px;margin:0 0 20px;}
    h2{font-size:15px;letter-spacing:.14em;text-transform:uppercase;color:#B0234F;margin:22px 0 8px;border-bottom:1px solid #EFE0C8;padding-bottom:6px;}
    .grp{font-size:13px;font-weight:700;color:#B98A1E;margin:14px 0 4px;}
    .row{display:flex;gap:10px;align-items:flex-start;padding:5px 0;}
    .bx{width:16px;height:16px;border:1.5px solid #B0234F;border-radius:4px;flex:0 0 auto;text-align:center;line-height:15px;color:#fff;font-size:11px;}
    .bx.on{background:#B0234F;}
    .lbl{font-size:14px;} .lbl.done{color:#8A6A55;} .note{color:#8A6A55;font-size:12px;}
    .foot{margin-top:26px;color:#a08a6c;font-size:11px;}
  </style></head><body>
  <h1>${babyName ? `${babyName}’s getting-ready list` : 'getting ready for baby'}</h1>
  <p class="sub">built with villie · hospital bag + home essentials</p>
  ${BEFORE_BABY.map((list) => `<h2>${list.label}</h2>${rows(list)}`).join('')}
  <p class="foot">A gentle guide, not a rulebook — add or skip what fits your family.</p>
  </body></html>`;
}
