// manualWeekContent.ts — the compact, repeatable Manual baseline.
//
// Ported from the Week 0 + Week 1 design kit. Every category follows the SAME
// template so adding a new week is just filling in data:
//   story[]  → the IG-story swipe deck (each card carries its own palette color)
//   checklist → "This week's {category}" list
//   article  → expert Q&A (the "article/video" slot — video added sparingly later)
//   info?    → one glanceable infographic (absent on some weeks, e.g. Week 0)
//
// Category note: Week 0 is "before baby" (hospital/sleep/feed/care/soothe — no
// grow, plus a hospital prep set). The app's chips are sleep/feed/grow/care/
// soothe, so getManualContent() falls back to Week 1 for anything a week lacks.

export type CardColor = 'ink' | 'rose' | 'honey' | 'caramel' | 'blush';
export type StoryLink = { kind: 'shop' | 'learn'; label: string; url: string };
export type StoryCard = {
  color: CardColor;
  eyebrow: string;
  title: string;   // may contain \n for the designed line break
  say?: string;    // handwritten caveat line
  body: string;
  link?: StoryLink;
};
export type ChecklistItem = { label: string; note?: string };
export type Checklist = { title: string; items: ChecklistItem[] };
export type Article = { question: string; answer: string; name: string; role: string; emoji: string };

export type Info =
  | { kind: 'wakewindows'; title: string; rows: { age: string; val: string; pct: number; now?: boolean }[]; foot: string }
  | { kind: 'milkstorage'; title: string; cols: { icon: 'counter' | 'fridge' | 'freezer'; v: string; u: string; w: string }[]; foot: string }
  | { kind: 'milestones'; title: string; items: { age: string; label: string; now?: boolean }[]; foot: string }
  | { kind: 'diapercolor'; title: string; cols: { sw: string; d: string; ds: string }[]; foot: string }
  | { kind: 'fives'; title: string; items: string[]; foot: string };

export type CategoryContent = {
  label: string;
  story: StoryCard[];
  checklist: Checklist;
  article: Article;
  info?: Info;
};

const SHOP = 'https://villieapp.com';

// helpers to keep the data terse + consistent with the kit's cover()/close()
const cover = (eyebrow: string, title: string, body: string): StoryCard => ({ color: 'ink', eyebrow, title, body });
const close = (eyebrow: string, title: string, say: string, body: string): StoryCard => ({ color: 'blush', eyebrow, title, say, body });

