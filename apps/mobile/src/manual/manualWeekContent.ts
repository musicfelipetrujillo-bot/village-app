// manualWeekContent.ts — the compact, repeatable Manual baseline.
//
// Authored from the real pain points a new mom hits in week 0–1 (not generic
// filler). Every category follows the SAME template so adding a week = data:
//   story[]   → the IG-story swipe deck (each card carries its own palette color)
//   checklist → "This week's {category}" list
//   article   → expert Q&A (the "article/video" slot — video added sparingly)
//   info?     → one glanceable infographic
//
// LINKS: every `link.url` below is a PLACEHOLDER (PLACEHOLDER_URL). The labels
// describe the product/guide so Felipe can hand back the real brand/affiliate
// URLs — see the "LINKS TO WIRE" list at the bottom. Swap per-link `url` then.
//
// Categories: Week 1 = sleep/feed/grow/care (Soothe was dropped — its content
// folds into Sleep + Care). Week 0 = before-baby prep (hospital/sleep/feed/care);
// it gets its own distinct pills + reachability in a follow-up.

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

// TODO(links): replace per-link once brand/affiliate URLs are provided.
const PLACEHOLDER_URL = 'https://villieapp.com';
const SHOP = PLACEHOLDER_URL;

// Real brand links (add affiliate params here once partnerships are signed).
// Stripped the ad-click tracking (gclid/utm/gbraid) — those are session-specific.
const KYTE_SWADDLE = 'https://kytebaby.com/products/swaddle-bag-in-silly-goose-0-5?variant=43190058025071';
const HATCH_SOUND = 'https://www.target.com/p/hatch-baby-sleep-bundle-home-38-travel-sound-machines-includes-hatch-baby-and-portable-hatch-go-putty/-/A-94909740';
const MOMCOZY_BAGS = 'https://www.amazon.com/dp/B09R4PVYG8'; // add Amazon Associates tag (?tag=…) once enrolled
const CARTERS_GOWN = 'https://www.carters.com/p/baby-2-pack-constellation-purelysoft-sleeper-gowns-yellow-cream/197233775093';
const CONTRAST_CARDS = 'https://www.amazon.com/dp/B0DHH7LGZT'; // high-contrast books + tummy-time mirror
const FRIDA_POSTPARTUM = 'https://www.amazon.com/dp/B0CZSD8YZV'; // Frida Mom postpartum essentials kit

const cover = (eyebrow: string, title: string, body: string): StoryCard => ({ color: 'blush', eyebrow, title, body });
const close = (eyebrow: string, title: string, say: string, body: string): StoryCard => ({ color: 'blush', eyebrow, title, say, body });

// ─────────────────────────────────────────────────────────────
// WEEK 1 — sleep / feed / grow / care  (the postpartum baseline)
// ─────────────────────────────────────────────────────────────
const WEEK_1: Record<string, CategoryContent> = {
  sleep: {
    label: 'Sleep',
    story: [
      cover('this week', 'Sleep is\nsurvival.', "no schedule yet — and that's exactly right. here's what actually helps."),
      { color: 'rose', eyebrow: 'the swaddle', title: 'Swaddle\nright.', say: 'arms up or down', body: 'snug around the chest, loose at the hips so they can bend. some babies sleep best arms-up — and some hate it. follow your baby.', link: { kind: 'shop', label: 'Easy swaddles to try', url: KYTE_SWADDLE } },
      { color: 'honey', eyebrow: 'safe sleep', title: 'Bare is\nbest.', say: 'back, firm, empty', body: 'baby on their back, on a firm flat surface, nothing else in there — every sleep, every time. it never changes.', link: { kind: 'learn', label: 'Safe-sleep basics', url: SHOP } },
      { color: 'caramel', eyebrow: 'timing', title: '45-min\nwindows.', say: 'catch the cues', body: 'newborns can only stay up ~45–60 min. yawns, red eyebrows, zoning out → put them down before the overtired cry.' },
      { color: 'rose', eyebrow: 'the sound', title: 'White\nnoise.', say: 'every sleep, not just naps', body: 'steady whooshing mimics the womb and covers the house. run it for naps and all night — one of the easiest wins.', link: { kind: 'shop', label: 'Sound machines', url: HATCH_SOUND } },
      close('keep going', 'Drowsy,\nnot asleep.', 'let her practice', "scroll for this week's sleep guide ↓"),
    ],
    checklist: { title: "This week's sleep", items: [
      { label: 'Swaddle for sleep', note: 'arms up or down — follow your baby' },
      { label: 'Always on the back, firm flat surface' },
      { label: 'Aim ~45–60 min wake windows' },
      { label: 'Put down drowsy, not fully asleep' },
      { label: 'White noise for naps too' },
      { label: 'Room-share, not bed-share', note: 'first 6 months' },
    ] },
    article: { question: 'How do I swaddle — and what if she hates it?', emoji: '🩺', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
      answer: "Lay the blanket as a diamond, fold the top corner, one arm down and wrap snug across, then the other — tight at the chest, loose at the hips. If she fights it, try arms-up or a zip sleep sack; some babies just sleep better unswaddled, and that's completely fine." },
    info: { kind: 'wakewindows', title: 'Wake windows by age', rows: [
      { age: 'Newborn', val: '45–60 min', pct: 30, now: true }, { age: '1–2 months', val: '60–90 min', pct: 48 },
      { age: '3–4 months', val: '75–120 min', pct: 68 }, { age: '5–6 months', val: '2–2.5 hrs', pct: 88 },
    ], foot: 'Awake too long → overtired → harder to settle. Put baby down at the first sleepy cue.' },
  },

  feed: {
    label: 'Feed',
    story: [
      cover('this week', 'Feed, round\nthe clock.', "8–12 feeds a day. it's relentless — and it's exactly right."),
      { color: 'rose', eyebrow: 'the latch', title: 'A deep\nlatch.', say: 'tug, not pinch', body: 'wide-open mouth, chin pressed in, more areola below than above. it should tug — not pinch. pain means break the seal and re-latch.', link: { kind: 'learn', label: 'Latch help (video)', url: SHOP } },
      { color: 'honey', eyebrow: 'bringing milk in', title: 'Colostrum\nfirst.', say: 'tiny = enough', body: 'the first days are thick golden colostrum in drops — exactly enough for her tummy. nurse or pump 8–12× a day to bring your full supply in.', link: { kind: 'learn', label: 'Pumping 101', url: SHOP } },
      { color: 'caramel', eyebrow: 'storing milk', title: 'Pitcher\nmethod.', say: "what's a storage bag?", body: "pool the day's pumped milk in one covered pitcher in the fridge, then portion into bottles — less washing. storage bags are pre-sterilized pouches you freeze flat to save room.", link: { kind: 'shop', label: 'Milk storage bags', url: MOMCOZY_BAGS } },
      close('keep going', "You're\nfeeding her.", "that's everything", "scroll for this week's feed guide ↓"),
    ],
    checklist: { title: "This week's feed", items: [
      { label: '8–12 feeds per 24 hrs' },
      { label: 'Deep latch — a tug, never a pinch' },
      { label: '6+ wet & 3+ dirty diapers', note: 'by day 5 = she’s getting enough' },
      { label: 'Burp after every feed', note: 'upright, gentle pats between the shoulders' },
      { label: 'Nurse/pump 8–12× to build supply', note: 'even small colostrum counts' },
      { label: 'Never give water', note: 'breastmilk or formula only before 6 months — water is dangerous for newborns' },
    ] },
    article: { question: 'Is she latched right — and getting enough?', emoji: '👩🏽‍⚕️', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
      answer: "A good latch tugs but doesn't pinch — wide-open mouth, chin buried in the breast. And you measure 'enough' by output, not ounces: six or more wet diapers a day by the end of week one means she's getting plenty. Count diapers, not minutes." },
    info: { kind: 'milkstorage', title: 'How long does breast milk keep?', cols: [
      { icon: 'counter', v: '4', u: 'hours', w: 'Counter' }, { icon: 'fridge', v: '4', u: 'days', w: 'Fridge' }, { icon: 'freezer', v: '6', u: 'months', w: 'Freezer' },
    ], foot: 'The easy "4-4-4" rule. Thawed milk: use within 24 hrs and never refreeze.' },
  },

  grow: {
    label: 'Grow',
    story: [
      cover('this week', 'Hello,\nworld.', 'baby sees ~8–12 inches — about your face at feeding distance.'),
      { color: 'rose', eyebrow: 'tummy time', title: 'Start\ntiny.', say: '2–3 min, a few times', body: 'even a minute chest-to-chest counts. it builds the neck and shoulders and heads off a flat spot. always awake and watched.', link: { kind: 'learn', label: 'Tummy time, day one', url: SHOP } },
      { color: 'honey', eyebrow: 'flat-head prevention', title: 'Rotate\nthe head.', say: 'switch it up', body: 'alternate which way she faces each sleep, and the arm you feed from. lots of tummy time + less time flat = a round head.' },
      { color: 'caramel', eyebrow: 'connect', title: 'Talk &\nsing.', say: 'narrate everything', body: 'your face and voice are the best toy there is. hold her close and talk through your day — this is how language begins.', link: { kind: 'shop', label: 'High-contrast cards', url: CONTRAST_CARDS } },
      close('keep going', 'Just\nbe near.', "you're their world", "scroll for this week's grow guide ↓"),
    ],
    checklist: { title: "This week's grow", items: [
      { label: 'Tummy time 2–3 min', note: 'a few times a day, awake & watched' },
      { label: 'Rotate head position each sleep', note: 'prevents flat spots' },
      { label: 'Hold baby 8–12 in from your face' },
      { label: 'Talk + sing constantly' },
      { label: 'Skin-to-skin daily' },
      { label: 'Alternate the arm you feed from' },
    ] },
    article: { question: 'When do I start tummy time — and how much?', emoji: '🤸', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
      answer: "Start day one — a minute or two lying on your chest counts. Build to a few short sessions a day, always awake and supervised. It's the single best thing you can do for neck strength and to prevent a flat spot." },
    info: { kind: 'milestones', title: "What's coming next", items: [
      { age: 'now', label: 'Focuses on faces', now: true }, { age: '~6 wks', label: 'First social smile' }, { age: '2 mo', label: 'Coos & gurgles' }, { age: '3 mo', label: 'Holds head up' },
    ], foot: "Every baby's timing is their own — these are typical ranges, not deadlines." },
  },

  care: {
    label: 'Care',
    story: [
      cover('this week', 'Sponge\nbaths only.', 'until the cord falls off — keep baby clean, dry, and supported.'),
      { color: 'rose', eyebrow: 'cord care', title: 'Keep it\ndry.', say: 'falls off in 1–3 wks', body: 'fold the diaper below the stump, let it air out, no tub baths yet. red, swollen, or smelly → call your provider.', link: { kind: 'learn', label: 'Cord care (video)', url: SHOP } },
      { color: 'honey', eyebrow: 'holding', title: 'Support\nthe head.', say: 'every pick-up', body: "her neck can't hold yet — one hand behind the head and neck, every single time, until she lifts it herself around 3–4 months.", link: { kind: 'learn', label: 'How to hold & burp', url: SHOP } },
      { color: 'caramel', eyebrow: 'diapers', title: '10+ a\nday.', say: 'change often', body: 'change every feed and when soiled to stay ahead of rash. pro tip: zip or magnetic onesies make 3am changes so much easier.', link: { kind: 'shop', label: 'Easy-change onesies', url: CARTERS_GOWN } },
      close('keep going', 'Gentle\ndoes it.', 'soft & slow', "scroll for this week's care guide ↓"),
    ],
    checklist: { title: "This week's care", items: [
      { label: 'Sponge baths only', note: 'no tub until the cord heals' },
      { label: 'Keep the cord stump dry & exposed' },
      { label: 'Support head & neck on every hold' },
      { label: 'Change diapers ~10×/day', note: 'stay ahead of rash' },
      { label: 'Rotate which way baby’s head faces', note: 'helps prevent a flat spot' },
      { label: 'Zip/magnetic onesies for night changes' },
      { label: 'Stock a diaper caddy', note: 'diapers, wipes, cream, a spare onesie' },
    ] },
    article: { question: 'How do I bathe her — and care for the cord?', emoji: '🛁', name: 'Dr. Marcus Hill, MD', role: 'pediatrician · villie expert',
      answer: "Until the cord drops off (usually 1–3 weeks), stick to sponge baths: warm room, damp cloth, wash the face and folds, pat dry. Keep the stump dry and open to air, fold the diaper below it, and let it fall off on its own. Redness, swelling, or a foul smell means call us." },
    info: { kind: 'diapercolor', title: 'Diaper decoder', cols: [
      { sw: '#2E1C0F', d: 'Day 1–2', ds: 'Black & tarry (meconium)' }, { sw: '#6E7A45', d: 'Day 3–4', ds: 'Greenish — transitioning' }, { sw: '#E3B23A', d: 'Day 5+', ds: 'Yellow & seedy — normal' },
    ], foot: 'Red, white, or chalky-grey? Snap a photo and call your provider.' },
  },
};