// ─────────────────────────────────────────────────────────────
// WEEK 1 — sleep / feed / grow / care / soothe (matches the chips)
// ─────────────────────────────────────────────────────────────
const WEEK_1: Record<string, CategoryContent> = {
  sleep: {
    label: 'Sleep',
    story: [
      cover('this week', 'Sleep is\nchaos.', "newborn sleep has no schedule yet — and that's exactly right."),
      { color: 'rose', eyebrow: 'tiny windows', title: '45 min\nawake.', say: 'then back down', body: 'newborns last only ~45–60 min before overtired. see the chart below.', link: { kind: 'learn', label: 'Spot sleepy cues', url: SHOP } },
      { color: 'honey', eyebrow: 'day = night', title: 'Mixed-up\nclock.', say: 'it flips by ~week 6', body: 'bright + busy by day, dark + boring by night teaches baby the difference.' },
      { color: 'caramel', eyebrow: 'still true', title: 'Bare\ncrib.', say: 'back, firm, empty', body: "safe sleep doesn't change — baby on their back, nothing else in there.", link: { kind: 'learn', label: 'Safe sleep', url: SHOP } },
      close('keep going', 'Follow\nbaby.', 'one day at a time', "scroll for this week's sleep guide ↓"),
    ],
    checklist: { title: "This week's sleep", items: [
      { label: 'Swaddle for every sleep' }, { label: 'Watch sleepy cues', note: 'yawns, red eyebrows, zoning out' },
      { label: 'Aim ~45–60 min wake windows' }, { label: 'White noise for naps too' },
      { label: '14–17 hrs total a day is normal' }, { label: 'Room-share, not bed-share' },
    ] },
    article: { question: 'Why is baby up all night?', emoji: '🩺', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
      answer: "Newborns don't have a body clock yet — they truly can't tell day from night. Keep nights dark and dull; it sorts itself out by around six weeks." },
    info: { kind: 'wakewindows', title: 'Wake windows by age', rows: [
      { age: 'Newborn', val: '45–60 min', pct: 30, now: true }, { age: '1–2 months', val: '60–90 min', pct: 48 },
      { age: '3–4 months', val: '75–120 min', pct: 68 }, { age: '5–6 months', val: '2–2.5 hrs', pct: 88 },
    ], foot: 'Awake too long → overtired → harder to settle. Put baby down at the first sleepy cue.' },
  },

  feed: {
    label: 'Feed',
    story: [
      cover('this week', 'Feed, round\nthe clock.', '8–12 feeds a day right now — yes, really that many.'),
      { color: 'rose', eyebrow: "what's normal", title: 'Cluster\nfeeds.', say: 'exhaustion, not failure', body: 'back-to-back evening feeds build your supply. completely normal.', link: { kind: 'learn', label: 'Why so often?', url: SHOP } },
      { color: 'honey', eyebrow: 'the real sign', title: 'Count wet\ndiapers.', say: '6+ a day by day 5', body: "diapers tell you baby's getting enough — not the ounces." },
      { color: 'caramel', eyebrow: 'pumping?', title: 'Milk\nstorage.', say: 'the 4-4-4 rule', body: 'room temp 4 hrs · fridge 4 days · freezer 6 months. full chart below.', link: { kind: 'shop', label: 'Shop storage bags', url: SHOP } },
      close('keep going', "You're\nfeeding her.", "that's everything", "scroll for this week's feed guide ↓"),
    ],
    checklist: { title: "This week's feed", items: [
      { label: '8–12 feeds per 24 hrs' }, { label: '6+ wet & 3+ dirty diapers', note: 'by day 5' },
      { label: 'Burp after each feed' }, { label: 'Wake to feed if >4 hrs', note: 'in these early days' },
      { label: 'Watch for a deep latch' }, { label: 'Track sides/times if it helps' },
    ] },
    article: { question: 'Is baby eating enough?', emoji: '👩🏽‍⚕️', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
      answer: "Count wet diapers, not ounces — six or more a day by the end of week one means baby is getting plenty. That's your real reassurance." },
    info: { kind: 'milkstorage', title: 'How long does breast milk keep?', cols: [
      { icon: 'counter', v: '4', u: 'hours', w: 'Counter' }, { icon: 'fridge', v: '4', u: 'days', w: 'Fridge' }, { icon: 'freezer', v: '6', u: 'months', w: 'Freezer' },
    ], foot: 'The easy "4-4-4" rule. Thawed milk: use within 24 hrs and never refreeze.' },
  },

  grow: {
    label: 'Grow',
    story: [
      cover('this week', 'Hello,\nworld.', 'baby sees ~8–12 inches — about your face at feeding distance.'),
      { color: 'rose', eyebrow: 'tiny doses', title: 'Tummy\ntime.', say: '2–3 min, a few times', body: 'start tiny — even a minute on your chest counts as tummy time.', link: { kind: 'learn', label: 'How to start', url: SHOP } },
      { color: 'honey', eyebrow: 'high contrast', title: 'Black &\nwhite.', say: 'easiest to see', body: 'newborns love bold contrast — cards, books, and your face most of all.', link: { kind: 'shop', label: 'Shop contrast cards', url: SHOP } },
      close('keep going', 'Just\nbe near.', "you're their world", "scroll for this week's grow guide ↓"),
    ],
    checklist: { title: "This week's grow", items: [
      { label: 'Tummy time 2–3 min', note: 'a few times a day, awake & watched' }, { label: 'Hold baby 8–12 in from your face' },
      { label: 'Talk + sing constantly' }, { label: 'High-contrast cards' }, { label: 'Skin-to-skin daily' },
    ] },
    article: { question: 'Can my newborn even see me?', emoji: '👁️', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
      answer: "At a week old, baby focuses best at about 8–12 inches — exactly the distance to your face when feeding. They're studying you more than anything else." },
    info: { kind: 'milestones', title: "What's coming next", items: [
      { age: 'now', label: 'Focuses on faces', now: true }, { age: '~6 wks', label: 'First social smile' }, { age: '2 mo', label: 'Coos & gurgles' }, { age: '3 mo', label: 'Holds head up' },
    ], foot: "Every baby's timing is their own — these are typical ranges, not deadlines." },
  },

  care: {
    label: 'Care',
    story: [
      cover('this week', 'Sponge\nbaths only.', 'until the cord stump falls off — keep it clean and dry.'),
      { color: 'rose', eyebrow: 'cord care', title: 'Keep it\ndry.', say: 'falls off in 1–3 wks', body: 'fold the diaper below it, let it air out, and no tub baths yet.', link: { kind: 'learn', label: 'Cord care', url: SHOP } },
      { color: 'honey', eyebrow: 'diapers', title: '10+ a\nday.', say: 'newborns go a lot', body: 'stock up — and change often to stay ahead of diaper rash.', link: { kind: 'shop', label: 'Shop newborn diapers', url: SHOP } },
      close('keep going', 'Gentle\ndoes it.', 'soft & slow', "scroll for this week's care guide ↓"),
    ],
    checklist: { title: "This week's care", items: [
      { label: 'Sponge baths only', note: 'no tub until the cord heals' }, { label: 'Keep the cord stump dry & exposed' },
      { label: 'Change diapers ~10× a day' }, { label: 'Fragrance-free wipes + cream' }, { label: "File nails — don't cut yet" }, { label: 'Watch for diaper rash' },
    ] },
    article: { question: 'How do I care for the cord stump?', emoji: '🩹', name: 'Dr. Marcus Hill, MD', role: 'pediatrician · villie expert',
      answer: 'Keep it dry and open to air, fold the diaper down below it, and let it fall off on its own. Call us if the surrounding skin gets red, swollen, or smelly.' },
    info: { kind: 'diapercolor', title: 'Diaper decoder', cols: [
      { sw: '#2E1C0F', d: 'Day 1–2', ds: 'Black & tarry (meconium)' }, { sw: '#6E7A45', d: 'Day 3–4', ds: 'Greenish — transitioning' }, { sw: '#E3B23A', d: 'Day 5+', ds: 'Yellow & seedy — normal' },
    ], foot: 'Red, white, or chalky-grey? Snap a photo and call your provider.' },
  },

  soothe: {
    label: 'Soothe',
    story: [
      cover('this week', 'The witching\nhour.', 'evening fussiness is real — and it peaks around six weeks.'),
      { color: 'rose', eyebrow: 'the magic', title: "5 S's,\non repeat.", say: 'swaddle · shush · sway', body: 'stack them together — swaddle, side, shush, swing, suck.', link: { kind: 'learn', label: "The 5 S's", url: SHOP } },
      { color: 'honey', eyebrow: "it's ok", title: 'Contact\nnaps.', say: 'baby just wants you', body: "being held to sleep is normal newborn stuff — not a habit you're breaking.", link: { kind: 'shop', label: 'Shop a wrap', url: SHOP } },
      close('keep going', 'This\npasses.', "you're doing great", "scroll for this week's soothe guide ↓"),
    ],
    checklist: { title: "This week's soothe", items: [
      { label: 'Swaddle + white noise + motion' }, { label: 'Offer a pacifier' }, { label: 'Wear baby in the evenings' },
      { label: 'Check basics first', note: 'hunger, diaper, temperature' }, { label: 'Tag-team with a partner' }, { label: "It's ok to put baby down safely & breathe" },
    ] },
    article: { question: 'Why does baby cry every evening?', emoji: '🍼', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
      answer: "Evening fussiness peaks around six weeks and then fades — it's normal newborn crying, not something you caused. Run the 5 S's, and tap out when you need to." },
    info: { kind: 'fives', title: "The 5 S's", items: ['Swaddle', 'Side', 'Shush', 'Swing', 'Suck'], foot: 'Stack them together — most newborns calm within minutes.' },
  },
};