// ─────────────────────────────────────────────────────────────
// WEEK 0 — before baby (prep). Distinct pills + reachability TBD;
// kept here so the data exists. (Soothe removed.)
// ─────────────────────────────────────────────────────────────
const WEEK_0: Record<string, CategoryContent> = {
  hospital: {
    label: 'Hospital',
    story: [
      cover('before baby', 'Before baby\narrives.', 'the week-0 must-dos: pack the bag, install the seat, prep your kit.'),
      { color: 'rose', eyebrow: 'by week 36', title: 'Hospital\nbag.', say: 'packed & by the door', body: "have it ready weeks early — babies don't read calendars. the short list moms actually use is below.", link: { kind: 'learn', label: 'What to pack (video)', url: SHOP } },
      { color: 'honey', eyebrow: 'do it early', title: 'Car\nseat.', say: 'installed + checked', body: 'install by week 36 — most seats are put in wrong the first time. many fire stations inspect it free.', link: { kind: 'learn', label: 'Car-seat install (video)', url: SHOP } },
      { color: 'caramel', eyebrow: 'for you, mama', title: 'Postpartum\nkit.', say: 'recovery at home', body: 'pads, peri bottle, witch-hazel, comfy high-waist undies, stool softener — set up your recovery before you need it.', link: { kind: 'shop', label: 'Postpartum recovery kit', url: FRIDA_POSTPARTUM } },
      close('ready', "You're set,\nmama.", 'deep breath', 'scroll for the full prep list ↓'),
    ],
    checklist: { title: 'Hospital bag & go-home', items: [
      { label: 'Robe + 2 nursing bras' }, { label: 'Going-home outfit', note: "loose, comfy — you'll still look pregnant" },
      { label: 'Toiletries + lip balm' }, { label: 'Long phone charger', note: 'hospital outlets are never close' },
      { label: 'Snacks + refillable water' }, { label: "Baby's coming-home outfit + hat" },
      { label: 'Car seat — installed & inspected', note: 'by week 36' }, { label: 'Insurance card + photo ID' },
      { label: 'Postpartum kit for home', note: 'pads, peri bottle, witch-hazel, stool softener' },
    ] },
    article: { question: 'When do I install the car seat?', emoji: '🚗', name: 'Officer Maya Cole', role: 'certified car-seat technician',
      answer: 'Install and get your seat checked by week 36 — most are installed wrong the first time, and many fire stations and hospitals inspect them free. Do it before discharge, not in the parking lot.' },
  },

  sleep: {
    label: 'Sleep',
    story: [
      cover('before baby', 'Sleep,\nready.', "the safe-sleep setup, before baby's first night."),
      { color: 'rose', eyebrow: 'safest is simple', title: 'Bare is\nbest.', say: 'firm, flat, empty', body: 'a breathable mattress, a fitted sheet, and nothing else in the crib or bassinet.', link: { kind: 'learn', label: 'Safe sleep 101', url: SHOP } },
      { color: 'honey', eyebrow: "you'll want these", title: 'Swaddles\n×3–5.', say: "what's a swaddle?", body: "snug wraps that calm the startle reflex and stretch sleep. get a few — newborns blow through them.", link: { kind: 'shop', label: 'Starter swaddles', url: KYTE_SWADDLE } },
      { color: 'caramel', eyebrow: 'peace of mind', title: 'White noise\n+ monitor.', say: 'rest, too', body: 'steady white noise mimics the womb; a monitor lets you actually sleep when baby does.', link: { kind: 'shop', label: 'Sound machines', url: HATCH_SOUND } },
      close('ready', 'Rest\neasy.', "nursery's ready", 'scroll for the full sleep list ↓'),
    ],
    checklist: { title: 'Sleep setup', items: [
      { label: 'Bassinet or crib + breathable mattress' }, { label: '2–3 fitted sheets' }, { label: '3–5 swaddles' },
      { label: 'White noise machine' }, { label: 'Baby monitor / camera' }, { label: 'Blackout curtains' },
    ] },
    article: { question: "What's actually safe in the crib?", emoji: '🩺', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
      answer: 'For the first year: baby alone, on their back, on a firm flat surface — no bumpers, blankets, pillows, or stuffed animals. A sleep sack instead of a loose blanket once they outgrow the swaddle.' },
  },

  feed: {
    label: 'Feed',
    story: [
      cover('before baby', 'Feed,\nprepped.', 'ready for breast, bottle, or both — whatever happens.'),
      { color: 'rose', eyebrow: 'even if nursing', title: 'Have bottles\nready.', say: 'plans change', body: 'latch trouble, low supply, a NICU stay — a few bottles mean a hard night never becomes an emergency.', link: { kind: 'shop', label: 'Starter bottles', url: SHOP } },
      { color: 'honey', eyebrow: 'bring milk in', title: 'Pump +\npads.', say: 'colostrum first', body: 'a pump helps establish supply (8–12×/day); leak pads save every shirt once your milk comes in.', link: { kind: 'shop', label: 'Pump + leak pads', url: SHOP } },
      { color: 'caramel', eyebrow: 'storing milk', title: 'Storage\nbags.', say: 'even if you don’t overproduce', body: "pre-sterilized pouches that freeze flat — handy for any pumped milk, not just a big stash. pair with the pitcher method.", link: { kind: 'shop', label: 'Milk storage bags', url: MOMCOZY_BAGS } },
      close('ready', 'Ready\neither way.', "you've got options", 'scroll for the full feed list ↓'),
    ],
    checklist: { title: 'Feed setup', items: [
      { label: '3–4 bottles', note: 'wide neck, slow-flow nipple' }, { label: 'Bottle brush + drying rack' }, { label: 'Bottle washer / sterilizer' },
      { label: 'Breast pump', note: 'check your insurance first — often free' }, { label: 'Milk storage bags' }, { label: 'Nursing / leak pads', note: 'washable + disposable' },
      { label: 'Burp cloths ×10' }, { label: 'Nursing pillow' }, { label: 'Small pack of formula', note: 'just in case' },
    ] },
    article: { question: 'How often should I pump to bring milk in?', emoji: '👩🏽‍⚕️', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
      answer: 'In the early days, empty the breast 8–12 times in 24 hours — that frequency is the signal that builds your supply. Those first drops are colostrum; tiny amounts are exactly right. Have storage bags ready for whatever you pump.' },
  },

  care: {
    label: 'Care',
    story: [
      cover('before baby', 'Care,\nset up.', 'bath station, diaper caddy, gentle everything.'),
      { color: 'rose', eyebrow: 'bath night', title: 'Tub +\ntowels.', say: 'two hooded towels', body: 'a contoured newborn tub and soft hooded towels make first baths calm, not chaos.', link: { kind: 'shop', label: 'Newborn bath set', url: SHOP } },
      { color: 'honey', eyebrow: 'night changes', title: 'Easy\nonesies.', say: 'zip or open-bottom', body: "skip the over-the-head snaps — zip or magnetic onesies and open-bottom gowns make 3am diaper changes painless.", link: { kind: 'shop', label: 'Easy-change onesies', url: CARTERS_GOWN } },
      { color: 'caramel', eyebrow: 'stock the caddy', title: 'Diaper\ncaddy.', say: 'one on each floor', body: 'diapers, wipes, cream, a spare onesie, burp cloth — a stocked caddy means you never get caught mid-blowout.', link: { kind: 'shop', label: 'Diaper caddy essentials', url: SHOP } },
      close('ready', 'All\nset.', "nursery's clean", 'scroll for the full care list ↓'),
    ],
    checklist: { title: 'Care & bath setup', items: [
      { label: 'Baby bathtub + 2 hooded towels' }, { label: 'Fragrance-free baby wash + lotion' }, { label: 'Free & clear laundry detergent', note: 'wash everything before baby comes home' },
      { label: 'Nail file + clippers' }, { label: 'Digital thermometer' }, { label: 'Diapers', note: 'newborn + size 1' },
      { label: 'Wipes + diaper cream' }, { label: 'Easy-change onesies', note: 'zip / magnetic / open-bottom' }, { label: 'Diaper caddy', note: 'stocked, one per floor' },
    ] },
    article: { question: 'What makes night diaper changes easier?', emoji: '🧴', name: 'Dr. Lena Ortiz', role: 'pediatric dermatologist',
      answer: 'Choose zip, magnetic, or open-bottom onesies so you never have to pull anything over a sleepy baby’s head, and keep a fully stocked diaper caddy within arm’s reach. And wash everything that touches baby in a fragrance- and dye-free detergent first.' },
  },
};

const WEEKS: Record<number, Record<string, CategoryContent>> = { 0: WEEK_0, 1: WEEK_1 };

/**
 * Resolve the Manual content for a given week + category. Falls back to the
 * nearest seeded week (Week 1 is the canonical baseline), then to Week 1's
 * version of the category, so the app's chips always render something.
 */
export function getManualContent(week: number, category: string): CategoryContent | null {
  const w = WEEKS[week] ?? WEEKS[1];
  return w?.[category] ?? WEEK_1[category] ?? WEEK_0[category] ?? null;
}

/*
LINKS TO WIRE (send me the brand/affiliate URL for each; I'll swap the per-link `url`):
  WEEK 1
    sleep  · "Easy swaddles to try"      (swaddle brand)
    sleep  · "Safe-sleep basics"         (guide/video)
    feed   · "Latch help (video)"        (guide/video)
    feed   · "Pumping 101"               (guide/video)
    feed   · "Milk storage bags"         (storage-bag brand)
    grow   · "Tummy time, day one"       (guide/video)
    grow   · "High-contrast cards"       (brand)
    care   · "Cord care (video)"         (guide/video)
    care   · "How to hold & burp"        (guide/video)
    care   · "Easy-change onesies"       (onesie brand — zip/magnetic)
  WEEK 0
    hospital · "What to pack (video)", "Car-seat install (video)", "Postpartum recovery kit"
    sleep    · "Safe sleep 101", "Starter swaddles", "Sleep essentials"
    feed     · "Starter bottles", "Pump + leak pads", "Milk storage bags"
    care     · "Newborn bath set", "Easy-change onesies", "Diaper caddy essentials"
*/