// ─────────────────────────────────────────────────────────────
// WEEK 0 — before baby (hospital/sleep/feed/care/soothe; no infographics)
// ─────────────────────────────────────────────────────────────
const WEEK_0: Record<string, CategoryContent> = {
  sleep: {
    label: 'Sleep',
    story: [
      cover('before baby', 'Sleep,\nready.', "the safe-sleep setup, before baby's first night."),
      { color: 'rose', eyebrow: 'safest is simple', title: 'Bare is\nbest.', say: 'firm, flat, empty', body: 'a breathable mattress, a fitted sheet, and nothing else in the crib.', link: { kind: 'learn', label: 'Safe sleep 101', url: SHOP } },
      { color: 'honey', eyebrow: "you'll want these", title: 'Swaddles\n×3–5.', say: 'what are these?', body: "snug wraps that calm baby's startle reflex and stretch sleep.", link: { kind: 'learn', label: "What's a swaddle?", url: SHOP } },
      { color: 'caramel', eyebrow: 'peace of mind', title: 'Monitor.', say: 'see & hear baby', body: 'a camera or audio monitor so you can actually rest, too.', link: { kind: 'shop', label: 'Shop monitors', url: SHOP } },
      close('ready', 'Rest\neasy.', "nursery's ready", 'scroll for the full sleep list ↓'),
    ],
    checklist: { title: 'Sleep setup', items: [
      { label: 'Bassinet or crib + breathable mattress' }, { label: '2–3 fitted sheets' }, { label: '3–5 swaddles' },
      { label: 'Sleep sacks', note: 'for later — not the newborn days' }, { label: 'White noise machine' }, { label: 'Baby monitor / camera' }, { label: 'Blackout curtains' },
    ] },
    article: { question: "What's actually safe in the crib?", emoji: '🩺', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
      answer: 'For the first year, baby sleeps safest alone, on their back, on a firm flat surface — no bumpers, blankets, or stuffed animals.' },
  },

  feed: {
    label: 'Feed',
    story: [
      cover('before baby', 'Feed,\nprepped.', 'ready for breast, bottle, or both — whatever happens.'),
      { color: 'rose', eyebrow: 'even if breastfeeding', title: 'Have bottles\nready.', say: 'plans change', body: 'feeding rarely goes exactly to plan; a few bottles take the panic out.', link: { kind: 'learn', label: "Why, if I'm nursing?", url: SHOP } },
      { color: 'honey', eyebrow: 'if breastfeeding', title: 'Nipple-like\nbottles.', say: 'ease the switch', body: 'wide, slow-flow nipples help breastfed babies move back and forth.', link: { kind: 'shop', label: 'Shop these bottles', url: SHOP } },
      { color: 'caramel', eyebrow: 'for the leaks', title: 'Nursing\npads.', say: 'washable + disposable', body: 'your milk comes in fast — pads save every shirt you own.', link: { kind: 'shop', label: 'Shop nursing pads', url: SHOP } },
      close('ready', 'Ready\neither way.', "you've got options", 'scroll for the full feed list ↓'),
    ],
    checklist: { title: 'Feed setup', items: [
      { label: '3–4 bottles', note: 'wide neck, slow-flow nipple' }, { label: 'Bottle brush + drying rack' }, { label: 'Bottle washer / sterilizer' },
      { label: 'Nursing or milk pads', note: 'washable + disposable' }, { label: 'Burp cloths ×10' }, { label: 'Nursing pillow' },
      { label: 'Breast pump', note: 'check your insurance first' }, { label: 'Milk storage bags' }, { label: 'Small pack of formula', note: 'just in case' },
    ] },
    article: { question: "Bottles even if I'm breastfeeding?", emoji: '👩🏽‍⚕️', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
      answer: "Yes — have a few bottles and a small pack of formula on hand. Feeding doesn't always go to plan, and being ready takes the panic out of those first hard nights." },
  },

  care: {
    label: 'Care',
    story: [
      cover('before baby', 'Care,\nset up.', 'bath station, grooming kit, gentle everything.'),
      { color: 'rose', eyebrow: 'bath night', title: 'Tub +\ntowels.', say: 'two hooded towels', body: 'a baby tub and soft hooded towels make first baths calm, not chaos.', link: { kind: 'shop', label: 'Shop bath set', url: SHOP } },
      { color: 'honey', eyebrow: 'newborn skin', title: 'Fragrance-\nfree.', say: 'wash + lotion', body: 'newborn skin is thin and reactive — skip the fragrance and dyes.', link: { kind: 'learn', label: 'Why fragrance-free?', url: SHOP } },
      { color: 'caramel', eyebrow: 'wash before', title: 'Gentle\ndetergent.', say: 'free & clear', body: 'wash all clothes, swaddles & sheets before baby comes home.', link: { kind: 'shop', label: 'Shop detergent', url: SHOP } },
      close('ready', 'All\nset.', "nursery's clean", 'scroll for the full care list ↓'),
    ],
    checklist: { title: 'Care & bath setup', items: [
      { label: 'Baby bathtub' }, { label: '2–3 hooded towels' }, { label: 'Fragrance-free baby wash' }, { label: 'Fragrance-free lotion' },
      { label: 'Free & clear laundry detergent' }, { label: 'Nail file + clippers' }, { label: 'Digital thermometer' },
      { label: 'Diapers', note: 'newborn + size 1' }, { label: 'Wipes + diaper cream' }, { label: 'Soft washcloths' },
    ] },
    article: { question: 'Do I really need special detergent?', emoji: '🧴', name: 'Dr. Lena Ortiz', role: 'pediatric dermatologist',
      answer: 'Wash everything that touches baby — clothes, swaddles, sheets — in a fragrance- and dye-free detergent before they arrive. It heads off most newborn skin irritation.' },
  },

  soothe: {
    label: 'Soothe',
    story: [
      cover('before baby', 'Soothe,\nready.', 'everything you need to settle a fussy newborn.'),
      { color: 'rose', eyebrow: 'the magic', title: 'The\n5 S’s.', say: 'swaddle · side · shush · swing · suck', body: 'five moves that recreate the womb and calm almost any baby.', link: { kind: 'learn', label: "The 5 S's", url: SHOP } },
      { color: 'honey', eyebrow: 'for fussy nights', title: 'Pacifiers\n×2.', say: 'try a couple shapes', body: 'not every baby likes the same one — have a few options ready.', link: { kind: 'shop', label: 'Shop pacifiers', url: SHOP } },
      { color: 'caramel', eyebrow: 'contact naps', title: 'Carrier\nor wrap.', say: 'hands free, baby close', body: 'wear baby to soothe — and still get a moment for yourself.', link: { kind: 'shop', label: 'Shop carriers', url: SHOP } },
      close('ready', 'Calm,\ncovered.', "you've got tools", 'scroll for the full soothe list ↓'),
    ],
    checklist: { title: 'Soothe kit', items: [
      { label: 'Pacifiers', note: '2 shapes to test' }, { label: 'Baby carrier or wrap' }, { label: 'Swaddles', note: 'shared with Sleep' },
      { label: 'White noise machine', note: 'shared with Sleep' }, { label: 'Swing or bouncer', note: 'optional' }, { label: 'Gripe water / gas drops', note: 'ask your pediatrician' },
    ] },
    article: { question: 'How do I calm a crying newborn?', emoji: '🍼', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
      answer: 'Babies settle fastest with rhythm — motion, white noise, and snugness recreate the womb. When in doubt: swaddle, sway, and shush.' },
  },
};

const WEEKS: Record<number, Record<string, CategoryContent>> = { 0: WEEK_0, 1: WEEK_1 };

/**
 * Resolve the Manual content for a given week + category. Falls back to the
 * nearest seeded week (Week 1 is the canonical baseline), then to Week 1's
 * version of the category, so the app's fixed chips always render something.
 */
export function getManualContent(week: number, category: string): CategoryContent | null {
  const w = WEEKS[week] ?? WEEKS[1];
  return w?.[category] ?? WEEK_1[category] ?? WEEK_0[category] ?? null;
}
