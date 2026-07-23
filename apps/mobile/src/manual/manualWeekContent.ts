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

import { WEEKS_ES } from './manualWeekContent.es';

export type CardColor = 'ink' | 'rose' | 'honey' | 'caramel' | 'blush';
export type StoryLink = { kind: 'shop' | 'learn'; label: string; url: string };
// "things that help" = the honest picks/tips lane, split OUT of the story deck so
// education (story cards) never mixes with commerce (product links). Populated
// either explicitly per-week, or derived at resolve time from the story cards'
// `shop` links (see splitHelps). FTC disclosure is rendered on the helps card.
export type HelpPick = { tag?: string; label: string; url: string };
export type Helps = { tips?: string[]; picks: HelpPick[] };
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
  articles: Article[];   // swipeable expert cards (3–4 per chapter)
  info?: Info;
  helps?: Helps;         // "things that help" — tips + product picks (derived if absent)
  specialistQs?: string[];
// "Ask your specialist — bring these three"
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

const cover = (eyebrow: string, title: string, say: string, body: string): StoryCard => ({ color: 'blush', eyebrow, title, say, body });
const close = (eyebrow: string, title: string, say: string, body: string): StoryCard => ({ color: 'blush', eyebrow, title, say, body });

// ─────────────────────────────────────────────────────────────
// WEEK 1 — sleep / feed / grow / care  (the postpartum baseline)
// ─────────────────────────────────────────────────────────────
const WEEK_1: Record<string, CategoryContent> = {
  sleep: {
    label: 'Sleep',
    story: [
      cover('this week', 'Sleep is\nsurvival.', 'breathe, mama', "no schedule yet — and that's exactly right. here's what actually helps."),
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
    articles: [
      { question: 'How do I swaddle — and what if she hates it?', emoji: '🩺', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
        answer: "Lay the blanket as a diamond, fold the top corner, one arm down and wrap snug across, then the other — tight at the chest, loose at the hips. If she fights it, try arms-up or a zip sleep sack; some babies just sleep better unswaddled, and that's completely fine." },
      { question: "Why won't she sleep unless I'm holding her?", emoji: '🌙', name: 'Renee Voss', role: 'pediatric sleep consultant · villie expert',
        answer: "Newborns are wired for closeness — your heartbeat and warmth literally regulate hers. Contact naps now don't create bad habits. Once feeding's established you can start setting her down drowsy-but-awake to practice; until then, hold away." },
      { question: 'Is it safe for her to sleep this much?', emoji: '🩺', name: 'Dr. Marcus Hill, MD', role: 'pediatrician · villie expert',
        answer: "Yes — 14–17 hours a day in short 2–4 hour stretches is exactly right. Until she's back to birth weight, wake her to feed if she goes past 4 hours; after that, let her lead." },
    ],
    info: { kind: 'wakewindows', title: 'Wake windows by age', rows: [
      { age: 'Newborn', val: '45–60 min', pct: 30, now: true }, { age: '1–2 months', val: '60–90 min', pct: 48 },
      { age: '3–4 months', val: '75–120 min', pct: 68 }, { age: '5–6 months', val: '2–2.5 hrs', pct: 88 },
    ], foot: 'Awake too long → overtired → harder to settle. Put baby down at the first sleepy cue.' },
  },

  feed: {
    label: 'Feed',
    story: [
      cover('this week', 'Feed, round\nthe clock.', "you're enough", "8–12 feeds a day. it's relentless — and it's exactly right."),
      { color: 'rose', eyebrow: 'the latch', title: 'A deep\nlatch.', say: 'tug, not pinch', body: 'wide-open mouth, chin pressed in, more areola below than above. it should tug — not pinch. pain means break the seal and re-latch.', link: { kind: 'learn', label: 'Latch help (video)', url: SHOP } },
      { color: 'honey', eyebrow: 'bringing milk in', title: 'Colostrum\nfirst.', say: 'tiny = enough', body: 'the first days are thick golden colostrum in drops — exactly enough for her tummy. nurse or pump 8–12× a day to bring your full supply in.', link: { kind: 'learn', label: 'Pumping 101', url: SHOP } },
      { color: 'caramel', eyebrow: 'storing milk', title: 'Pitcher\nmethod.', say: "what's a storage bag?", body: "pool the day's pumped milk in one covered pitcher in the fridge, then portion into bottles — less washing. storage bags are pre-sterilized pouches you freeze flat to save room.", link: { kind: 'shop', label: 'Milk storage bags', url: MOMCOZY_BAGS } },
      { color: 'rose', eyebrow: 'if formula or combo', title: 'Safe formula,\nstep by step.', say: 'clean + exact', body: 'clean hands and surfaces, follow the water-to-powder ratio exactly, and use a made bottle within an hour. never microwave — hot spots can burn her mouth.', link: { kind: 'learn', label: 'Safe formula prep', url: SHOP } },
      { color: 'honey', eyebrow: 'first use + daily', title: 'Sterilize,\nthen wash.', say: 'boil or sterilizer', body: 'sterilize bottles, nipples, and pump parts before the very first use. after that, hot soapy water or the dishwasher after each feed is enough.', link: { kind: 'learn', label: 'Sterilizing 101', url: SHOP } },
      { color: 'caramel', eyebrow: 'finding "the one"', title: 'Try a few\nbottles.', say: 'babies have opinions', body: 'start with one or two wide-neck, slow-flow bottles — a try-it kit lets you test a few shapes before committing to a whole set.', link: { kind: 'shop', label: 'Bottle try-it kit', url: SHOP } },
      close('keep going', "You're\nfeeding her.", "that's everything", "scroll for this week's feed guide ↓"),
    ],
    checklist: { title: "This week's feed", items: [
      { label: '8–12 feeds per 24 hrs' },
      { label: 'Deep latch — a tug, never a pinch' },
      { label: '6+ wet & 3+ dirty diapers', note: 'by day 5 = she’s getting enough' },
      { label: 'Burp after every feed', note: 'upright, gentle pats between the shoulders' },
      { label: 'Nurse/pump 8–12× to build supply', note: 'even small colostrum counts' },
      { label: 'Sterilize bottles + pump parts before first use' },
      { label: 'Formula: exact ratio, use within the hour, never microwave' },
      { label: 'Never give water', note: 'breastmilk or formula only before 6 months — water is dangerous for newborns' },
    ] },
    articles: [
      { question: 'Is she latched right — and getting enough?', emoji: '👩🏽‍⚕️', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
        answer: "A good latch tugs but doesn't pinch — wide-open mouth, chin buried in the breast. And you measure 'enough' by output, not ounces: six or more wet diapers a day by the end of week one means she's getting plenty. Count diapers, not minutes." },
      { question: 'My nipples are cracked — what do I do?', emoji: '🤱', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
        answer: "Cracking almost always traces back to a shallow latch — get the mouth wider with more areola in. A little lanolin or your own expressed milk heals them between feeds. If it's bleeding or getting worse, see a lactation consultant — it's fixable." },
      { question: 'How do I know it’s a growth spurt?', emoji: '🩺', name: 'Dr. Marcus Hill, MD', role: 'pediatrician · villie expert',
        answer: "Sudden round-the-clock feeding for a day or two — often around weeks 2–3 and again at 6 — is a growth spurt, not low supply. Feed on demand; your body catches up within about 48 hours." },
    ],
    info: { kind: 'milkstorage', title: 'How long does breast milk keep?', cols: [
      { icon: 'counter', v: '4', u: 'hours', w: 'Counter' }, { icon: 'fridge', v: '4', u: 'days', w: 'Fridge' }, { icon: 'freezer', v: '6', u: 'months', w: 'Freezer' },
    ], foot: 'The easy "4-4-4" rule. Thawed milk: use within 24 hrs and never refreeze.' },
  },

  grow: {
    label: 'Grow',
    story: [
      cover('this week', 'Hello,\nworld.', 'hi, little one', 'baby sees ~8–12 inches — about your face at feeding distance.'),
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
    articles: [
      { question: 'When do I start tummy time — and how much?', emoji: '🤸', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
        answer: "Start day one — a minute or two lying on your chest counts. Build to a few short sessions a day, always awake and supervised. It's the single best thing you can do for neck strength and to prevent a flat spot." },
      { question: 'Should she be smiling at me yet?', emoji: '👶', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
        answer: "The first real social smile usually lands around 6 weeks. Before that, those little grins are reflexes (often in sleep). Keep getting close and talking face-to-face — that's exactly what coaxes the real one out." },
      { question: 'How much should I worry about milestones?', emoji: '📈', name: 'Dr. Lena Ortiz', role: 'pediatrician · villie expert',
        answer: "Milestones are ranges, not deadlines. If she's feeding, alert, and growing, small timing differences are normal. Trust your gut — bring any specific worry to your well-visit rather than carrying it alone." },
    ],
    info: { kind: 'milestones', title: "What's coming next", items: [
      { age: 'now', label: 'Focuses on faces', now: true }, { age: '~6 wks', label: 'First social smile' }, { age: '2 mo', label: 'Coos & gurgles' }, { age: '3 mo', label: 'Holds head up' },
    ], foot: "Every baby's timing is their own — these are typical ranges, not deadlines." },
  },

  care: {
    label: 'Care',
    story: [
      cover('this week', 'Sponge\nbaths only.', 'gentle is the goal', 'until the cord falls off — keep baby clean, dry, and supported.'),
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
    articles: [
      { question: 'How do I bathe her — and care for the cord?', emoji: '🛁', name: 'Dr. Marcus Hill, MD', role: 'pediatrician · villie expert',
        answer: "Until the cord drops off (usually 1–3 weeks), stick to sponge baths: warm room, damp cloth, wash the face and folds, pat dry. Keep the stump dry and open to air, fold the diaper below it, and let it fall off on its own. Redness, swelling, or a foul smell means call us." },
      { question: 'What counts as a fever I should call about?', emoji: '🌡️', name: 'Dr. Marcus Hill, MD', role: 'pediatrician · villie expert',
        answer: "Under 3 months, a rectal temperature of 100.4°F (38°C) or higher is an automatic call — any hour, day or night. And don't give a newborn fever medicine before you talk to us." },
      { question: 'Her skin is peeling and blotchy — normal?', emoji: '🧴', name: 'Dr. Lena Ortiz', role: 'pediatric dermatologist · villie expert',
        answer: "Both are normal in the early weeks — that outer layer sheds, and come-and-go red splotches (newborn rash) settle on their own. Keep everything fragrance-free. Call if there's pus, blistering, or it spreads fast." },
    ],
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
      cover('before baby', 'Before baby\narrives.', 'almost time', 'the week-0 must-dos: pack the bag, install the seat, prep your kit.'),
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
    articles: [
      { question: 'When do I install the car seat?', emoji: '🚗', name: 'Officer Maya Cole', role: 'certified car-seat technician',
        answer: 'Install and get your seat checked by week 36 — most are installed wrong the first time, and many fire stations and hospitals inspect them free. Do it before discharge, not in the parking lot.' },
      { question: 'What do I actually need in my bag?', emoji: '🎒', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
        answer: "Less than you think: ID + insurance card, a going-home outfit for each of you, phone charger, toiletries, and snacks. The hospital supplies most baby basics for the stay — don't overpack." },
      { question: 'How do I know it’s real labor?', emoji: '🩺', name: 'Dr. Marcus Hill, MD', role: 'OB/GYN · villie expert',
        answer: "Real contractions get longer, stronger, and closer together and don't ease when you move. The 5-1-1 rule is your cue to call: about 5 minutes apart, 1 minute long, holding for 1 hour." },
    ],
  },

  sleep: {
    label: 'Sleep',
    story: [
      cover('before baby', 'Sleep,\nready.', 'nest it out', "the safe-sleep setup, before baby's first night."),
      { color: 'rose', eyebrow: 'safest is simple', title: 'Bare is\nbest.', say: 'firm, flat, empty', body: 'a breathable mattress, a fitted sheet, and nothing else in the crib or bassinet.', link: { kind: 'learn', label: 'Safe sleep 101', url: SHOP } },
      { color: 'honey', eyebrow: "you'll want these", title: 'Swaddles\n×3–5.', say: "what's a swaddle?", body: "snug wraps that calm the startle reflex and stretch sleep. get a few — newborns blow through them.", link: { kind: 'shop', label: 'Starter swaddles', url: KYTE_SWADDLE } },
      { color: 'caramel', eyebrow: 'peace of mind', title: 'White noise\n+ monitor.', say: 'rest, too', body: 'steady white noise mimics the womb; a monitor lets you actually sleep when baby does.', link: { kind: 'shop', label: 'Sound machines', url: HATCH_SOUND } },
      close('ready', 'Rest\neasy.', "nursery's ready", 'scroll for the full sleep list ↓'),
    ],
    checklist: { title: 'Sleep setup', items: [
      { label: 'Bassinet or crib + breathable mattress' }, { label: '2–3 fitted sheets' }, { label: '3–5 swaddles' },
      { label: 'White noise machine' }, { label: 'Baby monitor / camera' }, { label: 'Blackout curtains' },
    ] },
    articles: [
      { question: "What's actually safe in the crib?", emoji: '🩺', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
        answer: 'For the first year: baby alone, on their back, on a firm flat surface — no bumpers, blankets, pillows, or stuffed animals. A sleep sack instead of a loose blanket once they outgrow the swaddle.' },
      { question: 'Bassinet or crib to start?', emoji: '🌙', name: 'Dr. Priya Nair, MD', role: 'pediatrician · villie expert',
        answer: "Either is safe with a firm flat mattress and a fitted sheet only. A bassinet beside your bed for the first few months makes night feeds easier and supports the recommended room-sharing." },
      { question: 'How many swaddles do I really need?', emoji: '🧺', name: 'Renee Voss', role: 'pediatric sleep consultant · villie expert',
        answer: "Three to five — they get spit up on and blown through constantly. A couple of zip-up swaddle sacks are far easier than wrapping a blanket at 3am." },
    ],
  },

  feed: {
    label: 'Feed',
    story: [
      cover('before baby', 'Feed,\nprepped.', 'be ready', 'ready for breast, bottle, or both — whatever happens.'),
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
    articles: [
      { question: 'How often should I pump to bring milk in?', emoji: '👩🏽‍⚕️', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
        answer: 'In the early days, empty the breast 8–12 times in 24 hours — that frequency is the signal that builds your supply. Those first drops are colostrum; tiny amounts are exactly right. Have storage bags ready for whatever you pump.' },
      { question: 'What bottles should I buy if I want to nurse?', emoji: '🍼', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
        answer: "Wide-neck, slow-flow nipples that mimic the breast make moving back and forth easier. Don't overbuy one brand — babies have opinions. Start with one or two and see what she takes." },
      { question: 'Do I need a pump before baby arrives?', emoji: '🩺', name: 'Dr. Lena Ortiz', role: 'pediatrician · villie expert',
        answer: "Have one in the house — most insurance plans cover it free. You may not need it day one, but if your milk comes in hard or baby needs a NICU stay, you'll be glad it's ready." },
    ],
  },

  care: {
    label: 'Care',
    story: [
      cover('before baby', 'Care,\nset up.', 'set the scene', 'bath station, diaper caddy, gentle everything.'),
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
    articles: [
      { question: 'What makes night diaper changes easier?', emoji: '🧴', name: 'Dr. Lena Ortiz', role: 'pediatric dermatologist · villie expert',
        answer: 'Choose zip, magnetic, or open-bottom onesies so you never have to pull anything over a sleepy baby’s head, and keep a fully stocked diaper caddy within arm’s reach. And wash everything that touches baby in a fragrance- and dye-free detergent first.' },
      { question: 'How do I set up a bath station?', emoji: '🛁', name: 'Dr. Lena Ortiz', role: 'pediatric dermatologist · villie expert',
        answer: "A contoured newborn tub, two hooded towels, fragrance-free wash, and a soft cup for rinsing — all within reach before you start. Sponge baths only until the cord falls off." },
      { question: "What's the one thing new parents forget?", emoji: '💡', name: 'Dana Reyes, IBCLC', role: 'lactation consultant · villie expert',
        answer: "A stocked diaper caddy on every floor you use, plus easy-open onesies. At 3am you want everything within arm's reach and nothing that has to go over the head." },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// WEEK 2 — day/night flip · cluster feeds · the cord falls
// ─────────────────────────────────────────────────────────────
const WEEK_2: Record<string, CategoryContent> = {
  sleep: {
    label: 'Sleep',
    story: [
      cover('week 2', 'Day & night,\nflipped.', 'it evens out', "newborns mix up day and night — you can gently teach the difference."),
      { color: 'rose', eyebrow: 'daytime', title: 'Bright &\nchatty.', say: 'days are for living', body: 'keep daytime feeds light and talkative, curtains open, normal house noise. that contrast is how the clock resets.' },
      { color: 'honey', eyebrow: 'nighttime', title: 'Dark &\nboring.', say: 'nights are for sleep', body: 'night feeds: dim light, no talking, straight back down. dull and quiet teaches "this is sleep time."' },
      { color: 'caramel', eyebrow: 'still true', title: 'Watch the\nwindow.', say: '45–60 min, max', body: 'an overtired newborn fights sleep harder. put her down at the first yawn or zone-out — sooner than feels right.' },
      close('keep going', "It's not\nforever.", 'promise', "scroll for this week's sleep guide ↓"),
    ],
    checklist: { title: "This week's sleep", items: [
      { label: 'Daytime feeds: bright, chatty, curtains open' },
      { label: 'Night feeds: dim, quiet, straight back down' },
      { label: 'Still ~45–60 min wake windows' },
      { label: 'Swaddle + white noise every sleep' },
      { label: 'Contact naps are fine', note: "they don't spoil her" },
    ] },
    articles: [],
    info: { kind: 'fives', title: 'Reset day & night', items: [
      'Wake her for daytime feeds; let her wake you at night',
      'Daylight + gentle activity by day',
      'Dim, silent, no eye contact at night',
      'Same short wind-down cue each evening',
      'Be patient — it clicks by ~6–8 weeks',
    ], foot: 'A newborn’s body clock is still forming — gentle contrast nudges it along.' },
  },
  feed: {
    label: 'Feed',
    story: [
      cover('week 2', 'Cluster\nfeeds.', "you're not empty", "evenings of near-constant nursing are normal — it's a growth spurt, not low supply."),
      { color: 'rose', eyebrow: 'the spurt', title: 'Feed on\ndemand.', say: 'supply catches up', body: 'around weeks 2–3 she may feed every hour for a day or two. your body restocks within ~48 hours. just follow her lead.' },
      { color: 'honey', eyebrow: 'output > ounces', title: 'Count\ndiapers.', say: '6+ wet a day', body: "you can't see ounces, but diapers tell the story: 6+ wet and 3+ dirty a day means she's getting plenty." },
      { color: 'caramel', eyebrow: 'for you', title: 'Eat &\ndrink.', say: 'at every feed', body: 'keep water and a snack where you nurse. cluster feeding burns through you — fuel is not optional.' },
      close('keep going', "You're\nenough.", 'truly', "scroll for this week's feed guide ↓"),
    ],
    checklist: { title: "This week's feed", items: [
      { label: 'Feed on demand — expect a growth spurt' },
      { label: '6+ wet & 3+ dirty diapers a day' },
      { label: 'Water + snack at every feed' },
      { label: 'Burp between sides & after' },
      { label: 'Evening cluster feeding is normal', note: 'not low supply' },
    ] },
    articles: [],
    info: { kind: 'fives', title: 'Growth-spurt survival', items: [
      'It usually lasts ~24–48 hours',
      'Feed every time she asks',
      'Your supply catches up fast',
      'Cluster feeds bunch in the evening',
      'Tag someone in for one bottle if you can',
    ], foot: 'A growth spurt is your baby ordering more milk — answering the orders is what makes more.' },
  },
  grow: {
    label: 'Grow',
    story: [
      cover('week 2', 'Wide-eyed\nwindows.', 'hi in there', "alert stretches are getting longer — short, calm play is perfect now."),
      { color: 'rose', eyebrow: 'tummy time', title: 'Keep it\nup.', say: 'a few min, often', body: 'still 2–3 minutes, several times a day. chest-to-chest counts. she may turn her head side to side now.' },
      { color: 'honey', eyebrow: 'her view', title: 'High\ncontrast.', say: 'black, white, red', body: 'newborn eyes love bold contrast and your face at ~8–12 inches. move slowly side-to-side and she may track it.' },
      { color: 'caramel', eyebrow: 'reflexes', title: 'The\nstartle.', say: "it's normal", body: 'arms fling out at noises or a sense of falling — the Moro reflex. swaddling tames it; it fades by ~3–4 months.' },
      close('keep going', 'Just\nbe close.', "that's the work", "scroll for this week's grow guide ↓"),
    ],
    checklist: { title: "This week's grow", items: [
      { label: 'Tummy time 2–3 min, several times' },
      { label: 'Hold 8–12 in from your face' },
      { label: 'Slow side-to-side for tracking' },
      { label: 'Narrate your day out loud' },
      { label: 'Skin-to-skin daily' },
    ] },
    articles: [],
    info: { kind: 'milestones', title: "What's coming next", items: [
      { age: 'now', label: 'Tracks a face side-to-side', now: true }, { age: '~6 wks', label: 'First social smile' },
      { age: '2 mo', label: 'Coos & gurgles' }, { age: '3 mo', label: 'Pushes up in tummy time' },
    ], foot: 'Ranges, not deadlines — bring any worry to the well-visit.' },
  },
  care: {
    label: 'Care',
    story: [
      cover('week 2', 'The cord\nfalls.', 'almost healed', "the stump usually drops off this week — keep it dry until it does."),
      { color: 'rose', eyebrow: 'cord', title: 'Dry &\nopen.', say: 'falls off 1–3 wks', body: 'fold the diaper below it, no tub baths yet. a little dried blood when it falls is normal. red, swollen, or smelly → call.' },
      { color: 'honey', eyebrow: 'watch for', title: 'Jaundice\ncheck.', say: 'skin & eyes', body: 'a yellow tint to skin or the whites of the eyes can show in week one and linger. if it spreads or she’s hard to wake, call your provider.' },
      { color: 'caramel', eyebrow: 'first visit', title: 'Well\nbaby.', say: 'weigh-in time', body: "the first pediatrician visit is around now — they'll check weight, jaundice, and feeding. bring your diaper count." },
      close('keep going', "You've got\nthis.", 'soft & slow', "scroll for this week's care guide ↓"),
    ],
    checklist: { title: "This week's care", items: [
      { label: 'Keep the cord stump dry & open' },
      { label: 'Sponge baths only until it heals' },
      { label: 'Watch for yellowing skin or eyes', note: 'call if it spreads' },
      { label: 'Make/keep the first pediatrician visit' },
      { label: 'Change ~10 diapers a day' },
    ] },
    articles: [],
    info: { kind: 'fives', title: 'Call your provider if…', items: [
      'Rectal temp 100.4°F (38°C) or higher',
      'Far fewer wet diapers / hard to wake',
      'Skin or the whites of the eyes look yellow',
      'Cord is red, swollen, or smelly',
      "She's truly inconsolable",
    ], foot: 'Under 3 months, a fever of 100.4°F is always an immediate call — any hour, and no fever meds first.' },
  },
};

// ─────────────────────────────────────────────────────────────
// WEEK 3 — witching hour · gas & a second spurt · skin stuff
// ─────────────────────────────────────────────────────────────
const WEEK_3: Record<string, CategoryContent> = {
  sleep: {
    label: 'Sleep',
    story: [
      cover('week 3', 'The witching\nhour.', 'it peaks, then fades', "late-day fussiness is classic around now — it's a brand-new nervous system, not you."),
      { color: 'rose', eyebrow: 'why', title: 'Over-\nstimulated.', say: 'wind it down', body: 'by evening a newborn is maxed out. dim the lights, drop your voice, fewer hands — less input, not more.' },
      { color: 'honey', eyebrow: 'the ladder', title: 'Calm,\nin steps.', say: 'swaddle → shush → sway', body: 'snug swaddle, side-hold with a steady shush, slow sway. add skin-to-skin if it keeps climbing.' },
      { color: 'caramel', eyebrow: 'still true', title: 'Catch it\nearly.', say: 'before the meltdown', body: 'an overtired baby fights sleep hardest at night. an earlier wind-down beats a later one.' },
      close('keep going', "You're co-\nregulating.", "that's the job", "scroll for this week's sleep guide ↓"),
    ],
    checklist: { title: "This week's sleep", items: [
      { label: 'Dim, quiet evenings — less input' },
      { label: 'Run the calm-down ladder', note: 'swaddle → shush → sway → skin' },
      { label: 'Earlier wind-down on fussy days' },
      { label: 'Tag-team the witching hour if you can' },
      { label: 'White noise + swaddle every sleep' },
    ] },
    articles: [],
    info: { kind: 'fives', title: 'Calm-down ladder', items: [
      'Swaddle snug, arms tucked in',
      'Side or tummy hold (awake, in your arms)',
      'Steady "shhh" close to the ear',
      'Slow sway or gentle bounce',
      'Skin-to-skin if it keeps climbing',
    ], foot: 'Evening fussiness peaks around 6 weeks and eases after — you’re soothing, not failing.' },
  },
  feed: {
    label: 'Feed',
    story: [
      cover('week 3', 'Another\nspurt.', 'keep going', "a second growth spurt often lands now — more feeds, more cluster, same reassurance."),
      { color: 'rose', eyebrow: 'gas', title: 'Burp &\nbicycle.', say: 'trapped air hurts', body: 'burp upright after every feed; bicycle her legs and do awake tummy time to move gas. a lot of fuss is just a bubble.' },
      { color: 'honey', eyebrow: 'fore & hind', title: 'Drain one\nside.', say: 'before you switch', body: 'let her finish the first breast so she gets the richer hindmilk, then offer the second. it helps with gas and gain.' },
      { color: 'caramel', eyebrow: 'you', title: 'Protect\nyour supply.', say: 'rest + fluids', body: 'supply is still settling. frequent feeds, fluids, and rest do more than any tea or supplement.' },
      close('keep going', 'Still\nenough.', 'always', "scroll for this week's feed guide ↓"),
    ],
    checklist: { title: "This week's feed", items: [
      { label: 'Feed on demand — likely another spurt' },
      { label: 'Drain one side before offering the other' },
      { label: 'Burp upright after every feed' },
      { label: 'Bicycle legs / awake tummy time for gas' },
      { label: '6+ wet & 3+ dirty diapers a day' },
    ] },
    articles: [],
    info: { kind: 'fives', title: 'Easing newborn gas', items: [
      'Burp upright, mid-feed and after',
      'Bicycle the legs',
      'Awake, supervised tummy time',
      'Paced bottle if bottle-feeding',
      'Check the latch for swallowed air',
    ], foot: 'Some gas and grunting is normal. Blood in stool, projectile vomiting, or no wet diapers → call.' },
  },
  grow: {
    label: 'Grow',
    story: [
      cover('week 3', 'Almost\na smile.', 'any day now', "those sleepy grins are still reflexes — the real social smile is just weeks away."),
      { color: 'rose', eyebrow: 'talk', title: 'Face\ntime.', say: 'pause for a reply', body: 'get close, talk, and leave a little gap where her "answer" will go. that back-and-forth builds her first sounds.' },
      { color: 'honey', eyebrow: 'tummy time', title: 'Stronger\nneck.', say: 'short & often', body: 'she may lift and turn her head briefly now. a rolled towel under the chest can help. keep it short and watched.' },
      { color: 'caramel', eyebrow: 'senses', title: 'Sing &\nsway.', say: 'rhythm soothes', body: 'music, gentle movement, and your voice all build her brain — and calm you both.' },
      close('keep going', 'Connection\nis growth.', "you're it", "scroll for this week's grow guide ↓"),
    ],
    checklist: { title: "This week's grow", items: [
      { label: 'Face-to-face talk with pauses' },
      { label: 'Tummy time, slightly longer' },
      { label: 'Sing + sway daily' },
      { label: 'High-contrast images at 8–12 in' },
      { label: 'Skin-to-skin' },
    ] },
    articles: [],
    info: { kind: 'milestones', title: "What's coming next", items: [
      { age: 'now', label: 'Reflex smiles, longer alert windows', now: true }, { age: '~6 wks', label: 'First social smile' },
      { age: '2 mo', label: 'Coos back at you' }, { age: '3 mo', label: 'Holds head steady' },
    ], foot: 'Every baby’s timing is their own.' },
  },
  care: {
    label: 'Care',
    story: [
      cover('week 3', 'Skin\nstuff.', 'it passes', "peeling, baby acne, cradle cap — the early-weeks skin parade is almost all normal."),
      { color: 'rose', eyebrow: 'baby acne', title: 'Leave it\nalone.', say: 'no scrubbing', body: 'little red bumps on the cheeks come and go on their own. just water — no lotions or treatments. it clears by ~6 weeks.' },
      { color: 'honey', eyebrow: 'cradle cap', title: 'Flaky\nscalp.', say: 'gentle wins', body: "soften with a little baby oil, comb gently, wash out. don't pick. it's harmless — just cosmetic." },
      { color: 'caramel', eyebrow: 'nails', title: 'Tiny\nnails.', say: "file, don't cut", body: 'newborn nails grow fast and scratch. file them, or trim while she sleeps. mittens for the scratchy days.' },
      close('keep going', 'Fragrance-\nfree.', 'keep it simple', "scroll for this week's care guide ↓"),
    ],
    checklist: { title: "This week's care", items: [
      { label: 'Leave baby acne alone — water only' },
      { label: "Soften + comb cradle cap, don't pick" },
      { label: 'File or trim nails', note: 'easiest while sleeping' },
      { label: 'Fragrance-free everything' },
      { label: 'Watch for spreading rash / pus', note: 'then call' },
    ] },
    articles: [],
    info: { kind: 'diapercolor', title: 'Diaper decoder', cols: [
      { sw: '#E3B23A', d: 'Breastfed', ds: 'Yellow & seedy' }, { sw: '#9A7B3A', d: 'Formula', ds: 'Tan & pastier' }, { sw: '#6E7A45', d: 'Occasional green', ds: 'Usually fine' },
    ], foot: 'Red, white/chalky, or black after day 5? Snap a photo and call.' },
  },
};

// ─────────────────────────────────────────────────────────────
// WEEK 4 — one month · efficient feeds · the smile is near
// ─────────────────────────────────────────────────────────────
const WEEK_4: Record<string, CategoryContent> = {
  sleep: {
    label: 'Sleep',
    story: [
      cover('week 4', 'One\nmonth.', 'look at you both', "a few longer stretches may sneak in — still no schedule, and that's right on time."),
      { color: 'rose', eyebrow: 'pattern, not schedule', title: 'Rhythm\nover clock.', say: 'eat, wake, sleep', body: 'a loose eat–wake–sleep flow helps more than fixed times. follow her cues, not the clock.' },
      { color: 'honey', eyebrow: 'one longer stretch', title: 'A 4-hour\nstretch?', say: 'take it', body: "once she's back over birth weight, you can stop waking her at night — let her give you that longer stretch." },
      { color: 'caramel', eyebrow: 'never changes', title: 'Back, bare,\nswaddled.', say: 'every time', body: 'safe sleep is the one constant: on the back, firm flat surface, nothing in there, every sleep.' },
      close('keep going', 'Rhythm\nis coming.', 'slowly', "scroll for this week's sleep guide ↓"),
    ],
    checklist: { title: "This week's sleep", items: [
      { label: 'Loose eat–wake–sleep rhythm' },
      { label: 'Stop night-waking once back to birth weight', note: 'confirm with your pediatrician' },
      { label: 'Still ~60 min wake windows' },
      { label: 'Swaddle + white noise' },
      { label: 'Back, firm, empty — every sleep' },
    ] },
    articles: [],
    info: { kind: 'wakewindows', title: 'Wake windows by age', rows: [
      { age: 'Newborn', val: '45–60 min', pct: 30, now: true }, { age: '1–2 months', val: '60–90 min', pct: 48 },
      { age: '3–4 months', val: '75–120 min', pct: 68 }, { age: '5–6 months', val: '2–2.5 hrs', pct: 88 },
    ], foot: 'Awake too long → overtired → harder to settle. Down at the first sleepy cue.' },
  },
  feed: {
    label: 'Feed',
    story: [
      cover('week 4', 'Efficient\neater.', 'you found a groove', "feeds are faster now — she's gotten good at this, and so have you."),
      { color: 'rose', eyebrow: 'fewer minutes', title: 'Quicker\nfeeds.', say: 'not less milk', body: 'a 10-minute feed can be a full one now. trust output and weight gain, not the clock.' },
      { color: 'honey', eyebrow: 'if bottle-feeding', title: 'Paced\nbottles.', say: 'let her pause', body: 'hold the bottle level, let her control the flow, burp midway. paced feeding prevents overfeeding and gas.' },
      { color: 'caramel', eyebrow: 'supply', title: 'Settling\nin.', say: 'softer breasts', body: "breasts feel less full as supply regulates to demand — that's normal, not a drop." },
      close('keep going', "You've got\nthe hang.", 'really', "scroll for this week's feed guide ↓"),
    ],
    checklist: { title: "This week's feed", items: [
      { label: 'Trust output, not minutes' },
      { label: 'Paced bottle feeding if using bottles' },
      { label: 'Softer breasts = regulated supply, not low' },
      { label: 'Keep ~6+ wet diapers a day' },
      { label: 'No water or solids yet', note: 'milk only before ~6 months' },
    ] },
    articles: [],
    info: { kind: 'milkstorage', title: 'How long does breast milk keep?', cols: [
      { icon: 'counter', v: '4', u: 'hours', w: 'Counter' }, { icon: 'fridge', v: '4', u: 'days', w: 'Fridge' }, { icon: 'freezer', v: '6', u: 'months', w: 'Freezer' },
    ], foot: 'The easy "4-4-4" rule. Thawed milk: use within 24 hrs and never refreeze.' },
  },
  grow: {
    label: 'Grow',
    story: [
      cover('week 4', 'The smile\nis coming.', 'watch for it', "the first real social smile usually lands around 6 weeks — you're close."),
      { color: 'rose', eyebrow: 'coos', title: 'First\nsounds.', say: 'answer them', body: 'little vowel coos start soon. coo back — that turn-taking is the root of talking.' },
      { color: 'honey', eyebrow: 'tummy time', title: 'Pushing\nup.', say: 'building strength', body: 'she may lift her head toward 45° and hold it briefly. keep sessions short, frequent, and watched.' },
      { color: 'caramel', eyebrow: 'hands', title: 'Finding\nhands.', say: 'the first toy', body: "she'll start noticing her own hands soon. a little unswaddled awake time lets her discover them." },
      close('keep going', 'Almost\nsix weeks.', 'the smile awaits', "scroll for this week's grow guide ↓"),
    ],
    checklist: { title: "This week's grow", items: [
      { label: 'Coo back and forth' },
      { label: 'Tummy time, building to longer' },
      { label: 'Some unswaddled awake time for hands' },
      { label: 'Face-to-face at 8–12 in' },
      { label: 'Skin-to-skin + singing' },
    ] },
    articles: [],
    info: { kind: 'milestones', title: "What's coming next", items: [
      { age: 'now', label: 'Longer alert windows, cooing soon', now: true }, { age: '~6 wks', label: 'First social smile' },
      { age: '2 mo', label: 'Coos & vowel sounds' }, { age: '3 mo', label: 'Bats at toys' },
    ], foot: 'Ranges, not deadlines.' },
  },
  care: {
    label: 'Care',
    story: [
      cover('week 4', 'One-month\ncheck.', 'milestone visit', "the one-month well visit checks weight, length, and how feeding's going."),
      { color: 'rose', eyebrow: 'checkup', title: 'Weigh &\nmeasure.', say: 'bring questions', body: "they'll plot her growth and answer your list. the first vaccines come at the 2-month visit." },
      { color: 'honey', eyebrow: 'fussy peak', title: 'Crying\npeaks.', say: '~6 weeks', body: 'evening crying often peaks around 6 weeks, then eases. the calm-down ladder still works.' },
      { color: 'caramel', eyebrow: 'baths', title: 'Real\nbaths.', say: "once cord's healed", body: 'with the cord off you can start short tub baths — warm room, never unattended, 2–3× a week is plenty.' },
      close('keep going', 'One month\ndown.', 'you did that', "scroll for this week's care guide ↓"),
    ],
    checklist: { title: "This week's care", items: [
      { label: 'One-month well visit', note: 'bring your question list' },
      { label: 'Short tub baths OK once cord healed', note: '2–3×/week' },
      { label: 'Calm-down ladder for the 6-week fussy peak' },
      { label: 'Fragrance-free skin care' },
      { label: 'Know the fever rule', note: '100.4°F = call, under 3 months' },
    ] },
    articles: [],
    info: { kind: 'fives', title: 'Bring to the 1-month visit', items: [
      'Your diaper-count / feeding rhythm',
      'Any feeding or latch worries',
      'Sleep questions',
      'Anything about her skin or eyes',
      'How YOU are doing — ask for help',
    ], foot: 'The well visit is for your questions too. Postpartum mood matters — say it out loud.' },
  },
};

// ─────────────────────────────────────────────────────────────
// WEEK 6 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_6: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 6",
        "title": "the fussy\npeak",
        "say": "you're not failing",
        "body": "evenings can crest into a storm this week — fussiness often peaks around now and then slowly starts to ease."
      },
      {
        "color": "rose",
        "eyebrow": "wake windows",
        "title": "still short\n& sweet",
        "say": "watch, don't clock",
        "body": "45-60 minutes awake is still about all they can take. catch the yawn or zone-out before the meltdown."
      },
      {
        "color": "honey",
        "eyebrow": "the witching hour",
        "title": "ride the\nevening wave",
        "say": "it does pass",
        "body": "fussiness often clusters in the late afternoon and evening. dim the lights, hold close, and don't expect crisp naps in the chaos."
      },
      {
        "color": "caramel",
        "eyebrow": "back is best",
        "title": "same safe\nspot",
        "say": "every single sleep",
        "body": "on the back, firm flat surface, nothing else in there. room-share, don't bed-share. it never changes."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "the storm\nis temporary",
        "say": "breathe with them",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "aim for 45-60 min wake windows during the day"
        },
        {
          "label": "watch for any rolling cues — switch to an arms-out sleep sack the moment they show signs of trying to roll",
          "note": "stop swaddling at the first sign, even before true rolling"
        },
        {
          "label": "keep every sleep on the back, firm flat surface, empty crib"
        },
        {
          "label": "room-share, not bed-share, for the first year"
        },
        {
          "label": "dim the lights and slow the evening to soften the witching hour"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things that calm a fussy evening",
      "items": [
        "motion — a slow sway, a walk, a stroller loop",
        "skin-to-skin or being worn close to your chest",
        "white noise or a soft shush near their ear",
        "a darker, dimmer room than the rest of the day",
        "a fresh pair of hands — tag in your partner or a friend"
      ],
      "foot": "if crying is truly inconsolable or feels off to you, trust your gut and call your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 6",
        "title": "fueling the\nfussies",
        "say": "appetite is climbing",
        "body": "growth and long fussy evenings can both make feeds feel more frequent right now — that's normal."
      },
      {
        "color": "rose",
        "eyebrow": "cluster feeds",
        "title": "back-to-back\nis okay",
        "say": "not low supply",
        "body": "evening cluster feeding often lines up with the witching hour. nursing on and off for an hour or two is common and helps."
      },
      {
        "color": "honey",
        "eyebrow": "still milk only",
        "title": "breast or\nbottle",
        "say": "no solids yet",
        "body": "breast milk or formula is all they need. no solids, water, cow's milk, or honey for months yet."
      },
      {
        "color": "caramel",
        "eyebrow": "watch the spit",
        "title": "spit-up vs\nreal pain",
        "say": "happy spitter ok",
        "body": "a little spit-up is normal plumbing. arching, screaming, or poor weight gain is worth a provider chat."
      },
      {
        "color": "blush",
        "eyebrow": "trust the rhythm",
        "title": "you're reading\nthem well",
        "say": "keep going",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "feed on demand and expect more frequent evening feeds"
        },
        {
          "label": "count diapers — roughly 6+ wet a day says intake is on track",
          "note": "your provider can confirm what's right for your baby"
        },
        {
          "label": "keep it milk only — no solids, water, cow's milk, or honey"
        },
        {
          "label": "burp and keep upright a bit after feeds if spit-up is heavy"
        },
        {
          "label": "bring any feeding worries to the 2-month visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs feeding is going well",
      "items": [
        "steady weight gain along their own curve",
        "plenty of wet and dirty diapers",
        "calm and content after most feeds",
        "you can hear or see swallowing while they eat",
        "alert and engaged during awake stretches"
      ],
      "foot": "any sign of dehydration, very few wet diapers, or no interest in feeding — call your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 6",
        "title": "the first\nreal smile",
        "say": "worth the wait",
        "body": "right around now a true social smile often lands — aimed straight at you, just because you're you."
      },
      {
        "color": "rose",
        "eyebrow": "say hi back",
        "title": "smile, wait,\nsmile",
        "say": "ranges, not deadlines",
        "body": "lean in, smile, and give them a beat to answer. these little back-and-forths build their whole social brain."
      },
      {
        "color": "honey",
        "eyebrow": "first coos",
        "title": "tiny vowel\nsounds",
        "say": "around now-ish",
        "body": "soft aahs and oohs start to appear. coo back like it's a real conversation — because to them it is."
      },
      {
        "color": "caramel",
        "eyebrow": "tummy time",
        "title": "stronger\nneck daily",
        "say": "always awake & watched",
        "body": "short, frequent floor sessions are building head control. a few minutes, several times a day, is plenty."
      },
      {
        "color": "blush",
        "eyebrow": "soak it in",
        "title": "every baby\non their own clock",
        "say": "no behind here",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "respond to smiles and coos with your own — turn-taking matters"
        },
        {
          "label": "do short tummy time often, always awake and supervised"
        },
        {
          "label": "talk, sing, and narrate your day in a warm, sing-song voice"
        },
        {
          "label": "offer high-contrast faces and patterns at about 8-12 inches"
        },
        {
          "label": "remember milestones are ranges — bring questions to the 2-month visit",
          "note": "your pediatrician will check development then"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 wins you may spot this week",
      "items": [
        "a real social smile, aimed right at you",
        "first coos and soft vowel sounds",
        "tracking your face as it moves side to side",
        "briefly lifting their head during tummy time",
        "quieting or brightening at the sound of your voice"
      ],
      "foot": "if your baby isn't smiling by their 2-month visit, mention it to your pediatrician — it's worth a look, not a panic."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 6",
        "title": "the 2-month\nvisit is near",
        "say": "you're prepped",
        "body": "this is a big well-visit with the first round of vaccines — a little planning makes it smoother for you both."
      },
      {
        "color": "rose",
        "eyebrow": "before you go",
        "title": "write your\nquestions down",
        "say": "you'll forget otherwise",
        "body": "jot feeding, sleep, and fussiness questions in advance. tired brains lose them in the waiting room."
      },
      {
        "color": "honey",
        "eyebrow": "after the shots",
        "title": "snuggles &\nmild fussiness",
        "say": "follow their guidance",
        "body": "low fever or extra fuss can be normal after vaccines. ask your pediatrician about comfort and any meds before you leave."
      },
      {
        "color": "caramel",
        "eyebrow": "watch the temp",
        "title": "under 3 months\nis different",
        "say": "no meds first",
        "body": "a rectal temp of 100.4°f (38°c) means call right away, no medicine first. this rule holds until 3 months."
      },
      {
        "color": "blush",
        "eyebrow": "tend to you too",
        "title": "the witching\nweeks are hard",
        "say": "ask for help",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "confirm the 2-month well-visit and bring your insurance card"
        },
        {
          "label": "write down feeding, sleep, and fussiness questions ahead of time"
        },
        {
          "label": "ask your provider about post-vaccine comfort and fever guidance"
        },
        {
          "label": "know the rule: rectal 100.4°F (38°C) under 3 months = call now, no meds first"
        },
        {
          "label": "check in on your own mood and rest — accept the help that's offered"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things to bring to the 2-month visit",
      "items": [
        "your list of questions, written down",
        "insurance card and any paperwork",
        "a feeding and diaper sense of their routine",
        "a comfort item and an extra outfit for after shots",
        "a support person if you can — extra hands help"
      ],
      "foot": "for any fever under 3 months, or if your gut says something's wrong, call your pediatrician right away."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 8 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_8: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 8",
        "title": "two months in\nand still figuring it out",
        "say": "you're doing great",
        "body": "around now some babies start stretching night sleep a little longer, and even one extra hour can feel like a gift."
      },
      {
        "color": "rose",
        "eyebrow": "longer stretches",
        "title": "a longer night\nmay be coming",
        "say": "ranges, not promises",
        "body": "some babies start sleeping a longer first stretch around now. others don't for a while, and both are completely normal."
      },
      {
        "color": "honey",
        "eyebrow": "rolling soon",
        "title": "watch for\nthe first roll",
        "say": "stop swaddling early",
        "body": "once baby shows any sign of rolling, retire the swaddle for a sleep sack with arms out. for many babies that's a little later, so just watch for it."
      },
      {
        "color": "caramel",
        "eyebrow": "after the shots",
        "title": "vaccine nights\ncan be off",
        "say": "usually short-lived",
        "body": "a little extra fussiness or broken sleep the night after 2-month shots is common. keep sleep safe as always and follow your pediatrician's guidance."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "same safe setup\nevery single night",
        "say": "back is best",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "back to sleep, every nap and every night"
        },
        {
          "label": "firm flat surface, nothing else in the bed",
          "note": "no pillows, bumpers, blankets, or loose items"
        },
        {
          "label": "swap swaddle for a sleep sack at the first roll sign",
          "note": "arms out from here on"
        },
        {
          "label": "room-share, not bed-share",
          "note": "your room, their own flat surface"
        },
        {
          "label": "go gentle on the night after vaccines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 2-month sleep",
      "items": [
        "longer night stretches can start now, or not for weeks",
        "rolling changes everything, so retire the swaddle at the first sign",
        "sleep is still on the back, every time",
        "a dark, calm room helps day and night start to separate",
        "fussy post-vaccine nights usually pass in a day or two"
      ],
      "foot": "every baby's sleep timeline is different, check with your pediatrician if anything worries you."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 8",
        "title": "hungrier than\nusual lately?",
        "say": "you're not imagining it",
        "body": "a big growth spurt often lands around two months, so more frequent feeds for a few days are completely normal."
      },
      {
        "color": "rose",
        "eyebrow": "growth spurt",
        "title": "cluster feeds\ncome and go",
        "say": "it's temporary",
        "body": "baby may want to eat more often for a few days. nursing more builds your supply, so follow their lead."
      },
      {
        "color": "honey",
        "eyebrow": "still milk only",
        "title": "no solids,\nno water yet",
        "say": "around 6 months",
        "body": "breast milk or formula is still everything baby needs. solids and water come later, around 6 months with readiness signs."
      },
      {
        "color": "caramel",
        "eyebrow": "after the shots",
        "title": "feeding can\nsoothe too",
        "say": "comfort counts",
        "body": "some babies want extra feeds for comfort after vaccines. that's fine, and a little fussiness at the breast or bottle usually passes."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "follow the\nhunger cues",
        "say": "trust their lead",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "feed on demand through the growth spurt"
        },
        {
          "label": "watch diapers, steady wet ones mean enough milk",
          "note": "roughly 5-6 wet a day"
        },
        {
          "label": "keep it milk only, no solids or water yet"
        },
        {
          "label": "no honey before 12 months, ever"
        },
        {
          "label": "offer extra comfort feeds after vaccines if baby wants"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 2-month feeding",
      "items": [
        "a growth spurt can mean more frequent feeds for days",
        "more nursing tells your body to make more milk",
        "wet diapers are your best fullness check",
        "breast milk or formula is still all they need",
        "solids, water, cow's milk, and honey all come later"
      ],
      "foot": "if baby seems off their feeds or you worry about intake, call your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 8",
        "title": "the smiles\nare real now",
        "say": "soak it in",
        "body": "around two months many babies start truly social smiling and cooing, the first little back-and-forth of conversation."
      },
      {
        "color": "rose",
        "eyebrow": "first smiles",
        "title": "smile back,\ntalk back",
        "say": "it's a dialogue",
        "body": "when baby smiles or coos, answer them. these tiny exchanges are how language and connection get their start."
      },
      {
        "color": "honey",
        "eyebrow": "tummy time",
        "title": "pushing up\nhigher now",
        "say": "short and often",
        "body": "many babies lift their chest and head toward 45 degrees during tummy time. keep sessions short, frequent, and always supervised."
      },
      {
        "color": "caramel",
        "eyebrow": "the 2-month visit",
        "title": "well visit\nweighs in",
        "say": "bring your questions",
        "body": "this checkup tracks growth and development and usually includes first vaccines. it's a great moment to ask whatever's on your mind."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "milestones are\nranges, not races",
        "say": "no two alike",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "smile and coo back when baby starts the chat"
        },
        {
          "label": "offer tummy time in short bursts, several times a day",
          "note": "always awake and watched"
        },
        {
          "label": "make eye contact and narrate your day out loud"
        },
        {
          "label": "go to the 2-month well visit",
          "note": "growth check plus first vaccines"
        },
        {
          "label": "remember milestones are ranges, not deadlines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 2-month growth",
      "items": [
        "social smiling and cooing often begin around now",
        "tummy time builds toward a 45-degree push-up",
        "back-and-forth babbling is early language",
        "the well visit tracks growth and milestones",
        "every baby hits these on their own timeline"
      ],
      "foot": "if baby isn't smiling or you have any development questions, raise them at the well visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 8",
        "title": "first shots,\nbig feelings",
        "say": "for both of you",
        "body": "the 2-month vaccines protect against serious illness, and a little fussiness or low fever after is a normal, expected response."
      },
      {
        "color": "rose",
        "eyebrow": "after vaccines",
        "title": "fussy and\nwarm is ok",
        "say": "ask first, always",
        "body": "mild fussiness, sleepiness, or a low fever can follow shots. ask your pediatrician before giving anything, and follow their guidance."
      },
      {
        "color": "honey",
        "eyebrow": "comfort first",
        "title": "extra cuddles\nhelp a lot",
        "say": "you can't spoil this",
        "body": "skin-to-skin, feeding, and holding genuinely ease post-shot discomfort. a cool cloth on the leg can soothe a sore spot too."
      },
      {
        "color": "caramel",
        "eyebrow": "know the line",
        "title": "fever rules\nstill apply",
        "say": "under 3 months",
        "body": "a rectal temp of 100.4°f or higher in a baby under 3 months means call right away, even after vaccines. don't wait or medicate first."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "trust yourself,\ncall when unsure",
        "say": "you know them",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "keep the 2-month well visit and vaccine appointment"
        },
        {
          "label": "ask your pediatrician before giving any fever medicine",
          "note": "they'll tell you if and how much"
        },
        {
          "label": "offer cuddles, feeds, and skin-to-skin after shots"
        },
        {
          "label": "call right away for 100.4°f or higher under 3 months",
          "note": "no meds first, just call"
        },
        {
          "label": "watch for anything that feels off and trust your gut"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about post-vaccine care",
      "items": [
        "mild fussiness or low fever after shots is expected",
        "always ask your pediatrician before any medication",
        "cuddles, feeding, and a cool cloth ease soreness",
        "100.4°f rectal under 3 months means call now",
        "vaccines protect against serious, real illnesses"
      ],
      "foot": "this is general info, not medical advice, your pediatrician guides what's right for your baby."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 10 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_10: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 10",
        "title": "A rhythm,\nfinally.",
        "say": "not a clock yet",
        "body": "a loose, predictable-ish pattern is starting to show — feed, play, sleep, repeat."
      },
      {
        "color": "rose",
        "eyebrow": "wake windows",
        "title": "60-90\nminutes.",
        "say": "watch, don't time",
        "body": "awake stretches are a little longer now. yawns, looking away, or fussing means it's time to wind down — even if it's been under 90 min."
      },
      {
        "color": "honey",
        "eyebrow": "still constant",
        "title": "Back, bare,\nboring.",
        "say": "every sleep, every time",
        "body": "on the back, firm flat surface, nothing else in there. room-share, don't bed-share. it never changes."
      },
      {
        "color": "caramel",
        "eyebrow": "arms out",
        "title": "Ease off the\nswaddle.",
        "say": "before rolling starts",
        "body": "start moving away from the swaddle now and switch to a sleep sack, arms free. don't wait to see the first roll — safer early than late."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Predictable\nbeats perfect.",
        "say": "follow the cues",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "Aim for 60-90 min wake windows"
        },
        {
          "label": "Wind down at the first sleepy cue",
          "note": "don't wait for overtired"
        },
        {
          "label": "Always on the back, firm flat surface"
        },
        {
          "label": "Move to a sleep sack before rolling starts",
          "note": "arms out"
        },
        {
          "label": "Room-share, not bed-share",
          "note": "~first year"
        },
        {
          "label": "White noise + same wind-down each time"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Reading sleepy cues",
      "items": [
        "Yawning or rubbing the face",
        "Looking away, zoning out",
        "Getting fussy or jerky",
        "Less interested in cooing or play",
        "Quieter, glazed-over stare"
      ],
      "foot": "Cues beat the clock — when you see them, start the wind-down even if the window feels short."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 10",
        "title": "Drooly &\nchatty.",
        "say": "hands everywhere",
        "body": "more drool and hands-to-mouth is showing up now — it's usually exploring, not teething."
      },
      {
        "color": "rose",
        "eyebrow": "the drool",
        "title": "Hands in\nthe mouth.",
        "say": "not always teeth",
        "body": "around now babies discover their hands and mouth everything. lots of drool comes with it. teething this early is possible but uncommon."
      },
      {
        "color": "honey",
        "eyebrow": "still milk-only",
        "title": "No solids\nyet.",
        "say": "~6 months",
        "body": "breast milk or formula is still the whole meal. no solids, no water as a drink, no cereal in the bottle — wait for ~6 months and readiness signs."
      },
      {
        "color": "caramel",
        "eyebrow": "output",
        "title": "Diapers\ntell you.",
        "say": "steady is the goal",
        "body": "plenty of wet diapers and steady weight gain mean she's getting enough. trust the pattern over the numbers."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Still milk,\nstill enough.",
        "say": "you've got this",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "Keep feeding on demand — milk only"
        },
        {
          "label": "No solids or water yet",
          "note": "wait for ~6 months"
        },
        {
          "label": "Expect extra drool + hands-to-mouth"
        },
        {
          "label": "Wipe drool to keep chin/neck dry"
        },
        {
          "label": "Plenty of wet diapers = enough"
        },
        {
          "label": "Burp as needed; pace bottle feeds"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Drool vs. teething",
      "items": [
        "Drool + hands-to-mouth is usually just exploring",
        "Real teething often starts closer to ~4-7 months",
        "First teeth average around 6 months",
        "A drool rash on the chin is common — pat dry",
        "Fever isn't a normal teething sign — call if it appears"
      ],
      "foot": "Never put cereal or anything but milk/formula in a bottle. Drool questions? Ask at the well-visit."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 10",
        "title": "So social,\nso you.",
        "say": "hi back, mama",
        "body": "she's lighting up at faces, cooing, and \"talking\" — this is the chatty, connected stretch."
      },
      {
        "color": "rose",
        "eyebrow": "coos & talks",
        "title": "Have a\nconversation.",
        "say": "leave a gap",
        "body": "coo back when she coos, then pause for her \"answer.\" that back-and-forth is how language and connection grow."
      },
      {
        "color": "honey",
        "eyebrow": "head control",
        "title": "Stronger\nneck.",
        "say": "short & often",
        "body": "head control is getting better — she may hold it steadier and push up in tummy time. keep tummy time short, frequent, and watched."
      },
      {
        "color": "caramel",
        "eyebrow": "interactive",
        "title": "Play is\nthe work.",
        "say": "your face is best",
        "body": "smile, sing, make faces, narrate your day. you're her favorite toy — simple back-and-forth beats any screen."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Connection\nis growth.",
        "say": "ranges, not races",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "Coo back and pause for her reply"
        },
        {
          "label": "Tummy time, short and often"
        },
        {
          "label": "Make faces, sing, narrate your day"
        },
        {
          "label": "Hold her ~8-12 in from your face"
        },
        {
          "label": "Skin-to-skin and lots of smiles"
        },
        {
          "label": "No screens — you're the best input"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Around this age",
      "items": [
        "Smiles and \"talks\" back at you",
        "Coos, gurgles, and growing sounds",
        "Holds head steadier, pushes up in tummy time",
        "Tracks faces and follows you across the room",
        "Brings hands together and to the mouth"
      ],
      "foot": "These are ranges, not deadlines — no baby is \"behind.\" Bring any worry to the well-visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 10",
        "title": "Soft skin,\nsteady days.",
        "say": "you're in a groove",
        "body": "drool, a little chin rash, and a more predictable day are all part of this stretch."
      },
      {
        "color": "rose",
        "eyebrow": "drool care",
        "title": "Pat it\ndry.",
        "say": "gentle, not scrubbed",
        "body": "all that drool can redden the chin and neck. pat dry through the day, and a thin layer of plain barrier ointment helps."
      },
      {
        "color": "honey",
        "eyebrow": "the 2-month visit",
        "title": "Well-baby\n& shots.",
        "say": "around now",
        "body": "the 2-month checkup with vaccines often lands near here. mild fussiness or a low fever after can be normal — follow your pediatrician's guidance."
      },
      {
        "color": "caramel",
        "eyebrow": "fever rule",
        "title": "Under 3\nmonths.",
        "say": "call, don't wait",
        "body": "a rectal temp of 100.4°F (38°C) or higher in a baby under 3 months is always an immediate call — any hour, and no fever meds first."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "You know\nyour baby.",
        "say": "trust that",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "Pat drool dry; barrier cream on the chin"
        },
        {
          "label": "Make or keep the 2-month well-visit"
        },
        {
          "label": "Expect mild fussiness after shots",
          "note": "follow your pediatrician"
        },
        {
          "label": "Know the under-3-months fever rule"
        },
        {
          "label": "Keep washing hands before handling baby"
        },
        {
          "label": "Jot down questions for the visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Call your provider if…",
      "items": [
        "Rectal temp 100.4°F (38°C) or higher",
        "Far fewer wet diapers or hard to wake",
        "She's truly inconsolable for hours",
        "A rash spreads, blisters, or looks infected",
        "Anything just feels off to you"
      ],
      "foot": "Under 3 months, a fever of 100.4°F is always an immediate call — any hour, and no fever meds first."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 13 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_13: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 13",
        "title": "three months,\nfourth trimester done",
        "say": "you made it",
        "body": "sleep is starting to feel a little more predictable, and that's worth celebrating."
      },
      {
        "color": "rose",
        "eyebrow": "wake windows",
        "title": "about 75 to\n90 minutes",
        "say": "watch the cues",
        "body": "awake stretches stay short at this age. an early yawn or stare-off beats an overtired meltdown."
      },
      {
        "color": "honey",
        "eyebrow": "swaddle exit",
        "title": "arms out\nbefore rolling",
        "say": "safety first",
        "body": "as your baby gets stronger and rolling nears, move to a sleep sack with arms free. no more swaddle once they can roll."
      },
      {
        "color": "caramel",
        "eyebrow": "same old rules",
        "title": "back, flat,\nnothing else",
        "say": "every single sleep",
        "body": "on the back, firm flat surface, empty space. room-share, not bed-share, for about the first year."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "steadier nights\nahead",
        "say": "slow and steady",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep wake windows around 75-90 min"
        },
        {
          "label": "watch for early sleepy cues",
          "note": "yawns, stares, fussing"
        },
        {
          "label": "start the arms-out transition",
          "note": "before rolling shows up"
        },
        {
          "label": "always back, firm, flat, empty"
        },
        {
          "label": "keep room-sharing, not bed-sharing"
        },
        {
          "label": "hold a calm, repeatable wind-down"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 swaddle-transition tips",
      "items": [
        "go one arm out for a few nights, then both",
        "switch to a snug sleep sack once arms are free",
        "stop swaddling entirely once rolling starts",
        "keep the wind-down identical so only the swaddle changes",
        "expect a few bumpy nights as they adjust"
      ],
      "foot": "every baby rolls on their own timeline — when in doubt, sack over swaddle."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 13",
        "title": "three months\nat the table",
        "say": "still milk only",
        "body": "breast or formula is still everything your baby needs right now."
      },
      {
        "color": "rose",
        "eyebrow": "longer stretches",
        "title": "fewer, bigger\nfeeds",
        "say": "every baby differs",
        "body": "many babies take more per feed and space them out a bit more. follow their hunger, not the clock."
      },
      {
        "color": "honey",
        "eyebrow": "distracted eater",
        "title": "looking around\nmid-feed",
        "say": "totally normal",
        "body": "more alert means more curious. a calm, dim spot can help them stay focused."
      },
      {
        "color": "caramel",
        "eyebrow": "not yet",
        "title": "no solids,\nno water",
        "say": "wait for six-ish",
        "body": "solids wait until around 6 months and readiness signs. water as a drink waits too."
      },
      {
        "color": "blush",
        "eyebrow": "trust the rhythm",
        "title": "you're feeding\nbeautifully",
        "say": "milk is enough",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast or formula on cue"
        },
        {
          "label": "feed in a calm, low-distraction spot"
        },
        {
          "label": "watch wet diapers and steady weight"
        },
        {
          "label": "hold off on solids and water",
          "note": "around 6 months, with readiness signs"
        },
        {
          "label": "bring feeding questions to your well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs feeding is going well",
      "items": [
        "plenty of wet diapers through the day",
        "steady growth along their own curve",
        "content and calm after most feeds",
        "alert and engaged when awake",
        "feeds feel comfortable for you both"
      ],
      "foot": "weight and intake worries are always worth a call to your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 13",
        "title": "the world\nopens up",
        "say": "so much to see",
        "body": "this is a sparkly stretch — more smiles, more sounds, more you-and-them."
      },
      {
        "color": "rose",
        "eyebrow": "laughs + squeals",
        "title": "the first real\nbelly laugh",
        "say": "around now for many",
        "body": "squeals, coos, and laughs are blooming for lots of babies. talk back and watch the conversation grow."
      },
      {
        "color": "honey",
        "eyebrow": "hands found",
        "title": "discovers and\ngrabs hands",
        "say": "endlessly fascinating",
        "body": "your baby is finding their hands, batting at toys, and bringing things to their mouth to explore."
      },
      {
        "color": "caramel",
        "eyebrow": "steadier head",
        "title": "tummy time\npays off",
        "say": "short and often",
        "body": "head control is firming up. keep tummy time playful and supervised to build those muscles."
      },
      {
        "color": "blush",
        "eyebrow": "ranges, not races",
        "title": "their own\ntimeline",
        "say": "no deadlines here",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "do short, frequent tummy time"
        },
        {
          "label": "talk and pause so they can 'answer'"
        },
        {
          "label": "offer easy-to-grab toys at chest level"
        },
        {
          "label": "narrate your day in a warm voice"
        },
        {
          "label": "give plenty of floor and play time"
        },
        {
          "label": "keep your well-visit on the calendar"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things blooming now",
      "items": [
        "steadier head control upright and on the tummy",
        "laughing, squealing, and back-and-forth cooing",
        "finding and grabbing their own hands",
        "tracking faces and toys across the room",
        "batting at and reaching for dangling things"
      ],
      "foot": "milestones are ranges, not deadlines — share any worries at your well-visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 13",
        "title": "the end of\nthe fourth trimester",
        "say": "you, too, grew",
        "body": "three months in — be as gentle with yourself as you are with your baby."
      },
      {
        "color": "rose",
        "eyebrow": "well-visit",
        "title": "checkups and\nmaybe shots",
        "say": "normal to feel big",
        "body": "around now there may be a well-visit and vaccines. some fussiness or soreness after is common — your pediatrician will tell you what to watch for."
      },
      {
        "color": "honey",
        "eyebrow": "fever rule",
        "title": "under three months\nstill counts",
        "say": "don't wait",
        "body": "a rectal temp of 100.4°f (38°c) in a baby under 3 months means call right away — no meds first."
      },
      {
        "color": "caramel",
        "eyebrow": "your turn",
        "title": "refill your\nown cup",
        "say": "you matter too",
        "body": "sleep when you can, accept help, and check in on your own mood. postpartum feelings deserve care."
      },
      {
        "color": "blush",
        "eyebrow": "steady and soft",
        "title": "you're doing\nenough",
        "say": "truly, you are",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "book or confirm the well-visit"
        },
        {
          "label": "jot down questions before the appointment"
        },
        {
          "label": "know the under-3-months fever rule",
          "note": "100.4°F / 38°C rectal = call now"
        },
        {
          "label": "follow your pediatrician's post-vaccine guidance"
        },
        {
          "label": "check in on your own rest and mood"
        },
        {
          "label": "say yes to help when it's offered"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons to call your provider",
      "items": [
        "rectal temp of 100.4°F (38°C) under 3 months",
        "trouble breathing or unusual sleepiness",
        "far fewer wet diapers than normal",
        "not feeding or hard to wake",
        "your own low mood or worry that won't lift"
      ],
      "foot": "trust your gut — if something feels off, a call is always okay."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 17 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_17: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 17",
        "title": "the 4-month\nsleep shake-up",
        "say": "yes, it's real",
        "body": "if sleep just fell apart out of nowhere, your baby's brain is reorganizing how it sleeps, and it's a developmental milestone, not a step backward."
      },
      {
        "color": "rose",
        "eyebrow": "swaddle's done",
        "title": "arms out,\nsleep sack in",
        "say": "once rolling starts",
        "body": "as soon as your baby shows any sign of rolling, stop swaddling for good. a sleep sack with arms free is the safe next step."
      },
      {
        "color": "honey",
        "eyebrow": "back is best",
        "title": "still always\non the back",
        "say": "every sleep, every time",
        "body": "keep putting baby down on the back on a firm flat surface with nothing else in there. if they roll on their own, you don't have to flip them back."
      },
      {
        "color": "caramel",
        "eyebrow": "wake windows",
        "title": "two to two\nand a half",
        "say": "watch the cues",
        "body": "around now most babies can stay happily awake about 2 to 2.5 hours. catching that sleepy window before overtired makes everything smoother."
      },
      {
        "color": "blush",
        "eyebrow": "hang in there",
        "title": "this regression\nis temporary",
        "say": "it passes, promise",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "stop swaddling if rolling has started",
          "note": "sleep sack with arms out"
        },
        {
          "label": "keep every sleep on the back, firm flat surface"
        },
        {
          "label": "clear the sleep space — no blankets, pillows, or toys"
        },
        {
          "label": "aim for 2–2.5 hr wake windows"
        },
        {
          "label": "keep room-sharing, not bed-sharing"
        },
        {
          "label": "ride out the regression — keep your routine steady"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs it's the 4-month regression",
      "items": [
        "sudden night wakings after a stretch of better sleep",
        "short, fragmented naps",
        "fighting sleep at usual times",
        "more clingy or fussy around bedtime",
        "appetite or feeding shifts alongside it"
      ],
      "foot": "it usually passes in a few weeks — call your pediatrician if you're worried or it drags on."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 17",
        "title": "hungrier,\nhandsier",
        "say": "growth is loud",
        "body": "between a growth spurt and a brain busy learning, feeds can feel bigger and more distracted right now, and that's completely normal."
      },
      {
        "color": "rose",
        "eyebrow": "not yet",
        "title": "still no\nsolids today",
        "say": "around 6 months",
        "body": "breast milk or formula is still everything your baby needs. solids usually wait until closer to 6 months and the readiness signs line up."
      },
      {
        "color": "honey",
        "eyebrow": "watch for these",
        "title": "the readiness\nsigns to spot",
        "say": "signs, not a date",
        "body": "good head control, sitting with support, interest in your food, and the tongue-thrust reflex fading. a few may show early — wait for the full picture."
      },
      {
        "color": "caramel",
        "eyebrow": "distracted feeds",
        "title": "the easily\nbusy eater",
        "say": "normal phase",
        "body": "around 4 months babies notice everything and may pull off mid-feed. a calm, dim, low-stimulation spot can help them settle and finish."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing it",
        "title": "milk is still\nthe main event",
        "say": "no solids yet",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast milk or formula on demand"
        },
        {
          "label": "hold off on solids until ~6 months and readiness signs"
        },
        {
          "label": "feed in a calm, low-distraction spot if they pull off"
        },
        {
          "label": "expect a growth-spurt bump in appetite"
        },
        {
          "label": "no honey, cow's milk as a drink, or water yet"
        },
        {
          "label": "track wet diapers as your fullness check"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 solids readiness signs (for later)",
      "items": [
        "sits with support and holds head steady",
        "shows real interest in your food",
        "tongue-thrust reflex has faded",
        "can bring hands and objects to mouth",
        "opens mouth and leans in toward a spoon"
      ],
      "foot": "these guide ~6 months — confirm timing and your baby's readiness with your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 17",
        "title": "four months\nof you",
        "say": "so much new",
        "body": "this is a big developmental leap — grabbing, rolling, drooling, and discovering hands and mouth. it's a busy, beautiful stretch."
      },
      {
        "color": "rose",
        "eyebrow": "grab and gum",
        "title": "hands find\nthe mouth",
        "say": "everything tastes",
        "body": "your baby is reaching, grabbing, and bringing things straight to the mouth. this is normal exploration, so keep small or loose objects out of reach."
      },
      {
        "color": "honey",
        "eyebrow": "drool city",
        "title": "so much\ndribble lately",
        "say": "not always teeth",
        "body": "extra drool and chewing can start around now. it may mean teething is on the way, but plenty of drool is just a 4-month thing."
      },
      {
        "color": "caramel",
        "eyebrow": "rolling soon",
        "title": "the first\nbig roll",
        "say": "ranges, not deadlines",
        "body": "many babies start rolling around now, often tummy to back first. some take longer, and that's perfectly within the normal range."
      },
      {
        "color": "blush",
        "eyebrow": "every baby's own",
        "title": "milestones are\nranges not races",
        "say": "your own pace",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "offer safe things to grab and mouth"
        },
        {
          "label": "give daily floor time to practice rolling"
        },
        {
          "label": "keep small or loose objects out of reach"
        },
        {
          "label": "have bibs ready for the drool"
        },
        {
          "label": "never leave baby alone on a high surface",
          "note": "rolling can start any day"
        },
        {
          "label": "bring up milestones at your 4-month well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things showing up around now",
      "items": [
        "grabbing and bringing objects to the mouth",
        "rolling, often tummy to back first",
        "lots of drooling and chewing on hands",
        "laughing and louder babbling",
        "tracking and reaching for things they see"
      ],
      "foot": "these are typical ranges, not deadlines — share any milestone questions with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 17",
        "title": "caring through\nthe leap",
        "say": "you've got this",
        "body": "a regression plus teething hints can make for tender days. small steadying routines help you both feel grounded."
      },
      {
        "color": "rose",
        "eyebrow": "soothing drool",
        "title": "gentle care\nfor wet chins",
        "say": "keep skin dry",
        "body": "pat the drool away and keep the chin and neck dry to head off rashes. a clean, dry bib swap goes a long way."
      },
      {
        "color": "honey",
        "eyebrow": "comfort tools",
        "title": "easing those\ngummy gums",
        "say": "if teething starts",
        "body": "a clean chilled (not frozen) teether or your clean finger can soothe sore gums. skip teething necklaces and numbing gels."
      },
      {
        "color": "caramel",
        "eyebrow": "4-month visit",
        "title": "the well-visit\nand vaccines",
        "say": "normal afterward",
        "body": "the 4-month checkup often includes vaccines, and mild fussiness or a low fever can follow. your pediatrician will guide you on comfort."
      },
      {
        "color": "blush",
        "eyebrow": "one day at a time",
        "title": "steady beats\nperfect here",
        "say": "go gently",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "keep chin and neck dry to prevent drool rash"
        },
        {
          "label": "offer a clean chilled teether if gums seem sore",
          "note": "chilled, never frozen"
        },
        {
          "label": "book or keep the 4-month well-visit"
        },
        {
          "label": "skip teething necklaces and numbing gels"
        },
        {
          "label": "watch for post-vaccine fussiness or low fever"
        },
        {
          "label": "lean on your support people on hard days"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 safe teething soothers",
      "items": [
        "a clean chilled (not frozen) teether ring",
        "your clean finger to rub the gums",
        "a cool clean washcloth to gnaw",
        "extra cuddles and calm",
        "a dry bib to keep skin comfortable"
      ],
      "foot": "teething doesn't cause a true fever — avoid amber necklaces, numbing gels, and teething tablets, and call your pediatrician about any fever or concern."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 21 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_21: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 21",
        "title": "five months in,\nand still rolling",
        "say": "you've got this",
        "body": "around now sleep can start to consolidate a little, and that's a lovely thing to lean into."
      },
      {
        "color": "rose",
        "eyebrow": "arms free",
        "title": "sack on,\nswaddle off",
        "say": "first roll, no swaddle",
        "body": "at the first signs of rolling, swaddling stops for good. a sleep sack keeps them cozy with arms out and hips free."
      },
      {
        "color": "honey",
        "eyebrow": "wake windows",
        "title": "two to two\nand a half",
        "say": "watch, don't clock-watch",
        "body": "most babies this age stay happily awake about 2 to 2.5 hours. tired cues still beat the clock."
      },
      {
        "color": "caramel",
        "eyebrow": "back is best",
        "title": "rolls at night,\nstill fine",
        "say": "always place on back",
        "body": "keep putting baby down on the back. if they roll on their own now, you don't need to flip them back."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "rest easy,\nrest often",
        "say": "small wins count",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "place baby on the back for every sleep"
        },
        {
          "label": "swap any swaddle for a sleep sack, arms out",
          "note": "stop swaddling at the first signs of rolling"
        },
        {
          "label": "keep the crib bare — firm flat surface, nothing else"
        },
        {
          "label": "room-share, don't bed-share",
          "note": "ideally through the first year"
        },
        {
          "label": "aim for ~2 to 2.5 hr wake windows"
        },
        {
          "label": "keep a short, calm, repeatable bedtime routine"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 5-month sleep",
      "items": [
        "rolling in the crib is normal — a bare crib keeps it safe",
        "swaddling stops at the first signs of rolling; sleep sack from here",
        "night sleep may stretch a bit longer around now",
        "a 4-month-ish sleep shift can still be settling — be patient",
        "overtired babies fight sleep harder, so watch those cues"
      ],
      "foot": "every baby's sleep is different — check with your pediatrician if something worries you."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 21",
        "title": "still milk,\nstill perfect",
        "say": "no rush at all",
        "body": "breast milk or formula is still everything baby needs right now — no solids quite yet."
      },
      {
        "color": "rose",
        "eyebrow": "not yet solids",
        "title": "wait for\nsix-ish months",
        "say": "around 6 months",
        "body": "solids usually start around 6 months. milk leads the way until then, every feed."
      },
      {
        "color": "honey",
        "eyebrow": "readiness signs",
        "title": "what to\nwatch for",
        "say": "signs, not age alone",
        "body": "sits with support, steady head, eyes your plate, and the tongue-thrust reflex has faded. that's the green light."
      },
      {
        "color": "caramel",
        "eyebrow": "drooling more",
        "title": "wet chins,\nnot hunger",
        "say": "drool isn't a cue",
        "body": "lots of drool and chewing fists is normal exploring, not a sign to start solids. milk still covers it all."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "feed calm,\nfeed close",
        "say": "follow their lead",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast milk or formula on demand"
        },
        {
          "label": "hold off on solids until ~6 months",
          "note": "readiness signs matter more than the calendar"
        },
        {
          "label": "no honey before 12 months"
        },
        {
          "label": "no cow's milk as a drink before 12 months"
        },
        {
          "label": "skip water as a drink until ~6 months with solids"
        },
        {
          "label": "watch for readiness signs to note for your pediatrician"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 readiness signs for solids (later)",
      "items": [
        "can sit with support and hold the head steady",
        "shows real interest in what you're eating",
        "tongue-thrust reflex (pushing food out) has faded",
        "can move food to the back of the mouth and swallow",
        "opens up and leans in when food comes near"
      ],
      "foot": "these usually line up around 6 months — talk to your pediatrician before starting solids."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 21",
        "title": "rolling,\nreaching, here",
        "say": "ranges, not races",
        "body": "around five months babies get busy — and every one gets there on their own clock."
      },
      {
        "color": "rose",
        "eyebrow": "both ways",
        "title": "back to front,\nfront to back",
        "say": "give floor time",
        "body": "many babies roll both directions now. open floor space lets them practice and build those muscles."
      },
      {
        "color": "honey",
        "eyebrow": "sitting close",
        "title": "propped up\nand proud",
        "say": "stay within reach",
        "body": "baby may sit with support or a little help. cushions and your hands make a safe spot to practice."
      },
      {
        "color": "caramel",
        "eyebrow": "hand to hand",
        "title": "grab, hold,\npass it over",
        "say": "everything's a snack",
        "body": "reaching and passing toys hand to hand is big this week. expect everything to head straight for the mouth."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "grow gentle,\ngrow free",
        "say": "their own pace",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "make safe floor space for rolling both ways"
        },
        {
          "label": "practice supported sitting within arm's reach"
        },
        {
          "label": "offer easy-to-grab toys to pass hand to hand"
        },
        {
          "label": "keep small or mouth-sized objects out of reach",
          "note": "everything goes in the mouth now"
        },
        {
          "label": "narrate and chat — talking builds language early"
        },
        {
          "label": "bring up milestones at your next well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things showing up around now",
      "items": [
        "rolling both directions — back to front and front to back",
        "sitting with support or a steadying hand",
        "reaching for toys and transferring hand to hand",
        "bringing nearly everything to the mouth to explore",
        "babbling and reacting more to your voice and face"
      ],
      "foot": "milestones are ranges, not deadlines — share any concerns with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 21",
        "title": "busy baby,\ncozy you",
        "say": "you're doing great",
        "body": "as baby moves more, a little extra babyproofing and a lot of cuddles go a long way."
      },
      {
        "color": "rose",
        "eyebrow": "moving more",
        "title": "rolls fast,\nso stay low",
        "say": "never leave up high",
        "body": "now that baby rolls, never leave them on a bed, couch, or changing table unattended. floor is safest."
      },
      {
        "color": "honey",
        "eyebrow": "drool central",
        "title": "wet chins\nneed care",
        "say": "pat, don't rub",
        "body": "drool can irritate the skin. pat the chin dry and a gentle barrier balm can help if it gets red."
      },
      {
        "color": "caramel",
        "eyebrow": "after shots",
        "title": "fussy is\noften okay",
        "say": "follow their guidance",
        "body": "mild fussiness or a low fever after vaccines can be normal. your pediatrician can tell you what to watch for and when to call."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "care soft,\ncare sure",
        "say": "trust your gut",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "never leave a rolling baby on a raised surface"
        },
        {
          "label": "pat drool dry and soothe any chin redness gently"
        },
        {
          "label": "scan the floor for small or mouthable hazards"
        },
        {
          "label": "keep up with well-visits and any due vaccines"
        },
        {
          "label": "call your provider for anything that worries you",
          "note": "trust your instincts"
        },
        {
          "label": "carve out a little rest for yourself too"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons to call your pediatrician",
      "items": [
        "any fever or illness that worries you — call, don't wait it out",
        "no rolling, reaching, or interest in objects by now",
        "not turning to sounds or your voice",
        "very stiff or very floppy muscle tone",
        "anything that just feels off to you as the parent"
      ],
      "foot": "you know your baby best — a quick call is always worth it when in doubt."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 26 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_26: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 26",
        "title": "half a year\nof you",
        "say": "big, soft milestone",
        "body": "six months in, sleep is still a work in progress for most babies, and that's completely normal."
      },
      {
        "color": "rose",
        "eyebrow": "naps settling",
        "title": "two to three\nnaps now",
        "say": "ranges, not rules",
        "body": "many babies drift toward a more predictable 2-3 nap rhythm around now. follow your baby's cues, not a clock."
      },
      {
        "color": "honey",
        "eyebrow": "after the shots",
        "title": "vaccine day\nsleep",
        "say": "usually short-lived",
        "body": "a little extra fussiness or a short night after 6-month shots can happen. extra cuddles help, and call your pediatrician with any concerns."
      },
      {
        "color": "caramel",
        "eyebrow": "still on the back",
        "title": "back, bare,\nroom-share",
        "say": "every single night",
        "body": "back to sleep on a firm flat surface, nothing else in the crib. keep room-sharing without bed-sharing through the first year."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "rest is a\nrhythm",
        "say": "some nights win",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep every sleep on the back, firm flat surface"
        },
        {
          "label": "crib stays empty — no pillows, bumpers, or blankets"
        },
        {
          "label": "use a sleep sack with arms out if baby rolls",
          "note": "no more swaddling once rolling starts"
        },
        {
          "label": "room-share, not bed-share"
        },
        {
          "label": "expect extra fussiness around vaccine day",
          "note": "call your provider with concerns"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about sleep at 6 months",
      "items": [
        "most babies still wake at night — it's normal, not a setback",
        "naps often consolidate toward 2-3 a day",
        "a regular wind-down cue helps more than a strict schedule",
        "starting solids doesn't guarantee longer sleep",
        "separation awareness can mean more bedtime clinginess"
      ],
      "foot": "every baby's sleep is different — talk to your pediatrician about what's normal for yours."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 26",
        "title": "first bites\nbegin",
        "say": "messy and magical",
        "body": "around 6 months, solids can begin — but milk or formula is still your baby's main nutrition this whole year."
      },
      {
        "color": "rose",
        "eyebrow": "iron first",
        "title": "start with\niron-rich",
        "say": "milk still leads",
        "body": "iron-fortified cereal, pureed meats, beans, or lentils make great firsts. think tastes and practice, not full meals yet."
      },
      {
        "color": "honey",
        "eyebrow": "allergens early",
        "title": "introduce them\none at a time",
        "say": "a few days apart",
        "body": "offering common allergens like peanut and egg early may help. introduce one new food at a time so you can spot any reaction."
      },
      {
        "color": "caramel",
        "eyebrow": "two hard nos",
        "title": "no honey,\nno cow's milk",
        "say": "before 12 months",
        "body": "skip honey until after the first birthday, and cow's milk as a drink too. small sips of water in an open or straw cup with meals are fine now."
      },
      {
        "color": "blush",
        "eyebrow": "go slow",
        "title": "one food,\none day",
        "say": "follow their lead",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep milk or formula as the main nutrition"
        },
        {
          "label": "offer iron-rich first foods",
          "note": "fortified cereal, pureed meat, beans"
        },
        {
          "label": "introduce one new food at a time, a few days apart"
        },
        {
          "label": "offer common allergens early, one by one"
        },
        {
          "label": "no honey and no cow's milk as a drink until 12 months"
        },
        {
          "label": "sips of water in an open or straw cup with meals are ok"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about starting solids",
      "items": [
        "readiness = sits up with support, good head control, interest, no tongue-thrust",
        "first foods are for practice — milk still does the heavy lifting",
        "iron stores dip around 6 months, so iron-rich foods matter",
        "gagging looks scary but is a normal part of learning to eat",
        "watch for allergy signs: hives, swelling, vomiting, trouble breathing"
      ],
      "foot": "talk to your provider before starting solids if your baby was early or has health concerns; call 911 for trouble breathing."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 26",
        "title": "sitting up\nin the world",
        "say": "a whole new view",
        "body": "sitting, reaching, and noticing more — six months is a season of big, visible leaps."
      },
      {
        "color": "rose",
        "eyebrow": "sitting solo",
        "title": "unsupported\nsitting",
        "say": "ranges, not deadlines",
        "body": "many babies start sitting on their own around now. some take longer, and that's okay — keep cushions nearby for the tip-overs."
      },
      {
        "color": "honey",
        "eyebrow": "6-month visit",
        "title": "well-check\n& vaccines",
        "say": "worth the appointment",
        "body": "the 6-month well-visit checks growth and brings another round of vaccines. it's a great time to ask anything on your mind."
      },
      {
        "color": "caramel",
        "eyebrow": "i see you",
        "title": "separation\nawareness",
        "say": "a sign of bonding",
        "body": "baby may protest when you leave the room — that's their attachment growing, not a problem. quick goodbyes and warm returns help."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "title": "every baby,\ntheir timeline",
        "say": "milestones are ranges",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "book or attend the 6-month well-visit"
        },
        {
          "label": "give safe floor time to practice sitting"
        },
        {
          "label": "keep soft landings nearby for tip-overs"
        },
        {
          "label": "name objects and faces during play"
        },
        {
          "label": "expect more clinginess as separation awareness grows"
        },
        {
          "label": "flag any milestone worries to your pediatrician",
          "note": "ranges are wide — they'll help you read them"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about growing at 6 months",
      "items": [
        "sitting unsupported often starts now — but the range is wide",
        "babies may pass toys hand to hand and rake at small objects",
        "separation and stranger awareness are signs of healthy attachment",
        "the 6-month visit usually includes another vaccine round",
        "mild low fever or fussiness after shots can be normal"
      ],
      "foot": "milestones are ranges, not deadlines — your pediatrician is the best guide if anything feels off."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 26",
        "title": "caring for\nyour explorer",
        "say": "new tricks, new safety",
        "body": "as baby sits, reaches, and tastes the world, a few small care shifts keep things safe and calm."
      },
      {
        "color": "rose",
        "eyebrow": "after vaccines",
        "title": "comfort over\nthe fussies",
        "say": "call with concerns",
        "body": "extra cuddles, feeds, and rest help after 6-month shots. mild low fever can be normal — your pediatrician can guide you on comfort."
      },
      {
        "color": "honey",
        "eyebrow": "mealtime safety",
        "title": "buckled in,\nnever alone",
        "say": "eyes on, always",
        "body": "seat baby upright and strapped in for solids, and stay close the whole time. choking risk is real, so skip hard, round, or whole foods."
      },
      {
        "color": "caramel",
        "eyebrow": "on the move",
        "title": "baby-proof\na little early",
        "say": "sitting leads to reaching",
        "body": "a sitting baby grabs more than you'd think. tuck away cords, small objects, and anything that fits through a toilet-paper tube."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing great",
        "title": "small steps,\nsafe space",
        "say": "trust your gut",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "comfort with cuddles and feeds after vaccines"
        },
        {
          "label": "always supervise meals — baby upright and buckled in"
        },
        {
          "label": "keep choking hazards and small objects out of reach"
        },
        {
          "label": "start light baby-proofing as reaching grows"
        },
        {
          "label": "keep up gentle gum and first-tooth wiping",
          "note": "a soft cloth or tiny brush works"
        },
        {
          "label": "call your provider for fever or anything that worries you"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about care at 6 months",
      "items": [
        "never leave baby alone with food — choking risk is real",
        "skip whole grapes, nuts, popcorn, and hard chunks",
        "a sitting baby can reach farther than you expect",
        "mild fussiness or low fever after shots is often normal",
        "trust your instincts — when in doubt, call your pediatrician"
      ],
      "foot": "for a high or lasting fever, trouble breathing, or anything alarming, call your provider right away — 911 for emergencies."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 30 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_30: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 30",
        "title": "the world\nis fascinating now",
        "say": "sleep can wobble",
        "body": "around 7 months sleep can stir up a little — new skills and big feelings often visit at night, and that's normal."
      },
      {
        "color": "rose",
        "eyebrow": "wake windows",
        "title": "about 2.5 to\n3 hours awake",
        "say": "watch your baby",
        "body": "most 7-month-olds stay happy awake for roughly 2.5 to 3 hours, usually landing on 2 to 3 naps a day. follow their cues, not the clock alone."
      },
      {
        "color": "honey",
        "eyebrow": "practicing in the crib",
        "title": "crawling at\n2am happens",
        "say": "this passes",
        "body": "new movers love to rehearse sitting and crawling when they should be sleeping. give a calm minute before you step in — many settle themselves."
      },
      {
        "color": "caramel",
        "eyebrow": "same safe setup",
        "title": "back, bare,\nand boring",
        "say": "every sleep",
        "body": "still always on the back, on a firm flat surface, with nothing else in the crib. a sleep sack with arms out keeps a rolling baby cozy."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "steady beats\nperfect",
        "say": "one night at a time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep wake windows around 2.5–3 hours",
          "note": "adjust to your baby's cues"
        },
        {
          "label": "hold a consistent, calm bedtime routine"
        },
        {
          "label": "sleep sack with arms out, never a swaddle",
          "note": "once baby can roll"
        },
        {
          "label": "crib stays bare — no pillows, blankets, or toys"
        },
        {
          "label": "room-share without bed-sharing"
        },
        {
          "label": "give a beat before responding to night wiggles"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things that can stir 7-month sleep",
      "items": [
        "new skills like crawling and sitting up",
        "separation anxiety peeking in at night",
        "a nap transition shifting the schedule",
        "teething discomfort",
        "plain old overtiredness from a long wake window"
      ],
      "foot": "big shifts or true distress that won't settle are worth a call to your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 30",
        "title": "more textures,\nmore mess",
        "say": "milk still leads",
        "body": "around 7 months food gets more interesting, but breast milk or formula is still your baby's main nutrition this whole first year."
      },
      {
        "color": "rose",
        "eyebrow": "new textures",
        "title": "thicker, lumpier,\nbraver",
        "say": "go at their pace",
        "body": "if smooth purées are going well, try mashed and slightly lumpy foods. chewing practice helps even before teeth fully arrive."
      },
      {
        "color": "honey",
        "eyebrow": "finger foods",
        "title": "soft pieces,\ntiny hands",
        "say": "always supervised",
        "body": "offer soft, gummable pieces about the size of your fingertip. skip hard, round, or coin-shaped foods that can choke."
      },
      {
        "color": "caramel",
        "eyebrow": "a few hard no's",
        "title": "not honey,\nnot cow's milk",
        "say": "before age one",
        "body": "no honey until 12 months, and no cow's milk as a drink yet. a little water in an open or straw cup with meals is fine now."
      },
      {
        "color": "blush",
        "eyebrow": "keep it light",
        "title": "food is play\nand learning",
        "say": "mess means progress",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep breast milk or formula as the main source"
        },
        {
          "label": "offer thicker, mashed, and soft lumpy textures"
        },
        {
          "label": "introduce soft finger foods, fingertip-sized",
          "note": "always seated and supervised"
        },
        {
          "label": "no honey and no cow's milk as a drink",
          "note": "both wait until 12 months"
        },
        {
          "label": "offer small sips of water in a cup with meals"
        },
        {
          "label": "keep introducing common allergens, one at a time"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 soft first finger foods",
      "items": [
        "well-cooked, soft veggie sticks like carrot or sweet potato",
        "ripe banana or avocado pieces",
        "soft-cooked pasta",
        "small bits of scrambled egg",
        "strips of soft toast or dissolvable puffs"
      ],
      "foot": "always cut to safe sizes, supervise every bite, and ask your pediatrician about allergens and choking risks."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 30",
        "title": "on the move,\nfinding their voice",
        "say": "ranges, not deadlines",
        "body": "around 7 months bodies get busy and babbling gets chatty — every baby arrives on their own timeline, and that's okay."
      },
      {
        "color": "rose",
        "eyebrow": "crawling or scooting",
        "title": "forward, backward,\nor army-style",
        "say": "all of it counts",
        "body": "some babies crawl, some scoot or roll to get around, some skip crawling entirely. mobility comes in many shapes."
      },
      {
        "color": "honey",
        "eyebrow": "first sounds",
        "title": "ba-ba and\nda-da arrive",
        "say": "talk back lots",
        "body": "those repeated consonants are real language practice. respond, name things, and pause to let them \"answer\" you."
      },
      {
        "color": "caramel",
        "eyebrow": "object permanence",
        "title": "peekaboo gets\nthrilling",
        "say": "games build trust",
        "body": "baby is learning that things still exist when hidden. peekaboo and hiding toys under a cloth are perfect brain-builders right now."
      },
      {
        "color": "blush",
        "eyebrow": "trust the timeline",
        "title": "your baby,\ntheir pace",
        "say": "celebrate small wins",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe floor time to practice moving"
        },
        {
          "label": "babble back and narrate your day out loud"
        },
        {
          "label": "play peekaboo and hide-the-toy games"
        },
        {
          "label": "offer toys to pass hand to hand"
        },
        {
          "label": "baby-proof now that baby is mobile",
          "note": "get down to floor level to spot hazards"
        },
        {
          "label": "keep up with well-visits and milestone checks"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things many 7-month-olds explore",
      "items": [
        "moving by crawling, scooting, or rolling",
        "babbling repeated consonants like ba and da",
        "passing objects between hands",
        "sitting steadily, maybe without support",
        "understanding that hidden things still exist"
      ],
      "foot": "milestones are ranges — if you're ever unsure about your baby's progress, your pediatrician is the right call."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 30",
        "title": "big feelings,\nbig love",
        "say": "clinginess is healthy",
        "body": "around 7 months stranger and separation anxiety can bloom — it's a sign of healthy attachment, even when it feels intense."
      },
      {
        "color": "rose",
        "eyebrow": "separation anxiety",
        "title": "the velcro\nphase begins",
        "say": "reassurance helps",
        "body": "short, cheerful goodbyes and a consistent return teach your baby that you always come back. lingering tends to make it harder."
      },
      {
        "color": "honey",
        "eyebrow": "stranger wariness",
        "title": "new faces feel\nbig now",
        "say": "let them warm up",
        "body": "it's okay if baby buries into you around new people. give them time on your lap instead of passing them around."
      },
      {
        "color": "caramel",
        "eyebrow": "safety as baby moves",
        "title": "a crawler's-eye\nview",
        "say": "check low and small",
        "body": "get on the floor and look for cords, small objects, and unanchored furniture. anchor heavy pieces and cover outlets."
      },
      {
        "color": "blush",
        "eyebrow": "care for you too",
        "title": "your calm\nis their anchor",
        "say": "you matter here",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "keep goodbyes short, warm, and consistent"
        },
        {
          "label": "let baby warm up to new people at their own pace"
        },
        {
          "label": "baby-proof at floor level for your new mover"
        },
        {
          "label": "anchor furniture and secure cords and outlets"
        },
        {
          "label": "keep small objects and choking hazards out of reach"
        },
        {
          "label": "stay current on well-visits and vaccines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to ease separation anxiety",
      "items": [
        "practice quick peekaboo and hide-and-return games",
        "keep a predictable goodbye ritual",
        "offer a comfort object during transitions",
        "narrate that you're leaving and coming back",
        "stay calm — your steadiness reassures them"
      ],
      "foot": "after vaccines, mild fussiness or low fever can be normal; trust your gut and call your pediatrician with any worry."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 34 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_34: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 34",
        "title": "the 8-month\nsleep wobble",
        "say": "it passes, promise",
        "body": "if sleep just got bumpier this week, it's not a step backward — it's a busy little brain working overtime."
      },
      {
        "color": "rose",
        "eyebrow": "the regression",
        "title": "new skills\nwake them up",
        "say": "totally normal",
        "body": "crawling and pulling to stand are so exciting that babies practice them at 2am. it usually settles in a couple of weeks."
      },
      {
        "color": "honey",
        "eyebrow": "missing you",
        "title": "separation\nat bedtime",
        "say": "it's real, be patient",
        "body": "around now babies notice when you leave, so bedtime tears can spike. a calm, predictable goodbye helps more than rushing back."
      },
      {
        "color": "caramel",
        "eyebrow": "two naps",
        "title": "settling into\na rhythm",
        "say": "watch the cues",
        "body": "most babies this age land on two naps a day. follow their sleepy signs rather than the clock on tougher days."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "same crib,\nsame routine",
        "say": "consistency wins",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep the same calm bedtime routine every night",
          "note": "predictability is your anchor through a regression"
        },
        {
          "label": "always lay baby down on the back, on a firm flat surface"
        },
        {
          "label": "crib stays bare — no blankets, pillows, or bumpers"
        },
        {
          "label": "sleep sack with arms out instead of any swaddle",
          "note": "swaddling stops once baby can roll or push up"
        },
        {
          "label": "practice pulling to stand during the day so it's less tempting at night"
        },
        {
          "label": "room-share without bed-sharing through the first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs it's the regression, not something wrong",
      "items": [
        "sudden night wakings after weeks of better sleep",
        "fighting naps or bedtime that used to go smoothly",
        "standing up in the crib and not knowing how to sit back down",
        "extra clingy at goodbye",
        "shorter naps while skills are booming"
      ],
      "foot": "if wakings come with fever, pain, or just seem off, call your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 34",
        "title": "tiny fingers,\nbig appetite",
        "say": "messy is the goal",
        "body": "around 8 months many babies are ready to pick up soft little foods themselves — and the mess means they're learning."
      },
      {
        "color": "rose",
        "eyebrow": "pincer practice",
        "title": "finger foods\ntake the stage",
        "say": "soft + small",
        "body": "offer soft pieces about the size of your fingertip so they can practice the thumb-and-finger pinch. let them lead the pace."
      },
      {
        "color": "honey",
        "eyebrow": "milk first",
        "title": "breast or\nformula still leads",
        "say": "food rounds it out",
        "body": "breast milk or formula is still their main nutrition this year. solids are for practice, flavor, and a little iron — not replacing milk yet."
      },
      {
        "color": "caramel",
        "eyebrow": "keep it safe",
        "title": "no honey,\nno choke shapes",
        "say": "always supervised",
        "body": "skip honey until 12 months and avoid round, hard, or sticky foods. seat baby upright and stay within arm's reach at every meal."
      },
      {
        "color": "blush",
        "eyebrow": "go slow",
        "title": "one new food\nat a time",
        "say": "watch for reactions",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer soft fingertip-sized pieces for pincer-grasp practice"
        },
        {
          "label": "keep breast milk or formula as the main source of nutrition"
        },
        {
          "label": "no honey before 12 months; no cow's milk as a drink before 12 months"
        },
        {
          "label": "seat baby fully upright and supervise every single bite"
        },
        {
          "label": "avoid round, hard, sticky, or coin-shaped foods",
          "note": "common choking shapes for this age"
        },
        {
          "label": "offer small sips of water from an open or straw cup with meals"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 easy first finger foods",
      "items": [
        "soft roasted sweet potato strips",
        "ripe banana or avocado pieces (lightly mashed if slippery)",
        "well-cooked, soft-steamed veggie florets",
        "small soft-cooked pasta",
        "flaked, deboned soft fish or shredded soft meat"
      ],
      "foot": "every baby is different — your pediatrician can guide allergens and textures for yours."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 34",
        "title": "always on\nthe move",
        "say": "ranges, not races",
        "body": "this is the season of scooting, crawling, and pulling up — and every baby gets there on their own timeline."
      },
      {
        "color": "rose",
        "eyebrow": "on the go",
        "title": "crawling &\npulling to stand",
        "say": "many ways to move",
        "body": "some babies crawl, some scoot or roll to get around — all of it counts. pulling up on furniture often comes next."
      },
      {
        "color": "honey",
        "eyebrow": "cruising soon",
        "title": "side-stepping\nalong the couch",
        "say": "weeks to months away",
        "body": "once they can stand holding on, cruising sideways along furniture often follows. bare feet help them grip and balance."
      },
      {
        "color": "caramel",
        "eyebrow": "little hands",
        "title": "the pincer\ngrasp clicks",
        "say": "give them practice",
        "body": "thumb and finger start working together to pick up tiny things. offer safe small foods and toys to build that fine motor skill."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "title": "milestones are\nranges, not deadlines",
        "say": "no such thing as behind",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give lots of floor time for crawling and pulling up"
        },
        {
          "label": "set up safe sturdy furniture for them to cruise along"
        },
        {
          "label": "offer small safe objects to practice the pincer grasp"
        },
        {
          "label": "name what they reach for to grow words alongside movement"
        },
        {
          "label": "let them go barefoot indoors for better balance"
        },
        {
          "label": "bring up any milestone questions at the next well-visit",
          "note": "ranges are wide — your provider can reassure you"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways babies get moving (all normal)",
      "items": [
        "classic hands-and-knees crawling",
        "army crawling on the belly",
        "scooting on the bottom",
        "rolling to cross the room",
        "skipping crawling and going straight to pulling up"
      ],
      "foot": "if your baby isn't using both sides of the body evenly, or you feel unsure, check with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 34",
        "title": "a newly\nmobile world",
        "say": "time to look down",
        "body": "now that baby can move and pull up, this is the week to see your home from their level and make it safe."
      },
      {
        "color": "rose",
        "eyebrow": "baby-proof now",
        "title": "get down\nto their level",
        "say": "crawl it yourself",
        "body": "anchor tall furniture and tvs to the wall, cover outlets, and move cords and small objects out of reach. mobility moves fast."
      },
      {
        "color": "honey",
        "eyebrow": "the clingy phase",
        "title": "separation\nanxiety peaks",
        "say": "it means they love you",
        "body": "big feelings when you leave the room are a healthy sign of attachment. short, warm goodbyes teach them you always come back."
      },
      {
        "color": "caramel",
        "eyebrow": "gentle exits",
        "title": "peekaboo\nbuilds trust",
        "say": "practice makes ease",
        "body": "playing peekaboo and stepping away briefly helps baby learn that out of sight isn't gone for good."
      },
      {
        "color": "blush",
        "eyebrow": "you, too",
        "title": "a calm parent\nis baby-proofing",
        "say": "lean on your village",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "anchor dressers, bookshelves, and tvs to the wall"
        },
        {
          "label": "cover outlets and secure dangling cords and blind pulls"
        },
        {
          "label": "move small objects and choking hazards up high"
        },
        {
          "label": "add gates at stairs and latch low cabinets"
        },
        {
          "label": "keep goodbyes short, warm, and consistent"
        },
        {
          "label": "stay on track with well-visits and recommended vaccines",
          "note": "a mild low fever after shots can be normal — follow your provider's guidance"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 baby-proofing wins before they cruise",
      "items": [
        "anchor furniture and tvs against tip-overs",
        "outlet covers on every reachable socket",
        "stair gates top and bottom",
        "cabinet and drawer latches on anything low",
        "cords, cleaners, and small parts up and out of reach"
      ],
      "foot": "no home is hazard-free — supervision is still your best safety tool."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 39 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_39: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 39",
        "title": "nine months,\nstill back-sleeping",
        "say": "routine is everything",
        "body": "the bedtime ritual you've built is doing more for sleep than you might realize."
      },
      {
        "color": "rose",
        "eyebrow": "two naps",
        "title": "the day\nsettles in",
        "say": "ranges, not rules",
        "body": "many babies land around two naps now, often morning and early afternoon. follow their tired cues, not the clock alone."
      },
      {
        "color": "honey",
        "eyebrow": "same song nightly",
        "title": "keep the\nroutine boring",
        "say": "predictable wins",
        "body": "bath, book, song, bed in the same order tells the body it's time. a calm, repeatable wind-down beats anything fancy."
      },
      {
        "color": "caramel",
        "eyebrow": "safe sleep stays",
        "title": "crib stays\nempty",
        "say": "always on the back",
        "body": "firm flat surface, nothing else in the bed, room-share for about the first year. many families use a sleep sack instead of loose blankets."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "sleep is a\nlong game",
        "say": "some nights wobble",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep the same bedtime routine order nightly"
        },
        {
          "label": "aim for a consistent bedtime window"
        },
        {
          "label": "watch for a two-nap rhythm",
          "note": "morning + early afternoon is common"
        },
        {
          "label": "always place baby on the back to sleep"
        },
        {
          "label": "use a sleep sack, no loose blankets or pillows"
        },
        {
          "label": "keep room-sharing, not bed-sharing"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things that protect 9-month sleep",
      "items": [
        "a wind-down routine in the same order every night",
        "a dark, cool, quiet room",
        "a consistent bedtime, even on weekends",
        "naps that don't start too late in the day",
        "a fed, dry, calm baby going down drowsy"
      ],
      "foot": "sleep patterns vary widely; check with your pediatrician if anything worries you."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 39",
        "title": "milk plus\nthree meals",
        "say": "both still matter",
        "body": "milk is still the main event, with solids filling in around it."
      },
      {
        "color": "rose",
        "eyebrow": "milk first",
        "title": "two to three\nmilk feeds",
        "say": "breast or formula",
        "body": "breastmilk or formula stays the primary nutrition this whole first year. solids are practice and exploration on top of it."
      },
      {
        "color": "honey",
        "eyebrow": "three little meals",
        "title": "a rhythm\nof three",
        "say": "appetites vary",
        "body": "many babies settle into about three solid meals a day now. offer a mix of textures and let them decide how much."
      },
      {
        "color": "caramel",
        "eyebrow": "safety basics",
        "title": "a few hard\nnos",
        "say": "keep these in mind",
        "body": "no honey before 12 months and no cow's milk as a drink yet. cut foods small and soft to lower choking risk."
      },
      {
        "color": "blush",
        "eyebrow": "messy is good",
        "title": "food before one\nis for fun",
        "say": "and for learning",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep 2-3 milk feeds (breast or formula)"
        },
        {
          "label": "offer about 3 solid meals a day"
        },
        {
          "label": "serve soft, small, graspable pieces"
        },
        {
          "label": "no honey until after 12 months"
        },
        {
          "label": "no cow's milk as a drink before 12 months"
        },
        {
          "label": "offer water in small sips with meals",
          "note": "in an open or straw cup"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 finger-food wins at 9 months",
      "items": [
        "soft-cooked veggie sticks (squash, carrot, sweet potato)",
        "ripe soft fruit like banana or pear",
        "well-cooked pasta or small bits of egg",
        "strips of soft toast or oatmeal",
        "tiny pieces of soft cheese or shredded chicken"
      ],
      "foot": "stay close at meals and ask your pediatrician about allergens and choking-safe sizes."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 39",
        "title": "on the move\nand pointing",
        "say": "so much happening",
        "body": "cruising, pinching, waving, pointing — this is a big, busy month."
      },
      {
        "color": "rose",
        "eyebrow": "little fingers",
        "title": "the pincer\ngrasp sharpens",
        "say": "thumb meets finger",
        "body": "that neat thumb-and-finger pinch is getting precise, perfect for picking up tiny bits. it's huge for self-feeding."
      },
      {
        "color": "honey",
        "eyebrow": "cruising along",
        "title": "furniture\nwalking",
        "say": "every baby's pace",
        "body": "many babies pull up and cruise sideways along the couch now. give safe, sturdy things to hold and clear soft floor space."
      },
      {
        "color": "caramel",
        "eyebrow": "talking with hands",
        "title": "waves, claps,\npoints",
        "say": "connection is growing",
        "body": "waving, clapping, and pointing are early ways of sharing the world with you. name what they point at to feed their words."
      },
      {
        "color": "blush",
        "eyebrow": "ranges, not races",
        "title": "every baby\non their clock",
        "say": "milestones are windows",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "let baby practice pulling up and cruising"
        },
        {
          "label": "offer tiny safe foods for the pincer grasp"
        },
        {
          "label": "wave, clap, and point back to them"
        },
        {
          "label": "name objects they point at"
        },
        {
          "label": "clear soft floor space for safe exploring"
        },
        {
          "label": "book the 9-month well visit",
          "note": "a great time to ask milestone questions"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things many 9-month-olds do",
      "items": [
        "cruise along furniture while holding on",
        "use a refined thumb-finger pincer grasp",
        "wave bye-bye and clap",
        "point at things they want or notice",
        "babble strings like mama / dada / baba"
      ],
      "foot": "these are ranges, not deadlines; raise any concerns at the 9-month well visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 39",
        "title": "the nine-month\ncheck-in",
        "say": "a nice milestone",
        "body": "the 9-month well visit is a warm chance to celebrate and ask anything."
      },
      {
        "color": "rose",
        "eyebrow": "well visit",
        "title": "what to bring\nto the visit",
        "say": "questions welcome",
        "body": "your provider checks growth, development, and feeding, and may do a milestone screen. jot down anything you've been wondering about."
      },
      {
        "color": "honey",
        "eyebrow": "baby-proof again",
        "title": "crawl the floor\nyourself",
        "say": "new skills, new reach",
        "body": "a cruising, pulling-up baby reaches higher and faster. secure furniture, cover outlets, and move hazards up and away."
      },
      {
        "color": "caramel",
        "eyebrow": "after-shot care",
        "title": "if vaccines\nare due",
        "say": "mild fuss is ok",
        "body": "some babies are a little fussy or warm after shots, which can be normal. follow your pediatrician's guidance on comfort and when to call."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing great",
        "title": "care is steady,\nquiet work",
        "say": "and it counts",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "schedule and attend the 9-month well visit"
        },
        {
          "label": "write down questions for your provider"
        },
        {
          "label": "re-check baby-proofing for a taller reach"
        },
        {
          "label": "anchor furniture and cover outlets"
        },
        {
          "label": "keep up handwashing and teething comfort"
        },
        {
          "label": "call your pediatrician with any worries",
          "note": "trust your gut, always"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things to do around the 9-month visit",
      "items": [
        "note feeding, sleep, and milestone questions",
        "mention any words, points, or waves you've seen",
        "ask about iron-rich foods and what's next",
        "confirm which vaccines are due",
        "re-baby-proof for cruising and climbing"
      ],
      "foot": "this isn't medical advice; your pediatrician knows your baby best — call with any concern."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 43 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_43: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 43",
        "title": "around ten months\nand still cozy",
        "say": "every baby's own pace",
        "body": "sleep can wobble a little right now, and that's a normal part of this big, busy stage."
      },
      {
        "color": "rose",
        "eyebrow": "two naps",
        "title": "holding two\nfor now",
        "say": "watch the cues",
        "body": "most babies this age still do two naps a day. some start to lean toward one, but there's no rush to drop it."
      },
      {
        "color": "honey",
        "eyebrow": "standing up",
        "title": "pulling up\nin the crib",
        "say": "practice helps",
        "body": "if they pop up to stand at bedtime, gently help them back down. daytime standing practice makes nighttime less novel."
      },
      {
        "color": "caramel",
        "eyebrow": "missing you",
        "title": "separation\nat bedtime",
        "say": "calm and steady",
        "body": "separation anxiety can stretch into goodnights. a short, predictable routine helps them feel safe to settle."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "steady nights\nahead",
        "say": "one day at a time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep baby on their back to start sleep"
        },
        {
          "label": "firm flat surface, nothing else in the crib"
        },
        {
          "label": "room-share without bed-sharing",
          "note": "recommended through about the first year"
        },
        {
          "label": "use a sleep sack instead of loose blankets",
          "note": "arms out, no swaddling at this age"
        },
        {
          "label": "keep a short, predictable bedtime routine"
        },
        {
          "label": "lower the crib mattress if baby pulls to stand"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 10-month sleep",
      "items": [
        "two naps is still typical at this age",
        "standing up in the crib is a phase, not a problem",
        "separation anxiety can briefly bump up night wakings",
        "a wind-down routine signals it's time to settle",
        "total sleep needs vary widely baby to baby"
      ],
      "foot": "these are ranges, not rules — ask your pediatrician about big or sudden sleep changes."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 43",
        "title": "little hands,\nbig appetite",
        "say": "messy is good",
        "body": "around ten months, mealtimes get hands-on as your baby explores feeding themselves."
      },
      {
        "color": "rose",
        "eyebrow": "self-feeding",
        "title": "pincer\ngrip",
        "say": "soft and small",
        "body": "offer soft finger foods cut small. that thumb-and-finger pickup is great practice for little hands."
      },
      {
        "color": "honey",
        "eyebrow": "milk still matters",
        "title": "breast or\nformula first",
        "say": "food rounds it out",
        "body": "breast milk or formula is still the main drink this whole first year. solids build on top, not instead."
      },
      {
        "color": "caramel",
        "eyebrow": "cup sips",
        "title": "learning\nthe cup",
        "say": "a few sips count",
        "body": "offer water in an open or straw cup with meals. small sips are plenty at this age."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "one bite\nat a time",
        "say": "no pressure",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep breast milk or formula as the main drink",
          "note": "through about 12 months"
        },
        {
          "label": "offer soft finger foods cut into small pieces"
        },
        {
          "label": "let baby self-feed, even when it's messy"
        },
        {
          "label": "offer water in a cup with meals",
          "note": "small sips are enough"
        },
        {
          "label": "no honey before 12 months"
        },
        {
          "label": "always supervise; sit baby upright to eat"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 10-month feeding",
      "items": [
        "self-feeding builds the pincer grip and independence",
        "milk or formula still leads; food fills in around it",
        "no honey and no cow's milk as a drink before 12 months",
        "cut foods small and soft to lower choking risk",
        "appetite swings day to day — follow their hunger cues"
      ],
      "foot": "trust your baby's appetite, not the plate — ask your pediatrician about feeding or growth worries."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 43",
        "title": "cruising\nand curious",
        "say": "every baby's timeline",
        "body": "around ten months, your baby is on the move and finding their voice in new ways."
      },
      {
        "color": "rose",
        "eyebrow": "on the move",
        "title": "cruising\nthe furniture",
        "say": "barefoot is best",
        "body": "holding on and stepping sideways builds strength. some babies stand alone for a wobbly second or two."
      },
      {
        "color": "honey",
        "eyebrow": "first words",
        "title": "mama, dada,\nwith meaning",
        "say": "keep chatting",
        "body": "babble is getting purposeful, and \"mama\" or \"dada\" may start to mean you. talk back to keep it going."
      },
      {
        "color": "caramel",
        "eyebrow": "little explorer",
        "title": "poking and\npointing",
        "say": "follow their lead",
        "body": "pointing, banging, and dropping things are real learning. narrate what they're discovering."
      },
      {
        "color": "blush",
        "eyebrow": "in their own time",
        "title": "ranges,\nnot races",
        "say": "no such thing as behind",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe floor space to cruise and pull up"
        },
        {
          "label": "name objects and talk back to babble"
        },
        {
          "label": "play peekaboo and naming games"
        },
        {
          "label": "offer cups, blocks, and stackers to explore"
        },
        {
          "label": "let bare feet grip the floor for balance"
        },
        {
          "label": "keep your well-visits on the calendar"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 10-month growth",
      "items": [
        "cruising comes before independent walking",
        "brief standing alone can start around now",
        "babble turns into meaningful \"mama/dada\" over time",
        "pointing and copying you are big social wins",
        "milestones arrive across a wide, normal range"
      ],
      "foot": "milestones are ranges, not deadlines — share any concerns at your baby's well-visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 43",
        "title": "close by\nand clingy",
        "say": "it's a phase",
        "body": "around ten months, your baby may want you near constantly — separation anxiety is a sign of healthy attachment."
      },
      {
        "color": "rose",
        "eyebrow": "goodbyes",
        "title": "quick and\nconfident",
        "say": "keep it brief",
        "body": "a short, warm goodbye works better than a long one. lingering can make leaving harder for both of you."
      },
      {
        "color": "honey",
        "eyebrow": "baby-proofing",
        "title": "safe to\nexplore",
        "say": "down at their level",
        "body": "a cruising baby reaches new heights. anchor furniture, cover outlets, and move hazards up and away."
      },
      {
        "color": "caramel",
        "eyebrow": "your turn",
        "title": "refill\nyourself too",
        "say": "you matter",
        "body": "clingy days are tiring. trade off when you can and take small breaks to breathe."
      },
      {
        "color": "blush",
        "eyebrow": "you're their safe place",
        "title": "steady\nand here",
        "say": "you're doing great",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "keep goodbyes short, warm, and confident"
        },
        {
          "label": "anchor furniture and TVs to the wall"
        },
        {
          "label": "cover outlets and move small objects up high"
        },
        {
          "label": "check water heater is set to a safe temp",
          "note": "to prevent burns"
        },
        {
          "label": "offer comfort freely during clingy stretches"
        },
        {
          "label": "build in small breaks for yourself"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 10-month care",
      "items": [
        "separation anxiety is normal and shows secure attachment",
        "short goodbyes ease the transition for everyone",
        "cruising babies need furniture anchored and floors clear",
        "comforting a clingy baby won't spoil them",
        "your rest matters as much as theirs"
      ],
      "foot": "trust your gut — call your pediatrician about anything that feels off, and keep well-visits current."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 47 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_47: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 47",
        "title": "sleep at\nalmost-one",
        "say": "big mover, same rules",
        "body": "your little one is busy practicing standing all day, and that energy can spill right into the crib at night — totally normal."
      },
      {
        "color": "rose",
        "eyebrow": "crib gymnastics",
        "title": "standing up\nat bedtime",
        "say": "stay calm",
        "body": "if they pull up in the crib and get stuck, lay them back down gently without much chatter. they're learning to lower themselves too."
      },
      {
        "color": "honey",
        "eyebrow": "two to one",
        "title": "napping\nin transition",
        "say": "follow their lead",
        "body": "around now some babies drop toward one nap, others still need two. watch their cues, not the clock."
      },
      {
        "color": "caramel",
        "eyebrow": "still on the back",
        "title": "safe sleep\nstays the same",
        "say": "every single night",
        "body": "back to sleep, firm flat surface, nothing soft in the crib, room-share not bed-share. a plain sleep sack keeps them cozy without loose blankets."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "rest is\na rhythm",
        "say": "it bends, then settles",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep bedtime back-sleeping and the crib bare"
        },
        {
          "label": "lower the mattress if they're pulling up to stand",
          "note": "so they can't tumble over the rail"
        },
        {
          "label": "practice sitting back down during daytime play",
          "note": "makes crib-standing less frustrating at night"
        },
        {
          "label": "watch nap cues to see if one nap is coming"
        },
        {
          "label": "keep a calm, predictable wind-down routine"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons sleep gets bumpy near one",
      "items": [
        "new motor skills (standing, cruising) get rehearsed at night",
        "a nap transition can shorten or shift sleep for a bit",
        "separation awareness is peaking, so goodbyes feel bigger",
        "teething can flare again with molars on the way",
        "a familiar routine is the strongest comfort you can offer"
      ],
      "foot": "short rough patches are normal — call your pediatrician if sleep changes come with fever, pain, or seem off."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 47",
        "title": "feeding the\nlittle self-feeder",
        "say": "mess is progress",
        "body": "around eleven months meals get gloriously messy as those little fingers do more of the work — that's exactly the goal."
      },
      {
        "color": "rose",
        "eyebrow": "hands on",
        "title": "let them\ndrive the spoon",
        "say": "messy is fine",
        "body": "offer soft finger foods and a loaded spoon to grab. self-feeding builds skills even when most of it ends up on the floor."
      },
      {
        "color": "honey",
        "eyebrow": "thinking ahead",
        "title": "prepping for\nthe one-year shift",
        "say": "not yet, but soon",
        "body": "many families introduce whole cow's milk and ease off bottles around twelve months — your provider can confirm timing. now's a nice time to build cup practice."
      },
      {
        "color": "caramel",
        "eyebrow": "keep it safe",
        "title": "small bites,\nsitting up",
        "say": "always supervised",
        "body": "no honey before one, and keep round, hard, or sticky foods off the tray. cut things small and soft to lower choking risk."
      },
      {
        "color": "blush",
        "eyebrow": "nourished + loved",
        "title": "every messy\nmeal counts",
        "say": "appetite ebbs and flows",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer soft, small finger foods at most meals"
        },
        {
          "label": "let them practice an open or straw cup with water",
          "note": "great prep for weaning off bottles at one"
        },
        {
          "label": "keep breastmilk or formula as the main milk until 12 months",
          "note": "no cow's milk as a drink yet"
        },
        {
          "label": "skip honey and choking-risk foods entirely"
        },
        {
          "label": "sit together and eat as a family when you can"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to ease toward the 12-month menu",
      "items": [
        "build cup skills now so bottle weaning feels gradual",
        "offer a wide variety of textures and flavors",
        "keep milk feeds steady until your provider says to switch",
        "always supervise meals with baby seated upright",
        "expect appetite to dip as growth slows — that's normal"
      ],
      "foot": "every baby's pace differs — ask your pediatrician about timing milk, weaning, and any allergy concerns."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 47",
        "title": "on the edge\nof walking",
        "say": "ranges, not deadlines",
        "body": "pulling up, cruising the furniture, maybe a wobbly first step — every baby gets there on their own timeline."
      },
      {
        "color": "rose",
        "eyebrow": "up and cruising",
        "title": "pulling up\nto stand",
        "say": "so much practice",
        "body": "they'll haul up on anything sturdy and shuffle sideways holding on. bare feet help them feel the floor and balance."
      },
      {
        "color": "honey",
        "eyebrow": "words landing",
        "title": "they get\n\"no\" now",
        "say": "keep it simple",
        "body": "simple words and your tone are clicking. short, clear phrases and lots of naming help language bloom."
      },
      {
        "color": "caramel",
        "eyebrow": "home check",
        "title": "baby-proof\nfor the climber",
        "say": "a quick sweep",
        "body": "anchor furniture, gate the stairs, and tuck away cords. a new stander reaches higher and bolder than last week."
      },
      {
        "color": "blush",
        "eyebrow": "growing on time",
        "title": "their pace\nis the right pace",
        "say": "first steps vary widely",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe, sturdy surfaces to pull up and cruise on"
        },
        {
          "label": "name objects and actions all day to feed language"
        },
        {
          "label": "anchor heavy furniture and gate the stairs",
          "note": "new standers climb and reach fast"
        },
        {
          "label": "let them go barefoot indoors for better balance"
        },
        {
          "label": "bring milestone questions to the 12-month well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things many 11-month-olds are doing",
      "items": [
        "pulling to stand and cruising along furniture",
        "understanding simple words and \"no\"",
        "using a few sounds or words with meaning",
        "picking up tiny bits with a thumb-finger pinch",
        "copying gestures like waving and clapping"
      ],
      "foot": "these are typical ranges, not deadlines — if you're ever unsure about your baby's progress, check with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 47",
        "title": "caring through\nthe big leaps",
        "say": "closeness still wins",
        "body": "as your baby grows bolder, they still circle back to you for comfort — that secure base is what makes brave exploring possible."
      },
      {
        "color": "rose",
        "eyebrow": "feelings are big",
        "title": "clinginess\nis connection",
        "say": "it passes",
        "body": "separation worry often peaks near one. quick, confident goodbyes and a familiar caregiver help them feel safe."
      },
      {
        "color": "honey",
        "eyebrow": "setting limits",
        "title": "gentle \"no,\"\nredirect, repeat",
        "say": "calm beats stern",
        "body": "they're testing what \"no\" means. a steady voice plus moving them to something safe teaches more than a big reaction."
      },
      {
        "color": "caramel",
        "eyebrow": "keeping well",
        "title": "the 12-month\nvisit ahead",
        "say": "jot questions down",
        "body": "a check-up is coming around a year, often with vaccines. mild fussiness or low fever after can be normal — follow your provider's guidance."
      },
      {
        "color": "blush",
        "eyebrow": "you're their safe place",
        "title": "steady love,\nsteady baby",
        "say": "you're doing great",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "offer calm, quick goodbyes to ease separation worry"
        },
        {
          "label": "respond to clinginess with closeness, not pressure"
        },
        {
          "label": "use simple words plus redirection for limits"
        },
        {
          "label": "start a list of questions for the 12-month well-visit"
        },
        {
          "label": "keep up regular handwashing and well-checks"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to support an 11-month-old emotionally",
      "items": [
        "be a reliable home base they can return to",
        "name big feelings simply (\"you're sad we said bye\")",
        "keep routines predictable so the world feels safe",
        "redirect gently instead of long explanations",
        "take care of yourself too — your calm steadies them"
      ],
      "foot": "trust your gut — for any fever, persistent fussiness, or feeding or behavior changes that worry you, call your pediatrician."
    }
  }
};

// ─────────────────────────────────────────────────────────────
// WEEK 52 (authored + accuracy-verified 2026-06-20)
// ─────────────────────────────────────────────────────────────
const WEEK_52: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 52",
        "title": "one whole\nyear of sleep",
        "say": "you made it",
        "body": "a year of nights behind you — the rules that kept them safe haven't changed a bit."
      },
      {
        "color": "rose",
        "eyebrow": "still back, still bare",
        "title": "safe sleep\ndoesn't graduate",
        "say": "every single night",
        "body": "on the back, firm flat crib, nothing soft in there. the basics that carried you all year still carry you now."
      },
      {
        "color": "honey",
        "eyebrow": "naps narrowing",
        "title": "the slow\nslide to one",
        "say": "no rush at all",
        "body": "many babies start drifting from two naps toward one around now. let it happen on their timeline, not the calendar's."
      },
      {
        "color": "caramel",
        "eyebrow": "after the shots",
        "title": "a little\nextra fussy",
        "say": "usually short-lived",
        "body": "the 1-year vaccines can mean a restless night or two. extra cuddles help — ask your pediatrician about comfort if you need it."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "same crib,\nbigger baby",
        "say": "keep it boring",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep baby on the back, firm flat crib, nothing else in it"
        },
        {
          "label": "room-share, don't bed-share, through the first year"
        },
        {
          "label": "let naps drift toward one on baby's own timeline",
          "note": "two is still normal at 12 months"
        },
        {
          "label": "expect a rougher night or two after vaccines"
        },
        {
          "label": "hold a calm, repeatable bedtime routine"
        },
        {
          "label": "skip pillows and blankets in the crib for now"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 sleep truths at one year",
      "items": [
        "the crib stays bare — no pillow, blanket, or big plush yet",
        "back-sleeping is still the safest position",
        "a 2-to-1 nap shift can take weeks, not days",
        "post-vaccine fussiness is common and usually brief",
        "a steady routine matters more than an exact bedtime"
      ],
      "foot": "if sleep changes worry you, your pediatrician is the best call."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 52",
        "title": "the big\nmilk switch",
        "say": "twelve months in",
        "body": "at one year a few doors finally open — whole milk, honey, and a whole lot of family meals."
      },
      {
        "color": "rose",
        "eyebrow": "whole milk now",
        "title": "cow's milk\ngets a yes",
        "say": "at 12 months",
        "body": "whole milk is okay to introduce now as a drink. breastfeeding can absolutely continue too — both can coexist."
      },
      {
        "color": "honey",
        "eyebrow": "honey unlocked",
        "title": "honey is\nfinally safe",
        "say": "not a day sooner",
        "body": "the no-honey rule lifts at one year. a little in food is fine now that the botulism risk has passed."
      },
      {
        "color": "caramel",
        "eyebrow": "bye-bye bottle",
        "title": "trade the\nbottle for a cup",
        "say": "ease it out",
        "body": "start nudging toward an open or straw cup around now. small swaps over weeks beat one big goodbye."
      },
      {
        "color": "blush",
        "eyebrow": "join the table",
        "title": "one plate,\none family",
        "say": "soft and small",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "introduce whole milk as a drink now that baby is one"
        },
        {
          "label": "start weaning the bottle toward a cup",
          "note": "open or straw, no rush to finish overnight"
        },
        {
          "label": "offer honey now if you like — the under-1 rule has lifted"
        },
        {
          "label": "serve soft table foods cut small to lower choking risk"
        },
        {
          "label": "keep family meals together so baby copies you"
        },
        {
          "label": "let baby self-feed and decide how much they eat"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things that change at one year",
      "items": [
        "whole milk is now okay as a drink",
        "honey is safe — botulism risk has passed at 12 months",
        "the bottle starts its slow exit toward a cup",
        "table foods and family meals take center stage",
        "appetite swings day to day, and that's normal"
      ],
      "foot": "always cut foods small and stay close — choking risk is real at this age."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 52",
        "title": "your baby\nturns one",
        "say": "what a year",
        "body": "first steps, first words, first birthday — all clustered around now, all on a wonderfully wide timeline."
      },
      {
        "color": "rose",
        "eyebrow": "first steps",
        "title": "wobbly\nlittle launches",
        "say": "range is huge",
        "body": "some babies walk around now, plenty don't until well after. cruising and crawling are perfectly fine for months yet."
      },
      {
        "color": "honey",
        "eyebrow": "first words",
        "title": "one to three\ntiny words",
        "say": "babble counts too",
        "body": "mama, dada, or a word all their own may show up around now. pointing and gesturing matter just as much."
      },
      {
        "color": "caramel",
        "eyebrow": "busy hands",
        "title": "pinch, point,\nand pass",
        "say": "messy is good",
        "body": "the pincer grasp, waving, and handing you toys are all big wins. let them practice on snacks and stackers."
      },
      {
        "color": "blush",
        "eyebrow": "no two alike",
        "title": "ranges,\nnot deadlines",
        "say": "trust the spread",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe floor space to cruise, pull up, and try steps"
        },
        {
          "label": "name things out loud all day to feed language"
        },
        {
          "label": "celebrate gestures — pointing and waving count"
        },
        {
          "label": "offer finger foods to build the pincer grasp"
        },
        {
          "label": "remember walking and talking land across a wide range",
          "note": "later than 12 months is still normal"
        },
        {
          "label": "bring milestone questions to the 1-year well visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 one-year milestones (give or take)",
      "items": [
        "cruising, standing, maybe first wobbly steps",
        "around 1 to 3 words, plus lots of babble",
        "pointing, waving, and handing things over",
        "a neat pincer grasp for tiny bites",
        "copying you — sounds, gestures, mealtime moves"
      ],
      "foot": "these are ranges, not deadlines; share any concerns with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 52",
        "title": "the one-year\ncheck-in",
        "say": "a big visit",
        "body": "the 12-month well visit is a milestone of its own — measurements, vaccines, and a chance to ask anything."
      },
      {
        "color": "rose",
        "eyebrow": "well visit",
        "title": "the big\n12-month check",
        "say": "bring your list",
        "body": "expect growth tracking, a development check, and the next round of vaccines. jot questions down before you go."
      },
      {
        "color": "honey",
        "eyebrow": "after the shots",
        "title": "mild fuss\nis normal",
        "say": "follow their lead",
        "body": "a low fever or crankiness for a day or two can follow vaccines. your pediatrician can guide comfort and any medicine."
      },
      {
        "color": "caramel",
        "eyebrow": "toddler-proofing",
        "title": "a mover\nneeds a safer floor",
        "say": "get down low",
        "body": "now that baby's upright, anchor furniture, gate stairs, and lock cabinets. crawl their height to spot hazards."
      },
      {
        "color": "blush",
        "eyebrow": "one year strong",
        "title": "you both\ngrew this year",
        "say": "be proud",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "book and prep for the 1-year well visit"
        },
        {
          "label": "write down your milestone and feeding questions ahead"
        },
        {
          "label": "watch for mild post-vaccine fussiness or low fever",
          "note": "ask your pediatrician about comfort measures"
        },
        {
          "label": "anchor furniture and gate stairs for a new walker"
        },
        {
          "label": "lock low cabinets and move small choking hazards up high"
        },
        {
          "label": "keep up the bedtime and mealtime rhythms that work"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things at the 1-year visit",
      "items": [
        "growth and head measurements plotted on the curve",
        "a development and milestone check-in",
        "the 12-month round of vaccines",
        "talk about whole milk, weaning the bottle, and table foods",
        "your moment to raise any worry, big or small"
      ],
      "foot": "trust your gut — when something feels off, call your pediatrician."
    }
  }
};


// WEEK 5 (authored + accuracy-verified 2026-06-21)
const WEEK_5: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 5",
        "title": "evenings get\nlouder",
        "say": "still no schedule",
        "body": "fussiness tends to build a little this week on its way to a crest around six weeks — you're not doing anything wrong."
      },
      {
        "color": "rose",
        "eyebrow": "wake windows",
        "title": "still short\n& sweet",
        "say": "watch, don't clock",
        "body": "45-60 minutes awake is still about all they can manage. catch the yawn or the stare-off before it tips into overtired."
      },
      {
        "color": "honey",
        "eyebrow": "the evening wave",
        "title": "soften the\nlate hours",
        "say": "naps get messy",
        "body": "the back half of the day is often the hardest to settle. dim the lights, lower the volume, and don't expect crisp evening naps."
      },
      {
        "color": "caramel",
        "eyebrow": "never changes",
        "title": "back, firm,\nempty",
        "say": "every single sleep",
        "body": "on the back, firm flat surface, nothing else in there. room-share, don't bed-share. it's the one thing that never changes."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "the loud part\npasses",
        "say": "breathe with them",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "Watch for ~45-60 min wake windows"
        },
        {
          "label": "Down at the first sleepy cue",
          "note": "overtired makes settling harder"
        },
        {
          "label": "Swaddle + white noise if it helps",
          "note": "stop swaddling at first roll signs"
        },
        {
          "label": "Dim and slow the evening to ease fussiness"
        },
        {
          "label": "Back, firm, empty — every sleep"
        },
        {
          "label": "Room-share, not bed-share",
          "note": "first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to settle a wired-up baby",
      "items": [
        "motion — a slow sway, a walk, a stroller loop",
        "skin-to-skin or being worn close on your chest",
        "white noise or a soft shush near the ear",
        "a darker, quieter room than the rest of the house",
        "a fresh pair of hands — tag in your partner"
      ],
      "foot": "If crying feels truly inconsolable or just off to you, trust your gut and call your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 5",
        "title": "the evening\nbuffet",
        "say": "appetite climbing",
        "body": "longer fussy evenings often come with more frequent feeds right now — that's normal, not a sign anything's wrong."
      },
      {
        "color": "rose",
        "eyebrow": "cluster feeds",
        "title": "back-to-back\nis okay",
        "say": "not low supply",
        "body": "nursing on and off for an hour or two in the evening is common this week. it comforts and tops them off at once."
      },
      {
        "color": "honey",
        "eyebrow": "still milk only",
        "title": "breast or\nbottle",
        "say": "no solids yet",
        "body": "breast milk or formula is all they need. no solids, water, cow's milk, or honey for months yet."
      },
      {
        "color": "caramel",
        "eyebrow": "watch the output",
        "title": "diapers tell\nthe story",
        "say": "trust the count",
        "body": "roughly 6+ wet a day and steady weight gain say they're getting enough — more than any clock or number of minutes."
      },
      {
        "color": "blush",
        "eyebrow": "you're in sync",
        "title": "you're reading\nthem well",
        "say": "keep going",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "Feed on demand — expect more evening feeds"
        },
        {
          "label": "Cluster feeding is normal, not low supply"
        },
        {
          "label": "Watch for ~6+ wet diapers a day",
          "note": "your provider can confirm what's right"
        },
        {
          "label": "Paced bottles if you're using bottles",
          "note": "let them pause and breathe"
        },
        {
          "label": "No water or solids yet",
          "note": "milk only before ~6 months"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs feeding is on track",
      "items": [
        "~6+ wet diapers a day by now",
        "steady weight gain at well visits",
        "soft, relaxed hands after a full feed",
        "alert, content stretches between feeds",
        "swallows you can hear during nursing"
      ],
      "foot": "Worried about latch, supply, or weight? A lactation consultant or your pediatrician can help fast."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 5",
        "title": "the smile\nis near",
        "say": "watch for it",
        "body": "those early grins may still be reflex — the first true social smile usually lands around six weeks, and you're close."
      },
      {
        "color": "rose",
        "eyebrow": "longer windows",
        "title": "more awake,\nmore aware",
        "say": "soak it up",
        "body": "alert stretches are getting longer. they're taking in faces, voices, and the room with new focus."
      },
      {
        "color": "honey",
        "eyebrow": "talk back",
        "title": "first coos\ncoming",
        "say": "answer them",
        "body": "little vowel sounds start soon. coo back and pause — that turn-taking is the very root of talking."
      },
      {
        "color": "caramel",
        "eyebrow": "tummy time",
        "title": "lifting &\nlooking",
        "say": "short and watched",
        "body": "they may push up and hold their head a moment longer now. keep sessions brief, frequent, and always supervised."
      },
      {
        "color": "blush",
        "eyebrow": "ranges, not races",
        "title": "almost\nsix weeks",
        "say": "the smile awaits",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "Coo back and forth, leave pauses"
        },
        {
          "label": "Tummy time, short and frequent",
          "note": "awake and watched"
        },
        {
          "label": "Some unswaddled awake time for hands"
        },
        {
          "label": "Face-to-face at about 8-12 in"
        },
        {
          "label": "Skin-to-skin and singing daily"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 sweet things to expect soon",
      "items": [
        "a first true social smile (~6 weeks)",
        "longer, brighter awake windows",
        "vowel coos you can answer",
        "head lifting a little higher in tummy time",
        "eyes tracking your face across the room"
      ],
      "foot": "Milestones are ranges, not deadlines — never a behind. If something worries you, ask at your well visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 5",
        "title": "small comforts,\nbig week",
        "say": "you're both learning",
        "body": "with the cord healed and the fussy stretch building, a few gentle routines go a long way right now."
      },
      {
        "color": "rose",
        "eyebrow": "bath time",
        "title": "real tub\nbaths now",
        "say": "cord's healed",
        "body": "short, shallow tub baths are fine once the cord is off. warm room, never unattended, 2-3x a week is plenty."
      },
      {
        "color": "honey",
        "eyebrow": "the fussy build",
        "title": "ride the\nwitching hour",
        "say": "it crests, then eases",
        "body": "evening crying often climbs toward six weeks before it eases. a calm-down routine helps more than fixing anything."
      },
      {
        "color": "caramel",
        "eyebrow": "know the rule",
        "title": "fever means\ncall",
        "say": "under 3 months",
        "body": "a rectal temp of 100.4°F (38°C) or higher is an immediate call to your provider — no fever meds first. trust that number."
      },
      {
        "color": "blush",
        "eyebrow": "you matter too",
        "title": "check on\nyourself",
        "say": "say it out loud",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "Short tub baths OK now",
          "note": "2-3x a week, never unattended"
        },
        {
          "label": "Fragrance-free soap and lotion"
        },
        {
          "label": "Calm-down routine for the evening fussies"
        },
        {
          "label": "Know the fever rule",
          "note": "100.4°F = call, under 3 months"
        },
        {
          "label": "Check in on your own mood",
          "note": "ask for help out loud"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons to call your pediatrician",
      "items": [
        "rectal temp of 100.4°F (38°C) or higher",
        "fewer wet diapers or signs of dehydration",
        "crying that's truly inconsolable or sounds off",
        "poor feeding, hard to wake, or very floppy",
        "your own mood feels heavy or scary"
      ],
      "foot": "Under 3 months, a fever is an immediate call — no meds first. When in doubt, always call."
    }
  }
};

// WEEK 7 (authored + accuracy-verified 2026-06-21)
const WEEK_7: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 7",
        "title": "a longer\nstretch is near",
        "say": "no promises yet",
        "body": "around now, some babies surprise you with a longer first chunk of night sleep — it's a glimpse, not a guarantee."
      },
      {
        "color": "rose",
        "eyebrow": "that first stretch",
        "title": "watch the\nbedtime drift",
        "say": "keep it gentle",
        "body": "the longest sleep often anchors to the first part of the night. an earlier, calmer wind-down can help that stretch lengthen on its own."
      },
      {
        "color": "honey",
        "eyebrow": "drowsy but awake",
        "title": "set down\na little awake",
        "say": "some nights, not all",
        "body": "try laying baby down sleepy rather than fully asleep when you can. it plants the seed for self-settling, with zero pressure to nail it."
      },
      {
        "color": "caramel",
        "eyebrow": "swaddle check",
        "title": "watch for\nrolling cues",
        "say": "stop at first roll",
        "body": "most 7-week-olds aren't rolling yet, but the moment you see any sign of it, retire the swaddle for an arms-out sleep sack."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "sleep is\nstill scattered",
        "say": "that's normal",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "always back to sleep, on a firm flat surface",
          "note": "crib or bassinet, nothing else in it"
        },
        {
          "label": "room-share, don't bed-share, near your bed"
        },
        {
          "label": "start a short, repeatable wind-down before naps and night"
        },
        {
          "label": "set baby down drowsy when you can",
          "note": "no pressure if it doesn't take"
        },
        {
          "label": "swap swaddle for an arms-out sleep sack at any sign of rolling"
        },
        {
          "label": "keep night feeds quiet, dim, and boring"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs a longer night might be coming",
      "items": [
        "the first stretch is creeping past 4–5 hours",
        "baby resettles after a feed without a full wake-up",
        "daytime feeds are robust and frequent",
        "fussiness is starting to ease off",
        "you've got a calm, consistent bedtime rhythm"
      ],
      "foot": "these come and go — a great night can be followed by a rough one, and that's normal."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 7",
        "title": "a growth spurt\nmay hit",
        "say": "hello, hungry baby",
        "body": "around 6–8 weeks many babies cluster feed and want to eat constantly for a day or two — it usually passes quickly."
      },
      {
        "color": "rose",
        "eyebrow": "feed the spurt",
        "title": "follow the\nhunger, not a clock",
        "say": "on demand still wins",
        "body": "more feeding now tells your supply to make more milk. let baby lead and the frenzy usually settles within a few days."
      },
      {
        "color": "honey",
        "eyebrow": "diaper math",
        "title": "count the\nwet ones",
        "say": "your best gauge",
        "body": "roughly 6+ wet diapers a day and steady weight checks mean baby's getting enough, even when feeds feel nonstop."
      },
      {
        "color": "caramel",
        "eyebrow": "still milk only",
        "title": "no solids,\nno water yet",
        "say": "breast or formula only",
        "body": "baby's only food is breast milk or formula right now. no solids, water, cow's milk, or honey — those come much later."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing it",
        "title": "feeding is\ngoing well",
        "say": "trust the cues",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "feed on demand and expect a spurt around now"
        },
        {
          "label": "track 6+ wet diapers a day as your enough-check"
        },
        {
          "label": "keep it breast milk or formula only",
          "note": "no solids before ~6 months, no cow's milk before 12"
        },
        {
          "label": "never give honey before 12 months"
        },
        {
          "label": "if breastfeeding, let extra demand build your supply"
        },
        {
          "label": "bring feeding questions to the 2-month visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things a growth spurt looks like",
      "items": [
        "wanting to feed way more often, sometimes back-to-back",
        "fussier and harder to settle for a day or two",
        "shorter, lighter sleep right around the spurt",
        "extra clingy and wanting to be held",
        "it eases on its own within a few days"
      ],
      "foot": "poor weight gain, very few wet diapers, or refusing to feed aren't a spurt — call your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 7",
        "title": "that smile\nis the real deal",
        "say": "melts you every time",
        "body": "the true social smile is solidifying now — baby grins back at your face and voice, just for you."
      },
      {
        "color": "rose",
        "eyebrow": "smile back",
        "title": "talk, pause,\nlet them answer",
        "say": "these are ranges",
        "body": "chat, smile, then wait. those little coos and grins are baby's first conversations — and every baby's timing is their own."
      },
      {
        "color": "honey",
        "eyebrow": "tummy time",
        "title": "build that\nneck and back",
        "say": "awake and watched",
        "body": "short, frequent tummy-time sessions help head control bloom. floor mirrors and your face up close make it more fun."
      },
      {
        "color": "caramel",
        "eyebrow": "easier days",
        "title": "the fussy\npeak is easing",
        "say": "gradually, not overnight",
        "body": "if weeks 5–6 felt relentless, you may notice the witching hours softening from here. it's a real, normal turning point."
      },
      {
        "color": "blush",
        "eyebrow": "so much growing",
        "title": "week by\nweek, blooming",
        "say": "no deadlines here",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "smile, talk, and pause to let baby coo back"
        },
        {
          "label": "do short tummy-time sessions a few times a day",
          "note": "always awake and supervised"
        },
        {
          "label": "hold baby close and make eye contact often"
        },
        {
          "label": "offer high-contrast faces, mirrors, and your voice"
        },
        {
          "label": "treat milestones as ranges, never deadlines"
        },
        {
          "label": "jot any questions for the 2-month well visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things many 7-week-olds are doing",
      "items": [
        "smiling back at your face and voice",
        "cooing and making early vowel sounds",
        "holding their head up a bit during tummy time",
        "tracking your face and moving objects with their eyes",
        "calming to familiar voices and being held"
      ],
      "foot": "these are typical ranges, not a checklist — share any concerns with your pediatrician at the next visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 7",
        "title": "the 2-month\nvisit is near",
        "say": "a big, good one",
        "body": "this is one of the most useful checkups — a weight and growth check plus baby's first round of vaccines."
      },
      {
        "color": "rose",
        "eyebrow": "prep the visit",
        "title": "bring your\nquestions list",
        "say": "write them down",
        "body": "jot feeding, sleep, and development questions ahead of time. you'll cover more than you think you can hold in your head."
      },
      {
        "color": "honey",
        "eyebrow": "after vaccines",
        "title": "some fussiness\nis normal",
        "say": "follow your provider",
        "body": "mild fussiness, sleepiness, or a low fever can follow shots. ask your pediatrician what's expected and what to watch for."
      },
      {
        "color": "caramel",
        "eyebrow": "under 3 months",
        "title": "a fever is\na call, not a wait",
        "say": "100.4°F rectal",
        "body": "any rectal temp of 100.4°F (38°C) or higher means call right away — no fever meds first. when in doubt, always call."
      },
      {
        "color": "blush",
        "eyebrow": "caring for them, and you",
        "title": "check in\nwith yourself too",
        "say": "you matter here",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "schedule or confirm the 2-month well visit"
        },
        {
          "label": "write down your feeding, sleep, and milestone questions"
        },
        {
          "label": "ask which vaccines to expect and how to comfort after"
        },
        {
          "label": "call for any rectal fever of 100.4°F (38°C) or higher",
          "note": "under 3 months, call first — no meds first"
        },
        {
          "label": "keep up safe-sleep basics every nap and night"
        },
        {
          "label": "check in on your own mood and rest, and ask for help"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to make the 2-month visit easier",
      "items": [
        "bring a written list of questions and concerns",
        "note feeding and diaper patterns to share",
        "dress baby in easy-off layers for shots",
        "plan extra cuddles, feeds, and a calm day after",
        "ask exactly which fever or symptoms should prompt a call"
      ],
      "foot": "for any fever in a baby under 3 months, or if something feels off, call your pediatrician right away."
    }
  }
};

// WEEK 9 (authored + accuracy-verified 2026-06-21)
const WEEK_9: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 9",
        "title": "settling back\ninto your groove",
        "say": "the shots are behind you",
        "body": "the days right after the 2-month vaccines often smooth back out, and sleep usually finds its footing again within a day or two."
      },
      {
        "color": "rose",
        "eyebrow": "wake windows",
        "title": "60 to 90\nawake minutes",
        "say": "watch, don't time",
        "body": "awake stretches are settling around an hour to an hour and a half. read the yawns and the looking-away instead of the clock."
      },
      {
        "color": "honey",
        "eyebrow": "still constant",
        "title": "back, bare,\nsame as ever",
        "say": "every sleep, every time",
        "body": "on the back, firm flat surface, nothing else in there. room-share, never bed-share. this part never changes."
      },
      {
        "color": "caramel",
        "eyebrow": "watch for rolling",
        "title": "swaddle's\non its way out",
        "say": "arms out soon",
        "body": "at the first sign of rolling, retire the swaddle for a sleep sack with arms free. many babies aren't there yet, so just keep an eye out."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "rhythm beats\na rigid clock",
        "say": "follow their lead",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "aim for 60-90 minute wake windows"
        },
        {
          "label": "wind down at the first sleepy cue",
          "note": "don't wait for overtired"
        },
        {
          "label": "always on the back, firm flat surface"
        },
        {
          "label": "room-share, not bed-share",
          "note": "their own flat space in your room"
        },
        {
          "label": "switch to a sleep sack at the first roll sign",
          "note": "arms out from then on"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about week-9 sleep",
      "items": [
        "post-vaccine sleep usually settles within a day or two",
        "wake windows are landing around 60-90 minutes now",
        "cues beat the clock, so wind down when you see them",
        "back is best for every nap and every night",
        "watch for rolling and retire the swaddle at the first sign"
      ],
      "foot": "every baby's sleep timeline is different, check with your pediatrician if anything worries you."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 9",
        "title": "appetite easing\nback to normal",
        "say": "you're reading them well",
        "body": "if the 2-month growth spurt had baby feeding nonstop, things often calm back down around now into a more familiar pattern."
      },
      {
        "color": "rose",
        "eyebrow": "fewer, fuller",
        "title": "feeds may\nspace out",
        "say": "still on demand",
        "body": "some babies start taking bigger, less frequent feeds as their tummy grows. keep following hunger cues rather than a strict schedule."
      },
      {
        "color": "honey",
        "eyebrow": "still milk only",
        "title": "no solids\nor water yet",
        "say": "around 6 months",
        "body": "breast milk or formula is still everything baby needs. solids and water come later, around 6 months with readiness signs."
      },
      {
        "color": "caramel",
        "eyebrow": "the drool myth",
        "title": "drooly doesn't\nmean teething",
        "say": "or ready for food",
        "body": "more drool and hands-to-mouth around now is usually just exploring. it's not a cue to start solids, and honey still waits until 12 months."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "trust the\nhunger cues",
        "say": "they'll tell you",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep feeding on demand, not by the clock"
        },
        {
          "label": "watch diapers for steady wet ones",
          "note": "roughly 5-6 wet a day"
        },
        {
          "label": "keep it milk only, no solids or water yet"
        },
        {
          "label": "no honey before 12 months, ever"
        },
        {
          "label": "let drool and hand-chewing be exploring, not a food cue"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about week-9 feeding",
      "items": [
        "feeds often settle after the 2-month growth spurt",
        "bigger, less frequent feeds can be a sign of growing",
        "wet diapers are still your best fullness check",
        "drool and hands-to-mouth is exploring, not teething or hunger",
        "solids, water, cow's milk, and honey all come later"
      ],
      "foot": "if baby seems off their feeds or you worry about intake, call your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 9",
        "title": "the coos are\ngetting chatty",
        "say": "soak up every one",
        "body": "around now many babies smile more freely and add new little sounds, turning quiet grins into real back-and-forth conversation."
      },
      {
        "color": "rose",
        "eyebrow": "talk back",
        "title": "answer every\ncoo and smile",
        "say": "this is language",
        "body": "when baby makes a sound, pause and respond like it's a chat. these tiny exchanges are how talking and connection get their start."
      },
      {
        "color": "honey",
        "eyebrow": "tummy time",
        "title": "higher push-ups\nare coming",
        "say": "short and often",
        "body": "many babies lift their head and chest higher now, working toward propping on the forearms. keep sessions short, frequent, and always watched."
      },
      {
        "color": "caramel",
        "eyebrow": "tracking & reaching",
        "title": "eyes follow,\nhands swipe",
        "say": "no two alike",
        "body": "baby may track a toy across the room and bat at things nearby. some do this now, some a little later, and both are right on time."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "milestones are\nranges, not races",
        "say": "their own timeline",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "coo and smile back when baby starts the chat"
        },
        {
          "label": "offer tummy time in short bursts through the day",
          "note": "always awake and watched"
        },
        {
          "label": "hold toys nearby for batting and tracking"
        },
        {
          "label": "make eye contact and narrate what you're doing"
        },
        {
          "label": "remember milestones are ranges, not deadlines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about week-9 growth",
      "items": [
        "social smiling and cooing are blooming around now",
        "tummy-time push-ups keep getting higher",
        "back-and-forth babble is early language taking root",
        "tracking and reaching may start now or a little later",
        "every baby hits these on their own timeline"
      ],
      "foot": "if baby isn't smiling yet or you have any development questions, raise them at the next well visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 9",
        "title": "the after-shot\nfog is lifting",
        "say": "you both made it",
        "body": "any extra fussiness or low fever from the 2-month vaccines usually fades within a day or two, and baby starts feeling like themselves again."
      },
      {
        "color": "rose",
        "eyebrow": "lingering soreness",
        "title": "a tender leg\ncan stick around",
        "say": "ask before any meds",
        "body": "a little redness or soreness at the shot spot can last a few days. a cool cloth and extra cuddles help, and always ask your pediatrician before giving anything."
      },
      {
        "color": "honey",
        "eyebrow": "know the line",
        "title": "fever rules\nstill apply",
        "say": "under 3 months",
        "body": "a rectal temp of 100.4°f or higher in a baby under 3 months means call right away, even now. don't wait or medicate first."
      },
      {
        "color": "caramel",
        "eyebrow": "your turn too",
        "title": "check in on\nyourself",
        "say": "you matter here",
        "body": "two months in, the fog is real. if sadness, anxiety, or feeling not-yourself is hanging on, please tell your provider. support is part of care."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "trust yourself,\ncall when unsure",
        "say": "you know them",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "soothe any lingering shot soreness with a cool cloth and cuddles"
        },
        {
          "label": "ask your pediatrician before giving any medicine",
          "note": "they'll tell you if and how much"
        },
        {
          "label": "call right away for 100.4°f or higher under 3 months",
          "note": "no meds first, just call"
        },
        {
          "label": "watch for anything that feels off and trust your gut"
        },
        {
          "label": "check in on your own mood and ask for support if you need it"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about week-9 care",
      "items": [
        "post-vaccine fussiness and low fever usually pass in a day or two",
        "shot-spot soreness can linger a few days and is normal",
        "always ask your pediatrician before any medication",
        "100.4°f rectal under 3 months means call now",
        "your mental health is part of baby's care too"
      ],
      "foot": "this is general info, not medical advice, your pediatrician guides what's right for your baby."
    }
  }
};

// WEEK 11 (authored + accuracy-verified 2026-06-21)
const WEEK_11: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 11",
        "title": "Sleep's getting\nreadable.",
        "say": "looser, not locked",
        "body": "days are starting to repeat themselves — and that little bit of predictability is a real win."
      },
      {
        "color": "rose",
        "eyebrow": "longer stretches",
        "title": "Nights may\nlengthen.",
        "say": "no schedule needed",
        "body": "some babies string together a longer night stretch around now. it can come and go — don't chase it, just follow her cues."
      },
      {
        "color": "honey",
        "eyebrow": "never changes",
        "title": "Back, bare,\nboring.",
        "say": "every single sleep",
        "body": "on the back, firm flat surface, nothing else in there. room-share, don't bed-share. safe sleep stays the same at every age."
      },
      {
        "color": "caramel",
        "eyebrow": "make the switch",
        "title": "Swaddle to\nsack.",
        "say": "before the first roll",
        "body": "move to a sleep sack with arms out now, while she still can't roll. arms-free means she can reposition if she ends up on her side."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Rhythm beats\na clock.",
        "say": "watch, don't time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "Wind down at the first sleepy cue",
          "note": "not when overtired"
        },
        {
          "label": "Always on the back, firm flat surface"
        },
        {
          "label": "Finish the swaddle-to-sack switch",
          "note": "arms out"
        },
        {
          "label": "Room-share, not bed-share",
          "note": "~first year"
        },
        {
          "label": "Keep the same short wind-down each time"
        },
        {
          "label": "Let a longer night stretch happen on its own"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Swaddle to sleep sack",
      "items": [
        "Start the switch before any sign of rolling",
        "Sleep sack = arms out, hips free to move",
        "Try one arm out for a night or two to ease in",
        "Once she can roll, the swaddle is done for good",
        "Keep the bed empty — the sack is the only layer"
      ],
      "foot": "If she's showing any roll attempts, stop swaddling now. Sack questions? Ask at the well-visit."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 11",
        "title": "Drooly little\nexplorer.",
        "say": "hands everywhere",
        "body": "more drool and everything-to-the-mouth is part of this stretch — it's discovery, not usually teething."
      },
      {
        "color": "rose",
        "eyebrow": "the drool",
        "title": "Hands in\nthe mouth.",
        "say": "exploring, not teeth",
        "body": "she's found her hands and they go straight to her mouth, drool and all. teething this early happens but it's uncommon."
      },
      {
        "color": "honey",
        "eyebrow": "still milk-only",
        "title": "No solids\nyet.",
        "say": "~6 months",
        "body": "breast milk or formula is still the whole meal. no solids, no water as a drink, nothing in the bottle but milk — wait for ~6 months and readiness signs."
      },
      {
        "color": "caramel",
        "eyebrow": "output",
        "title": "Diapers tell\nyou enough.",
        "say": "trust the pattern",
        "body": "plenty of wet diapers and steady weight gain mean she's getting what she needs. lean on the pattern, not the ounces."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Still milk,\nstill plenty.",
        "say": "you're enough",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "Keep feeding on demand — milk only"
        },
        {
          "label": "No solids or water yet",
          "note": "wait for ~6 months"
        },
        {
          "label": "Never put cereal in the bottle"
        },
        {
          "label": "Wipe drool to keep chin and neck dry"
        },
        {
          "label": "Plenty of wet diapers = enough"
        },
        {
          "label": "Pace bottle feeds; burp as needed"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Drool vs. teething",
      "items": [
        "Drool + hands-to-mouth is usually just exploring",
        "Real teething often starts closer to ~4-7 months",
        "First teeth average around 6 months",
        "A drool rash on the chin is common — pat dry",
        "Fever isn't a normal teething sign — call if it appears"
      ],
      "foot": "Milk or formula only — nothing else in a bottle before solids. Drool questions? Ask at the well-visit."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 11",
        "title": "First laughs\nare coming.",
        "say": "any day now",
        "body": "squeals, giggles, and maybe a first real laugh are starting to bubble up — this is the fun, chatty stretch."
      },
      {
        "color": "rose",
        "eyebrow": "squeals & laughs",
        "title": "Be silly\non purpose.",
        "say": "find her giggle",
        "body": "gentle tickles, funny faces, peekaboo, silly sounds — play with what makes her squeal. her first laugh often shows up around now."
      },
      {
        "color": "honey",
        "eyebrow": "back-and-forth",
        "title": "Have a real\nconversation.",
        "say": "leave a gap",
        "body": "coo when she coos, then pause for her \"answer.\" that turn-taking is how language and connection grow."
      },
      {
        "color": "caramel",
        "eyebrow": "stronger body",
        "title": "Tummy time\npays off.",
        "say": "short & often",
        "body": "head control keeps improving and she may push up higher in tummy time. keep it short, frequent, and watched."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Ranges, not\nraces.",
        "say": "no baby's behind",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "Play for the squeal — faces, sounds, peekaboo"
        },
        {
          "label": "Coo back and pause for her reply"
        },
        {
          "label": "Tummy time, short and often"
        },
        {
          "label": "Narrate your day out loud"
        },
        {
          "label": "Lots of smiles and skin-to-skin"
        },
        {
          "label": "No screens — you're the best input"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Around this age",
      "items": [
        "Squeals, giggles, maybe a first real laugh",
        "\"Talks\" back with coos and gurgles",
        "Holds head steadier, pushes up in tummy time",
        "Brings hands together and to the mouth",
        "Tracks faces and follows you across the room"
      ],
      "foot": "These are ranges, not deadlines — no baby is \"behind.\" Bring any worry to the well-visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 11",
        "title": "Soft skin,\nsettled days.",
        "say": "you're in a groove",
        "body": "drool, a little chin rash, and a more predictable day are all part of this stretch."
      },
      {
        "color": "rose",
        "eyebrow": "drool care",
        "title": "Pat it\ndry.",
        "say": "gentle, not scrubbed",
        "body": "all that drool can redden the chin and neck. pat dry through the day, and a thin layer of plain barrier ointment helps."
      },
      {
        "color": "honey",
        "eyebrow": "the 2-month visit",
        "title": "Well-baby\n& shots.",
        "say": "around now",
        "body": "if you haven't had the 2-month checkup with vaccines yet, it often lands near here. mild fussiness or a low fever after can be normal — follow your pediatrician's guidance."
      },
      {
        "color": "caramel",
        "eyebrow": "fever rule",
        "title": "Under 3\nmonths.",
        "say": "call, don't wait",
        "body": "a rectal temp of 100.4°F (38°C) or higher in a baby under 3 months is always an immediate call — any hour, and no fever meds first."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "You know\nyour baby.",
        "say": "trust that",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "Pat drool dry; barrier cream on the chin"
        },
        {
          "label": "Keep or catch up on the 2-month well-visit"
        },
        {
          "label": "Expect mild fussiness after shots",
          "note": "follow your pediatrician"
        },
        {
          "label": "Know the under-3-months fever rule"
        },
        {
          "label": "Keep washing hands before handling baby"
        },
        {
          "label": "Jot down questions for the visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Call your provider if…",
      "items": [
        "Rectal temp 100.4°F (38°C) or higher",
        "Far fewer wet diapers or hard to wake",
        "She's truly inconsolable for hours",
        "A rash spreads, blisters, or looks infected",
        "Anything just feels off to you"
      ],
      "foot": "Under 3 months, a fever of 100.4°F is always an immediate call — any hour, and no fever meds first."
    }
  }
};

// WEEK 12 (authored + accuracy-verified 2026-06-21)
const WEEK_12: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 12",
        "title": "almost three\nmonths in",
        "say": "you found a groove",
        "body": "the 4th trimester is winding down, and a loose eat-wake-sleep rhythm is starting to carry your days."
      },
      {
        "color": "rose",
        "eyebrow": "wake windows",
        "title": "about 75 to\n90 minutes",
        "say": "watch, don't time",
        "body": "awake stretches are a touch longer now. wind down at the first yawn or zone-out, even if the window feels short."
      },
      {
        "color": "honey",
        "eyebrow": "still constant",
        "title": "back, bare,\nboring",
        "say": "every sleep, every time",
        "body": "on the back, firm flat surface, nothing else in there. room-share, don't bed-share. this part never changes."
      },
      {
        "color": "caramel",
        "eyebrow": "arms out",
        "title": "rolling could\nstart soon",
        "say": "safer early than late",
        "body": "if you're still swaddling, move to a sleep sack with arms free now. don't wait for the first roll to switch."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "rhythm beats\na rigid clock",
        "say": "follow their lead",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "aim for roughly 75-90 min wake windows",
          "note": "cues beat the clock"
        },
        {
          "label": "wind down at the first sleepy sign"
        },
        {
          "label": "always on the back, firm flat surface",
          "note": "nothing else in the bed"
        },
        {
          "label": "swap swaddle for a sleep sack, arms out",
          "note": "before rolling begins"
        },
        {
          "label": "room-share, not bed-share",
          "note": "~first year"
        },
        {
          "label": "keep the same calm wind-down each time"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 3-month sleep",
      "items": [
        "a loose eat-wake-sleep rhythm is emerging now",
        "wake windows stretch to about 75-90 minutes",
        "some babies sleep a longer night stretch, some don't yet",
        "retire the swaddle for a sleep sack before rolling",
        "back, firm, and bare stays the rule at every age"
      ],
      "foot": "every baby's sleep timeline is different — check with your pediatrician if anything worries you."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 12",
        "title": "feeds fold into\nthe rhythm",
        "say": "more predictable now",
        "body": "as the eat-wake-sleep pattern settles, feeds often space out a little and feel less around-the-clock."
      },
      {
        "color": "rose",
        "eyebrow": "longer gaps",
        "title": "fuller feeds,\nfewer of them",
        "say": "still on demand",
        "body": "many babies take bigger, more efficient feeds now and go a bit longer between. keep following hunger cues, not a strict schedule."
      },
      {
        "color": "honey",
        "eyebrow": "still milk only",
        "title": "no solids,\nno water yet",
        "say": "around 6 months",
        "body": "breast milk or formula is still everything they need. solids and water come later, around 6 months with readiness signs."
      },
      {
        "color": "caramel",
        "eyebrow": "easily distracted",
        "title": "the world is\nfascinating now",
        "say": "a calm spot helps",
        "body": "a more alert baby may pull off to look around mid-feed. a quieter, dimmer space can help them stay focused."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "trust the\nhunger cues",
        "say": "they lead, you follow",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep feeding on demand as gaps stretch out"
        },
        {
          "label": "watch diapers for steady wet ones",
          "note": "roughly 5-6 wet a day"
        },
        {
          "label": "keep it milk only, no solids or water yet"
        },
        {
          "label": "no honey before 12 months, ever"
        },
        {
          "label": "try a calm, low-distraction spot if baby pulls off"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 3-month feeding",
      "items": [
        "feeds often grow fuller and a little less frequent",
        "a more alert baby may get distracted mid-feed",
        "wet diapers are still your best fullness check",
        "breast milk or formula is all they need right now",
        "solids, water, cow's milk, and honey all come later"
      ],
      "foot": "if baby seems off their feeds or you worry about intake, call your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 12",
        "title": "steadier and\nso chatty",
        "say": "soak it in",
        "body": "head control is firming up and the coos are turning into squeals — the back-and-forth is getting real."
      },
      {
        "color": "rose",
        "eyebrow": "head control",
        "title": "a steadier\nlittle head",
        "say": "still support it",
        "body": "on your shoulder and during tummy time, baby holds their head up more steadily now. keep supporting it for lifts and carries."
      },
      {
        "color": "honey",
        "eyebrow": "new sounds",
        "title": "squeals and\nvaried coos",
        "say": "answer back",
        "body": "you'll hear higher squeals and a wider range of coos. talk back, pause, and let them reply — that's early conversation."
      },
      {
        "color": "caramel",
        "eyebrow": "tummy time",
        "title": "pushing up\nand looking out",
        "say": "short and often",
        "body": "many babies push up higher and track you across the room now. keep tummy time short, frequent, and always supervised."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "milestones are\nranges, not races",
        "say": "no two alike",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "talk and pause so baby can coo and squeal back"
        },
        {
          "label": "offer tummy time in short bursts, several times a day",
          "note": "always awake and watched"
        },
        {
          "label": "still support the head on lifts and carries"
        },
        {
          "label": "hold a toy or your face out for them to track"
        },
        {
          "label": "remember milestones are ranges, not deadlines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about 3-month growth",
      "items": [
        "head control gets steadier as the 4th trimester ends",
        "squeals and a wider range of coos often appear now",
        "back-and-forth sounds are early language",
        "tummy time builds the muscles for rolling and sitting",
        "every baby reaches these on their own timeline"
      ],
      "foot": "if you have any questions about your baby's development, raise them at the next well visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 12",
        "title": "the 4th trimester\nis ending",
        "say": "you made it here",
        "body": "those first intense months are easing into something steadier — for your baby and for you."
      },
      {
        "color": "rose",
        "eyebrow": "check in on you",
        "title": "how are you,\nreally?",
        "say": "ask out loud",
        "body": "as the newborn fog lifts, feelings can surface. lasting sadness, anxiety, or numbness deserves a call to your provider."
      },
      {
        "color": "honey",
        "eyebrow": "the rhythm helps",
        "title": "lean into the\npredictability",
        "say": "don't force it",
        "body": "a loose eat-wake-sleep rhythm makes outings and your own rest easier to plan. let it guide the day, not rule it."
      },
      {
        "color": "caramel",
        "eyebrow": "know the line",
        "title": "fever rules\nstill apply",
        "say": "under 3 months",
        "body": "a rectal temp of 100.4°f or higher in a baby under 3 months means call your provider right away — this can't wait."
      },
      {
        "color": "blush",
        "eyebrow": "this week",
        "title": "trust yourself,\ncall when unsure",
        "say": "you know them",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "check in on your own mood, not just the baby's",
          "note": "call your provider about lasting low feelings"
        },
        {
          "label": "lean on the eat-wake-sleep rhythm to plan rest"
        },
        {
          "label": "call right away for 100.4°f or higher under 3 months",
          "note": "this can't wait"
        },
        {
          "label": "keep up well visits and ask whatever's on your mind"
        },
        {
          "label": "trust your gut on anything that feels off"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things as the 4th trimester ends",
      "items": [
        "the intense newborn stage eases into a steadier rhythm",
        "a settled routine helps both of you rest more",
        "lasting sadness or anxiety in you is worth a provider call",
        "100.4°f rectal under 3 months still means call now",
        "you know your baby best — trust that instinct"
      ],
      "foot": "this is general info, not medical advice — your provider and pediatrician guide what's right for you and your baby."
    }
  }
};

// WEEK 14 (authored + accuracy-verified 2026-06-21)
const WEEK_14: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 14",
        "title": "sleep, and\na heads up",
        "say": "big-ish week",
        "body": "around 3.5 months a lot of babies start hinting they might roll, and that changes one small sleep thing."
      },
      {
        "color": "rose",
        "eyebrow": "the swaddle swap",
        "title": "arms out,\nthe moment they try",
        "say": "don't wait",
        "body": "the first time you see your baby attempt to roll, retire the swaddle for good. switch to an arms-out sleep sack so they can push up and turn freely."
      },
      {
        "color": "honey",
        "eyebrow": "back is best",
        "title": "always start\non the back",
        "say": "every sleep",
        "body": "keep placing baby down on their back on a firm, flat surface with nothing else in it. once they can roll both ways on their own, you don't have to flip them back."
      },
      {
        "color": "caramel",
        "eyebrow": "the 4-month shift",
        "title": "sleep can get\nbumpy now",
        "say": "usually passes",
        "body": "around this age sleep often reorganizes and naps or nights can feel choppier. it's developmental, not a step backward."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "small swap,\nbig safety",
        "say": "one change",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "watch for any rolling attempt during awake time"
        },
        {
          "label": "swap swaddle for an arms-out sleep sack the moment they try"
        },
        {
          "label": "place baby on their back to start every sleep"
        },
        {
          "label": "keep the crib bare — no pillows, bumpers, or loose blankets"
        },
        {
          "label": "room-share, don't bed-share",
          "note": "sharing a room is recommended for about the first year"
        },
        {
          "label": "ride out choppier sleep — it usually settles"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs it's time to ditch the swaddle",
      "items": [
        "baby rolls or tries to roll to their side or tummy",
        "they break an arm free again and again",
        "they push up or lift their head strongly in tummy time",
        "they seem to fight the wrap more than settle into it",
        "they're around 3–4 months — a common turning point"
      ],
      "foot": "if you're unsure, go arms-out early — sooner is safer than later."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 14",
        "title": "feeding,\nstill simple",
        "say": "milk only",
        "body": "your baby is growing fast and getting more interested in the world, but their food is still just milk — breast, formula, or both."
      },
      {
        "color": "rose",
        "eyebrow": "the distracted eater",
        "title": "hello,\nsnack breaks",
        "say": "totally normal",
        "body": "around now babies notice everything and may pull off mid-feed to look around. a calmer, dimmer room can help them settle and finish."
      },
      {
        "color": "honey",
        "eyebrow": "not yet on solids",
        "title": "hold off\non food",
        "say": "wait for six",
        "body": "solids usually wait until around 6 months and clear readiness signs. drooling and chewing on hands alone aren't a green light yet."
      },
      {
        "color": "caramel",
        "eyebrow": "still satisfied",
        "title": "trust the\ndiaper count",
        "say": "watch the output",
        "body": "steady wet diapers and your baby's own growth curve are your best signs feeding is going well, even on choppy days."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "milk now,\nmeals later",
        "say": "no rush",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast or formula on demand"
        },
        {
          "label": "feed in a calmer, lower-stimulation spot if baby keeps unlatching"
        },
        {
          "label": "skip solids, water, cow's milk, and honey for now",
          "note": "solids around 6 months; cow's milk + honey not before 12 months"
        },
        {
          "label": "watch for steady wet diapers as a good-feeding sign"
        },
        {
          "label": "bring feeding questions to your next well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things that are normal at 3.5 months",
      "items": [
        "pulling off the breast or bottle to look around",
        "lots of drool — it doesn't mean it's time for food",
        "feeds getting quicker as baby gets more efficient",
        "a slightly less predictable hunger pattern some days",
        "wanting to nurse for comfort, not just hunger"
      ],
      "foot": "if wet diapers drop off or weight gain worries you, call your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 14",
        "title": "so much\nis clicking",
        "say": "fun stage",
        "body": "this is a sweet, social week — your baby is starting to laugh, reach, and really connect with you."
      },
      {
        "color": "rose",
        "eyebrow": "belly laughs",
        "title": "the first\nreal giggles",
        "say": "melts you",
        "body": "around now many babies discover laughing out loud. silly faces, gentle tickles, and your voice are the best comedy they know."
      },
      {
        "color": "honey",
        "eyebrow": "reach and grab",
        "title": "hands on\neverything",
        "say": "supervise closely",
        "body": "babies start reaching for toys and pulling them in — often straight to the mouth. offer big, clean, choke-safe toys to explore."
      },
      {
        "color": "caramel",
        "eyebrow": "strong neck",
        "title": "head control,\nsteadier now",
        "say": "keep tummy time",
        "body": "head control is getting solid. short, frequent tummy-time sessions keep building the strength behind rolling and sitting."
      },
      {
        "color": "blush",
        "eyebrow": "ranges, not races",
        "title": "every baby,\ntheir own pace",
        "say": "no deadlines",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "make silly faces and sounds to chase those first laughs"
        },
        {
          "label": "offer big, washable toys for reaching and grabbing"
        },
        {
          "label": "do short tummy-time sessions a few times a day"
        },
        {
          "label": "narrate your day — talking builds language early"
        },
        {
          "label": "keep small or breakable objects out of reach",
          "note": "everything is heading to the mouth now"
        },
        {
          "label": "bring any milestone questions to your well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 lovely 3.5-month wins",
      "items": [
        "laughing or squealing out loud",
        "reaching for and grasping a toy",
        "holding their head steady and up in tummy time",
        "tracking faces and toys side to side",
        "babbling back when you talk to them"
      ],
      "foot": "milestones are ranges — if anything worries you, your pediatrician is the place to ask."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 14",
        "title": "drool, and\ndaily comfort",
        "say": "gentle week",
        "body": "you may notice more drool and chewing this week — here's how to keep your baby comfy and yourself sane."
      },
      {
        "color": "rose",
        "eyebrow": "the drool flood",
        "title": "so much\nslobber",
        "say": "usually not teeth",
        "body": "extra drool is common now and often isn't teething yet. pat the chin dry and use a bib to keep that soft skin from chapping."
      },
      {
        "color": "honey",
        "eyebrow": "maybe teething",
        "title": "gums on\nalert",
        "say": "comfort, not meds",
        "body": "if gums look sore, a clean cool teether or your washed finger to rub them can soothe. skip teething gels and necklaces."
      },
      {
        "color": "caramel",
        "eyebrow": "after shots",
        "title": "vaccine-day\ntenderness",
        "say": "follow your ped",
        "body": "if a well-visit brings shots, extra cuddles, feeding, and rest help. a little fussiness or low fever can be normal — call your provider about anything that worries you."
      },
      {
        "color": "blush",
        "eyebrow": "you matter too",
        "title": "care for them,\ncare for you",
        "say": "rest counts",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "keep a soft bib on and pat the chin dry to prevent drool rash"
        },
        {
          "label": "offer a clean, cool teether if gums seem sore"
        },
        {
          "label": "skip teething gels, tablets, and amber necklaces",
          "note": "they're not recommended and can be unsafe"
        },
        {
          "label": "soothe vaccine-day fussiness with cuddles, feeds, and rest"
        },
        {
          "label": "keep up your well-visit schedule"
        },
        {
          "label": "build in a little rest for yourself too"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to ease teething-stage fuss",
      "items": [
        "a clean, firm rubber teether (chilled, not frozen)",
        "gently rubbing the gums with a washed finger",
        "a cool, damp washcloth to gnaw on",
        "extra closeness and calm on cranky days",
        "a bib + a barrier cream your ped suggests for drool rash"
      ],
      "foot": "any fever or symptoms that worry you — call your pediatrician rather than starting any medicine on your own."
    }
  }
};

// WEEK 15 (authored + accuracy-verified 2026-06-21)
const WEEK_15: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 15",
        "title": "the calm\nbefore the shift",
        "say": "you're not imagining it",
        "body": "around now sleep can wobble a little as their brain reorganizes — it's growth, not a step backward."
      },
      {
        "color": "rose",
        "eyebrow": "arms out now",
        "title": "if they roll,\ndrop the swaddle",
        "say": "the moment they try",
        "body": "once rolling shows up, swaddling stops. move to a sleep sack with arms free so they can reposition safely."
      },
      {
        "color": "honey",
        "eyebrow": "longer awake",
        "title": "watch the\nwake windows",
        "say": "every baby differs",
        "body": "wake windows often stretch toward 1.5–2 hours now. an overtired baby fights sleep harder, so catch the early yawns."
      },
      {
        "color": "caramel",
        "eyebrow": "same boring setup",
        "title": "back, bare,\nbox",
        "say": "every sleep, every time",
        "body": "on the back, firm flat surface, nothing else in there. room-share without bed-sharing for now."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "ride the\nwobble out",
        "say": "it usually passes",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "swap swaddle for an arms-out sleep sack once rolling starts",
          "note": "this is the big one this month"
        },
        {
          "label": "keep wake windows around 1.5–2 hours and watch for early sleepy cues"
        },
        {
          "label": "always place baby on their back to sleep"
        },
        {
          "label": "firm flat surface, no pillows, blankets, or bumpers"
        },
        {
          "label": "keep a calm, repeatable wind-down routine"
        },
        {
          "label": "room-share, don't bed-share"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs the 4-month shift is starting",
      "items": [
        "naps suddenly get shorter or harder to start",
        "more night wakings even if nights were settling",
        "fussier and clingier at bedtime",
        "rolling or rolling attempts show up around the same time",
        "feeds more at night or seems extra hungry"
      ],
      "foot": "this phase is normal and temporary — if you're worried about feeding or weight, check with your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 15",
        "title": "hungrier\nlately?",
        "say": "it can come and go",
        "body": "growth and the brain shift can bump appetite for a bit — feeding more for a few days is usually just them catching up."
      },
      {
        "color": "rose",
        "eyebrow": "still milk only",
        "title": "no solids\nquite yet",
        "say": "around six months",
        "body": "breast milk or formula is still all they need. solids wait for ~6 months and readiness signs, even if they're eyeing your plate."
      },
      {
        "color": "honey",
        "eyebrow": "easily distracted",
        "title": "the world\nis loud now",
        "say": "totally normal phase",
        "body": "babies this age pop off to look around. a calmer, dimmer room can help them settle and finish."
      },
      {
        "color": "caramel",
        "eyebrow": "everything's a snack",
        "title": "hands and\nmouths united",
        "say": "watch for choking risks",
        "body": "they grab and gum everything right now. keep small objects away — that's exploring, not real hunger for food."
      },
      {
        "color": "blush",
        "eyebrow": "follow their lead",
        "title": "trust the\nrhythm",
        "say": "they know full",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast milk or formula on demand"
        },
        {
          "label": "feed in a calm, low-distraction spot if they keep popping off"
        },
        {
          "label": "hold off on solids until ~6 months and readiness signs",
          "note": "good head control, sitting with support, interest in food"
        },
        {
          "label": "no honey, cow's milk as a drink, or water as a drink yet"
        },
        {
          "label": "keep small grabbable objects out of reach during this mouthing stage"
        },
        {
          "label": "watch wet diapers and steady growth as your fullness signs"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about feeding at ~3.5–4 months",
      "items": [
        "appetite can jump for a few days during growth and the brain shift",
        "distraction and popping off is a phase, not a problem",
        "no solids needed yet — milk covers everything until ~6 months",
        "mouthing everything is exploration, not a sign to start food",
        "6+ wet diapers a day is a good intake sign"
      ],
      "foot": "every baby's pattern differs — talk to your pediatrician about any feeding or weight concerns."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 15",
        "title": "so much\nis brewing",
        "say": "ranges, not deadlines",
        "body": "around 3.5–4 months their body and brain are working hard — every baby gets there on their own timeline."
      },
      {
        "color": "rose",
        "eyebrow": "the big roll",
        "title": "rolling is\non the way",
        "say": "some sooner, some later",
        "body": "many babies start rolling tummy-to-back around now. never leave them alone on a couch, bed, or changing table."
      },
      {
        "color": "honey",
        "eyebrow": "grab and gum",
        "title": "hands find\neverything",
        "say": "supervise closely",
        "body": "they reach, grasp, and bring it straight to the mouth — that's how they learn. keep choking hazards out of reach."
      },
      {
        "color": "caramel",
        "eyebrow": "tummy time wins",
        "title": "stronger\nby the day",
        "say": "short and often",
        "body": "tummy time builds the neck and core that rolling needs. a few short sessions beat one long one."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "title": "watch them\nbloom",
        "say": "no two alike",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "do short, frequent tummy time sessions through the day"
        },
        {
          "label": "offer safe grabbable toys to reach for and explore"
        },
        {
          "label": "never leave baby alone on a raised surface now that rolling may start"
        },
        {
          "label": "keep small objects and choking hazards out of reach"
        },
        {
          "label": "talk, sing, and respond to their sounds to build language"
        },
        {
          "label": "remember milestones are ranges, not a schedule"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things emerging around 3.5–4 months",
      "items": [
        "rolling tummy-to-back may start (a range, not a deadline)",
        "purposeful reaching and grabbing for objects",
        "bringing hands and toys to the mouth to explore",
        "stronger head control during tummy time",
        "cooing, babbling, and more social smiles and laughs"
      ],
      "foot": "if your baby isn't doing these yet it's often fine — raise any milestone questions at the next well-visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 15",
        "title": "the fussy\nstretch",
        "say": "you're doing great",
        "body": "the pre-4-month shift can make them clingier and harder to settle — extra closeness right now is exactly what they need."
      },
      {
        "color": "rose",
        "eyebrow": "drool central",
        "title": "so much\nspit lately",
        "say": "usually not teeth yet",
        "body": "more drool and chewing is common now and often isn't teething. pat the chin dry to keep skin from getting irritated."
      },
      {
        "color": "honey",
        "eyebrow": "the 4-month visit",
        "title": "well-check\nis near",
        "say": "bring your questions",
        "body": "the 4-month well-visit often includes vaccines. jot down anything you've noticed so nothing slips your mind."
      },
      {
        "color": "caramel",
        "eyebrow": "after the shots",
        "title": "fussy is\nokay",
        "say": "follow your provider",
        "body": "mild fussiness or a low fever can follow vaccines. ask your pediatrician about comfort and what to watch for."
      },
      {
        "color": "blush",
        "eyebrow": "care for you too",
        "title": "fill your\ncup",
        "say": "you matter here",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "schedule or prep for the 4-month well-visit and write down questions"
        },
        {
          "label": "offer extra cuddles and contact through the fussy stretch"
        },
        {
          "label": "wipe drool gently and keep chin and neck folds dry"
        },
        {
          "label": "follow your pediatrician's guidance for any post-vaccine fussiness or low fever"
        },
        {
          "label": "lean on your people so you can rest too"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons to call your pediatrician",
      "items": [
        "a fever that worries you, especially after vaccines — ask what's expected",
        "much fewer wet diapers or signs of dehydration",
        "unusual sleepiness, floppiness, or hard-to-wake",
        "any milestone or development concern you can't shake",
        "you feel persistently low, anxious, or not yourself — that counts too"
      ],
      "foot": "trust your gut — when something feels off, calling your provider is always the right move."
    }
  }
};

// WEEK 16 (authored + accuracy-verified 2026-06-21)
const WEEK_16: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 16",
        "title": "the 4-month\nregression starts",
        "say": "it's real, not you",
        "body": "if naps just got short and nights got bumpy, your baby's sleep is maturing into more adult-like cycles — a developmental leap, not a setback."
      },
      {
        "color": "rose",
        "eyebrow": "swaddle's done",
        "title": "sleep sack,\narms free now",
        "say": "the moment rolling hints",
        "body": "the second you see any sign of rolling, retire the swaddle for good. a sleep sack with arms out is the safe next step."
      },
      {
        "color": "honey",
        "eyebrow": "safe sleep stays",
        "title": "back, firm,\nempty — always",
        "say": "every sleep, every time",
        "body": "always start on the back, on a firm flat surface, with nothing else in there. once baby can roll both ways on their own, you don't have to flip them back."
      },
      {
        "color": "caramel",
        "eyebrow": "steady wins",
        "title": "keep your\nroutine boring",
        "say": "consistency soothes",
        "body": "a calm, same-every-night wind-down is your best tool through the bumps. predictability helps the new sleep cycles settle."
      },
      {
        "color": "blush",
        "eyebrow": "hang in there",
        "title": "this phase\nhas an end",
        "say": "it really passes",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "swap the swaddle for a sleep sack if rolling has started",
          "note": "arms out"
        },
        {
          "label": "start every sleep on the back, firm flat surface"
        },
        {
          "label": "keep the sleep space empty — no blankets, pillows, or toys"
        },
        {
          "label": "aim for 2–2.5 hr wake windows"
        },
        {
          "label": "hold your wind-down routine steady through the bumps"
        },
        {
          "label": "keep room-sharing, not bed-sharing"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to ride out the regression",
      "items": [
        "keep the same calm bedtime routine every night",
        "watch wake windows so baby isn't overtired",
        "put down drowsy but awake when you can",
        "keep the room dark with white noise",
        "go easy on yourself — it's a phase, not a habit"
      ],
      "foot": "it usually eases within a few weeks; call your pediatrician if sleep changes worry you or drag on."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 16",
        "title": "milk is still\nthe whole meal",
        "say": "no solids yet",
        "body": "around 4 months, breast milk or formula is still everything your baby needs — and a busy, distracted feeder is right on schedule."
      },
      {
        "color": "rose",
        "eyebrow": "not yet",
        "title": "solids can\nwait a bit",
        "say": "around 6 months",
        "body": "there's no rush to start food. solids usually wait until closer to 6 months, when the readiness signs line up together."
      },
      {
        "color": "honey",
        "eyebrow": "start watching",
        "title": "the signs\nto look for",
        "say": "signs, not a date",
        "body": "steady head control, sitting with support, eyeing your plate, and the tongue-thrust reflex fading. one early sign isn't the green light — wait for the whole picture."
      },
      {
        "color": "caramel",
        "eyebrow": "the wiggly eater",
        "title": "easily pulled\noff the feed",
        "say": "normal phase",
        "body": "baby notices everything now and may unlatch to look around. a dim, quiet spot helps them settle in and finish."
      },
      {
        "color": "blush",
        "eyebrow": "you're nourishing them",
        "title": "output is your\nfullness check",
        "say": "count diapers",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast milk or formula on demand"
        },
        {
          "label": "hold off on solids until ~6 months and readiness signs"
        },
        {
          "label": "feed in a calm, low-distraction spot if baby keeps pulling off"
        },
        {
          "label": "no honey, no cow's milk as a drink, no water yet",
          "note": "all wait for later"
        },
        {
          "label": "watch wet diapers as your getting-enough check"
        },
        {
          "label": "bring up starting solids at the 4-month well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things that are normal at 4 months",
      "items": [
        "shorter, more efficient feeds",
        "pulling off to look around mid-feed",
        "a growth-spurt jump in appetite",
        "more drool around feeds",
        "wanting to feed for comfort, not just hunger"
      ],
      "foot": "breast milk or formula only — confirm any solids timing with your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 16",
        "title": "hello,\nfour months",
        "say": "a big leap",
        "body": "reaching, grabbing, rolling, drooling, finding hands and mouth — this is one of the busiest, most delightful stretches yet."
      },
      {
        "color": "rose",
        "eyebrow": "grab and gum",
        "title": "hands go\nstraight to mouth",
        "say": "everything tastes",
        "body": "baby is reaching, grabbing, and mouthing whatever they catch. it's healthy exploring — just keep small or loose objects out of reach."
      },
      {
        "color": "honey",
        "eyebrow": "rolling watch",
        "title": "the roll is\ncoming soon",
        "say": "ranges, not deadlines",
        "body": "many babies start rolling around now, often tummy to back first. some take a while longer, and that's well within normal."
      },
      {
        "color": "caramel",
        "eyebrow": "drool city",
        "title": "so much\ndribble now",
        "say": "not always teeth",
        "body": "extra drool and chewing on hands can start around 4 months. it might mean teething's on the way, or it might just be a 4-month thing."
      },
      {
        "color": "blush",
        "eyebrow": "every baby's own pace",
        "title": "milestones are\nranges not races",
        "say": "no behind here",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "offer safe things to grab and mouth"
        },
        {
          "label": "give daily floor and tummy time to practice rolling"
        },
        {
          "label": "never leave baby alone on a bed, couch, or changing table",
          "note": "rolling can start any day"
        },
        {
          "label": "keep small or loose objects out of reach"
        },
        {
          "label": "talk and play face-to-face to fuel babbling"
        },
        {
          "label": "bring milestone questions to the 4-month well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things showing up around now",
      "items": [
        "reaching for and grabbing objects on purpose",
        "bringing hands and toys to the mouth",
        "rolling, often tummy to back first",
        "lots of drool and chewing on hands",
        "laughing and louder, chattier babbling"
      ],
      "foot": "these are typical ranges, not deadlines — share any milestone questions with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 16",
        "title": "tender days,\ngentle care",
        "say": "you've got this",
        "body": "a sleep shake-up plus new drool can make for fragile stretches. small steadying habits help you both feel grounded."
      },
      {
        "color": "rose",
        "eyebrow": "soothing drool",
        "title": "keep that\nchin dry",
        "say": "head off rashes",
        "body": "pat the drool away and keep the chin and neck dry to prevent a rash. a clean, dry bib swap goes a long way."
      },
      {
        "color": "honey",
        "eyebrow": "if gums ache",
        "title": "easing sore\nlittle gums",
        "say": "if teething starts",
        "body": "a clean chilled (not frozen) teether or your clean finger can soothe. skip teething necklaces, gels, and tablets — they're not safe."
      },
      {
        "color": "caramel",
        "eyebrow": "4-month visit",
        "title": "checkup and\nmaybe shots",
        "say": "mild fuss is ok",
        "body": "the 4-month visit often includes vaccines; a little fussiness or low fever can follow. your pediatrician will guide you on comfort."
      },
      {
        "color": "blush",
        "eyebrow": "one day at a time",
        "title": "steady beats\nperfect here",
        "say": "go gently",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "keep chin and neck dry to prevent drool rash"
        },
        {
          "label": "offer a clean chilled teether if gums seem sore",
          "note": "chilled, never frozen"
        },
        {
          "label": "book or keep the 4-month well-visit"
        },
        {
          "label": "skip teething necklaces, numbing gels, and tablets"
        },
        {
          "label": "expect mild fussiness or low fever after vaccines",
          "note": "follow your pediatrician's guidance"
        },
        {
          "label": "lean on your support people on the hard days"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 safe teething soothers",
      "items": [
        "a clean chilled (not frozen) teether ring",
        "your clean finger to rub the gums",
        "a cool, clean washcloth to gnaw",
        "extra cuddles and calm",
        "a dry bib to keep skin comfortable"
      ],
      "foot": "teething doesn't cause a true fever — avoid amber necklaces, numbing gels, and tablets, and call your pediatrician about any fever or concern."
    }
  }
};

// WEEK 18 (authored + accuracy-verified 2026-06-21)
const WEEK_18: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 18",
        "title": "deep in the\nregression",
        "say": "this is the middle",
        "body": "if sleep is still all over the place, you're not doing anything wrong — your baby's sleep is rewiring, and the steadiest thing you can offer right now is a boring, predictable routine."
      },
      {
        "color": "rose",
        "eyebrow": "boring wins",
        "title": "keep the\nroutine dull",
        "say": "consistency over tricks",
        "body": "same wind-down, same order, same calm every night. it feels too simple to matter, but predictability is exactly what helps a regressing baby settle."
      },
      {
        "color": "honey",
        "eyebrow": "arms always out",
        "title": "sleep sack,\nnever swaddle",
        "say": "once rolling's near",
        "body": "if your baby is rolling or close to it, swaddling is done for good. use a sleep sack with arms free, on the back, on a firm flat surface, with nothing else in there."
      },
      {
        "color": "caramel",
        "eyebrow": "don't flip",
        "title": "if they roll,\nleave them",
        "say": "back to start, then free",
        "body": "keep placing baby down on the back. once they can roll both ways on their own, you don't need to flip them back through the night."
      },
      {
        "color": "blush",
        "eyebrow": "almost through",
        "title": "it really does\npass soon",
        "say": "a few weeks tops",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep the same wind-down every single night",
          "note": "predictable beats clever"
        },
        {
          "label": "put baby down on the back, firm flat surface"
        },
        {
          "label": "sleep sack with arms out — no more swaddle if rolling"
        },
        {
          "label": "clear the space — no blankets, pillows, bumpers, or toys"
        },
        {
          "label": "keep room-sharing, not bed-sharing"
        },
        {
          "label": "resist big new sleep experiments mid-regression"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to ride out the regression",
      "items": [
        "keep wake windows around 2–2.5 hours",
        "hold one calm, repeatable bedtime routine",
        "respond consistently so nights feel predictable",
        "protect an early bedtime when naps fall apart",
        "take shifts with a partner so you can rest too"
      ],
      "foot": "it typically passes within a few weeks — if poor sleep drags on or worries you, check in with your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 18",
        "title": "still milk,\nstill enough",
        "say": "nothing new needed",
        "body": "breast milk or formula is still everything your baby needs right now — no solids, no water, no extras, even though they seem so interested in everything."
      },
      {
        "color": "rose",
        "eyebrow": "not yet",
        "title": "solids can\nwait a bit",
        "say": "around 6 months",
        "body": "the curiosity is real, but interest alone isn't readiness. solids usually start closer to 6 months, once the full set of signs line up."
      },
      {
        "color": "honey",
        "eyebrow": "busy eater",
        "title": "the distracted\nmid-feed pull",
        "say": "normal phase",
        "body": "a 4-month-old notices everything and may pop off to look around. a calm, dim, quiet spot helps them settle in and actually finish."
      },
      {
        "color": "caramel",
        "eyebrow": "how to tell",
        "title": "trust the\ndiaper count",
        "say": "output over ounces",
        "body": "regular wet diapers and steady growth are your best fullness check. you don't need to measure every feed to know it's working."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "milk is the\nwhole menu",
        "say": "no solids yet",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast milk or formula on demand"
        },
        {
          "label": "hold off on solids until ~6 months and readiness signs"
        },
        {
          "label": "feed in a calm, low-distraction spot if they pull off"
        },
        {
          "label": "watch wet diapers as your fullness check"
        },
        {
          "label": "no honey, cow's milk as a drink, or water yet"
        },
        {
          "label": "expect appetite to swing with the regression"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 solids readiness signs (for later)",
      "items": [
        "sits with support and holds head steady",
        "shows real, reaching interest in your food",
        "tongue-thrust reflex has faded",
        "brings hands and objects to the mouth",
        "opens up and leans toward a spoon"
      ],
      "foot": "these point to ~6 months — confirm timing and your baby's readiness with your pediatrician."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 18",
        "title": "hands on\neverything",
        "say": "busy little brain",
        "body": "mid-4-months is a grab-and-explore stretch — reaching, gripping, and mouthing whatever they can reach. it's exactly how they learn the world right now."
      },
      {
        "color": "rose",
        "eyebrow": "grab and gum",
        "title": "the mouth\nis the lab",
        "say": "everything tastes",
        "body": "your baby tests objects by mouthing them, so keep small or loose pieces, cords, and choking hazards well out of reach. it's curiosity, not a problem."
      },
      {
        "color": "honey",
        "eyebrow": "rolling both ways",
        "title": "the next\nbig roll",
        "say": "ranges, not races",
        "body": "after tummy-to-back, many babies start working on back-to-tummy around now. some get there later, and that's still completely normal."
      },
      {
        "color": "caramel",
        "eyebrow": "floor time",
        "title": "give room\nto practice",
        "say": "daily, safe space",
        "body": "a little floor time each day builds the strength behind rolling and reaching. supervised tummy time still counts and still helps."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "title": "milestones are\nranges not deadlines",
        "say": "no baby is behind",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "offer safe, easy-to-grab things to mouth"
        },
        {
          "label": "give daily floor time to practice rolling both ways"
        },
        {
          "label": "keep small or loose objects and cords out of reach"
        },
        {
          "label": "never leave baby alone on a high surface",
          "note": "rolling can surprise you any day"
        },
        {
          "label": "keep bibs handy for the drool"
        },
        {
          "label": "jot any milestone questions for the next well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things showing up around now",
      "items": [
        "grabbing and bringing everything to the mouth",
        "working on rolling both ways",
        "tracking and reaching for objects they see",
        "louder babbling, squeals, and laughs",
        "studying faces and their own hands"
      ],
      "foot": "these are typical ranges, not deadlines — bring any milestone questions to your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 18",
        "title": "steady hands\nfor a hard week",
        "say": "go gently on you",
        "body": "a long regression wears on a parent too. small, repeatable routines steady both of you, and resting when you can is real care, not a luxury."
      },
      {
        "color": "rose",
        "eyebrow": "wet chins",
        "title": "keep skin\ndry and happy",
        "say": "pat, don't rub",
        "body": "with all the drool and mouthing, gently pat the chin and neck dry and swap damp bibs. a little barrier balm can help head off drool rash."
      },
      {
        "color": "honey",
        "eyebrow": "sore gums",
        "title": "soothing if\nteething starts",
        "say": "safe tools only",
        "body": "a clean chilled (not frozen) teether or your clean finger eases sore gums. skip teething necklaces, tablets, and numbing gels."
      },
      {
        "color": "caramel",
        "eyebrow": "after the shots",
        "title": "post-vaccine\ncomfort",
        "say": "mild and short",
        "body": "if the 4-month vaccines were recent, a little fussiness or low fever can follow. cuddles and your pediatrician's guidance carry you through it."
      },
      {
        "color": "blush",
        "eyebrow": "one day at a time",
        "title": "steady beats\nperfect here",
        "say": "you're doing it",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "pat chin and neck dry to prevent drool rash"
        },
        {
          "label": "swap damp bibs and clothes often"
        },
        {
          "label": "offer a clean chilled teether if gums seem sore",
          "note": "chilled, never frozen"
        },
        {
          "label": "skip teething necklaces, tablets, and numbing gels"
        },
        {
          "label": "watch for post-vaccine fussiness or low fever"
        },
        {
          "label": "lean on your people and rest when you can"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 safe soothers for a tender week",
      "items": [
        "a clean chilled (not frozen) teether ring",
        "a cool clean washcloth to gnaw on",
        "your clean finger to rub sore gums",
        "extra holding, calm, and contact",
        "a dry bib to keep skin comfortable"
      ],
      "foot": "teething doesn't cause a true fever — call your pediatrician about any fever, especially in a young baby, or anything that worries you."
    }
  }
};

// WEEK 19 (authored + accuracy-verified 2026-06-21)
const WEEK_19: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 19",
        "title": "four and a half,\nfinding calm",
        "say": "it does ease",
        "body": "for a lot of babies the four-month sleep shift is starting to settle now — the hardest part may already be behind you."
      },
      {
        "color": "rose",
        "eyebrow": "arms free now",
        "title": "sack on,\nswaddle off",
        "say": "the moment they roll",
        "body": "once baby can roll, swaddling stops for good. a sleep sack keeps them cozy with arms out and hips free."
      },
      {
        "color": "honey",
        "eyebrow": "wake windows",
        "title": "about two\nhours awake",
        "say": "watch, don't clock",
        "body": "most babies this age stay happily awake around 2 hours. a yawn or a faraway stare beats any schedule."
      },
      {
        "color": "caramel",
        "eyebrow": "back is best",
        "title": "rolls in the night,\nstill fine",
        "say": "always lay on back",
        "body": "keep placing baby down on the back. if they roll on their own now, you don't need to flip them back over."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "rest easy,\nrest often",
        "say": "small wins count",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "place baby on the back for every sleep"
        },
        {
          "label": "swap any swaddle for a sleep sack, arms out",
          "note": "stop swaddling once baby can roll"
        },
        {
          "label": "keep the crib bare — firm flat surface, nothing else"
        },
        {
          "label": "room-share, don't bed-share",
          "note": "ideally through the first year"
        },
        {
          "label": "aim for ~2 hour wake windows"
        },
        {
          "label": "keep a short, calm, repeatable bedtime routine"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about sleep right now",
      "items": [
        "the 4-month sleep shift often starts easing around now — hang in there",
        "rolling in the crib is normal; a bare crib keeps it safe",
        "swaddling is done once baby can roll — sleep sack from here",
        "an overtired baby fights sleep harder, so catch those early cues",
        "night sleep may start to consolidate a little — lean into it"
      ],
      "foot": "every baby's sleep is different — check with your pediatrician if something worries you."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 19",
        "title": "still milk,\nstill enough",
        "say": "no rush at all",
        "body": "breast milk or formula is still everything baby needs right now — there's no solid food quite yet."
      },
      {
        "color": "rose",
        "eyebrow": "not yet solids",
        "title": "wait for\nsix-ish months",
        "say": "around 6 months",
        "body": "solids usually start around 6 months. milk leads the way until then, every single feed."
      },
      {
        "color": "honey",
        "eyebrow": "drooling lots",
        "title": "wet chins,\nnot hunger",
        "say": "drool isn't a cue",
        "body": "teething drool and gnawing on fists is normal exploring, not a sign to start food. milk still covers it all."
      },
      {
        "color": "caramel",
        "eyebrow": "readiness signs",
        "title": "what you'll\nwatch for",
        "say": "signs, not age alone",
        "body": "soon you'll look for sitting with support, steady head, eyeing your plate, and the tongue-thrust reflex fading."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "feed calm,\nfeed close",
        "say": "follow their lead",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast milk or formula on demand"
        },
        {
          "label": "hold off on solids until ~6 months",
          "note": "wait for readiness signs, not just an age"
        },
        {
          "label": "treat extra drool as teething, not a hunger cue"
        },
        {
          "label": "no water as a drink yet",
          "note": "milk covers all hydration until solids start around 6 months"
        },
        {
          "label": "keep an eye on steady wet diapers and growth"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about feeding right now",
      "items": [
        "milk only — no solids before ~6 months and the readiness signs",
        "more drool and fist-chewing is teething, not a green light for food",
        "no honey before 12 months, ever — even a taste",
        "no cow's milk as a drink before 12 months",
        "trust wet diapers and steady weight gain over the clock"
      ],
      "foot": "feeding questions are perfect for your pediatrician — ask at the next well visit."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 19",
        "title": "reaching out,\ngrabbing on",
        "say": "so much to touch",
        "body": "hands are the big story right now — reaching, raking toys closer, and exploring everything with curiosity."
      },
      {
        "color": "rose",
        "eyebrow": "on the move",
        "title": "rolling\nand rocking",
        "say": "ranges, not deadlines",
        "body": "many babies are rolling both ways around now. some start any week — every baby has their own timeline."
      },
      {
        "color": "honey",
        "eyebrow": "propped up",
        "title": "sitting with\na little help",
        "say": "spotter close by",
        "body": "supported sitting is coming along — prop them with a hand or pillow and stay right there to catch the topple."
      },
      {
        "color": "caramel",
        "eyebrow": "hands at work",
        "title": "rake it in,\nmouth it out",
        "say": "small parts away",
        "body": "a raking grab brings toys closer, then straight to the mouth. keep anything small or choke-sized out of reach."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "play low,\nplay often",
        "say": "you're their favorite",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "offer easy-to-grab toys at arm's reach"
        },
        {
          "label": "practice supported sitting with a spotter close"
        },
        {
          "label": "keep daily tummy time for rolling and core strength"
        },
        {
          "label": "sweep small or choke-sized objects out of reach",
          "note": "everything goes to the mouth right now"
        },
        {
          "label": "narrate, sing, and read face-to-face"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about growing right now",
      "items": [
        "reaching and raking objects closer is a big new skill",
        "rolling both ways may be here — or coming soon, both are fine",
        "supported sitting builds with practice and a close spotter",
        "teething drool can show up well before any tooth does",
        "milestones are ranges, not deadlines — never a race"
      ],
      "foot": "well visits are the place to track milestones — bring any questions to your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 19",
        "title": "drool, gums,\nand grace",
        "say": "you're doing great",
        "body": "teething feelings can start now even with no tooth in sight — a little extra fussiness is normal and it passes."
      },
      {
        "color": "rose",
        "eyebrow": "sore gums",
        "title": "cool and\nclean comfort",
        "say": "ask before any meds",
        "body": "a clean, chilled (not frozen) teether or a gentle gum rub can soothe. skip teething gels and check with your pediatrician first."
      },
      {
        "color": "honey",
        "eyebrow": "drool rash",
        "title": "pat dry,\nbarrier on",
        "say": "fragrance-free",
        "body": "all that drool can redden the chin. pat dry often and a plain barrier cream helps keep skin calm."
      },
      {
        "color": "caramel",
        "eyebrow": "between visits",
        "title": "know the\nfever rule",
        "say": "when in doubt, call",
        "body": "teething shouldn't cause a real fever. if baby seems truly unwell or you're worried, call your pediatrician."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "soothe slow,\nsoothe close",
        "say": "you've got this",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "offer a clean, chilled teether or a gentle gum rub",
          "note": "chilled, never frozen"
        },
        {
          "label": "pat drool dry and use a plain barrier cream on the chin"
        },
        {
          "label": "skip teething gels and necklaces",
          "note": "ask your pediatrician about any comfort meds"
        },
        {
          "label": "start wiping gums and any first tooth with a soft cloth"
        },
        {
          "label": "know the fever rule",
          "note": "real fever isn't from teething — call if you're worried"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about teething care",
      "items": [
        "a clean, chilled (not frozen) teether soothes sore gums",
        "skip teething gels, tablets, and amber necklaces — safety first",
        "teething causes drool and fussiness, not a true fever",
        "wipe gums and any new tooth with a soft, damp cloth",
        "drool rash settles with pat-drying and a plain barrier cream"
      ],
      "foot": "if baby seems truly unwell or feverish, that's a call to your pediatrician — not just teething."
    }
  }
};

// WEEK 20 (authored + accuracy-verified 2026-06-21)
const WEEK_20: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 20",
        "title": "sleep is\nfinding a rhythm",
        "say": "still bumpy, promise",
        "body": "around now nights can start to stretch and stitch together — even if yours hasn't yet, that's okay too."
      },
      {
        "color": "rose",
        "eyebrow": "wake windows",
        "title": "about two\nto two-and-a-half",
        "say": "watch, don't clock",
        "body": "most babies this age can stay up roughly 2 to 2.5 hours before getting tired. yawns, glazed eyes and fussiness are your real cues."
      },
      {
        "color": "honey",
        "eyebrow": "rolling now",
        "title": "swaddle's\ndone its job",
        "say": "retire it once rolling",
        "body": "once baby can roll, retire the swaddle and move to a sleep sack with arms out. it keeps them safe to roll both ways."
      },
      {
        "color": "caramel",
        "eyebrow": "back is best",
        "title": "always down\non the back",
        "say": "every nap, every night",
        "body": "keep laying baby down on their back on a firm flat surface. if they roll on their own in the night, you don't have to flip them back."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "rhythms come,\nthen they wobble",
        "say": "regressions pass",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "lay baby down on the back, every sleep"
        },
        {
          "label": "swap swaddle for an arms-out sleep sack",
          "note": "do this as soon as baby can roll"
        },
        {
          "label": "keep the crib bare — no pillows, bumpers, or toys"
        },
        {
          "label": "aim for ~2–2.5 hr awake between sleeps"
        },
        {
          "label": "room-share, don't bed-share"
        },
        {
          "label": "keep a short, steady wind-down before bed"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs baby's ready to sleep",
      "items": [
        "yawning or rubbing eyes and face",
        "looking away or zoning out",
        "fussier than they were a moment ago",
        "slower, calmer body and movements",
        "less interest in toys or your face"
      ],
      "foot": "every baby differs — follow your baby's cues over the clock."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 20",
        "title": "still just\nmilk for now",
        "say": "solids can wait",
        "body": "breast milk or formula is still everything your baby needs this week — no rush to add anything else."
      },
      {
        "color": "rose",
        "eyebrow": "almost, not yet",
        "title": "readiness signs\nare on the way",
        "say": "around six months",
        "body": "good head control, sitting with support and watching your food are early hints. real solids usually start closer to 6 months."
      },
      {
        "color": "honey",
        "eyebrow": "growth spurts",
        "title": "hungrier days\nhappen",
        "say": "totally normal",
        "body": "some weeks baby wants to feed more often for a few days. let them — your supply adjusts to meet the ask."
      },
      {
        "color": "caramel",
        "eyebrow": "easily distracted",
        "title": "the world is\nso interesting now",
        "say": "feeds get wiggly",
        "body": "babies this age pop off to look around. a calm, dim room can help them focus and finish."
      },
      {
        "color": "blush",
        "eyebrow": "trust the pace",
        "title": "milk first,\nfood later",
        "say": "no honey, no cow's milk",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast milk or formula on demand"
        },
        {
          "label": "hold off on solids until ~6 months / readiness signs"
        },
        {
          "label": "no honey before 12 months"
        },
        {
          "label": "no cow's milk as a drink before 12 months"
        },
        {
          "label": "feed in a calmer spot if baby keeps unlatching"
        },
        {
          "label": "watch wet diapers and weight at well-visits"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 solids-readiness signs (coming soon)",
      "items": [
        "sits with support and holds head steady",
        "watches your food and follows the spoon",
        "opens mouth or leans in toward food",
        "tongue-thrust reflex is fading",
        "reaches for and grabs things to mouth"
      ],
      "foot": "these usually line up around 6 months — ask your pediatrician before starting."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 20",
        "title": "hands are\ngetting busy",
        "say": "so much reaching",
        "body": "your baby is discovering they can grab the world — and bring almost all of it to their mouth."
      },
      {
        "color": "rose",
        "eyebrow": "hand to hand",
        "title": "passing toys\nside to side",
        "say": "a brand-new trick",
        "body": "many babies now move a toy from one hand to the other. offer light, easy-to-grip things to practice with."
      },
      {
        "color": "honey",
        "eyebrow": "sitting supported",
        "title": "propped up\nand looking around",
        "say": "spot them close",
        "body": "with a little support, baby can sit and take in the room. stay near — tipping over is part of learning."
      },
      {
        "color": "caramel",
        "eyebrow": "ranges, not races",
        "title": "every baby\non their own clock",
        "say": "never behind",
        "body": "milestones arrive across wide windows. if something feels off, your pediatrician is the best place to check."
      },
      {
        "color": "blush",
        "eyebrow": "wonder weeks",
        "title": "watching you\nfigure it out",
        "say": "you're their world",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "offer toys to pass hand to hand"
        },
        {
          "label": "practice supported sitting on the floor",
          "note": "stay within arm's reach"
        },
        {
          "label": "keep up daily tummy time"
        },
        {
          "label": "name what baby sees and touches out loud"
        },
        {
          "label": "keep small or loose objects out of reach",
          "note": "everything goes to the mouth now"
        },
        {
          "label": "bring questions to your well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things around 4.5–5 months",
      "items": [
        "reaches for and grabs nearby toys",
        "passes objects from hand to hand",
        "sits with support, head steady",
        "laughs, babbles and copies sounds",
        "explores everything by mouthing it"
      ],
      "foot": "these are typical ranges, not deadlines — mention any worries to your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 20",
        "title": "caring for them,\ncaring for you",
        "say": "both matter",
        "body": "as baby gets more curious and mobile, a few small tweaks keep everyone safe and steady this week."
      },
      {
        "color": "rose",
        "eyebrow": "drool central",
        "title": "lots of\nslobber lately",
        "say": "not always teething",
        "body": "extra drool and chewing on hands is common now. a soft bib and gentle cheek-wipes keep skin from getting raw."
      },
      {
        "color": "honey",
        "eyebrow": "rolling proof",
        "title": "the world\njust got bigger",
        "say": "never leave up high",
        "body": "now that baby can roll, never leave them on a bed, couch or changing table unattended — even for a second."
      },
      {
        "color": "caramel",
        "eyebrow": "after shots",
        "title": "a little fussy\nis okay",
        "say": "follow your ped",
        "body": "mild fussiness or a low fever can follow vaccines. lots of cuddles help — and call your provider if anything worries you."
      },
      {
        "color": "blush",
        "eyebrow": "you, too",
        "title": "rest when\nyou can",
        "say": "ask for help",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "never leave baby alone on a raised surface"
        },
        {
          "label": "wipe drool to protect cheeks and chin"
        },
        {
          "label": "keep small objects and cords out of reach"
        },
        {
          "label": "go to your scheduled well-visit / shots"
        },
        {
          "label": "call your pediatrician with any worry, anytime"
        },
        {
          "label": "take a real break for yourself when you can"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons to call your provider",
      "items": [
        "any fever, or one that won't ease",
        "not feeding or far fewer wet diapers",
        "unusually limp, very sleepy, or hard to wake",
        "any milestone worry that's nagging at you",
        "anything that just feels wrong to you"
      ],
      "foot": "you know your baby best — when in doubt, reach out; this isn't medical advice."
    }
  }
};

// WEEK 22 (authored + accuracy-verified 2026-06-21)
const WEEK_22: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 22",
        "title": "Rolling in\nthe crib.",
        "say": "that's safe now",
        "body": "once she can roll both ways on her own, you don't have to re-roll her at night — let her find her own comfy spot."
      },
      {
        "color": "rose",
        "eyebrow": "arms out",
        "title": "Sleep sack,\nno swaddle.",
        "say": "if you haven't yet",
        "body": "a rolling baby needs both arms free to push up. if you're still swaddling, switch to an arms-out sleep sack tonight."
      },
      {
        "color": "honey",
        "eyebrow": "still bare",
        "title": "Back, firm,\nempty.",
        "say": "every sleep",
        "body": "she still goes down on her back on a firm flat surface with nothing else in there. if she rolls to her tummy on her own, that's okay — you don't flip her back."
      },
      {
        "color": "caramel",
        "eyebrow": "a tooth?",
        "title": "Teething\nwakes.",
        "say": "comes and goes",
        "body": "a first tooth can stir up a few rough nights anytime now. keep your wind-down steady — it usually passes in a few days."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "She's\npracticing.",
        "say": "even at 3am",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "Arms-out sleep sack — no swaddle",
          "note": "essential once she can roll"
        },
        {
          "label": "Always place on the back to start"
        },
        {
          "label": "Let her settle in her own rolled position",
          "note": "once she rolls both ways, no need to flip her"
        },
        {
          "label": "Firm flat surface, nothing else in the crib"
        },
        {
          "label": "Keep the bedtime routine steady through teething"
        },
        {
          "label": "Room-share, not bed-share",
          "note": "through the first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Now that she rolls",
      "items": [
        "Stop swaddling — arms-out sleep sack only",
        "Still always lay her down on her back",
        "If she rolls to her tummy herself, leave her be",
        "Clear the crib: no bumpers, pillows, or loose blankets",
        "Lower the mattress before she's sitting unassisted"
      ],
      "foot": "Back-to-sleep + a bare crib never change. A baby who rolls and self-positions on their own is okay; the surface still has to be empty."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 22",
        "title": "Still milk,\nonly milk.",
        "say": "around 5 months",
        "body": "breast milk or formula is still her whole meal right now — everything she needs is in there."
      },
      {
        "color": "rose",
        "eyebrow": "not yet",
        "title": "Watch the\nsigns.",
        "say": "closer to 6 mo",
        "body": "solids usually wait until about 6 months and a few readiness cues showing up together: steady head control, sitting with support, and reaching for your food."
      },
      {
        "color": "honey",
        "eyebrow": "the big three",
        "title": "Readiness,\nnot a date.",
        "say": "together, not one",
        "body": "sits propped with steady head control, food stays in instead of getting pushed out, and real interest in your food. drooling or a tooth alone isn't a green light."
      },
      {
        "color": "caramel",
        "eyebrow": "still no",
        "title": "Skip the\nwater.",
        "say": "and no honey",
        "body": "no water as a drink yet, no honey before her first birthday, no cow's milk as a drink before 12 months. milk covers her hydration."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Almost\nthere.",
        "say": "soon, not now",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "Breast milk or formula only",
          "note": "no solids until ~6 mo + readiness signs"
        },
        {
          "label": "Watch for the readiness cues together",
          "note": "sits propped, food stays in, reaches for food"
        },
        {
          "label": "No water as a drink yet",
          "note": "small sips with solids ok around 6 mo"
        },
        {
          "label": "No honey before 12 months"
        },
        {
          "label": "No cow's milk as a drink before 12 months"
        },
        {
          "label": "Give her safe things to mouth — she explores everything now"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Ready for solids? (~6 mo)",
      "items": [
        "Sits propped with steady head control",
        "Food stays in instead of getting pushed back out",
        "Reaches for and watches your food",
        "Opens up when a spoon comes near",
        "Around double her birth weight"
      ],
      "foot": "Look for several of these together, not just one — and usually not before about 6 months. Check in with your pediatrician before you start."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 22",
        "title": "Rolling\nboth ways.",
        "say": "around 5 months",
        "body": "back-to-front and front-to-back may both be clicking now — and the floor just became her favorite gym."
      },
      {
        "color": "rose",
        "eyebrow": "sitting up",
        "title": "Propped &\nproud.",
        "say": "stay close",
        "body": "she can sit leaning on her hands or a pillow for a bit. circle her with cushions — tip-overs are part of learning."
      },
      {
        "color": "honey",
        "eyebrow": "everything in",
        "title": "Mouth\nexplorer.",
        "say": "it's how she learns",
        "body": "every toy goes straight to her mouth — that's normal mapping of her world. just keep small, button-sized things far out of reach."
      },
      {
        "color": "caramel",
        "eyebrow": "ranges, not races",
        "title": "Her own\ntiming.",
        "say": "no deadlines",
        "body": "some babies roll early, some sit early, some swap the order. these are wide ranges — bring any worry to your well-visit, you don't have to carry it alone."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "On the\nmove.",
        "say": "blink and she's grown",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "Floor time for rolling & reaching",
          "note": "clear, padded, supervised"
        },
        {
          "label": "Practice propped sitting with cushions"
        },
        {
          "label": "Offer big, mouth-safe toys",
          "note": "she's bringing everything to her mouth"
        },
        {
          "label": "Sweep the floor for small, choke-sized objects"
        },
        {
          "label": "Narrate, sing, and name things all day"
        },
        {
          "label": "Bring any milestone worry to the well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "What's coming next",
      "items": [
        "Now: rolls both ways, sits propped",
        "~5–6 mo: sits with less support",
        "~6 mo: passes a toy hand to hand",
        "~4–7 mo: a first tooth (range is wide)",
        "~6–9 mo: begins to scoot or creep"
      ],
      "foot": "Every baby's timing is their own — these are typical ranges, not deadlines. A first tooth can appear anywhere from about 4 to 7 months, sometimes later."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 22",
        "title": "Here comes\na tooth.",
        "say": "anytime now",
        "body": "the first tooth can pop through anytime in these months — sore gums, drool, and chewing are the usual heads-up."
      },
      {
        "color": "rose",
        "eyebrow": "soothe gums",
        "title": "Cool &\nchewy.",
        "say": "skip the gels",
        "body": "a clean chilled (not frozen) teether or a cool damp cloth helps. skip teething gels and amber necklaces — they're not safe."
      },
      {
        "color": "honey",
        "eyebrow": "tiny tooth",
        "title": "Wipe it\ndaily.",
        "say": "from tooth one",
        "body": "once a tooth shows, wipe it with a soft damp cloth or a tiny soft brush. ask your pediatrician about whether to start toothpaste and how much."
      },
      {
        "color": "caramel",
        "eyebrow": "mouthing safety",
        "title": "Choke-\nproof it.",
        "say": "she mouths it all",
        "body": "if it fits through a toilet-paper tube, it's a choking risk. check toys for loose parts and keep coins, caps, and button batteries away."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Gentle\ndoes it.",
        "say": "soft & steady",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "Offer a chilled (not frozen) teether"
        },
        {
          "label": "Wipe new teeth with a soft cloth or tiny brush",
          "note": "ask your pediatrician about starting toothpaste"
        },
        {
          "label": "Skip teething gels & amber necklaces",
          "note": "not considered safe"
        },
        {
          "label": "Choke-check every toy",
          "note": "no parts smaller than a TP tube"
        },
        {
          "label": "Lock away button batteries, coins & caps"
        },
        {
          "label": "Call your provider for a true fever or rash with teething",
          "note": "teething doesn't cause high fevers"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Teething, the calm way",
      "items": [
        "Chilled teether or cool damp cloth on the gums",
        "A clean finger to rub sore gums works too",
        "Wipe drool often to head off a rash",
        "Wipe each new tooth daily; no bottle in the crib",
        "Skip teething gels, tablets, and amber necklaces"
      ],
      "foot": "Teething can mean fussiness and low-grade warmth, but not a true fever or diarrhea — if those show up, call your pediatrician. At any age, a fever in a baby under 3 months (rectal 100.4°F / 38°C) is always an immediate call."
    }
  }
};

// WEEK 23 (authored + accuracy-verified 2026-06-21)
const WEEK_23: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 23",
        "title": "five and a half\nmonths in",
        "say": "you're doing great",
        "body": "sleep may be finding more of a rhythm now — lean into the calm where you can."
      },
      {
        "color": "rose",
        "eyebrow": "arms out",
        "title": "sleep sack,\nnot swaddle",
        "say": "once they roll",
        "body": "if baby is rolling, swaddling stays retired. a sleep sack keeps them cozy with arms free and hips moving."
      },
      {
        "color": "honey",
        "eyebrow": "wake windows",
        "title": "about two\nand a half",
        "say": "cues beat the clock",
        "body": "many babies this age happily stay awake around 2 to 2.5 hours. yawns and zoning out still tell you more than the time."
      },
      {
        "color": "caramel",
        "eyebrow": "back is best",
        "title": "down on the back,\nevery time",
        "say": "let them re-settle",
        "body": "always place baby on the back to sleep. if they roll on their own in the night, you can let them be."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "rest easy,\nstay close",
        "say": "small wins count",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "place baby on the back for every sleep"
        },
        {
          "label": "use a sleep sack with arms out, no swaddle",
          "note": "once baby can roll"
        },
        {
          "label": "keep the crib bare — firm flat surface, nothing else"
        },
        {
          "label": "room-share, don't bed-share",
          "note": "ideally through the first year"
        },
        {
          "label": "aim for ~2 to 2.5 hr wake windows"
        },
        {
          "label": "keep a short, calm, repeatable bedtime routine"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about sleep at 5.5 months",
      "items": [
        "a bare crib keeps rolling safe — nothing else in there",
        "wake windows stretch to about 2 to 2.5 hours for many babies now",
        "night sleep may be consolidating into longer stretches",
        "teething or a leap can ruffle sleep for a few nights",
        "overtired babies fight sleep harder, so watch those cues"
      ],
      "foot": "every baby's sleep is different — check with your pediatrician if something worries you."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 23",
        "title": "still milk,\nstill the whole meal",
        "say": "no rush at all",
        "body": "breast milk or formula is still everything baby needs — solids are close, but not quite yet."
      },
      {
        "color": "rose",
        "eyebrow": "prep mode",
        "title": "set the\nhigh chair up",
        "say": "a week or two early",
        "body": "solids usually begin around 6 months, so now's a great time to set up the high chair and grab a few easy-wipe bibs."
      },
      {
        "color": "honey",
        "eyebrow": "make a plan",
        "title": "pick a few\nfirst foods",
        "say": "iron-rich first",
        "body": "jot down a starter list — iron-fortified cereal, pureed meat, beans, lentils. you'll offer one at a time when the day comes."
      },
      {
        "color": "caramel",
        "eyebrow": "readiness signs",
        "title": "watch for\nthe green light",
        "say": "signs, not age alone",
        "body": "sits steady with support, holds the head up, eyes your plate, and the tongue-thrust reflex has faded. those signs together are the go-ahead."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "feed calm,\nfeed close",
        "say": "follow their lead",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep offering breast milk or formula on demand"
        },
        {
          "label": "set up the high chair and a few bibs",
          "note": "so you're ready around 6 months"
        },
        {
          "label": "make a short first-foods plan",
          "note": "iron-rich foods to start"
        },
        {
          "label": "hold off on actual solids until ~6 months",
          "note": "readiness signs matter more than the calendar"
        },
        {
          "label": "no honey and no cow's milk as a drink before 12 months"
        },
        {
          "label": "skip water as a drink until ~6 months with solids"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to prep for solids",
      "items": [
        "set up a sturdy high chair with a snug, supportive seat",
        "stock easy-wipe bibs, soft spoons, and a couple of small bowls",
        "plan iron-rich firsts: fortified cereal, pureed meat, beans, lentils",
        "plan to introduce one new food at a time, a few days apart",
        "remember milk still leads — first foods are practice, not full meals"
      ],
      "foot": "talk to your pediatrician before starting solids, especially if baby was early or has health concerns."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 23",
        "title": "steadier,\nbusier, here",
        "say": "ranges, not races",
        "body": "around five and a half months babies get more capable by the day — each on their own clock."
      },
      {
        "color": "rose",
        "eyebrow": "sitting steady",
        "title": "propped up\nand sturdier",
        "say": "stay within reach",
        "body": "baby may sit with support and wobble less now. cushions and your hands make a safe spot to practice."
      },
      {
        "color": "honey",
        "eyebrow": "raking & reaching",
        "title": "grab, hold,\npass it over",
        "say": "everything's a snack",
        "body": "baby may rake toys in with the whole hand and pass them from hand to hand. expect it all to head for the mouth."
      },
      {
        "color": "caramel",
        "eyebrow": "first sounds",
        "title": "babble\nbegins",
        "say": "talk back to them",
        "body": "babbling sounds may be starting to show up — not words yet, just play. answer them and you're teaching conversation."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "grow gentle,\ngrow free",
        "say": "their own pace",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "practice supported sitting within arm's reach"
        },
        {
          "label": "offer easy-to-grab toys to rake and pass hand to hand"
        },
        {
          "label": "keep small or mouth-sized objects out of reach",
          "note": "everything goes in the mouth now"
        },
        {
          "label": "babble back and chat — answering builds language"
        },
        {
          "label": "make safe floor time for rolling and reaching"
        },
        {
          "label": "bring up milestones at your next well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things showing up around now",
      "items": [
        "sitting steadier with support and less wobble",
        "raking toys in and transferring hand to hand",
        "bringing nearly everything to the mouth to explore",
        "babbling — repeated sounds like ba-ba may begin",
        "turning toward your voice and watching faces closely"
      ],
      "foot": "milestones are ranges, not deadlines — share any concerns with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 23",
        "title": "busy baby,\ncozy you",
        "say": "you're doing great",
        "body": "as baby reaches and rolls more, a little babyproofing and a lot of cuddles go a long way."
      },
      {
        "color": "rose",
        "eyebrow": "moving more",
        "title": "rolls fast,\nso stay low",
        "say": "never leave up high",
        "body": "now that baby rolls and reaches, never leave them on a bed, couch, or changing table alone. the floor is safest."
      },
      {
        "color": "honey",
        "eyebrow": "mouthing everything",
        "title": "scan the\nfloor low",
        "say": "get on their level",
        "body": "anything small enough to fit in the mouth is a choking risk. do a quick floor sweep at baby's eye level each day."
      },
      {
        "color": "caramel",
        "eyebrow": "drool & maybe teeth",
        "title": "wet chins\nneed care",
        "say": "pat, don't rub",
        "body": "drool can irritate skin — pat the chin dry and a gentle barrier balm can help. a clean, chilled teether soothes sore gums."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "care soft,\ncare sure",
        "say": "trust your gut",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "never leave a rolling baby on a raised surface"
        },
        {
          "label": "do a daily floor sweep for small or mouthable hazards"
        },
        {
          "label": "pat drool dry and soothe any chin redness gently"
        },
        {
          "label": "offer a clean, chilled teether for sore gums"
        },
        {
          "label": "keep up with well-visits and any due vaccines"
        },
        {
          "label": "call your provider for anything that worries you",
          "note": "trust your instincts"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons to call your pediatrician",
      "items": [
        "any fever or illness that worries you — call, don't wait it out",
        "no sitting with support, reaching, or interest in objects",
        "not babbling, turning to sounds, or watching faces",
        "very stiff or very floppy muscle tone",
        "anything that just feels off to you as the parent"
      ],
      "foot": "you know your baby best — a quick call is always worth it when in doubt."
    }
  }
};

// WEEK 24 (authored + accuracy-verified 2026-06-21)
const WEEK_24: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 24",
        "title": "almost six months,\nstill the back",
        "say": "every nap, every night",
        "body": "no matter how big they're getting, sleep stays simple: back, firm flat surface, nothing else in there."
      },
      {
        "color": "rose",
        "eyebrow": "rolling pro",
        "title": "they flip,\nyou don't flip out",
        "say": "if they can roll",
        "body": "once baby rolls both ways on their own, you can let them find their own sleep position. you still always start them on the back."
      },
      {
        "color": "honey",
        "eyebrow": "sack not swaddle",
        "title": "arms out,\nstay cozy",
        "say": "no more swaddle",
        "body": "if you haven't already, retire the swaddle for a sleep sack with arms free. rolling babies need their arms to move."
      },
      {
        "color": "caramel",
        "eyebrow": "solids soon",
        "title": "food won't fix\nthe night yet",
        "say": "milk still leads",
        "body": "starting solids rarely means more sleep, despite the old myths. keep your wind-down routine doing the heavy lifting."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "you've got\nthe rhythm",
        "say": "one calm step at a time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "always place baby down on their back"
        },
        {
          "label": "swap swaddle for an arms-out sleep sack",
          "note": "a must once they can roll"
        },
        {
          "label": "keep the crib bare — no pillows, bumpers, or toys"
        },
        {
          "label": "room-share, don't bed-share"
        },
        {
          "label": "hold your bedtime routine steady even as days shift"
        },
        {
          "label": "keep the room cool, dark, and quiet"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 sleep truths near 6 months",
      "items": [
        "back to sleep, every single time — no exceptions",
        "rolling both ways is normal; you don't have to reposition them",
        "swaddle is done once they roll — sleep sack instead",
        "solids almost never mean longer stretches",
        "naps may be settling into a more predictable pattern"
      ],
      "foot": "every baby's sleep timeline differs — check in with your pediatrician with any worries."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 24",
        "title": "the first-foods\nmoment is near",
        "say": "milk still the main event",
        "body": "you're right at the doorway of solids — this week is about getting your simple, calm plan ready."
      },
      {
        "color": "rose",
        "eyebrow": "iron first",
        "title": "lead with\niron-rich foods",
        "say": "around 6 months",
        "body": "their iron stores are running low, so first foods like iron-fortified cereal, pureed meats, or beans pull real weight."
      },
      {
        "color": "honey",
        "eyebrow": "one at a time",
        "title": "single foods,\nspaced apart",
        "say": "a few days each",
        "body": "introduce one new single-ingredient food at a time so any reaction is easy to trace. no salt, no sugar, no honey."
      },
      {
        "color": "caramel",
        "eyebrow": "allergens early",
        "title": "don't wait\non allergens",
        "say": "small, calm, at home",
        "body": "offering common allergens like peanut and egg early and often can help. start with one at a time, in small amounts, on a calm day."
      },
      {
        "color": "blush",
        "eyebrow": "no pressure",
        "title": "milk first,\nfood is bonus",
        "say": "no rush, no pressure",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep breastmilk or formula as the main nutrition"
        },
        {
          "label": "plan an iron-rich first food to start with",
          "note": "fortified cereal, meats, or beans"
        },
        {
          "label": "offer one single-ingredient food at a time"
        },
        {
          "label": "introduce common allergens early, one at a time"
        },
        {
          "label": "skip honey, added salt, and added sugar entirely"
        },
        {
          "label": "wait for readiness signs before that first spoon",
          "note": "sits with support, good head control, mouths everything"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 first-foods basics",
      "items": [
        "iron-rich foods come first — stores are low by now",
        "one new single ingredient every few days",
        "introduce allergens early and one at a time",
        "no honey before 12 months, ever",
        "milk stays primary — solids are learning, not lunch"
      ],
      "foot": "ask your pediatrician about starting solids — especially before peanut or egg if your baby has severe eczema or a known food allergy."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 24",
        "title": "everything goes\nstraight to the mouth",
        "say": "this is how they learn",
        "body": "mouthing isn't a problem to stop — it's how your baby explores texture, weight, and the world right now."
      },
      {
        "color": "rose",
        "eyebrow": "sitting steadier",
        "title": "propped up,\nproud as ever",
        "say": "with a little support",
        "body": "many babies sit well with support now and may tripod on their own. floor time builds the core that holds them up."
      },
      {
        "color": "honey",
        "eyebrow": "grabby hands",
        "title": "reach, grab,\ntaste, repeat",
        "say": "keep small bits away",
        "body": "they'll snatch whatever's in reach and bring it close. it's great development — just sweep choking hazards out of range."
      },
      {
        "color": "caramel",
        "eyebrow": "ranges not races",
        "title": "their own\ntimeline wins",
        "say": "no such thing as behind",
        "body": "milestones arrive across wide windows. one baby tripods at five months, another at seven — both are right on time."
      },
      {
        "color": "blush",
        "eyebrow": "front row",
        "title": "watching them\nfigure it out",
        "say": "front-row seat",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give daily supervised floor and sitting practice"
        },
        {
          "label": "offer safe mouthing toys — clean, big, no small parts"
        },
        {
          "label": "sweep small objects out of reach for grabby hands"
        },
        {
          "label": "name what they touch to build language"
        },
        {
          "label": "follow your baby's pace, not a calendar"
        },
        {
          "label": "bring any milestone worries to your well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things to expect near 6 months",
      "items": [
        "sits with support, maybe a wobbly tripod",
        "brings nearly everything to the mouth",
        "reaches for and grabs objects on purpose",
        "babbles, laughs, and responds to their name",
        "rolls both ways for many babies"
      ],
      "foot": "milestones are ranges, not deadlines — share concerns with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 24",
        "title": "a big new\nchapter, calmly",
        "say": "you set the pace",
        "body": "solids, sitting, more grabbing — a lot is shifting, and going slow is exactly the right speed."
      },
      {
        "color": "rose",
        "eyebrow": "six-month visit",
        "title": "the check-up\nis a great moment",
        "say": "bring your questions",
        "body": "the 6-month well-visit often covers solids, sleep, and vaccines. jot down anything you've been wondering."
      },
      {
        "color": "honey",
        "eyebrow": "after shots",
        "title": "a little fussy\nis okay",
        "say": "follow your provider",
        "body": "mild fussiness or a low fever after vaccines can be normal. ask your pediatrician what's expected and when to call."
      },
      {
        "color": "caramel",
        "eyebrow": "baby-proof now",
        "title": "they move\nbefore you think",
        "say": "one step ahead",
        "body": "grabbing and scooting come fast. start lowering crib mattresses, anchoring furniture, and clearing small objects."
      },
      {
        "color": "blush",
        "eyebrow": "halfway there",
        "title": "halfway to one,\nand thriving",
        "say": "you're doing beautifully",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "schedule or attend the 6-month well-visit"
        },
        {
          "label": "write down your questions before the appointment"
        },
        {
          "label": "begin baby-proofing for a more mobile baby"
        },
        {
          "label": "lower the crib mattress as they sit up on their own"
        },
        {
          "label": "know your provider's after-vaccine guidance",
          "note": "what's normal vs. when to call"
        },
        {
          "label": "carve out a moment for your own rest too"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 care notes for this week",
      "items": [
        "the 6-month visit often covers solids, sleep, and shots",
        "mild post-vaccine fussiness can be normal — ask your provider",
        "baby-proof early; mobility arrives fast",
        "lower the crib mattress as they sit up",
        "always call your pediatrician when something feels off"
      ],
      "foot": "this is general guidance, not medical advice — your pediatrician knows your baby best."
    }
  }
};

// WEEK 25 (authored + accuracy-verified 2026-06-21)
const WEEK_25: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 25",
        "title": "almost six\nmonths",
        "say": "so close now",
        "body": "sleep is still finding its rhythm this close to half a year, and that's exactly on track."
      },
      {
        "color": "rose",
        "eyebrow": "wake windows",
        "title": "around two\nand a half",
        "say": "cues over clock",
        "body": "most babies this age stay happily awake roughly 2 to 2.5 hours. watch for the yawns and zone-outs, not the time."
      },
      {
        "color": "honey",
        "eyebrow": "arms always out",
        "title": "sack on,\nno swaddle",
        "say": "once they roll",
        "body": "if your baby is rolling, swaddling stays off for good. a sleep sack keeps them cozy with arms free and hips loose."
      },
      {
        "color": "caramel",
        "eyebrow": "never changes",
        "title": "back, bare,\nroom-share",
        "say": "every sleep",
        "body": "back to sleep on a firm flat surface with nothing else in there. keep room-sharing without bed-sharing through the first year."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "rest is a\nrhythm",
        "say": "some nights win",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "place baby on the back for every sleep"
        },
        {
          "label": "keep the crib bare — firm flat surface, nothing else"
        },
        {
          "label": "use a sleep sack with arms out if baby rolls",
          "note": "no swaddling once rolling starts"
        },
        {
          "label": "aim for ~2 to 2.5 hr wake windows"
        },
        {
          "label": "room-share, not bed-share",
          "note": "ideally through the first year"
        },
        {
          "label": "keep a calm, repeatable wind-down cue"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about sleep near 6 months",
      "items": [
        "night wakings are still common — normal, not a setback",
        "most babies settle around 2 to 3 naps a day now",
        "a steady wind-down helps more than a strict clock",
        "teething or a leap can ripple sleep for a few nights",
        "starting solids soon won't magically lengthen sleep"
      ],
      "foot": "every baby's sleep is different — ask your pediatrician what's normal for yours."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 25",
        "title": "getting set\nfor solids",
        "say": "not just yet",
        "body": "the big first bites are nearly here — this week is for spotting the readiness signs while milk stays the main event."
      },
      {
        "color": "rose",
        "eyebrow": "the readiness check",
        "title": "four signs\nto watch",
        "say": "all four, not some",
        "body": "sits with support, steady head control, eyeing your food, and the tongue-thrust reflex fading. when all four show up, your baby is ready."
      },
      {
        "color": "honey",
        "eyebrow": "still the main meal",
        "title": "milk leads\nthe way",
        "say": "solids are practice",
        "body": "breastmilk or formula is still your baby's main nutrition this whole first year. early solids are tastes and skill-building, not a replacement."
      },
      {
        "color": "caramel",
        "eyebrow": "two hard nos",
        "title": "no honey,\nno cow's milk",
        "say": "before 12 months",
        "body": "skip honey and cow's milk as a drink until after the first birthday. water as a drink waits for solids too — small sips with meals are fine then."
      },
      {
        "color": "blush",
        "eyebrow": "almost time",
        "title": "ready when\nthey're ready",
        "say": "follow their lead",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep milk or formula as the main nutrition"
        },
        {
          "label": "run the readiness check before any solids",
          "note": "sits supported, head control, interest, no tongue-thrust"
        },
        {
          "label": "hold off on solids until all the signs are there",
          "note": "around 6 months for most babies"
        },
        {
          "label": "plan iron-rich first foods for when you start",
          "note": "fortified cereal, pureed meat, beans"
        },
        {
          "label": "no honey and no cow's milk as a drink before 12 months"
        },
        {
          "label": "ask your provider if baby was early or has health concerns"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs your baby is ready for solids",
      "items": [
        "sits upright with support and holds the head steady",
        "watches your food and reaches or leans toward it",
        "opens the mouth when a spoon comes close",
        "tongue-thrust reflex has faded — food stays in, not pushed out",
        "this usually lines up around 6 months, not by age alone"
      ],
      "foot": "wait for the signs, not just the calendar — talk to your provider before starting, especially if baby was premature."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 25",
        "title": "steadier\nby the day",
        "say": "a whole new view",
        "body": "sitting is getting stronger and the world is opening up — these last weeks before six months are full of small, visible leaps."
      },
      {
        "color": "rose",
        "eyebrow": "sitting improving",
        "title": "propped up\nand proud",
        "say": "ranges, not deadlines",
        "body": "many babies sit with support now and some are inching toward solo sitting. keep cushions close for the gentle tip-overs."
      },
      {
        "color": "honey",
        "eyebrow": "book it",
        "title": "prep the\n6-month visit",
        "say": "worth the appointment",
        "body": "the 6-month well-check is coming up — it brings a growth check and another vaccine round. jot down any questions as they pop into your head."
      },
      {
        "color": "caramel",
        "eyebrow": "reaching out",
        "title": "grab, pass,\nexplore",
        "say": "hands are busy",
        "body": "baby is reaching, raking, and passing toys hand to hand. simple, safe objects to grab are perfect practice right now."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "title": "every baby,\ntheir timeline",
        "say": "milestones are ranges",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "book the 6-month well-visit if you haven't"
        },
        {
          "label": "start a running list of questions for the appointment"
        },
        {
          "label": "give safe floor time to practice sitting"
        },
        {
          "label": "keep soft landings nearby for tip-overs"
        },
        {
          "label": "offer easy-to-grab toys for reaching and passing"
        },
        {
          "label": "flag any milestone worries to your pediatrician",
          "note": "ranges are wide — they'll help you read them"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about growing near 6 months",
      "items": [
        "supported sitting is common now; solo sitting is around the corner",
        "babies start passing toys hand to hand and raking small objects",
        "interest in your food is a normal cue, not a demand to start early",
        "the 6-month visit usually includes another vaccine round",
        "stranger and separation awareness are signs of healthy attachment"
      ],
      "foot": "milestones are ranges, not deadlines — your pediatrician is the best guide if anything feels off."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 25",
        "title": "caring for\nyour explorer",
        "say": "new tricks, new safety",
        "body": "as baby sits taller and reaches farther, a few small care shifts keep these last pre-solids weeks safe and calm."
      },
      {
        "color": "rose",
        "eyebrow": "sitting leads to reaching",
        "title": "baby-proof\na little early",
        "say": "before they grab",
        "body": "a sitting baby reaches more than you'd expect. tuck away cords, small objects, and anything that fits through a toilet-paper tube."
      },
      {
        "color": "honey",
        "eyebrow": "gums and first teeth",
        "title": "keep the\nlittle mouth clean",
        "say": "soft and gentle",
        "body": "wipe gums and any new tooth with a soft cloth or tiny brush. teething drool and chewing are normal — a clean, chilled teether can soothe."
      },
      {
        "color": "caramel",
        "eyebrow": "set up for solids",
        "title": "a safe seat,\neyes on",
        "say": "never alone with food",
        "body": "when solids start soon, baby sits upright and buckled in, with you right there the whole time. it's worth getting the spot ready now."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing great",
        "title": "small steps,\nsafe space",
        "say": "trust your gut",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "start light baby-proofing as reaching grows"
        },
        {
          "label": "keep small objects and choking hazards out of reach"
        },
        {
          "label": "wipe gums and any new tooth gently",
          "note": "a soft cloth or tiny brush works"
        },
        {
          "label": "offer a clean teether for sore gums"
        },
        {
          "label": "ready a safe, upright feeding seat for solids soon"
        },
        {
          "label": "call your provider for fever or anything that worries you"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about care near 6 months",
      "items": [
        "a sitting baby can reach farther than you expect",
        "anything that fits through a toilet-paper tube is a choking risk",
        "teething drool, gnawing, and fussiness are usually normal",
        "you'll never leave baby alone with food once solids start",
        "a soft cloth keeps gums and first teeth clean and healthy"
      ],
      "foot": "for a high or lasting fever, trouble breathing, or anything alarming, call your provider right away — 911 for emergencies."
    }
  }
};

// WEEK 27 (authored + accuracy-verified 2026-06-21)
const WEEK_27: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 27",
        "title": "settling into\na rhythm",
        "say": "some nights win",
        "body": "around 6.5 months, sleep is finding more of a shape — and the wobbles in between are completely normal."
      },
      {
        "color": "rose",
        "eyebrow": "a loose routine",
        "title": "same steps,\nevery night",
        "say": "cues over clocks",
        "body": "a short, repeatable wind-down — feed, bath, book, dim lights — tells baby sleep is coming. it helps more than a strict schedule."
      },
      {
        "color": "honey",
        "eyebrow": "solids & sleep",
        "title": "food won't\nfix nights",
        "say": "a gentle myth",
        "body": "starting solids doesn't promise longer stretches. keep milk or formula as the main event, and let sleep come on its own timeline."
      },
      {
        "color": "caramel",
        "eyebrow": "still the basics",
        "title": "back, bare,\nroom-share",
        "say": "every single night",
        "body": "on the back, firm flat surface, nothing else in the crib — every sleep, all year. once baby rolls, it's a sleep sack with arms out, no swaddle."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "rest comes\nin waves",
        "say": "this is normal",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep a short, repeatable wind-down most nights"
        },
        {
          "label": "every sleep on the back, firm flat surface"
        },
        {
          "label": "crib stays empty — no pillows, bumpers, or blankets"
        },
        {
          "label": "sleep sack with arms out if baby rolls",
          "note": "no swaddling once rolling starts"
        },
        {
          "label": "room-share, not bed-share",
          "note": "through the first year"
        },
        {
          "label": "don't expect solids to lengthen night sleep"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about sleep at 6.5 months",
      "items": [
        "a predictable wind-down beats a rigid clock at this age",
        "night wakings are still common and not a setback",
        "solids don't reliably buy you longer stretches",
        "many babies hold a 2-3 nap rhythm now",
        "separation awareness can add some bedtime clinginess"
      ],
      "foot": "every baby's sleep is different — your pediatrician is the best guide for yours."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 27",
        "title": "finding a\nfood groove",
        "say": "messy is learning",
        "body": "a couple of weeks into solids, this is about practice and variety — milk or formula is still the main nutrition all year."
      },
      {
        "color": "rose",
        "eyebrow": "keep iron coming",
        "title": "iron-rich,\nagain & again",
        "say": "every day helps",
        "body": "iron stores dip around now, so keep offering iron-fortified cereal, pureed meats, beans, and lentils alongside new tastes."
      },
      {
        "color": "honey",
        "eyebrow": "one at a time",
        "title": "new allergens,\nspaced out",
        "say": "a few days apart",
        "body": "keep introducing common allergens like peanut and egg, one new food every few days, so any reaction is easy to spot."
      },
      {
        "color": "caramel",
        "eyebrow": "two hard nos",
        "title": "no honey,\nno cow's milk",
        "say": "before 12 months",
        "body": "skip honey and cow's milk as a drink until after the first birthday. small sips of water from an open or straw cup at meals are fine."
      },
      {
        "color": "blush",
        "eyebrow": "low pressure",
        "title": "offer, don't\npush",
        "say": "follow their lead",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep milk or formula as the main nutrition"
        },
        {
          "label": "offer iron-rich foods daily",
          "note": "fortified cereal, pureed meat, beans, lentils"
        },
        {
          "label": "keep introducing one new food every few days"
        },
        {
          "label": "continue common allergens early, one at a time"
        },
        {
          "label": "no honey and no cow's milk as a drink until 12 months"
        },
        {
          "label": "let baby practice open-cup or straw-cup water sips at meals"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about feeding now",
      "items": [
        "solids are still practice — milk does the heavy lifting",
        "keep iron-rich foods front and center every day",
        "introduce allergens one at a time, a few days apart",
        "never honey before 12 months — botulism risk",
        "gagging is loud but normal; true choking is silent"
      ],
      "foot": "watch for hives, swelling, vomiting, or trouble breathing with new foods — call your provider, and 911 for trouble breathing."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 27",
        "title": "busy little\nhands",
        "say": "so much reaching",
        "body": "around 6.5 months, baby is grabbing, mouthing, and steadying up — curiosity is running the show."
      },
      {
        "color": "rose",
        "eyebrow": "hands at work",
        "title": "raking &\npassing toys",
        "say": "ranges, not rules",
        "body": "many babies rake at small objects and pass a toy hand to hand now. some take longer, and that's perfectly okay."
      },
      {
        "color": "honey",
        "eyebrow": "steadier sitting",
        "title": "sitting with\nfewer wobbles",
        "say": "cushions nearby",
        "body": "sitting is getting sturdier, though tip-overs still happen. give plenty of safe floor time and keep soft landings close."
      },
      {
        "color": "caramel",
        "eyebrow": "i know you",
        "title": "separation\nawareness",
        "say": "a sign of bonding",
        "body": "protests when you leave the room are attachment growing, not a problem. quick goodbyes and warm returns build trust."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "title": "every baby,\ntheir timeline",
        "say": "milestones are ranges",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe, open floor time to practice sitting and reaching"
        },
        {
          "label": "offer easy-to-grasp toys to pass hand to hand"
        },
        {
          "label": "keep soft landings nearby for tip-overs"
        },
        {
          "label": "name objects and faces during play"
        },
        {
          "label": "expect more clinginess as separation awareness grows"
        },
        {
          "label": "flag any milestone worries to your pediatrician",
          "note": "ranges are wide — they'll help you read them"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about growing at 6.5 months",
      "items": [
        "raking small objects and passing toys hand to hand often start now",
        "sitting steadies, but the range for solo sitting is wide",
        "babbling with more sounds and turn-taking is common",
        "separation and stranger awareness show healthy attachment",
        "everything goes to the mouth — it's how babies explore"
      ],
      "foot": "milestones are ranges, not deadlines — your pediatrician is the best guide if anything feels off."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 27",
        "title": "caring for\na grabber",
        "say": "new reach, new rules",
        "body": "as baby sits steadier and reaches farther, a few small care shifts keep mealtimes and floor time safe."
      },
      {
        "color": "rose",
        "eyebrow": "mealtime safety",
        "title": "upright,\nbuckled, watched",
        "say": "eyes on, always",
        "body": "seat baby upright and strapped in for every meal, and stay within arm's reach. skip hard, round, or whole foods that can choke."
      },
      {
        "color": "honey",
        "eyebrow": "on the move",
        "title": "baby-proof\na step ahead",
        "say": "reaching beats crawling",
        "body": "a sitting baby grabs more than you'd guess. tuck away cords, small objects, and anything that fits through a toilet-paper tube."
      },
      {
        "color": "caramel",
        "eyebrow": "teething days",
        "title": "sore gums,\ngentle help",
        "say": "skip the gels",
        "body": "a clean cold teether or a chilled cloth soothes sore gums. avoid teething gels and amber necklaces, and keep wiping gums and any new teeth."
      },
      {
        "color": "blush",
        "eyebrow": "trust yourself",
        "title": "small steps,\nsafe space",
        "say": "trust your gut",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "always supervise meals — baby upright and buckled in"
        },
        {
          "label": "keep choking hazards and small objects out of reach"
        },
        {
          "label": "baby-proof a step ahead as reaching grows",
          "note": "cords, outlets, small items"
        },
        {
          "label": "soothe sore gums with a clean cold teether or cloth"
        },
        {
          "label": "wipe gums and any new teeth with a soft cloth or tiny brush"
        },
        {
          "label": "call your provider for fever or anything that worries you"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about care at 6.5 months",
      "items": [
        "never leave baby alone with food — choking risk is real",
        "skip whole grapes, nuts, popcorn, and hard chunks",
        "a sitting baby can reach farther than you expect",
        "cold teethers help; skip teething gels and amber necklaces",
        "trust your instincts — when in doubt, call your pediatrician"
      ],
      "foot": "for a fever, trouble breathing, or anything that alarms you, call your provider right away — 911 for emergencies."
    }
  }
};

// WEEK 28 (authored + accuracy-verified 2026-06-21)
const WEEK_28: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 28",
        "title": "sleep, around\nseven months",
        "say": "steadier nights ahead",
        "body": "sleep can get smoother now as days fill up with new movement and babble — and the basics stay exactly the same."
      },
      {
        "color": "rose",
        "eyebrow": "safe sleep stays",
        "title": "back, bare,\nclose by",
        "say": "every nap, every night",
        "body": "still on the back, on a firm flat surface with nothing else in there. room-share, don't bed-share, through the first year."
      },
      {
        "color": "honey",
        "eyebrow": "rolling baby",
        "title": "swaddle's done,\nsack's in",
        "say": "arms always out",
        "body": "once baby can roll, no more swaddling. a sleep sack with arms free keeps them cozy and able to shift on their own."
      },
      {
        "color": "caramel",
        "eyebrow": "new wakeups",
        "title": "missing you\nat night",
        "say": "this is normal",
        "body": "separation awareness is building, so some extra night wakeups can show up. a calm, boring check-in helps them settle back."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "steady wins\nthe night",
        "say": "one day at a time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep every sleep on the back, firm flat surface"
        },
        {
          "label": "swap any swaddle for an arms-out sleep sack",
          "note": "once baby rolls, swaddling stops for good"
        },
        {
          "label": "keep the crib bare — no pillows, bumpers, or loose blankets"
        },
        {
          "label": "room-share without bed-sharing",
          "note": "recommended through the first year"
        },
        {
          "label": "keep a short, predictable wind-down routine"
        },
        {
          "label": "offer calm, low-key comfort at night wakeups"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things that help sleep at 7 months",
      "items": [
        "a consistent wind-down: bath or wipe-down, pajamas, book, lights low",
        "letting baby practice rolling and sitting during awake time, not in the crib",
        "a dark, cool room and a little white noise if it helps",
        "putting baby down drowsy-but-awake so they can resettle on their own",
        "keeping middle-of-the-night check-ins quiet and brief"
      ],
      "foot": "every baby's sleep is different — talk to your pediatrician about big or sudden changes."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 28",
        "title": "new textures,\ntiny hands",
        "say": "breast or bottle leads",
        "body": "around now you can offer thicker textures and soft finger foods — milk is still the main event, food is for practice and joy."
      },
      {
        "color": "rose",
        "eyebrow": "soft and squishy",
        "title": "finger foods\nthat smush",
        "say": "squish-test everything",
        "body": "think soft-cooked veggie sticks or ripe fruit that mash between your fingers. let little hands explore and self-feed."
      },
      {
        "color": "honey",
        "eyebrow": "thicker textures",
        "title": "lumps are\ngood now",
        "say": "go at their pace",
        "body": "moving past smooth purees to mashed and lumpy textures helps baby learn to chew. follow their cues and don't rush."
      },
      {
        "color": "caramel",
        "eyebrow": "two hard nos",
        "title": "skip honey\nand cow's milk",
        "say": "both wait for one",
        "body": "no honey before 12 months, and no cow's milk as a drink before 12 months. small sips of water with meals are fine now."
      },
      {
        "color": "blush",
        "eyebrow": "messy is learning",
        "title": "let them\ndig in",
        "say": "bibs on, breathe",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep breastmilk or formula as the main source of nutrition"
        },
        {
          "label": "offer soft finger foods that squish between your fingers"
        },
        {
          "label": "introduce thicker, lumpier textures alongside purees"
        },
        {
          "label": "always supervise; sit baby upright and stay within reach"
        },
        {
          "label": "no honey and no cow's-milk drink before 12 months"
        },
        {
          "label": "offer small sips of water in an open or straw cup with meals"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 safe first finger foods to try",
      "items": [
        "soft-cooked carrot or sweet potato sticks",
        "ripe avocado or banana spears",
        "soft pieces of ripe pear or peach",
        "cooked, soft pasta pieces",
        "soft-cooked, well-mashed beans or lentils"
      ],
      "foot": "cut foods to avoid choking, skip hard/round/sticky items, and ask your pediatrician about introducing common allergens."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 28",
        "title": "sitting tall,\non the move",
        "say": "ranges, not deadlines",
        "body": "around now many babies sit steady and start rocking or scooting — every baby's timeline is their own."
      },
      {
        "color": "rose",
        "eyebrow": "steady sitter",
        "title": "hands free\nto play",
        "say": "spotter nearby",
        "body": "as sitting gets sturdier, baby can use both hands to explore toys. keep soft space around them for the tip-overs."
      },
      {
        "color": "honey",
        "eyebrow": "getting mobile",
        "title": "rocking on\nhands and knees",
        "say": "crawl styles vary",
        "body": "some babies rock, scoot backward, or army-crawl before true crawling. all of it counts as practice and progress."
      },
      {
        "color": "caramel",
        "eyebrow": "first sounds",
        "title": "ba-ba and\nda-da",
        "say": "talk back lots",
        "body": "babbling real consonants like ba and da is blooming. repeat their sounds and narrate your day to fuel it."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "title": "every baby,\ntheir timeline",
        "say": "celebrate small wins",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give floor time for sitting, rocking, and reaching"
        },
        {
          "label": "babble back and name things during everyday moments"
        },
        {
          "label": "offer toys just out of reach to invite scooting",
          "note": "only with close supervision"
        },
        {
          "label": "baby-proof low spaces before crawling kicks in"
        },
        {
          "label": "read together and point to pictures"
        },
        {
          "label": "bring questions or concerns to your well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things blooming around 7 months",
      "items": [
        "sitting steadily, often with hands free to play",
        "rocking on hands and knees or early scooting",
        "babbling repeated consonants like ba, da, ma",
        "passing toys from one hand to the other",
        "showing they know and prefer familiar faces"
      ],
      "foot": "milestones happen across a wide range — if something worries you, check in with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 28",
        "title": "a clingier,\nbusier baby",
        "say": "this is connection",
        "body": "as baby gets more mobile and more aware of you, big feelings can show up — it all means your bond is growing."
      },
      {
        "color": "rose",
        "eyebrow": "missing you",
        "title": "separation\nfeelings",
        "say": "normal and healthy",
        "body": "more clinginess and protest at goodbyes is right on track. quick, confident goodbyes help more than long ones."
      },
      {
        "color": "honey",
        "eyebrow": "on the move",
        "title": "baby-proof\nbefore they go",
        "say": "get down low",
        "body": "crawl the floor at their eye level. secure outlets, cords, and low cabinets, and anchor tippy furniture."
      },
      {
        "color": "caramel",
        "eyebrow": "little mouths",
        "title": "drool, gums,\nand teeth",
        "say": "comfort first",
        "body": "chewing and drooling may ramp up. offer a clean chilled teether and wipe gums or new teeth gently."
      },
      {
        "color": "blush",
        "eyebrow": "care for you too",
        "title": "you're the\nsafe place",
        "say": "rest when you can",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "baby-proof at floor level before crawling starts"
        },
        {
          "label": "anchor furniture and secure cords and outlets"
        },
        {
          "label": "keep goodbyes short, warm, and confident"
        },
        {
          "label": "offer a safe teether for sore gums",
          "note": "skip teething gels and amber necklaces"
        },
        {
          "label": "wipe new teeth and gums gently each day"
        },
        {
          "label": "keep up with well-visits and any due vaccines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to ease separation feelings",
      "items": [
        "play peekaboo to teach that you always come back",
        "keep a calm, predictable goodbye routine",
        "let a trusted caregiver follow your comfort cues",
        "narrate where you're going and that you'll return",
        "give extra cuddles after reunions, no big drama"
      ],
      "foot": "some clinginess is normal — call your pediatrician if your baby seems inconsolable or unwell."
    }
  }
};

// WEEK 29 (authored + accuracy-verified 2026-06-21)
const WEEK_29: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 29",
        "title": "almost seven\nmonths in",
        "say": "you're finding a rhythm",
        "body": "around seven months, sleep is settling for many babies — but night wakes still happen, and that's completely normal."
      },
      {
        "color": "rose",
        "eyebrow": "separation at night",
        "say": "a bonding sign",
        "title": "the bedtime\nclinginess",
        "body": "object permanence is clicking, so baby now knows you still exist when you leave. a little extra protest at bedtime is normal — calm, consistent goodnights help."
      },
      {
        "color": "honey",
        "eyebrow": "on the move",
        "say": "safety first",
        "title": "crawler in\nthe crib",
        "body": "as crawling prep kicks in, baby may push up or scoot in the crib. keep the mattress on its lowest setting and the crib totally bare."
      },
      {
        "color": "caramel",
        "eyebrow": "still the basics",
        "say": "every single night",
        "title": "back, bare,\nroom-share",
        "body": "back to sleep on a firm flat surface, nothing else in the crib. once baby can roll, it's a sleep sack with arms out — no swaddling. room-share through the first year."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "say": "some nights win",
        "title": "rest comes\nin waves",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep every sleep on the back, firm flat surface"
        },
        {
          "label": "lower the crib mattress as baby pushes up and scoots"
        },
        {
          "label": "keep the crib empty — no pillows, bumpers, or blankets"
        },
        {
          "label": "use a sleep sack with arms out, never a swaddle",
          "note": "swaddling stops once baby can roll"
        },
        {
          "label": "keep bedtime goodbyes calm and consistent",
          "note": "separation protest is normal now"
        },
        {
          "label": "room-share, not bed-share"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about sleep at 7 months",
      "items": [
        "night wakes can return as separation awareness grows — it's normal",
        "most babies are on 2-3 naps a day around now",
        "a steady wind-down cue helps more than a strict clock",
        "lower the crib mattress once baby pushes up or pulls to sit",
        "brief, calm goodnights ease bedtime clinginess"
      ],
      "foot": "every baby's sleep is different — talk to your pediatrician about what's normal for yours."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 29",
        "title": "getting the\nhang of it",
        "say": "messy is progress",
        "body": "a month or so into solids, eating is still mostly practice — milk or formula stays your baby's main nutrition all year."
      },
      {
        "color": "rose",
        "eyebrow": "little fingers",
        "say": "watch them learn",
        "title": "raking toward\nthe pincer",
        "body": "baby may rake food toward their palm now, with a true pincer grasp coming in the weeks ahead. soft, gummable finger foods give great practice."
      },
      {
        "color": "honey",
        "eyebrow": "keep going",
        "say": "a few days apart",
        "title": "more textures,\nmore tastes",
        "body": "thicker purees, soft lumps, and mashed foods build chewing skills. keep introducing one new food at a time so you can spot any reaction."
      },
      {
        "color": "caramel",
        "eyebrow": "two hard nos",
        "say": "before 12 months",
        "title": "no honey,\nno cow's milk",
        "body": "skip honey and cow's milk as a drink until after the first birthday. small sips of water from an open or straw cup with meals are fine."
      },
      {
        "color": "blush",
        "eyebrow": "follow their lead",
        "say": "appetites vary",
        "title": "one bite\nat a time",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep milk or formula as the main nutrition"
        },
        {
          "label": "offer soft, gummable finger foods for grasp practice"
        },
        {
          "label": "build up to thicker purees and soft lumps for chewing"
        },
        {
          "label": "introduce one new food at a time, a few days apart"
        },
        {
          "label": "keep offering iron-rich foods",
          "note": "meats, beans, lentils, fortified cereal"
        },
        {
          "label": "no honey and no cow's milk as a drink until 12 months"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about feeding at 7 months",
      "items": [
        "solids are still practice — milk or formula does the heavy lifting",
        "raking food toward the palm comes before the pincer grasp",
        "soft finger foods build hand skills and self-feeding",
        "gagging looks scary but is a normal part of learning to eat",
        "cut food soft and small — skip hard, round, or whole pieces"
      ],
      "foot": "never leave baby alone with food, and call 911 for any trouble breathing."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 29",
        "title": "on the edge\nof moving",
        "say": "a big season",
        "body": "rocking, reaching, and babbling — around seven months, baby is gearing up for some of the biggest leaps yet."
      },
      {
        "color": "rose",
        "eyebrow": "crawling prep",
        "say": "ranges, not deadlines",
        "title": "rocking on\nhands and knees",
        "body": "many babies push up and rock back and forth before crawling. some scoot, some skip crawling entirely — all of it is normal."
      },
      {
        "color": "honey",
        "eyebrow": "so much to say",
        "say": "talk right back",
        "title": "the babble\nis booming",
        "body": "strings of \"bababa\" and \"dadada\" are baby practicing sound. narrate your day and pause for their turn — it's how language grows."
      },
      {
        "color": "caramel",
        "eyebrow": "i know you",
        "say": "a healthy sign",
        "title": "stranger &\nseparation",
        "body": "baby may cling to you and get wary around new faces. object permanence means they know you can leave — quick goodbyes and warm returns build trust."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "say": "milestones are ranges",
        "title": "every baby,\ntheir timeline",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give plenty of safe floor time to rock and reach"
        },
        {
          "label": "babble back and narrate your day to grow language"
        },
        {
          "label": "play peekaboo to practice object permanence"
        },
        {
          "label": "keep goodbyes quick and returns warm"
        },
        {
          "label": "expect more clinginess around new faces",
          "note": "stranger anxiety is a bonding sign"
        },
        {
          "label": "flag any milestone worries to your pediatrician",
          "note": "ranges are wide — they'll help you read them"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about growing at 7 months",
      "items": [
        "rocking on hands and knees often comes before crawling",
        "not every baby crawls — scooting or skipping it is normal",
        "babbling with repeated sounds is early language at work",
        "stranger and separation anxiety are signs of healthy attachment",
        "peekaboo helps baby learn that you always come back"
      ],
      "foot": "milestones are ranges, not deadlines — your pediatrician is the best guide if anything feels off."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 29",
        "title": "caring for\na mover",
        "say": "new reach, new rules",
        "body": "as baby gears up to crawl, a little baby-proofing now keeps the whole world safer to explore."
      },
      {
        "color": "rose",
        "eyebrow": "baby-proof now",
        "say": "get down low",
        "title": "crawl the\nfloor first",
        "body": "get on the floor at baby's level and look. secure cords, outlets, and tip-prone furniture, and gate the stairs before crawling starts."
      },
      {
        "color": "honey",
        "eyebrow": "tiny hazards",
        "say": "eyes on, always",
        "title": "if it fits,\nit's a risk",
        "body": "a moving baby grabs everything. keep anything that fits through a toilet-paper tube — coins, caps, button batteries — well out of reach."
      },
      {
        "color": "caramel",
        "eyebrow": "comfort the clingy",
        "say": "go at their pace",
        "title": "easing the\nseparation",
        "body": "more clinginess can mean tougher drop-offs and bedtimes. a calm goodbye routine and a familiar comfort item help baby feel secure."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing great",
        "say": "trust your gut",
        "title": "safe space,\nsteady you",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "baby-proof at floor level before crawling starts"
        },
        {
          "label": "secure cords, outlets, and tip-prone furniture"
        },
        {
          "label": "gate stairs and block off unsafe rooms"
        },
        {
          "label": "keep small objects and button batteries out of reach"
        },
        {
          "label": "keep a calm, consistent goodbye routine"
        },
        {
          "label": "call your provider for a fever or anything that worries you"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about care at 7 months",
      "items": [
        "baby-proof from the floor up before crawling begins",
        "button batteries and magnets are emergencies if swallowed",
        "anything that fits through a toilet-paper tube is a choking risk",
        "gate stairs and anchor furniture that could tip",
        "a comfort item and steady routine ease separation"
      ],
      "foot": "for a fever that worries you, trouble breathing, a swallowed object, or anything alarming, call your provider right away — 911 for emergencies."
    }
  }
};

// WEEK 31 (authored + accuracy-verified 2026-06-21)
const WEEK_31: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 31",
        "title": "two naps\nare coming",
        "say": "slow and wobbly",
        "body": "around 7.5 months many babies start drifting from three naps toward two — it's a gradual shuffle, and a few uneven days are completely normal."
      },
      {
        "color": "rose",
        "eyebrow": "the 3-to-2 shift",
        "title": "watch for a\ndropped catnap",
        "say": "follow the signs",
        "body": "if that third late nap keeps pushing bedtime late or getting refused, it may be on its way out. let wake windows stretch a touch as it goes."
      },
      {
        "color": "honey",
        "eyebrow": "missing you at night",
        "title": "waking up\njust to find you",
        "say": "this is a phase",
        "body": "separation anxiety can spill into the night right now. a calm, quick reassurance — then space to resettle — usually works better than a long rescue."
      },
      {
        "color": "caramel",
        "eyebrow": "same safe setup",
        "title": "back, bare,\nsame as ever",
        "say": "every single sleep",
        "body": "still on the back, firm flat surface, nothing else in the crib. a sleep sack with arms out keeps your rolling, sitting baby cozy and free to move."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "steady wins\nthe long game",
        "say": "one nap at a time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "watch for signs the third nap is fading",
          "note": "refused or pushing bedtime late"
        },
        {
          "label": "let wake windows stretch gently as naps shift",
          "note": "follow your baby's tired cues, not the clock"
        },
        {
          "label": "keep one consistent, calm bedtime routine"
        },
        {
          "label": "sleep sack with arms out — never a swaddle",
          "note": "once baby can roll or sit"
        },
        {
          "label": "crib stays bare: no pillows, blankets, or toys"
        },
        {
          "label": "give a beat before responding to night wakes"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs the third nap is on its way out",
      "items": [
        "the late nap gets harder to fall into",
        "bedtime keeps drifting later and later",
        "early-morning wakeups creep in",
        "that nap shrinks shorter and shorter",
        "baby stays happy through a longer afternoon stretch"
      ],
      "foot": "transitions take a couple of weeks — if sleep stays rough or feels off, check in with your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 31",
        "title": "tiny fingers,\nbig pinches",
        "say": "milk still leads",
        "body": "around 7.5 months the pincer grasp starts to bloom — but breast milk or formula is still your baby's main nutrition all the way through this first year."
      },
      {
        "color": "rose",
        "eyebrow": "the pincer grasp",
        "title": "thumb meets\nfinger now",
        "say": "let them practice",
        "body": "picking up small soft pieces is a brand-new skill. offer fingertip-sized, gummable bits and let those little hands do the work."
      },
      {
        "color": "honey",
        "eyebrow": "choking-safe sizes",
        "title": "soft, small,\nsquishable",
        "say": "always supervised",
        "body": "skip hard, round, or coin-shaped foods like whole grapes, nuts, and raw carrot. cut everything soft enough to squish between your fingers."
      },
      {
        "color": "caramel",
        "eyebrow": "a few firm no's",
        "title": "not honey,\nnot cow's milk",
        "say": "before age one",
        "body": "no honey until 12 months and no cow's milk as a drink yet. small sips of water from an open or straw cup with meals are just fine now."
      },
      {
        "color": "blush",
        "eyebrow": "keep it easy",
        "title": "messy hands\nmean learning",
        "say": "progress over neat",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep breast milk or formula as the main source"
        },
        {
          "label": "offer soft, fingertip-sized pieces to pinch",
          "note": "always seated and supervised"
        },
        {
          "label": "squish-test every piece between your fingers"
        },
        {
          "label": "no honey and no cow's milk as a drink",
          "note": "both wait until 12 months"
        },
        {
          "label": "offer small sips of water in a cup with meals"
        },
        {
          "label": "keep introducing common allergens, one at a time"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 easy foods for new pincer practice",
      "items": [
        "small soft pieces of ripe banana or avocado",
        "well-cooked pea-sized veggies like sweet potato",
        "soft-cooked pasta pieces",
        "little bits of scrambled egg",
        "dissolvable puffs or thin strips of soft toast"
      ],
      "foot": "cut to safe sizes, supervise every bite, and ask your pediatrician about allergens and choking risks."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 31",
        "title": "sitting tall,\ntalking lots",
        "say": "ranges, not deadlines",
        "body": "around 7.5 months babies often sit solidly and string babble together — every baby arrives on their own timeline, and that's exactly okay."
      },
      {
        "color": "rose",
        "eyebrow": "sitting solid",
        "title": "hands free\nto explore",
        "say": "spot from nearby",
        "body": "steady sitting frees both hands for play. offer toys at different angles so baby reaches, twists, and balances while they explore."
      },
      {
        "color": "honey",
        "eyebrow": "babble chains",
        "title": "bababa and\ndadada arrive",
        "say": "talk back lots",
        "body": "those repeated-syllable chains are real language practice. answer them, name what you see, and pause so baby can \"reply.\""
      },
      {
        "color": "caramel",
        "eyebrow": "on the move",
        "title": "crawling, scooting,\nor rolling",
        "say": "all of it counts",
        "body": "some crawl, some scoot, some army-shuffle, some skip crawling entirely. however your baby gets across the room, it counts."
      },
      {
        "color": "blush",
        "eyebrow": "trust the timeline",
        "title": "your baby,\ntheir pace",
        "say": "celebrate small wins",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe floor time to sit, reach, and move"
        },
        {
          "label": "babble back and narrate your day out loud"
        },
        {
          "label": "name objects and pause for baby to \"answer\""
        },
        {
          "label": "offer toys to pass hand to hand"
        },
        {
          "label": "baby-proof at floor level now that baby is mobile",
          "note": "get down low to spot hazards"
        },
        {
          "label": "keep up with well-visits and milestone checks"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things many 7.5-month-olds explore",
      "items": [
        "sitting steadily with hands free to play",
        "babbling repeated-syllable chains like bababa",
        "getting around by crawling, scooting, or rolling",
        "pinching small objects with thumb and finger",
        "passing toys between both hands"
      ],
      "foot": "milestones are ranges — if you're ever unsure about your baby's progress, your pediatrician is the right call."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 31",
        "title": "velcro baby,\nbig love",
        "say": "clinginess is healthy",
        "body": "around 7.5 months separation anxiety can build — it's a sign of healthy attachment and deep trust, even on the days it feels like a lot."
      },
      {
        "color": "rose",
        "eyebrow": "separation anxiety",
        "title": "quick goodbyes,\nsure returns",
        "say": "reassurance helps",
        "body": "short, cheerful goodbyes plus a reliable return teach your baby that you always come back. lingering tends to make the leaving harder."
      },
      {
        "color": "honey",
        "eyebrow": "comfort and routine",
        "title": "a lovey and\na rhythm help",
        "say": "keep it predictable",
        "body": "a familiar comfort object and a steady daily rhythm give an anxious baby something to hold onto when you step away."
      },
      {
        "color": "caramel",
        "eyebrow": "safety as baby moves",
        "title": "a crawler's-eye\nview of home",
        "say": "check low and small",
        "body": "get on the floor and scan for cords, small objects, and unanchored furniture. anchor heavy pieces, cover outlets, and gate the stairs."
      },
      {
        "color": "blush",
        "eyebrow": "care for you too",
        "title": "your calm\nis their anchor",
        "say": "you matter here",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "keep goodbyes short, warm, and consistent"
        },
        {
          "label": "offer a comfort object during transitions"
        },
        {
          "label": "baby-proof at floor level for your new mover"
        },
        {
          "label": "anchor furniture and secure cords and outlets"
        },
        {
          "label": "keep small objects and choking hazards out of reach"
        },
        {
          "label": "stay current on well-visits and vaccines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 gentle ways to ease separation anxiety",
      "items": [
        "keep a short, predictable goodbye ritual",
        "play peekaboo and hide-and-return games",
        "offer a familiar comfort object during hand-offs",
        "narrate that you're leaving and coming back",
        "stay calm — your steadiness reassures them"
      ],
      "foot": "after vaccines, mild fussiness or low fever can be normal; trust your gut and call your pediatrician with any worry."
    }
  }
};

// WEEK 32 (authored + accuracy-verified 2026-06-21)
const WEEK_32: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 32",
        "title": "standing up\nin the crib",
        "say": "this is a phase",
        "body": "around 7.5 to 8 months many babies start pulling up to stand at the rail — at bedtime, at 2am, anytime. it's exciting, not a problem."
      },
      {
        "color": "rose",
        "eyebrow": "pull-up at bedtime",
        "title": "up at the rail,\nstuck standing",
        "say": "give a calm beat",
        "body": "new standers often pull up and then aren't sure how to get down. lay them back gently without much fuss and let them practice in the daytime."
      },
      {
        "color": "honey",
        "eyebrow": "lower the mattress",
        "title": "drop it down\na notch",
        "say": "do it now",
        "body": "once baby can pull to stand, set the crib mattress to its lowest setting so a tall reach can't tip them over the rail."
      },
      {
        "color": "caramel",
        "eyebrow": "same safe setup",
        "title": "back, bare,\nand boring",
        "say": "every sleep",
        "body": "still always on the back, on a firm flat surface, with nothing else in the crib. a sleep sack with arms out keeps a rolling, standing baby cozy."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "steady beats\nperfect",
        "say": "one night at a time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "lower the crib mattress to its lowest setting",
          "note": "once baby can pull up"
        },
        {
          "label": "keep a consistent, calm bedtime routine"
        },
        {
          "label": "lay a standing baby back down without a big reaction"
        },
        {
          "label": "sleep sack with arms out, never a swaddle",
          "note": "once baby can roll"
        },
        {
          "label": "crib stays bare — no pillows, blankets, bumpers, or toys"
        },
        {
          "label": "room-share without bed-sharing"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things that can stir 7.5–8 month sleep",
      "items": [
        "practicing pulling up and standing in the crib",
        "separation anxiety peeking in at night",
        "teething discomfort",
        "a nap transition shifting the schedule",
        "plain old overtiredness from a long wake window"
      ],
      "foot": "big shifts or true distress that won't settle are worth a call to your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 32",
        "title": "tiny fingers,\nbig pickups",
        "say": "milk still leads",
        "body": "around 7.5 to 8 months babies start pinching small pieces with thumb and finger — but breast milk or formula is still the main nutrition for the whole first year."
      },
      {
        "color": "rose",
        "eyebrow": "pincer grasp",
        "title": "thumb and finger,\nworking together",
        "say": "let them lead",
        "body": "that little pinch is the pincer grasp arriving. offer soft, pea-sized pieces they can practice picking up themselves."
      },
      {
        "color": "honey",
        "eyebrow": "finger foods",
        "title": "soft pieces,\nsafe sizes",
        "say": "always supervised",
        "body": "keep finger foods soft and gummable, and skip hard, round, or coin-shaped foods that can choke. baby seated and watched, every bite."
      },
      {
        "color": "caramel",
        "eyebrow": "a few hard no's",
        "title": "not honey,\nnot cow's milk",
        "say": "before age one",
        "body": "no honey until 12 months, and no cow's milk as a drink yet. small sips of water in an open or straw cup with meals are fine now."
      },
      {
        "color": "blush",
        "eyebrow": "keep it light",
        "title": "food is play\nand learning",
        "say": "mess means progress",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep breast milk or formula as the main source"
        },
        {
          "label": "offer soft, pea-sized pieces for pincer practice",
          "note": "always seated and supervised"
        },
        {
          "label": "keep textures soft and gummable — no hard or round foods"
        },
        {
          "label": "no honey and no cow's milk as a drink",
          "note": "both wait until 12 months"
        },
        {
          "label": "offer small sips of water in a cup with meals"
        },
        {
          "label": "keep introducing common allergens, one at a time"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 soft foods for pincer practice",
      "items": [
        "soft-cooked peas or small bean pieces",
        "tiny pieces of ripe banana or avocado",
        "small bits of scrambled egg",
        "soft-cooked pasta cut small",
        "dissolvable puffs or soft bits of toast"
      ],
      "foot": "always cut to safe sizes, supervise every bite, and ask your pediatrician about allergens and choking risks."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 32",
        "title": "pulling up,\nreaching higher",
        "say": "ranges, not deadlines",
        "body": "around 7.5 to 8 months bodies get stronger and braver — every baby pulls up and stands on their own timeline, and that's okay."
      },
      {
        "color": "rose",
        "eyebrow": "pulling to stand",
        "title": "up on two feet,\nholding on",
        "say": "all of it counts",
        "body": "many babies start pulling to sit and to stand using furniture. some cruise sideways soon after, some take their time — both are normal."
      },
      {
        "color": "honey",
        "eyebrow": "pincer grasp",
        "title": "the tiny\npinch arrives",
        "say": "practice helps",
        "body": "thumb and finger learning to pinch is real fine-motor work. offer safe small things to pick up, and watch those little hands get precise."
      },
      {
        "color": "caramel",
        "eyebrow": "object permanence",
        "title": "peekaboo gets\nthrilling",
        "say": "games build trust",
        "body": "baby is learning that things still exist when hidden. peekaboo and hiding a toy under a cloth are perfect brain-builders right now."
      },
      {
        "color": "blush",
        "eyebrow": "trust the timeline",
        "title": "your baby,\ntheir pace",
        "say": "celebrate small wins",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe floor time near sturdy, anchored furniture to pull up on"
        },
        {
          "label": "offer small safe objects for pincer-grasp practice",
          "note": "always supervised"
        },
        {
          "label": "babble back and narrate your day out loud"
        },
        {
          "label": "play peekaboo and hide-the-toy games"
        },
        {
          "label": "baby-proof seriously now that baby pulls up",
          "note": "get down to floor level to spot hazards"
        },
        {
          "label": "keep up with well-visits and milestone checks"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things many 7.5–8 month-olds explore",
      "items": [
        "pulling to sit and pulling up to stand",
        "pinching small objects with thumb and finger",
        "babbling longer strings of sounds",
        "passing objects between hands",
        "understanding that hidden things still exist"
      ],
      "foot": "milestones are ranges — if you're ever unsure about your baby's progress, your pediatrician is the right call."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 32",
        "title": "a home that's\nready to climb",
        "say": "clinginess is healthy",
        "body": "around 7.5 to 8 months babies pull up and explore everything — now's the time for serious baby-proofing, and a little extra clinginess is normal too."
      },
      {
        "color": "rose",
        "eyebrow": "serious baby-proofing",
        "title": "a puller-upper's\neye view",
        "say": "check low and high",
        "body": "get on the floor and look up: cover outlets, tie up cords and blinds, and anchor every dresser, shelf, and TV to the wall."
      },
      {
        "color": "honey",
        "eyebrow": "stairs and edges",
        "title": "gates, latches,\nsoft corners",
        "say": "do it before they climb",
        "body": "add gates at stairs, latch low cabinets, and pad sharp furniture corners. babies who pull up reach things they couldn't before."
      },
      {
        "color": "caramel",
        "eyebrow": "stranger anxiety",
        "title": "new faces feel\nbig now",
        "say": "let them warm up",
        "body": "it's okay if baby buries into you around new people. give them time on your lap instead of passing them around — it's healthy attachment."
      },
      {
        "color": "blush",
        "eyebrow": "care for you too",
        "title": "your calm\nis their anchor",
        "say": "you matter here",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "anchor all dressers, shelves, and TVs to the wall"
        },
        {
          "label": "cover outlets and secure dangling cords and blind strings"
        },
        {
          "label": "add gates at stairs and latch low cabinets"
        },
        {
          "label": "pad sharp corners on low furniture",
          "note": "baby pulls up on everything now"
        },
        {
          "label": "let baby warm up to new people at their own pace"
        },
        {
          "label": "stay current on well-visits and vaccines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 baby-proofing moves for a new puller-upper",
      "items": [
        "anchor heavy furniture and the TV to the wall",
        "cover every reachable outlet",
        "tie up cords, charger cables, and blind strings",
        "gate the stairs, top and bottom",
        "latch low cabinets and move cleaners up high"
      ],
      "foot": "after vaccines, mild fussiness or a mild fever can be normal; trust your gut and call your pediatrician with any worry."
    }
  }
};

// WEEK 33 (authored + accuracy-verified 2026-06-21)
const WEEK_33: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 33",
        "title": "busy days,\nbumpier nights",
        "say": "this is a phase",
        "body": "around 8 months sleep can ripple as new skills and big feelings bubble up — a wobble now isn't a sign you've done anything wrong."
      },
      {
        "color": "rose",
        "eyebrow": "the 8-9 month regression",
        "title": "new skills\nwake them",
        "say": "it usually passes",
        "body": "crawling and pulling to stand are so thrilling that babies rehearse them at 2am. it often settles within a couple of weeks of steady routine."
      },
      {
        "color": "honey",
        "eyebrow": "missing you",
        "title": "tears when\nyou leave",
        "say": "stay calm + warm",
        "body": "separation anxiety can peak now, so bedtime goodbyes may sting more. a predictable, unhurried routine reassures more than rushing back in."
      },
      {
        "color": "caramel",
        "eyebrow": "same safe setup",
        "title": "back, bare,\nand boring",
        "say": "every single sleep",
        "body": "still always on the back, on a firm flat surface, with nothing else in the crib. a sleep sack with arms out keeps a mover cozy — no swaddle once baby can roll."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "steady routine,\nsteady nights",
        "say": "one night at a time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "hold the same calm bedtime routine every night",
          "note": "predictability is your anchor through a regression"
        },
        {
          "label": "always lay baby down on the back, on a firm flat surface"
        },
        {
          "label": "lower the crib mattress now that baby can pull to stand",
          "note": "keeps a stander from tumbling over the rail"
        },
        {
          "label": "sleep sack with arms out, never a swaddle",
          "note": "swaddling stops once baby can roll or push up"
        },
        {
          "label": "crib stays bare — no pillows, blankets, bumpers, or toys"
        },
        {
          "label": "room-share without bed-sharing through the first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 signs it's the regression, not something wrong",
      "items": [
        "sudden night wakings after weeks of steadier sleep",
        "fighting naps or bedtime that used to go smoothly",
        "pulling to stand in the crib and getting stuck up there",
        "extra clingy and teary at goodbye",
        "shorter naps while new skills are booming"
      ],
      "foot": "if wakings come with fever, pain, or just feel off to you, call your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 33",
        "title": "tiny pinch,\nbig progress",
        "say": "milk still leads",
        "body": "around 8 months little fingers start to pinch up small foods — and the mess is exactly how they learn. breast milk or formula is still the main event this year."
      },
      {
        "color": "rose",
        "eyebrow": "pincer practice",
        "title": "thumb-and-finger\npickups",
        "say": "soft + small",
        "body": "offer soft pieces about the size of your fingertip so baby can practice the thumb-to-finger pinch. let them set the pace and feed themselves."
      },
      {
        "color": "honey",
        "eyebrow": "milk first",
        "title": "food rounds\nit out",
        "say": "not a replacement",
        "body": "breast milk or formula is still your baby's main nutrition. solids are for practice, flavor, and a little iron — not for replacing milk feeds yet."
      },
      {
        "color": "caramel",
        "eyebrow": "a few hard no's",
        "title": "no honey,\nno choke shapes",
        "say": "always supervised",
        "body": "no honey until 12 months and no cow's milk as a drink yet. skip round, hard, or coin-shaped foods, seat baby upright, and stay within arm's reach."
      },
      {
        "color": "blush",
        "eyebrow": "go slow",
        "title": "one new food\nat a time",
        "say": "watch for reactions",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer soft, fingertip-sized pieces for pincer-grasp practice"
        },
        {
          "label": "keep breast milk or formula as the main source of nutrition"
        },
        {
          "label": "no honey and no cow's milk as a drink",
          "note": "both wait until 12 months"
        },
        {
          "label": "seat baby fully upright and supervise every single bite"
        },
        {
          "label": "avoid round, hard, sticky, or coin-shaped foods",
          "note": "common choking shapes at this age"
        },
        {
          "label": "offer small sips of water from an open or straw cup with meals"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 great pincer-grasp finger foods",
      "items": [
        "soft roasted sweet potato or carrot pieces",
        "ripe banana or avocado (lightly mashed if slippery)",
        "small soft-cooked pasta",
        "tiny bits of scrambled egg",
        "well-cooked, soft-steamed veggie florets"
      ],
      "foot": "always cut to safe sizes, supervise every bite, and ask your pediatrician about allergens and choking risks."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 33",
        "title": "on the move,\npulling up",
        "say": "ranges, not races",
        "body": "around 8 months bodies get busy — crawling, scooting, and pulling to stand. every baby gets there on their own timeline, and that's okay."
      },
      {
        "color": "rose",
        "eyebrow": "pulling to stand",
        "title": "up on two\nfeet, holding on",
        "say": "all of it counts",
        "body": "many babies start hauling themselves up on furniture now. some crawl first, some scoot, some skip crawling — mobility comes in many shapes."
      },
      {
        "color": "honey",
        "eyebrow": "little explorer",
        "title": "everything goes\nin the mouth",
        "say": "tasting is learning",
        "body": "mouthing and banging objects is how baby studies the world. give safe things to grasp, drop, and pass from hand to hand."
      },
      {
        "color": "caramel",
        "eyebrow": "object permanence",
        "title": "peekaboo gets\nthrilling",
        "say": "games build trust",
        "body": "baby is learning that things still exist when hidden. peekaboo and hiding a toy under a cloth are perfect brain-builders right now."
      },
      {
        "color": "blush",
        "eyebrow": "trust the timeline",
        "title": "your baby,\ntheir pace",
        "say": "celebrate small wins",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe floor time to crawl and pull up"
        },
        {
          "label": "set up a sturdy surface for cruising practice",
          "note": "check it can't tip"
        },
        {
          "label": "babble back and narrate your day out loud"
        },
        {
          "label": "play peekaboo and hide-the-toy games"
        },
        {
          "label": "baby-proof now that baby is mobile",
          "note": "get down to floor level to spot hazards"
        },
        {
          "label": "keep up with well-visits and milestone checks"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things many 8-month-olds explore",
      "items": [
        "pulling to stand on furniture",
        "crawling, scooting, or rolling to get around",
        "passing objects between hands and banging them",
        "babbling strings like ba-ba and da-da",
        "understanding that hidden things still exist"
      ],
      "foot": "milestones are ranges — if you're ever unsure about your baby's progress, your pediatrician is the right call."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 33",
        "title": "big feelings,\nbig love",
        "say": "clinginess is healthy",
        "body": "around 8 months separation anxiety can run strong — it's a sign of healthy attachment, even when the velcro phase feels intense."
      },
      {
        "color": "rose",
        "eyebrow": "separation anxiety",
        "title": "the velcro\nphase peaks",
        "say": "reassurance helps",
        "body": "short, cheerful goodbyes and a consistent return teach your baby that you always come back. lingering tends to make it harder for you both."
      },
      {
        "color": "honey",
        "eyebrow": "safety as baby pulls up",
        "title": "a stander's-eye\nview",
        "say": "check low and high",
        "body": "now that baby pulls to stand, anchor heavy furniture, secure cords, and move tippy or sharp things up. recheck the floor for small objects."
      },
      {
        "color": "caramel",
        "eyebrow": "new faces feel big",
        "title": "let them\nwarm up",
        "say": "no passing around",
        "body": "stranger wariness is normal now. give baby time on your lap with new people instead of handing them over right away."
      },
      {
        "color": "blush",
        "eyebrow": "care for you too",
        "title": "your calm\nis their anchor",
        "say": "you matter here",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "keep goodbyes short, warm, and consistent"
        },
        {
          "label": "let baby warm up to new people at their own pace"
        },
        {
          "label": "anchor furniture now that baby pulls to stand"
        },
        {
          "label": "secure cords, cover outlets, and move tippy items up high"
        },
        {
          "label": "keep small objects and choking hazards out of reach"
        },
        {
          "label": "stay current on well-visits and vaccines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to ease separation anxiety",
      "items": [
        "keep a predictable, unhurried goodbye ritual",
        "play quick peekaboo and hide-and-return games",
        "offer a comfort object during transitions",
        "narrate that you're leaving and coming back",
        "stay calm — your steadiness reassures them"
      ],
      "foot": "after vaccines, mild fussiness or low fever can be normal; trust your gut and call your pediatrician with any worry."
    }
  }
};

// WEEK 35 (authored + accuracy-verified 2026-06-21)
const WEEK_35: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 35",
        "title": "the 8-9 month\nsleep shuffle",
        "say": "it's a phase",
        "body": "a new wave of night wakings and short naps can show up right about now, and it almost always settles."
      },
      {
        "color": "rose",
        "eyebrow": "the regression",
        "title": "more wakeups,\nsame baby",
        "say": "developmental, not broken",
        "body": "new skills like pulling up keep their brain busy at night. it usually eases within a few weeks."
      },
      {
        "color": "honey",
        "eyebrow": "standing in the crib",
        "title": "they stand,\nthen get stuck",
        "say": "practice helps",
        "body": "lots of babies pull up at night and forget how to sit back down. a calm hand to help them lower, then space, shows them the way down."
      },
      {
        "color": "caramel",
        "eyebrow": "keep it boring",
        "title": "same wind-down,\nevery night",
        "say": "predictable wins",
        "body": "the same short routine in the same order tells a busy brain it's time to power down. resist adding new steps to soothe."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "steady beats\nperfect",
        "say": "this passes",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep the crib bare — no pillows, blankets, or bumpers",
          "note": "safe sleep doesn't change with age"
        },
        {
          "label": "always lay baby down on their back; they can roll to their own comfy spot"
        },
        {
          "label": "use a sleep sack with arms out, never a swaddle now that they roll"
        },
        {
          "label": "if they stand in the crib, help them down once, calmly, then give space"
        },
        {
          "label": "hold the bedtime routine steady through the regression"
        },
        {
          "label": "room-share without bed-sharing for around the first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 truths about the 8-9 month regression",
      "items": [
        "it's tied to big motor leaps like pulling up and cruising",
        "short naps and split nights are common and temporary",
        "new nighttime standing is a skill, not a problem to fix",
        "consistency soothes faster than brand-new sleep crutches",
        "most families see it settle within a few weeks"
      ],
      "foot": "if wakings come with fever, pain, or just seem off to you, call your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 35",
        "title": "the gloriously\nmessy table",
        "say": "mess is learning",
        "body": "self-feeding looks chaotic right now, and that mess is exactly how those little hands get skilled."
      },
      {
        "color": "rose",
        "eyebrow": "pincer practice",
        "title": "tiny pieces,\nbig wins",
        "say": "soft and small",
        "body": "that thumb-and-finger pinch is sharpening fast. offer soft, pea-sized bites so they can practice picking up."
      },
      {
        "color": "honey",
        "eyebrow": "let them lead",
        "title": "hands in,\nspoon nearby",
        "say": "following their pace",
        "body": "loading a spoon and letting them grab it builds skill. expect more on the floor than in their mouth for a while."
      },
      {
        "color": "caramel",
        "eyebrow": "milk still first",
        "title": "breast or bottle\nstays the base",
        "say": "food is bonus",
        "body": "breast milk or formula is still their main nutrition this whole year. solids are practice and exposure, not a replacement yet."
      },
      {
        "color": "blush",
        "eyebrow": "keep offering",
        "title": "new foods\ntake time",
        "say": "try, try again",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer soft, pea-sized pieces for pincer-grasp practice"
        },
        {
          "label": "keep breast milk or formula as the main drink all year"
        },
        {
          "label": "always seat baby upright, supervise every bite, and learn infant choking first aid",
          "note": "skip round, hard, or whole foods like grapes and nuts"
        },
        {
          "label": "let baby self-feed and accept the mess"
        },
        {
          "label": "no honey and no cow's milk as a drink before 12 months"
        },
        {
          "label": "offer small sips of water in an open or straw cup with meals"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to support self-feeding now",
      "items": [
        "serve soft finger foods cut to pea size",
        "preload a spoon and hand it over",
        "offer a few choices, not a loaded plate",
        "model chewing and let them copy you",
        "expect refusals — exposure counts even without eating"
      ],
      "foot": "choking is silent; never prop a bottle or leave baby alone while eating."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 35",
        "title": "pulling up,\ncruising soon",
        "say": "on the move",
        "body": "around now many babies pull to stand confidently and start to think about side-stepping along the furniture."
      },
      {
        "color": "rose",
        "eyebrow": "cruising prep",
        "title": "furniture\nbecomes a rail",
        "say": "hello, cruising",
        "body": "once they're steady standing, watch for sideways steps holding the couch. it's the warmup for walking."
      },
      {
        "color": "honey",
        "eyebrow": "tiny pinch",
        "title": "thumb meets\nfinger",
        "say": "so precise",
        "body": "the refined pincer grasp lets them pick up the smallest crumb. it's great for eating and a reason to scan the floor."
      },
      {
        "color": "caramel",
        "eyebrow": "ranges not races",
        "title": "every baby\non their clock",
        "say": "wide and normal",
        "body": "some pull up earlier, some a couple of months later. all of it can be perfectly on track."
      },
      {
        "color": "blush",
        "eyebrow": "cheering you on",
        "title": "watch them\nfigure it out",
        "say": "trust the range",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "anchor or strap heavy furniture and tvs to the wall",
          "note": "a puller-upper can topple things"
        },
        {
          "label": "do a floor sweep for small choke-able objects daily"
        },
        {
          "label": "give safe, sturdy surfaces to pull up and cruise along"
        },
        {
          "label": "offer small safe objects to practice the pincer grasp, with you watching"
        },
        {
          "label": "bring any milestone questions to the next well-visit",
          "note": "ranges are wide — your provider can reassure you"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 cruising-soon signs (any can come first)",
      "items": [
        "pulling up to stand and holding on confidently",
        "bouncing or shifting weight foot to foot",
        "reaching sideways for the next handhold",
        "picking up tiny bits with thumb and finger",
        "standing a moment with just one hand down"
      ],
      "foot": "milestones are ranges; share real worries with your pediatrician, not a chart."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 35",
        "title": "a more mobile\nlittle person",
        "say": "and busier you",
        "body": "as they pull up and explore, your home and your patience both get a gentle stress-test — and you're doing great."
      },
      {
        "color": "rose",
        "eyebrow": "baby-proof again",
        "title": "get down\nto their level",
        "say": "crawl and check",
        "body": "a newly standing baby reaches higher than before. re-scan for cords, table edges, and anything newly within grasp."
      },
      {
        "color": "honey",
        "eyebrow": "feelings are big",
        "title": "clinginess\nis connection",
        "say": "totally normal",
        "body": "separation worry often peaks around now. quick, confident goodbyes help more than long, anxious ones."
      },
      {
        "color": "caramel",
        "eyebrow": "refill your cup",
        "title": "you can't pour\nfrom empty",
        "say": "ask for help",
        "body": "the regression plus a mobile baby is a lot. trade off, lower the bar, and lean on your village."
      },
      {
        "color": "blush",
        "eyebrow": "with you",
        "title": "you're the\nsafe place",
        "say": "that matters most",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "re-baby-proof at standing height — cords, edges, blind pulls"
        },
        {
          "label": "keep goodbyes short and confident to ease separation worry"
        },
        {
          "label": "trade off night duty so no one runs on empty"
        },
        {
          "label": "stay on track with well-visits and recommended vaccines"
        },
        {
          "label": "call your provider for fever, lasting fussiness, or anything that feels off",
          "note": "trust your gut over any checklist"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things mobility changes around the house",
      "items": [
        "pull-up height means new reach — re-scan low and high",
        "anchor furniture and tvs against tip-overs",
        "move cords, cleaners, and meds well out of reach",
        "add gates at stairs and risky doorways",
        "cushion or pad sharp coffee-table corners"
      ],
      "foot": "a mild low fever after vaccines can be normal — follow your pediatrician's guidance."
    }
  }
};

// WEEK 36 (authored + accuracy-verified 2026-06-21)
const WEEK_36: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 36",
        "title": "the bedtime\nroutine pays off",
        "say": "steady wins now",
        "body": "around 9 months the same calm steps each night become the cue their body trusts — that consistency is doing quiet work."
      },
      {
        "color": "rose",
        "eyebrow": "same steps",
        "title": "a routine they\ncan predict",
        "say": "order over timing",
        "body": "bath, book, song, bed in the same order tells a busy brain it's time to wind down. the sequence matters more than the exact clock."
      },
      {
        "color": "honey",
        "eyebrow": "two naps",
        "title": "holding at\ntwo naps",
        "say": "follow the cues",
        "body": "most babies this age settle into two solid naps a day. on cruising-heavy days, lean on sleepy signs rather than the schedule."
      },
      {
        "color": "caramel",
        "eyebrow": "standing up",
        "title": "pulling up\nin the crib",
        "say": "practice by day",
        "body": "newly cruising babies often stand at the rail at bedtime. lay them back down calmly and let daytime be where they practice it."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "same crib,\nsame back",
        "say": "safe sleep stays",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep the same calm bedtime routine in the same order each night",
          "note": "the predictable sequence is the sleep cue, not the clock"
        },
        {
          "label": "always lay baby down on the back, on a firm flat surface"
        },
        {
          "label": "crib stays bare — no blankets, pillows, bumpers, or toys"
        },
        {
          "label": "sleep sack with arms out instead of any swaddle",
          "note": "once baby can roll or pull up, swaddling is done"
        },
        {
          "label": "if they pull to stand in the crib, lay them back down calmly and quietly"
        },
        {
          "label": "room-share without bed-sharing through the first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 steps for a bedtime routine that sticks",
      "items": [
        "start at roughly the same time each night",
        "keep it short — about 20 to 30 minutes",
        "same order every time: bath, pajamas, book, song",
        "dim the lights and lower your voice as you go",
        "lay them down drowsy but awake so they settle in the crib"
      ],
      "foot": "every baby is different — if bedtime is a nightly battle, your pediatrician can help."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 36",
        "title": "three meals,\nmilk still leads",
        "say": "practice, not pressure",
        "body": "around 9 months many babies are eating something at three meals a day — and breast milk or formula is still their main nutrition."
      },
      {
        "color": "rose",
        "eyebrow": "a real rhythm",
        "title": "building toward\nthree meals",
        "say": "appetites vary",
        "body": "breakfast, lunch, and dinner can start to look like meals now. offer a little variety and let their appetite set the amount."
      },
      {
        "color": "honey",
        "eyebrow": "milk first",
        "title": "breast or\nformula still leads",
        "say": "food rounds it out",
        "body": "milk is still the foundation this whole first year. solids add flavor, texture, and iron — they don't replace those feeds yet."
      },
      {
        "color": "caramel",
        "eyebrow": "keep it safe",
        "title": "no honey,\nno choke shapes",
        "say": "always supervised",
        "body": "skip honey until 12 months and avoid round, hard, or sticky foods. seat baby fully upright and stay within arm's reach."
      },
      {
        "color": "blush",
        "eyebrow": "let them lead",
        "title": "messy hands,\nhappy learning",
        "say": "watch for reactions",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "work toward something at three meals a day, at the family's pace"
        },
        {
          "label": "keep breast milk or formula as the main source of nutrition"
        },
        {
          "label": "no honey before 12 months; no cow's milk as a drink before 12 months"
        },
        {
          "label": "seat baby fully upright and supervise every single bite"
        },
        {
          "label": "offer soft fingertip-sized pieces for pincer-grasp practice",
          "note": "avoid round, hard, sticky, or coin-shaped foods"
        },
        {
          "label": "offer small sips of water from an open or straw cup with meals"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to round out three meals",
      "items": [
        "soft iron-rich foods like lentils, beans, or shredded meat",
        "a fruit or veggie they can pick up themselves",
        "an easy grain — soft pasta, oatmeal, or well-cooked rice",
        "a familiar favorite alongside one new food to try",
        "a milk feed before or after, still their main nutrition"
      ],
      "foot": "every baby eats differently — your pediatrician can guide allergens, iron, and textures for yours."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 36",
        "title": "cruising and\nwaving hello",
        "say": "ranges, not races",
        "body": "around 9 months many babies are cruising along furniture and trying out little waves and claps — all on their own timeline."
      },
      {
        "color": "rose",
        "eyebrow": "on their feet",
        "title": "cruising along\nthe couch",
        "say": "bare feet help",
        "body": "once they can stand holding on, side-stepping along furniture often follows. bare feet help them grip and find their balance."
      },
      {
        "color": "honey",
        "eyebrow": "little gestures",
        "title": "waving and\nclapping start",
        "say": "copy them back",
        "body": "waves, claps, and pointing are early ways of talking. clap and wave back — they learn these by watching and copying you."
      },
      {
        "color": "caramel",
        "eyebrow": "sounds to words",
        "title": "babbling gets\nmore like talk",
        "say": "narrate the day",
        "body": "strings of \"bababa\" and \"mamama\" are building toward first words. name what they see and pause so they can babble back."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "title": "milestones are\nranges, not deadlines",
        "say": "no such thing as behind",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "set up sturdy, stable furniture for them to cruise along"
        },
        {
          "label": "wave, clap, and point so they can copy the gestures back"
        },
        {
          "label": "name objects and narrate your day to grow words"
        },
        {
          "label": "play peekaboo and hide-a-toy to build object permanence"
        },
        {
          "label": "let them go barefoot indoors for better balance"
        },
        {
          "label": "bring up any milestone questions at the next well-visit",
          "note": "ranges are wide — your provider can reassure you"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 little signs of big growth around now",
      "items": [
        "cruising sideways along furniture",
        "waving, clapping, or pointing",
        "babbling with repeated sounds like bababa and mamama",
        "looking for a toy you've hidden",
        "using thumb and finger to pick up tiny bits"
      ],
      "foot": "if your baby isn't using both sides of the body evenly, or you feel unsure, check with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 36",
        "title": "a cruiser's\nworld",
        "say": "look down low",
        "body": "now that baby pulls up and cruises, this is the week to re-check your home from their new, taller reach."
      },
      {
        "color": "rose",
        "eyebrow": "raise the bar",
        "title": "they can reach\nhigher now",
        "say": "re-scan everything",
        "body": "standing changes what's in reach — clear countertops near furniture, move hot drinks back, and re-check cords and small objects."
      },
      {
        "color": "honey",
        "eyebrow": "steady on",
        "title": "bumps come\nwith cruising",
        "say": "soft landings help",
        "body": "wobbles and tumbles are part of learning to move. clear sharp corners and hard edges from their cruising path so falls stay gentle."
      },
      {
        "color": "caramel",
        "eyebrow": "warm goodbyes",
        "title": "separation\nstays tender",
        "say": "short and sure",
        "body": "big feelings when you leave are a healthy sign of attachment. a calm, consistent goodbye teaches them you always come back."
      },
      {
        "color": "blush",
        "eyebrow": "you, too",
        "title": "a steady parent\nis safety, too",
        "say": "lean on your village",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "re-scan the house from standing height now that they cruise"
        },
        {
          "label": "clear countertops near furniture and keep hot drinks well back"
        },
        {
          "label": "anchor dressers, bookshelves, and tvs to the wall"
        },
        {
          "label": "pad or clear sharp corners along their cruising path"
        },
        {
          "label": "keep goodbyes short, warm, and consistent"
        },
        {
          "label": "stay on track with well-visits and recommended vaccines",
          "note": "a low-grade fever after shots can be normal — follow your provider's guidance"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 safety re-checks once they're cruising",
      "items": [
        "nothing pullable or hot within reach of furniture edges",
        "tall furniture and tvs anchored against tip-overs",
        "sharp corners padded or cleared from their path",
        "stair gates secured top and bottom",
        "cords, cleaners, and small parts up and out of reach"
      ],
      "foot": "no home is hazard-free — supervision is still your best safety tool."
    }
  }
};

// WEEK 37 (authored + accuracy-verified 2026-06-21)
const WEEK_37: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 37",
        "title": "the bedtime\nroutine pays off",
        "say": "steady wins here",
        "body": "around 9 months, the same few calming steps every night become the cue their little body reads as 'sleep is coming.'"
      },
      {
        "color": "rose",
        "eyebrow": "same order",
        "title": "keep the steps\nin order",
        "say": "predictable beats perfect",
        "body": "bath, pajamas, book, song, bed — in the same order most nights. the sequence matters more than the exact clock time."
      },
      {
        "color": "honey",
        "eyebrow": "object permanence",
        "title": "they know\nyou left",
        "say": "a quick check is ok",
        "body": "now that out-of-sight isn't gone-for-good, bedtime protests can pop up. a calm, brief reassurance teaches them you always come back."
      },
      {
        "color": "caramel",
        "eyebrow": "two naps",
        "title": "holding\ntwo naps",
        "say": "follow sleepy cues",
        "body": "most babies this age still nap twice a day. on busy or off days, let their tired signs lead instead of the clock."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "same crib,\nsame steps",
        "say": "consistency wins",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep the same calm bedtime routine in the same order each night",
          "note": "the sequence is the cue, more than the exact time"
        },
        {
          "label": "always lay baby down on the back, on a firm flat surface"
        },
        {
          "label": "crib stays bare — no blankets, pillows, or bumpers"
        },
        {
          "label": "sleep sack with arms out instead of any swaddle",
          "note": "swaddling stops once baby can roll or push up"
        },
        {
          "label": "keep goodbyes calm and brief when they protest"
        },
        {
          "label": "room-share without bed-sharing through the first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 steps that make a bedtime routine work",
      "items": [
        "start at roughly the same time each night",
        "keep it to the same few steps, in the same order",
        "dim the lights and lower your voice as you go",
        "end in the crib awake but drowsy when you can",
        "keep it short — 20 to 30 minutes is plenty"
      ],
      "foot": "every baby settles differently — if sleep suddenly changes or seems off, check with your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 37",
        "title": "the pincer\ngets precise",
        "say": "messy means learning",
        "body": "around 9 months, thumb and finger team up to pick up tiny soft pieces — and self-feeding is wonderful, careful practice."
      },
      {
        "color": "rose",
        "eyebrow": "let them lead",
        "title": "finger foods,\ntheir pace",
        "say": "soft + small",
        "body": "offer soft pieces about the size of your fingertip so they can practice the pinch. let baby decide how much they eat."
      },
      {
        "color": "honey",
        "eyebrow": "milk still leads",
        "title": "breast or\nformula first",
        "say": "food rounds it out",
        "body": "breast milk or formula is still their main nutrition this whole year. solids add flavor, texture, and a little iron — not a replacement yet."
      },
      {
        "color": "caramel",
        "eyebrow": "keep it safe",
        "title": "no honey,\nno choke shapes",
        "say": "always supervised",
        "body": "skip honey until 12 months and avoid round, hard, or sticky foods. seat baby fully upright and stay within arm's reach at every meal."
      },
      {
        "color": "blush",
        "eyebrow": "go slow",
        "title": "new foods,\none at a time",
        "say": "watch for reactions",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer soft fingertip-sized pieces for pincer-grasp practice"
        },
        {
          "label": "keep breast milk or formula as the main source of nutrition"
        },
        {
          "label": "no honey before 12 months; no cow's milk as a drink before 12 months"
        },
        {
          "label": "seat baby fully upright and supervise every single bite"
        },
        {
          "label": "avoid round, hard, sticky, or coin-shaped foods",
          "note": "common choking shapes for this age"
        },
        {
          "label": "offer small sips of water from an open or straw cup with meals"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 soft foods for pincer practice",
      "items": [
        "soft-cooked peas or veggie bits, lightly mashed or flattened",
        "small pieces of ripe banana or avocado",
        "soft-scrambled egg in little curds",
        "well-cooked, soft pasta cut small",
        "flaked, deboned soft fish or shredded soft meat"
      ],
      "foot": "every baby is different — your pediatrician can guide allergens and textures for yours."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 37",
        "title": "cruising and\npointing",
        "say": "ranges, not races",
        "body": "around 9 months many babies side-step along furniture and start pointing — every baby reaches each step on their own timeline."
      },
      {
        "color": "rose",
        "eyebrow": "on their feet",
        "title": "cruising along\nthe couch",
        "say": "bare feet help",
        "body": "once they can stand holding on, cruising sideways often follows. bare feet help little toes grip and balance as they go."
      },
      {
        "color": "honey",
        "eyebrow": "little signals",
        "title": "pointing at\nwhat they want",
        "say": "name it back",
        "body": "pointing is early communication — they're showing you what they notice. name what they point at to grow words alongside the gesture."
      },
      {
        "color": "caramel",
        "eyebrow": "peekaboo wins",
        "title": "object permanence\nclicks in",
        "say": "play it often",
        "body": "they now know things still exist when hidden, which is why peekaboo is suddenly the best game. it's their brain practicing memory."
      },
      {
        "color": "blush",
        "eyebrow": "their own pace",
        "title": "milestones are\nranges, not deadlines",
        "say": "no such thing as behind",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "set up sturdy furniture for safe cruising practice"
        },
        {
          "label": "play peekaboo and hide-the-toy to build object permanence"
        },
        {
          "label": "name what baby points at to grow early words"
        },
        {
          "label": "offer small safe objects to refine the pincer grasp"
        },
        {
          "label": "let them go barefoot indoors for better balance"
        },
        {
          "label": "jot down any milestone questions for the 9-month well visit",
          "note": "ranges are wide — your provider can reassure you"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 playful ways to grow 9-month skills",
      "items": [
        "peekaboo and hiding a toy under a cloth for them to find",
        "pointing at and naming objects around the room",
        "stacking cups or knocking down soft towers",
        "cruising games along a low, sturdy couch",
        "handing soft little foods over for pincer practice"
      ],
      "foot": "if your baby isn't using both sides of the body evenly, or you feel unsure, bring it up at the well visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 37",
        "title": "the 9-month\ncheck-in",
        "say": "a helpful checkpoint",
        "body": "around 9 months there's a well visit — a gentle moment to ask questions, check growth, and talk through what's next."
      },
      {
        "color": "rose",
        "eyebrow": "come prepared",
        "title": "jot your\nquestions down",
        "say": "no question too small",
        "body": "write down anything you've wondered about — sleep, eating, movement, words. a quick list means you won't forget in the moment."
      },
      {
        "color": "honey",
        "eyebrow": "what to expect",
        "title": "growth, play,\nand a screen",
        "say": "it's a conversation",
        "body": "expect weight and length checks, a developmental check-in, and feeding talk. your provider may walk through a few milestones with you."
      },
      {
        "color": "caramel",
        "eyebrow": "the clingy phase",
        "title": "separation\nis still big",
        "say": "it means they love you",
        "body": "object permanence makes leaving harder right now. short, warm goodbyes and peekaboo both teach them you always come back."
      },
      {
        "color": "blush",
        "eyebrow": "you, too",
        "title": "a calm parent\nis good care",
        "say": "lean on your village",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "schedule or confirm the 9-month well visit"
        },
        {
          "label": "write down your questions before the appointment",
          "note": "sleep, eating, movement, and words are all fair game"
        },
        {
          "label": "bring the feeding and sleep rhythm you've noticed lately"
        },
        {
          "label": "keep goodbyes short, warm, and consistent"
        },
        {
          "label": "re-check baby-proofing now that they cruise and reach higher"
        },
        {
          "label": "stay on track with recommended vaccines",
          "note": "mild fussiness or a low fever after shots can be normal — follow your provider's guidance"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 questions worth asking at the 9-month visit",
      "items": [
        "is my baby's growth tracking where you'd expect?",
        "are we on track with finger foods and textures?",
        "which vaccines are due now?",
        "any milestones you'd watch for before the next visit?",
        "tips for separation anxiety and night wakings"
      ],
      "foot": "this list is a starting point — your pediatrician knows your baby best and can tailor it."
    }
  }
};

// WEEK 38 (authored + accuracy-verified 2026-06-21)
const WEEK_38: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 38",
        "title": "Two naps,\nnew calm.",
        "say": "rhythm, not clock",
        "body": "many babies settle into a steadier two-nap day around now — and it makes everything feel a little more predictable."
      },
      {
        "color": "rose",
        "eyebrow": "the rhythm",
        "title": "Morning &\nafternoon.",
        "say": "watch the windows",
        "body": "a nap mid-morning and one early-afternoon is a common shape now. wake windows often stretch to about 3–4 hours between sleeps."
      },
      {
        "color": "honey",
        "eyebrow": "still constant",
        "title": "Back, bare,\nempty.",
        "say": "never changes",
        "body": "on the back, firm flat crib, nothing loose in there — every sleep, all the way through the first year. swaddle's long gone now that they roll; a sleep sack with arms out is perfect."
      },
      {
        "color": "caramel",
        "eyebrow": "the wobble",
        "title": "Clingy at\nbedtime.",
        "say": "it's a phase",
        "body": "separation anxiety can make goodnights harder this month. a short, same-every-night routine and a calm goodbye tend to help more than sneaking out."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Steady\nwins.",
        "say": "protect the rhythm",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "Two naps a day",
          "note": "mid-morning + early-afternoon"
        },
        {
          "label": "Wake windows ~3–4 hrs"
        },
        {
          "label": "Always back, firm flat surface, empty crib"
        },
        {
          "label": "Sleep sack, arms out",
          "note": "no swaddle once they roll"
        },
        {
          "label": "Same short bedtime routine every night",
          "note": "eases separation-anxiety clinginess"
        },
        {
          "label": "Room-share, not bed-share",
          "note": "through the first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to ease the bedtime clingies",
      "items": [
        "keep the routine short, warm, and exactly the same each night",
        "say a real goodbye — sneaking out can make the worry worse",
        "a quick peek-back 'i'm here' reassures without restarting playtime",
        "offer a comfort object during the wind-down, then a bare crib for sleep",
        "off-screens and dim lights the last 30 minutes before bed"
      ],
      "foot": "keep the crib empty for sleep through the first year. separation anxiety is a healthy sign of attachment and it passes — but persistent night screaming or signs of pain → call your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 38",
        "title": "Little\npincers.",
        "say": "messy is good",
        "body": "finger foods are the star this month — let them explore a real variety of soft, safe bites at their own pace."
      },
      {
        "color": "rose",
        "eyebrow": "the grip",
        "title": "Pincer\nfoods.",
        "say": "soft, small pieces",
        "body": "soft strips and small, soft pieces let them practice the thumb-and-finger pinch. think ripe banana, avocado, soft-cooked veg, flaked fish, well-cooked pasta."
      },
      {
        "color": "honey",
        "eyebrow": "keep offering",
        "title": "Variety,\nno pressure.",
        "say": "texture matters now",
        "body": "a new food can take many tries — keep offering without forcing. mixing textures now helps them learn to chew and move food around."
      },
      {
        "color": "caramel",
        "eyebrow": "still the rules",
        "title": "Milk first,\nno honey.",
        "say": "safety stays",
        "body": "breastmilk or formula is still the main drink before 1. no honey, no cow's milk as a drink, no choking shapes — cut grapes and round foods lengthwise."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Let them\nlead.",
        "say": "follow their cues",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "Offer soft finger foods at most meals",
          "note": "soft strips or small soft pieces"
        },
        {
          "label": "Breastmilk or formula still the main drink"
        },
        {
          "label": "Keep offering new textures + flavors",
          "note": "no pressure — many tries is normal"
        },
        {
          "label": "Always seated + supervised, never on the move"
        },
        {
          "label": "Cut round foods lengthwise",
          "note": "grapes, cherry tomatoes, hot-dog shapes"
        },
        {
          "label": "No honey, no cow's-milk drink before 12 months"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 easy finger foods to try",
      "items": [
        "ripe banana or avocado in soft strips",
        "soft-cooked carrot, sweet potato, or soft broccoli",
        "well-cooked pasta or soft, mashable beans",
        "flaked salmon or finely shredded soft chicken",
        "strips of toast with a thin smear (no honey)"
      ],
      "foot": "know the difference between gagging (loud, often normal) and choking (silent) — an infant-CPR refresher helps. talk to your pediatrician before introducing common allergens like fish, egg, or peanut."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 38",
        "title": "Up and\ncruising.",
        "say": "hold on tight",
        "body": "many babies are pulling to stand and starting to cruise along the furniture now — sturdy legs and a big new world to reach."
      },
      {
        "color": "rose",
        "eyebrow": "on the move",
        "title": "Cruising\nstart.",
        "say": "a range, not a race",
        "body": "pulling up, then stepping sideways holding the couch, comes for lots of babies around now. some aren't there yet — both are completely normal."
      },
      {
        "color": "honey",
        "eyebrow": "first words?",
        "title": "Mama,\ndada.",
        "say": "not always with meaning",
        "body": "that babbled 'mamamama' is huge — but it may not mean you yet, and that's right on track. name everything; meaning clicks in time."
      },
      {
        "color": "caramel",
        "eyebrow": "the 9-mo visit",
        "title": "Check-in\nahead.",
        "say": "bring your list",
        "body": "the 9-month well-visit is around the corner. jot questions, note new skills, and remember milestones are ranges — never deadlines."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "So much\nnew.",
        "say": "cheer them on",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "Give safe surfaces to pull up + cruise on",
          "note": "sturdy, no tip-over furniture"
        },
        {
          "label": "Anchor furniture + cover outlets",
          "note": "a new climber needs a new sweep"
        },
        {
          "label": "Name everything — narrate your day",
          "note": "this builds first real words"
        },
        {
          "label": "Play peekaboo + hiding games",
          "note": "teaches object permanence"
        },
        {
          "label": "Book the 9-month well-visit",
          "note": "jot your questions ahead"
        },
        {
          "label": "Barefoot at home for balance"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things showing up around now",
      "items": [
        "pulling to stand and cruising along furniture",
        "babbling 'mama/dada' — meaning may come a bit later",
        "pincer grasp picking up tiny bits",
        "peekaboo + looking for a hidden toy (object permanence)",
        "clearer stranger + separation awareness"
      ],
      "foot": "milestones are ranges, not deadlines — no baby is 'behind.' if you have any worry, bring it to the 9-month visit or call sooner."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 38",
        "title": "Clingy &\nconnected.",
        "say": "this is love",
        "body": "the velcro phase is real right now — separation anxiety means your bond is exactly where it should be."
      },
      {
        "color": "rose",
        "eyebrow": "the feelings",
        "title": "It's not\nspoiling.",
        "say": "respond warmly",
        "body": "answering their need for you doesn't create clinginess — it builds the security that lets them venture out. comfort freely."
      },
      {
        "color": "honey",
        "eyebrow": "goodbyes",
        "title": "Short &\nsure.",
        "say": "don't sneak away",
        "body": "a quick, confident goodbye and a cheerful hello teach them you always come back. drawn-out exits make it harder for everyone."
      },
      {
        "color": "caramel",
        "eyebrow": "new mover",
        "title": "Babyproof\nagain.",
        "say": "they reach higher now",
        "body": "a cruiser grabs cords, table edges, and outlets. re-walk the room at their new standing height and anchor anything that could topple."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "You're\ntheir safe.",
        "say": "you've got this",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "Comfort freely — it's not spoiling"
        },
        {
          "label": "Keep goodbyes short + confident",
          "note": "no sneaking out"
        },
        {
          "label": "Re-babyproof at standing height",
          "note": "cords, edges, outlets, low drawers"
        },
        {
          "label": "Anchor furniture + TVs to the wall"
        },
        {
          "label": "Offer a comfort object for handoffs + daytime",
          "note": "keep the crib empty for sleep"
        },
        {
          "label": "Book + prep the 9-month well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to soften separation anxiety",
      "items": [
        "practice short, low-stakes goodbyes around the house",
        "play peekaboo — it teaches 'you come back'",
        "keep a consistent caregiver + routine when you can",
        "name the feeling: 'you miss mama, i always come back'",
        "give a comfort object for handoffs and wind-down"
      ],
      "foot": "separation anxiety often peaks around now and eases with time. if your baby seems inconsolable or unwell, call your pediatrician."
    }
  }
};

// WEEK 40 (authored + accuracy-verified 2026-06-21)
const WEEK_40: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 40",
        "title": "two naps,\none cruiser",
        "say": "around 9.5 months",
        "body": "most babies settle into a steady two-nap rhythm right about now, and that predictability is a gift for everyone."
      },
      {
        "color": "rose",
        "eyebrow": "the standing trick",
        "title": "pulls up\nat 2am",
        "say": "totally normal phase",
        "body": "new cruisers love to practice standing in the crib at night. give it a beat before you rush in — many will figure out how to sit back down on their own."
      },
      {
        "color": "honey",
        "eyebrow": "two naps",
        "title": "morning + \nafternoon",
        "say": "ranges, not rules",
        "body": "a typical day looks like one mid-morning nap and one early-afternoon one, often around 2.5–3 hours of day sleep total. follow your baby, not the clock."
      },
      {
        "color": "caramel",
        "eyebrow": "safe + simple",
        "title": "back, bare,\nsleep sack",
        "say": "every single night",
        "body": "crib stays empty — no pillows, blankets, or bumpers this whole first year. a sleep sack with arms out keeps a busy mover cozy and free."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "rest is\nstill the work",
        "say": "steady wins",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep the crib empty — no pillows, blankets, or bumpers"
        },
        {
          "label": "sleep sack with arms out for your mover",
          "note": "swaddling stays off once baby can roll or sit"
        },
        {
          "label": "hold a steady two-nap rhythm",
          "note": "morning + afternoon is typical near this age"
        },
        {
          "label": "pause before rescuing a standing baby at night",
          "note": "many learn to sit back down themselves"
        },
        {
          "label": "keep bedtime predictable — same order, same cues"
        },
        {
          "label": "room-share without bed-sharing through the first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about sleep right now",
      "items": [
        "pulling to stand in the crib is a developmental phase, not a sleep problem",
        "brief night wakings can spike when a big motor skill is clicking into place",
        "a wind-down routine helps an excited cruiser switch off",
        "two naps often total around 2.5–3 hours across the day",
        "lower the crib mattress now that baby pulls up — safety first"
      ],
      "foot": "sleep needs vary widely — check with your pediatrician if sleep feels off for your baby."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 40",
        "title": "little hands,\nbig appetite",
        "say": "around 9.5 months",
        "body": "self-feeding finger foods is one of the proudest, messiest milestones — and it's exactly what those pincer fingers are built for."
      },
      {
        "color": "rose",
        "eyebrow": "pincer practice",
        "title": "thumb meets\nfinger",
        "say": "messy is good",
        "body": "soft pieces about the size of your fingertip let baby pick up food themselves. expect drops, smears, and a lot of learning."
      },
      {
        "color": "honey",
        "eyebrow": "milk still leads",
        "title": "breast or\nformula first",
        "say": "under 12 months",
        "body": "breastmilk or formula is still the main nutrition this whole first year. solids are practice and flavor, layered around milk feeds."
      },
      {
        "color": "caramel",
        "eyebrow": "keep it safe",
        "title": "no honey,\nno cow's milk",
        "say": "a quick reminder",
        "body": "hold honey and cow's milk as a drink until after the first birthday. always sit baby up to eat and stay within arm's reach."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing great",
        "title": "flavor is\nan adventure",
        "say": "one bite at a time",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer soft, fingertip-sized pieces for self-feeding"
        },
        {
          "label": "keep breastmilk or formula as the main nutrition",
          "note": "solids stay supportive this first year"
        },
        {
          "label": "sit baby fully upright and supervise every bite"
        },
        {
          "label": "no honey and no cow's milk as a drink before 12 months"
        },
        {
          "label": "offer small sips of water in an open or straw cup with meals"
        },
        {
          "label": "keep introducing new textures and flavors gently",
          "note": "it can take many tries for a baby to accept a food"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 finger foods to try",
      "items": [
        "soft-steamed veggie sticks (carrot, sweet potato, zucchini)",
        "ripe banana or avocado in graspable pieces",
        "well-cooked pasta spirals or soft beans",
        "small bits of soft scrambled egg or shredded chicken",
        "oat o's and soft toast strips for pincer practice"
      ],
      "foot": "cut foods small and soft, avoid choking shapes (whole grapes, nuts, hard chunks), and ask your pediatrician about introducing allergens."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 40",
        "title": "cruising the\nwhole room",
        "say": "around 9.5 months",
        "body": "holding furniture and sidestepping along it is huge — those little laps around the coffee table are how walking gets built."
      },
      {
        "color": "rose",
        "eyebrow": "on two feet",
        "title": "stands while\nholding on",
        "say": "ranges, not deadlines",
        "body": "pulling up and cruising is the work of this stretch. some babies cruise early, some later — both are perfectly normal."
      },
      {
        "color": "honey",
        "eyebrow": "first words near",
        "title": "mama, dada,\nmaybe soon",
        "say": "every baby's clock",
        "body": "intentional first words are approaching — babbling is sharpening into meaning. narrate your day and name things out loud."
      },
      {
        "color": "caramel",
        "eyebrow": "copycat phase",
        "title": "waves, claps,\ncopies you",
        "say": "play it back",
        "body": "babies this age love imitating simple gestures. wave, clap, and peekaboo together — it's connection and learning at once."
      },
      {
        "color": "blush",
        "eyebrow": "so much growing",
        "title": "every lap\nis progress",
        "say": "in their own time",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "clear a safe path for cruising along furniture"
        },
        {
          "label": "name objects and narrate your day to feed first words"
        },
        {
          "label": "play copycat games — wave, clap, peekaboo"
        },
        {
          "label": "give floor time and low surfaces to pull up on"
        },
        {
          "label": "anchor heavy furniture and TVs to the wall",
          "note": "new climbers test everything"
        },
        {
          "label": "bring milestone questions to your 9-month well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things showing up now",
      "items": [
        "cruising sideways along furniture while holding on",
        "pulling to stand and lowering back down",
        "copying simple gestures like waving and clapping",
        "babble sharpening toward intentional first words",
        "using thumb and finger in a neat pincer grasp"
      ],
      "foot": "milestones are ranges, not deadlines — if you have concerns, your pediatrician is the right call."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 40",
        "title": "safe to\nroam",
        "say": "around 9.5 months",
        "body": "a confident cruiser sees the whole world as a playground — a quick safety sweep lets them explore with you breathing easier."
      },
      {
        "color": "rose",
        "eyebrow": "down low",
        "title": "baby-proof\nat their level",
        "say": "crawl and check",
        "body": "get on the floor and look around — covered outlets, latched cabinets, gates at stairs. fix what those new hands can reach."
      },
      {
        "color": "honey",
        "eyebrow": "steady on",
        "title": "anchor the\nbig stuff",
        "say": "tip-overs happen",
        "body": "secure dressers, bookshelves, and TVs to the wall. a baby pulling up will lean on anything within reach."
      },
      {
        "color": "caramel",
        "eyebrow": "after the shots",
        "title": "mild fuss\ncan be normal",
        "say": "when in doubt, call",
        "body": "a little fussiness or low-grade fever after vaccines can happen — call your pediatrician with any worry or with a fever that concerns you."
      },
      {
        "color": "blush",
        "eyebrow": "you've got them",
        "title": "a safe nest\nto grow in",
        "say": "one room at a time",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "do a floor-level baby-proofing sweep of each room"
        },
        {
          "label": "anchor dressers, shelves, and TVs to the wall"
        },
        {
          "label": "add gates at the top and bottom of stairs"
        },
        {
          "label": "cover outlets and latch low cabinets",
          "note": "keep cleaners and meds up high and out of reach"
        },
        {
          "label": "keep up your 9-month well-visit and ask any questions"
        },
        {
          "label": "call your pediatrician with a fever or any symptoms that worry you"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 baby-proofing wins",
      "items": [
        "anchor tall furniture and TVs against tip-overs",
        "gate stairs at top and bottom",
        "move cleaners, meds, and small objects out of reach",
        "cover outlets and tuck away cords and blind cords",
        "pad sharp corners on low tables"
      ],
      "foot": "no product replaces supervision — stay close, and call your provider with any health concern."
    }
  }
};

// WEEK 41 (authored + accuracy-verified 2026-06-21)
const WEEK_41: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 41",
        "title": "standing\nin the crib",
        "say": "this is a phase",
        "body": "around now babies pull up and stand at the crib rail at bedtime — it's exciting, not a sleep problem, and it passes."
      },
      {
        "color": "rose",
        "eyebrow": "the stand-up game",
        "title": "lay back\ndown calmly",
        "say": "boring is best",
        "body": "if they pop up at bedtime, gently lay them back down without a show. quiet and repetitive teaches more than a reaction does."
      },
      {
        "color": "honey",
        "eyebrow": "two naps still",
        "title": "hold the\ntwo naps",
        "say": "morning + afternoon",
        "body": "most babies this age still take two naps. wake windows of about 3-4 hours stretch the day without overtiring."
      },
      {
        "color": "caramel",
        "eyebrow": "never changes",
        "title": "back, firm,\nempty",
        "say": "every single sleep",
        "body": "on the back, firm flat surface, nothing else in there. room-share, not bed-share, through the first year."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "they'll settle\nagain",
        "say": "stay the course",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep two naps with ~3-4 hr wake windows"
        },
        {
          "label": "calmly lay them back down when they stand at the rail",
          "note": "low drama works better than a reaction"
        },
        {
          "label": "drop the crib mattress to its lowest setting now that they pull to stand",
          "note": "a standing baby can topple over a high rail"
        },
        {
          "label": "keep every sleep on the back, firm flat surface, empty crib"
        },
        {
          "label": "room-share, not bed-share, for the first year"
        },
        {
          "label": "keep a calm, predictable wind-down before bed"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons sleep wobbles around now",
      "items": [
        "new skills — pulling up and cruising are too fun to stop for sleep",
        "separation awareness peaks, so goodnights feel bigger",
        "a tooth or two may be working through",
        "a nap may be getting a little shorter as the day stretches",
        "schedule changes — travel, illness, or a busy week"
      ],
      "foot": "most wobbles pass in a week or two; if sleep changes come with fever or real distress, call your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 41",
        "title": "tiny fingers,\nbig pinch",
        "say": "let them practice",
        "body": "the pincer grasp is sharpening — thumb-and-finger pickups make self-feeding the main event right now."
      },
      {
        "color": "rose",
        "eyebrow": "finger foods",
        "title": "small, soft,\ngraspable",
        "say": "stay close + seated",
        "body": "soft pea-sized pieces let them practice the pincer. always supervise, baby upright, and know the difference between gagging and choking."
      },
      {
        "color": "honey",
        "eyebrow": "milk still leads",
        "title": "milk first,\nfood beside it",
        "say": "before 12 months",
        "body": "breast milk or formula is still the main nutrition this year. solids are for practice and exposure, not to replace milk yet."
      },
      {
        "color": "caramel",
        "eyebrow": "the no list",
        "title": "skip these\nfor now",
        "say": "safety, not preference",
        "body": "no honey and no cow's milk as a drink before 12 months. avoid choking shapes like whole grapes, nuts, and hard chunks."
      },
      {
        "color": "blush",
        "eyebrow": "let it be messy",
        "title": "mess means\nlearning",
        "say": "hands are tools",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer soft, pea-sized finger foods for pincer practice"
        },
        {
          "label": "keep breast milk or formula as the main nutrition",
          "note": "no cow's milk as a drink before 12 months"
        },
        {
          "label": "always supervise, baby seated and upright, never on the move"
        },
        {
          "label": "skip honey, whole grapes, nuts, and hard chunks"
        },
        {
          "label": "offer water in an open or straw cup with meals",
          "note": "small amounts alongside food"
        },
        {
          "label": "let them feed themselves and expect the mess"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 easy pincer-practice foods",
      "items": [
        "soft-steamed carrot or sweet potato in small pieces",
        "ripe banana or avocado in little chunks",
        "well-cooked pasta cut small",
        "soft black beans or chickpeas, lightly smashed",
        "small bits of soft scrambled egg or shredded cheese"
      ],
      "foot": "cut everything to soft, pea-sized pieces, stay within arm's reach, and ask your pediatrician about allergens."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 41",
        "title": "cruising,\nfast",
        "say": "ranges, not deadlines",
        "body": "many babies cruise along furniture now and may stand alone for a second or two — every baby is on their own clock."
      },
      {
        "color": "rose",
        "eyebrow": "they hear you",
        "title": "words are\nlanding",
        "say": "narrate everything",
        "body": "simple words like 'milk,' 'up,' and even 'no' are starting to make sense. talk through your day and watch them respond."
      },
      {
        "color": "honey",
        "eyebrow": "cause + effect",
        "title": "bang, drop,\nrepeat",
        "say": "this is science",
        "body": "dropping a spoon a hundred times isn't a battle — it's how they learn that actions make things happen. let them experiment."
      },
      {
        "color": "caramel",
        "eyebrow": "let them lead",
        "title": "floor time\nover gear",
        "say": "skip the walker",
        "body": "open floor space beats a walker for building real balance. low, sturdy furniture gives them something safe to pull up on."
      },
      {
        "color": "blush",
        "eyebrow": "watching it click",
        "title": "the world\nis opening",
        "say": "their own pace",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give open floor space for cruising and pulling up"
        },
        {
          "label": "name objects and actions as you go through the day"
        },
        {
          "label": "play drop-and-fetch and peekaboo for cause-and-effect"
        },
        {
          "label": "offer cups, boxes, and lids to fill, dump, and bang"
        },
        {
          "label": "use simple, consistent words like up, more, and all done"
        },
        {
          "label": "treat milestones as ranges, not a timeline",
          "note": "babies cruise and stand on their own clock"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "What's coming next",
      "items": [
        "cruising more smoothly along furniture",
        "standing alone for a couple of seconds",
        "first clear words and pointing at what they want",
        "waving bye-bye and playing back-and-forth games",
        "first wobbly steps — often closer to 12 months or later"
      ],
      "foot": "ranges, not deadlines — bring any milestone questions to the well visit. you know your baby best."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 41",
        "title": "they're\neverywhere",
        "say": "a moving target",
        "body": "now that they pull up and cruise, the room looks different. a quick safety pass keeps the adventure a happy one."
      },
      {
        "color": "rose",
        "eyebrow": "baby-proof again",
        "title": "get down\nto their level",
        "say": "anchor the heavy",
        "body": "crawl the floor and look up — anchor furniture and TVs, cover outlets, and move cords and small objects out of reach."
      },
      {
        "color": "honey",
        "eyebrow": "tiny hazards",
        "title": "scan for\nchoking bits",
        "say": "toilet-paper-tube test",
        "body": "cruisers grab and mouth everything. if it fits through a toilet-paper tube it's a choking risk — sweep floors for coins, batteries, magnets, and small parts."
      },
      {
        "color": "caramel",
        "eyebrow": "they get 'no'",
        "title": "redirect,\ndon't lecture",
        "say": "short and calm",
        "body": "they understand a simple 'no' now but can't stop themselves yet. a calm word plus moving them along teaches best."
      },
      {
        "color": "blush",
        "eyebrow": "you're on it",
        "title": "safe to\nexplore",
        "say": "you've got this",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "anchor dressers, bookshelves, and TVs to the wall"
        },
        {
          "label": "do a floor sweep for choking-size objects",
          "note": "if it fits through a toilet-paper tube, it's too small"
        },
        {
          "label": "cover outlets and secure blind cords and electrical cords"
        },
        {
          "label": "use gates at stairs and latches on low cabinets"
        },
        {
          "label": "redirect calmly when they reach for something off-limits"
        },
        {
          "label": "know the fever rule and call your pediatrician with concerns",
          "note": "trust your gut on anything that feels off"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5-minute cruiser safety sweep",
      "items": [
        "anchor anything tall or heavy that could tip over",
        "scan low surfaces and floors for coins, batteries, and magnets",
        "tuck away cords, blind pulls, and phone chargers",
        "latch cabinets with cleaners, meds, and sharp items",
        "gate the stairs and check that windows are secured"
      ],
      "foot": "this isn't a one-time job — re-sweep as they get taller and faster; keep Poison Control (1-800-222-1222) handy."
    }
  }
};

// WEEK 42 (authored + accuracy-verified 2026-06-21)
const WEEK_42: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 42",
        "title": "sleep at\nten months",
        "say": "you've got this",
        "body": "big-kid skills are showing up in the crib, but the safe-sleep basics never change."
      },
      {
        "color": "rose",
        "eyebrow": "two-nap life",
        "title": "most babies\nstill nap twice",
        "say": "two is normal",
        "body": "a few start nudging toward one nap around now, but most stay on two for a while. follow your baby, not the calendar."
      },
      {
        "color": "honey",
        "eyebrow": "standing up",
        "title": "pulls up\nin the crib",
        "say": "this is normal",
        "body": "lots of babies pull to stand at bedtime and get a little stuck. give them a minute to figure it out, or gently help them back down."
      },
      {
        "color": "caramel",
        "eyebrow": "same old rules",
        "title": "back, bare,\nsleep sack",
        "say": "every single night",
        "body": "on the back, firm flat surface, nothing loose in the crib. since they roll, skip the swaddle and use a sleep sack with arms out."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing great",
        "title": "that's sleep\nthis week",
        "say": "one day at a time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep offering two naps unless baby clearly fights one"
        },
        {
          "label": "lower the crib mattress if you haven't",
          "note": "now that they can pull to stand"
        },
        {
          "label": "clear the crib — no pillows, bumpers, or toys"
        },
        {
          "label": "use a sleep sack, arms out",
          "note": "no swaddle once rolling"
        },
        {
          "label": "hold a calm, predictable bedtime routine"
        },
        {
          "label": "room-share without bed-sharing through the first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 sleep things at 10 months",
      "items": [
        "pulling up at bedtime is a phase — practice it in the daytime too",
        "a wake-up at the same time most nights is often a habit, not hunger",
        "standing then fussing usually just means they can't sit back down yet",
        "a wobbly nap day around a leap or new skill is normal",
        "most 10-month-olds sleep roughly 11–12 hours overnight plus naps"
      ],
      "foot": "sleep needs vary widely — talk to your pediatrician about big or sudden changes."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 42",
        "title": "feeding at\nten months",
        "say": "messy is good",
        "body": "milk still leads, but meals are getting more real and a lot more hands-on."
      },
      {
        "color": "rose",
        "eyebrow": "finger foods",
        "title": "let them\nfeed themselves",
        "say": "messy means learning",
        "body": "soft, pea-sized pieces they can pick up build the pincer grasp. expect more on the floor than in the mouth for now."
      },
      {
        "color": "honey",
        "eyebrow": "milk still matters",
        "title": "breast or\nformula leads",
        "say": "under one year",
        "body": "breastmilk or formula is still their main nutrition. no cow's milk as a drink and no honey until after the first birthday."
      },
      {
        "color": "caramel",
        "eyebrow": "sips of water",
        "title": "an open cup\nto practice",
        "say": "small amounts ok",
        "body": "offer a little water in an open or straw cup with meals. it's for practice — milk is still doing the heavy lifting."
      },
      {
        "color": "blush",
        "eyebrow": "so much progress",
        "title": "that's feeding\nthis week",
        "say": "trust their pace",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer soft finger foods in pea-sized pieces"
        },
        {
          "label": "keep breastmilk or formula as the main drink"
        },
        {
          "label": "introduce a variety of textures and flavors"
        },
        {
          "label": "let baby practice an open or straw cup with water",
          "note": "small sips at meals"
        },
        {
          "label": "always sit with baby and watch for choking"
        },
        {
          "label": "skip honey and cow's milk as a drink until 12 months"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 feeding things at 10 months",
      "items": [
        "the pincer grasp (thumb + finger) is blooming — finger foods help it along",
        "cut round foods like grapes lengthwise into tiny pieces",
        "refusing a food once isn't a no — it can take many tries",
        "appetite dips on busy or teething days, and that's okay",
        "aim for soft, gummable textures, not just purées"
      ],
      "foot": "learn the difference between gagging and choking, and ask your pediatrician about any allergy concerns."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 42",
        "title": "growing at\nten months",
        "say": "every baby's own pace",
        "body": "this is a big, busy month for movement and chatter — and it all unfolds on a wide timeline."
      },
      {
        "color": "rose",
        "eyebrow": "first steps",
        "title": "may stand,\nmay step",
        "say": "a wide range",
        "body": "some babies stand alone for a second or take a first wobble; many won't walk for weeks or months. all of it is normal."
      },
      {
        "color": "honey",
        "eyebrow": "so much babble",
        "title": "sounds, points,\nand waves",
        "say": "talk back",
        "body": "babbling, pointing, and copying you are huge. name what they point at and chat through your day to feed those new words."
      },
      {
        "color": "caramel",
        "eyebrow": "little mimic",
        "title": "copies what\nyou do",
        "say": "you're the model",
        "body": "clapping, waving, banging cups together — they're learning by watching you. simple back-and-forth games build big skills."
      },
      {
        "color": "blush",
        "eyebrow": "watching them bloom",
        "title": "that's growth\nthis week",
        "say": "ranges, not deadlines",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe floor space to pull up and cruise"
        },
        {
          "label": "name objects as baby points and gestures"
        },
        {
          "label": "play copycat games — clap, wave, peekaboo"
        },
        {
          "label": "read together and pause for them to respond"
        },
        {
          "label": "let them practice standing without rushing steps"
        },
        {
          "label": "keep up with well-visits and milestone check-ins"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 growth things at 10 months",
      "items": [
        "standing alone briefly often comes before any first step",
        "pointing and gestures are early language — they count as 'talking'",
        "copying you (waves, sounds, faces) is a key social milestone",
        "cruising along furniture is great practice for walking later",
        "milestones are ranges — first steps can land anywhere across a wide window"
      ],
      "foot": "if baby isn't babbling, gesturing, or bearing weight on legs, mention it at the next well-visit — your pediatrician is the guide."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 42",
        "title": "care at\nten months",
        "say": "you matter too",
        "body": "a more mobile, more verbal baby means a few new things to babyproof — and a few feelings to hold."
      },
      {
        "color": "rose",
        "eyebrow": "on the move",
        "title": "recheck your\nbabyproofing",
        "say": "they reach higher",
        "body": "now that they pull up and cruise, get down to their level and look again. secure furniture, cover outlets, move climbables away."
      },
      {
        "color": "honey",
        "eyebrow": "big feelings",
        "title": "clinginess\nis love",
        "say": "totally normal",
        "body": "separation worries can peak around now. quick, cheerful goodbyes and a steady routine help them feel safe."
      },
      {
        "color": "caramel",
        "eyebrow": "teething again",
        "title": "more teeth,\nmore drool",
        "say": "comfort, not panic",
        "body": "chilled teethers and gentle gums help. start brushing tiny teeth with a soft brush and a smear of fluoride toothpaste."
      },
      {
        "color": "blush",
        "eyebrow": "you're their safe place",
        "title": "that's care\nthis week",
        "say": "ask for help",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "re-babyproof at standing and cruising height"
        },
        {
          "label": "anchor bookshelves and dressers to the wall"
        },
        {
          "label": "keep quick, warm goodbyes for separation anxiety"
        },
        {
          "label": "brush new teeth with a soft brush and tiny smear of toothpaste"
        },
        {
          "label": "confirm your next well-visit and any vaccines"
        },
        {
          "label": "build in a little rest for yourself, too"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 care things at 10 months",
      "items": [
        "secure tall furniture — climbing comes fast once they stand",
        "separation anxiety peaking now is a sign of healthy attachment",
        "object permanence means peekaboo and 'mama comes back' really land",
        "a smear of fluoride toothpaste is enough for those first teeth",
        "mild fussiness after a vaccine can be normal — follow your pediatrician"
      ],
      "foot": "trust your gut — a fever, lethargy, or anything that worries you is always worth a call to your provider."
    }
  }
};

// WEEK 44 (authored + accuracy-verified 2026-06-21)
const WEEK_44: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 44",
        "title": "the standing-up\nin the crib phase",
        "say": "yes, it's normal",
        "body": "around 10.5 months a lot of babies pull to stand in the crib and forget how to sit back down — sleep usually settles again once they practice the way back down."
      },
      {
        "color": "rose",
        "eyebrow": "back down practice",
        "title": "teach the\nsit-back-down",
        "say": "daytime, not bedtime",
        "body": "if they stand and cry at bedtime, practice lowering from standing to sitting during the day. at night, calmly help them down and step back."
      },
      {
        "color": "honey",
        "eyebrow": "still on the back",
        "title": "back, sack,\nbare crib",
        "say": "true all year",
        "body": "keep starting them on their back on a firm flat surface with nothing else in the crib. once they roll and stand, it's a sleep sack with arms out — no swaddle."
      },
      {
        "color": "caramel",
        "eyebrow": "two naps still",
        "title": "hold the\ntwo-nap rhythm",
        "say": "ranges, not rules",
        "body": "most babies this age still nap twice a day. the drop to one nap usually comes later, so there's no rush to push it."
      },
      {
        "color": "blush",
        "eyebrow": "for now",
        "title": "you've got\nthe rhythm",
        "say": "one night at a time",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "start every sleep on the back, firm flat surface"
        },
        {
          "label": "keep the crib bare — no pillows, blankets, or bumpers"
        },
        {
          "label": "use a sleep sack with arms out, never a swaddle",
          "note": "swaddling stops once a baby can roll"
        },
        {
          "label": "practice sitting back down from standing during the day"
        },
        {
          "label": "lower the mattress if you haven't — they're pulling up now"
        },
        {
          "label": "keep a short, predictable wind-down routine"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about sleep right now",
      "items": [
        "pulling to stand in the crib is a milestone, not misbehaving",
        "standing then crying often means they can't get back down yet",
        "two naps a day is still typical at this age",
        "a lowered crib mattress keeps a standing baby safe",
        "separation feelings can briefly bump up night wake-ups"
      ],
      "foot": "every baby's rhythm differs — talk to your pediatrician if sleep changes worry you."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 44",
        "title": "the great\nself-feeding era",
        "say": "messy is good",
        "body": "around 10.5 months many babies grab the spoon, pinch up tiny bits, and want to do it themselves — the mess is part of how they learn."
      },
      {
        "color": "rose",
        "eyebrow": "let them lead",
        "title": "hand over\nsmall pieces",
        "say": "always supervised",
        "body": "offer soft, pea-sized finger foods they can pick up. a loaded spoon they grab themselves builds the same skills."
      },
      {
        "color": "honey",
        "eyebrow": "milk still first",
        "title": "breastmilk or\nformula leads",
        "say": "before 12 months",
        "body": "breastmilk or formula is still their main nutrition this whole year. solids are practice and extras, not the main meal yet."
      },
      {
        "color": "caramel",
        "eyebrow": "keep these off",
        "title": "no honey,\nno cow's milk",
        "say": "wait till one",
        "body": "skip honey and cow's milk as a drink until 12 months. cut round foods like grapes lengthwise and avoid hard, small, choke-able bits."
      },
      {
        "color": "blush",
        "eyebrow": "for now",
        "title": "let them\nmake a mess",
        "say": "you're doing great",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep breastmilk or formula as the main nutrition"
        },
        {
          "label": "offer soft, pea-sized finger foods to self-feed"
        },
        {
          "label": "let them try a spoon — expect mess",
          "note": "grabbing the spoon is a real skill"
        },
        {
          "label": "no honey and no cow's milk as a drink before 12 months"
        },
        {
          "label": "cut round foods lengthwise; skip hard, choke-able bits"
        },
        {
          "label": "always stay within arm's reach while they eat"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about feeding now",
      "items": [
        "self-feeding with fingers and spoon builds coordination",
        "the pincer grasp lets them pick up tiny pieces",
        "milk or formula is still the main source until 12 months",
        "honey and cow's-milk-as-a-drink wait until after one",
        "small sips of water in an open or straw cup with meals are fine now"
      ],
      "foot": "learn the difference between gagging (normal) and choking, and ask your pediatrician about any feeding worries."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 44",
        "title": "cruising fast,\nsteps in range",
        "say": "ranges, not deadlines",
        "body": "around 10.5 months lots of babies cruise along furniture and some take a first wobbly step — first steps land anywhere across a wide window, all normal."
      },
      {
        "color": "rose",
        "eyebrow": "let them cruise",
        "title": "low, sturdy\nthings to hold",
        "say": "clear the path",
        "body": "set up safe, stable furniture at their height to cruise along. bare feet help them feel the floor and balance."
      },
      {
        "color": "honey",
        "eyebrow": "first little words",
        "title": "one or two\nwords with meaning",
        "say": "name everything",
        "body": "many babies now say a word or two on purpose, like \"mama\" or \"dada\". narrate your day and pause so they can answer back."
      },
      {
        "color": "caramel",
        "eyebrow": "they understand",
        "title": "follows simple\nasks and \"no\"",
        "say": "keep it short",
        "body": "they're starting to understand small requests and the word \"no\". simple, calm directions land better than long explanations."
      },
      {
        "color": "blush",
        "eyebrow": "for now",
        "title": "every baby\non their own clock",
        "say": "no such thing as behind",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe, sturdy furniture to cruise along"
        },
        {
          "label": "let them go barefoot inside to build balance",
          "note": "no shoes needed for early walking"
        },
        {
          "label": "name objects and narrate your day out loud"
        },
        {
          "label": "use short, simple requests they can follow"
        },
        {
          "label": "celebrate effort — cruising and steps come on a wide timeline"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about this stage",
      "items": [
        "cruising along furniture is the warm-up for walking",
        "first independent steps can come now or months from now",
        "one to two meaningful words is typical around this age",
        "they understand more than they can say, including \"no\"",
        "barefoot at home helps balance more than shoes do"
      ],
      "foot": "milestones are ranges, not deadlines — bring any questions about movement or words to your well-visit."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 44",
        "title": "a tiny mover\nwho gets \"no\"",
        "say": "you've got this",
        "body": "now that they pull up, cruise, and understand simple words, care this week is mostly about a safe space to explore and steady, calm limits."
      },
      {
        "color": "rose",
        "eyebrow": "re-check the room",
        "title": "babyproof at\nstanding height",
        "say": "get down low",
        "body": "they can reach higher now — anchor furniture and TVs, move cords and small objects up. crawl their route to spot hazards."
      },
      {
        "color": "honey",
        "eyebrow": "gentle limits",
        "title": "\"no\" plus\na redirect",
        "say": "calm beats loud",
        "body": "they're learning \"no\" but need help following it. pair a short \"no\" with moving them to something safe to do instead."
      },
      {
        "color": "caramel",
        "eyebrow": "feelings are big",
        "title": "clingy is\nconnection",
        "say": "totally normal",
        "body": "separation feelings can peak around now. quick, warm goodbyes and a predictable return help them feel secure."
      },
      {
        "color": "blush",
        "eyebrow": "for now",
        "title": "safe space,\nsteady you",
        "say": "one day at a time",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "anchor furniture and TVs to the wall"
        },
        {
          "label": "move cords, cleaners, and small objects out of reach"
        },
        {
          "label": "pair \"no\" with a calm redirect to something safe"
        },
        {
          "label": "keep goodbyes short and warm during clingy phases"
        },
        {
          "label": "check in about the 12-month well-visit and shots",
          "note": "ask your pediatrician what's coming up"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things to handle this week",
      "items": [
        "re-babyproof for a baby who now stands and reaches",
        "anchoring furniture prevents the most serious tip-over injuries",
        "short \"no\" plus redirect teaches limits without fear",
        "separation anxiety is a sign of healthy attachment",
        "after vaccines, mild fussiness or low fever can be normal"
      ],
      "foot": "for a high or lasting fever, or anything that worries you, call your pediatrician."
    }
  }
};

// WEEK 45 (authored + accuracy-verified 2026-06-21)
const WEEK_45: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 45",
        "title": "almost-walker,\nstill needs rest",
        "say": "big body, big sleep",
        "body": "all that standing and cruising burns real energy, so good sleep matters more than ever right now."
      },
      {
        "color": "rose",
        "eyebrow": "the standing phase",
        "title": "pulls up\nin the crib",
        "say": "it's a stage",
        "body": "around now lots of babies pop up to stand the second you put them down. lay them back down calmly, keep it boring, and they learn to settle themselves."
      },
      {
        "color": "honey",
        "eyebrow": "one or two",
        "title": "naps are\nshifting",
        "say": "follow their lead",
        "body": "some babies still take two naps, some are sliding toward one. watch their cues and let the schedule move slowly rather than forcing it."
      },
      {
        "color": "caramel",
        "eyebrow": "still on the back",
        "title": "safe sleep\ndoesn't expire",
        "say": "every night, every nap",
        "body": "back to sleep, firm flat surface, nothing soft in the crib. once they roll and stand, skip the swaddle and use a sleep sack with arms out."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "rest fuels\nthe next leap",
        "say": "steady wins",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep bedtime calm and predictable",
          "note": "a steady wind-down helps a busy body settle"
        },
        {
          "label": "lay them back down if they stand in the crib",
          "note": "quiet and matter-of-fact"
        },
        {
          "label": "watch nap cues as 2 naps drift toward 1"
        },
        {
          "label": "use a sleep sack, arms out — no swaddle"
        },
        {
          "label": "keep the crib bare: no pillows, blankets, or toys"
        },
        {
          "label": "room-share without bed-sharing this first year"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things about sleep right now",
      "items": [
        "standing up in the crib is a normal new skill, not a sleep regression to panic over",
        "practicing pull-to-stand on the floor by day can mean less of it at night",
        "a 2-to-1 nap transition is usually slow and bumpy — that's okay",
        "split nights or early wakes often pass as a developmental leap settles",
        "crib bare and back-sleeping stay non-negotiable, every age"
      ],
      "foot": "sudden, lasting sleep changes are worth a chat with your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 45",
        "title": "a tiny eater\nwith opinions",
        "say": "variety is the goal",
        "body": "around now many babies handle a real range of finger foods and love feeding themselves — mess and all."
      },
      {
        "color": "rose",
        "eyebrow": "finger foods",
        "title": "let them\npick it up",
        "say": "soft, small pieces",
        "body": "offer soft, pea-sized bits they can grab with that pincer grasp. self-feeding builds skill, even when most of it lands on the floor."
      },
      {
        "color": "honey",
        "eyebrow": "milk still counts",
        "title": "breast or\nformula leads",
        "say": "food rounds it out",
        "body": "breastmilk or formula is still their main nutrition this whole first year. solids are practice and exploration alongside it."
      },
      {
        "color": "caramel",
        "eyebrow": "the no list",
        "title": "a few foods\nstill wait",
        "say": "keep these out",
        "body": "no honey and no cow's milk as a drink until after one year. keep choke risks like whole grapes, nuts, and round hot dog coins off the tray."
      },
      {
        "color": "blush",
        "eyebrow": "trust the process",
        "title": "every bite\nis learning",
        "say": "let them explore",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer a variety of soft finger foods daily",
          "note": "different colors, textures, and flavors"
        },
        {
          "label": "keep breastmilk or formula as the main drink"
        },
        {
          "label": "cut foods small and soft to lower choke risk"
        },
        {
          "label": "skip honey and cow's milk as a drink until 12 months"
        },
        {
          "label": "always supervise, seated, during meals"
        },
        {
          "label": "offer water in an open or straw cup with meals"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 finger foods to try",
      "items": [
        "soft-steamed veggie sticks or florets, cooled",
        "small pieces of ripe banana, avocado, or pear",
        "well-cooked pasta or soft beans",
        "strips of soft scrambled egg or shredded chicken",
        "grapes and cherry tomatoes quartered lengthwise, never whole"
      ],
      "foot": "introduce one new food at a time — for swelling, trouble breathing, or other severe allergy signs, get emergency care right away."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 45",
        "title": "standing solo,\nmaybe a step",
        "say": "ranges, not deadlines",
        "body": "some babies stand alone and take a wobbly first step around now, and plenty take their time — all of it is normal."
      },
      {
        "color": "rose",
        "eyebrow": "first steps",
        "title": "wobbly and\nbarefoot is best",
        "say": "no shoes needed",
        "body": "bare feet help them feel the floor and balance. give them safe open space to cruise, stand, and tumble onto a soft landing."
      },
      {
        "color": "honey",
        "eyebrow": "pointing",
        "title": "points to\nwhat they want",
        "say": "a big leap",
        "body": "that little finger is communication. name what they point at — 'the dog!' — to pour words into all that curiosity."
      },
      {
        "color": "caramel",
        "eyebrow": "a wide range",
        "title": "walking comes\nwhen it comes",
        "say": "not a race",
        "body": "some babies walk before one, many well after — anywhere into the teens of months is typical. early or late doesn't predict anything."
      },
      {
        "color": "blush",
        "eyebrow": "cheering you both on",
        "title": "so much\nhappening",
        "say": "watch them go",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe open floor space to stand and cruise",
          "note": "soft landings nearby"
        },
        {
          "label": "let them go barefoot indoors for better balance"
        },
        {
          "label": "name what they point at to build language"
        },
        {
          "label": "anchor furniture and gate stairs as they pull up"
        },
        {
          "label": "celebrate effort, not just the milestone"
        },
        {
          "label": "bring up any milestone questions at the well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things you might see now",
      "items": [
        "standing alone for a few seconds without holding on",
        "cruising fast along furniture, maybe letting go",
        "pointing at people, pets, and things they want",
        "a first wobbly step — or no steps yet, both fine",
        "copying you: waving, clapping, simple sounds"
      ],
      "foot": "milestones are ranges — share any worries with your pediatrician, never a checklist deadline."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 45",
        "title": "a mobile baby,\na busier you",
        "say": "safety shifts again",
        "body": "now that they pull up and maybe step, the house changes fast — and so does what keeps them safe."
      },
      {
        "color": "rose",
        "eyebrow": "baby-proof again",
        "title": "get down\nto their level",
        "say": "crawl and look",
        "body": "a standing baby reaches higher shelves and table edges. re-scan for cords, wobbly furniture, and anything newly in reach."
      },
      {
        "color": "honey",
        "eyebrow": "those little teeth",
        "title": "brush twice\na day",
        "say": "tiny smear",
        "body": "with teeth in, brush morning and night with a rice-grain smear of fluoride toothpaste. a first dental visit by age one is a good idea."
      },
      {
        "color": "caramel",
        "eyebrow": "feelings are big",
        "title": "clinginess\nis connection",
        "say": "totally normal",
        "body": "separation worry can spike around now. quick, confident goodbyes and a reliable return teach them you always come back."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing great",
        "title": "keeping pace\nwith a mover",
        "say": "one step at a time",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "re-baby-proof for a taller, standing reach",
          "note": "anchor furniture, secure cords"
        },
        {
          "label": "brush teeth twice daily with a rice-grain smear of toothpaste"
        },
        {
          "label": "keep a calm, predictable goodbye routine"
        },
        {
          "label": "check that gates and outlet covers are secure"
        },
        {
          "label": "schedule a first dental visit around age one"
        },
        {
          "label": "keep up with well-visits and any due vaccines"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 quick safety re-checks",
      "items": [
        "anchor dressers, bookshelves, and the TV to the wall",
        "raise or tuck away blind and electrical cords",
        "add corner guards to sharp table edges",
        "move hot drinks and small objects out of reach",
        "lock cabinets with cleaners or medicines"
      ],
      "foot": "after vaccines mild fussiness or low fever can be normal — follow your pediatrician's guidance."
    }
  }
};

// WEEK 46 (authored + accuracy-verified 2026-06-21)
const WEEK_46: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 46",
        "title": "almost-walker\nsleep",
        "say": "steady as you go",
        "body": "the body that pulled up to standing all day is still learning to power all the way down at night — that's normal."
      },
      {
        "color": "rose",
        "eyebrow": "standing in the crib",
        "title": "pop up,\nlie back down",
        "say": "give it a beat",
        "body": "lots of near-walkers practice standing in the crib at bedtime. pause before you rush in; many lower themselves and settle on their own."
      },
      {
        "color": "honey",
        "eyebrow": "same boring crib",
        "title": "flat, firm,\nempty",
        "say": "every single night",
        "body": "safe sleep doesn't change with new skills — still back to sleep, firm flat mattress, no pillows, blankets, or bumpers. a sleep sack with arms out is plenty."
      },
      {
        "color": "caramel",
        "eyebrow": "one nap shifting",
        "title": "the great\nnap merge",
        "say": "watch the cues",
        "body": "some 11-month-olds start fighting one of their two naps. follow the tired cues, not the clock, and shift bedtime a touch earlier on short-nap days."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "steady nights\nahead",
        "say": "ranges, not rules",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep the crib flat, firm, and empty — no pillows or blankets yet"
        },
        {
          "label": "lower the mattress to its lowest setting",
          "note": "a pulling-up baby can topple over a high rail"
        },
        {
          "label": "sleep sack with arms out — no swaddling once rolling or standing"
        },
        {
          "label": "pause before responding to crib-standing at bedtime"
        },
        {
          "label": "protect a consistent wind-down routine, even while traveling"
        },
        {
          "label": "keep room-sharing if it still works for you (not bed-sharing)"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 sleep shifts around 11 months",
      "items": [
        "standing up in the crib (and not always knowing how to get down)",
        "more night-waking during a big motor leap like cruising",
        "one nap suddenly feeling like a fight",
        "earlier bedtime needed on days a nap runs short",
        "separation feelings peaking at lights-out"
      ],
      "foot": "these are common, not universal — every baby's sleep timeline is their own, and your pediatrician is there for any worries."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 46",
        "title": "the 12-month\nrunway",
        "say": "start, don't rush",
        "body": "big transitions are coming next month — this is the gentle on-ramp, not the finish line."
      },
      {
        "color": "rose",
        "eyebrow": "still not yet",
        "title": "hold the\ncow's milk",
        "say": "wait for 12 mo",
        "body": "breastmilk or formula is still the main drink until the first birthday. you can start thinking about whole milk now, but don't pour it yet."
      },
      {
        "color": "honey",
        "eyebrow": "meet the cup",
        "title": "bottle out,\ncup in",
        "say": "slow and steady",
        "body": "now's a lovely time to offer more from an open or straw cup. swapping one bottle at a time makes the 12-month bottle wean feel easy."
      },
      {
        "color": "caramel",
        "eyebrow": "real little meals",
        "title": "meals plus\nsnacks",
        "say": "let them lead",
        "body": "most 11-month-olds eat soft table foods in small pieces and love self-feeding. keep textures varied and keep offering, even foods they've turned down before."
      },
      {
        "color": "blush",
        "eyebrow": "family table",
        "title": "one meal,\nshared",
        "say": "no honey yet",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep breastmilk or formula as the main drink for now",
          "note": "whole milk waits until 12 months"
        },
        {
          "label": "offer small sips of water in an open or straw cup with meals"
        },
        {
          "label": "swap one bottle feed for a cup to start the gentle wean"
        },
        {
          "label": "serve soft, pea-sized table foods — keep round foods cut small"
        },
        {
          "label": "still no honey until the first birthday"
        },
        {
          "label": "sit together and share the same foods when you can"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to start the 12-month food prep",
      "items": [
        "practice the open or straw cup now, a little every day",
        "wean one bottle at a time, not all at once",
        "keep introducing new textures so chewing keeps maturing",
        "plan to switch to whole milk near 12 months (not a drink yet)",
        "keep meals social — they eat better watching you eat"
      ],
      "foot": "appetites swing week to week at this age; follow their hunger and fullness, and ask your pediatrician about any feeding worries."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 46",
        "title": "on the\nmove",
        "say": "in their own time",
        "body": "pulling up, cruising the couch, maybe a wobbly free-stand — your baby's whole world just got vertical."
      },
      {
        "color": "rose",
        "eyebrow": "cruise control",
        "title": "furniture\nwalking",
        "say": "ranges, not races",
        "body": "many 11-month-olds cruise sideways holding furniture and stand steady for a moment. some take first steps soon, some weeks later — all normal."
      },
      {
        "color": "honey",
        "eyebrow": "they get it",
        "title": "\"where's the\nball?\"",
        "say": "keep narrating",
        "body": "simple requests are starting to land — they may look, point, or hand things over. talk through your day and watch the understanding bloom."
      },
      {
        "color": "caramel",
        "eyebrow": "floor is the gym",
        "title": "barefoot\nis best",
        "say": "clear the path",
        "body": "bare or grippy-sock feet help balance more than shoes indoors. give safe open floor and low sturdy furniture to pull up on."
      },
      {
        "color": "blush",
        "eyebrow": "every baby, their pace",
        "title": "steady\nwins",
        "say": "trust the range",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "create safe pull-up and cruising space with sturdy furniture"
        },
        {
          "label": "let them go barefoot indoors for better balance"
        },
        {
          "label": "give simple one-step requests and lots of narration"
        },
        {
          "label": "re-check anchors on dressers, shelves, and TVs",
          "note": "climbers test everything that moves"
        },
        {
          "label": "cheer the attempts, not just the milestones"
        },
        {
          "label": "bring any milestone questions to the next well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things you might see around 11 months",
      "items": [
        "pulling up and cruising along furniture",
        "standing steady for a few seconds unassisted",
        "understanding simple requests like \"give me\" or \"wave bye\"",
        "pointing at what they want or find interesting",
        "using a finger-and-thumb pincer grasp on tiny foods"
      ],
      "foot": "milestones are wide ranges, not deadlines — a baby reaching these later isn't behind; mention any real concerns to your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 46",
        "title": "prepping for\nbig changes",
        "say": "one step at a time",
        "body": "the run-up to 12 months is a great moment to look around and get the house ready for a mover."
      },
      {
        "color": "rose",
        "eyebrow": "anchor it all",
        "title": "secure the\ntip-overs",
        "say": "do it today",
        "body": "a pulling-up baby can topple dressers, shelves, and TVs. anchor heavy furniture to the wall and move climbable things away from windows."
      },
      {
        "color": "honey",
        "eyebrow": "mouth explorer",
        "title": "down on\ntheir level",
        "say": "check the floor",
        "body": "crawl your space and scan for small objects, cords, and button batteries. anything that fits through a toilet-paper tube is a choking risk."
      },
      {
        "color": "caramel",
        "eyebrow": "feelings are big",
        "title": "clingy is\nconnected",
        "say": "this is healthy",
        "body": "separation feelings often peak now. quick, warm goodbyes and a consistent caregiver help — the clinginess is a sign of secure attachment."
      },
      {
        "color": "blush",
        "eyebrow": "you're their safe place",
        "title": "calm hands,\ncalm heart",
        "say": "when in doubt, call",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "anchor dressers, bookshelves, and TVs to the wall"
        },
        {
          "label": "do a floor-level sweep for choking hazards and button batteries"
        },
        {
          "label": "add gates at stairs and latches on low cabinets"
        },
        {
          "label": "keep up well-visits and the vaccine schedule"
        },
        {
          "label": "offer warm, brief goodbyes to ease separation feelings"
        },
        {
          "label": "save your pediatrician and poison-control numbers where you can find them fast"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 quick wins before baby's on two feet",
      "items": [
        "anchor every tip-able piece of furniture to the wall",
        "move cribs and furniture away from window blind cords",
        "get low and clear small objects from the floor",
        "gate the stairs, top and bottom",
        "keep a steady goodbye routine for separation worries"
      ],
      "foot": "this isn't medical advice — for fevers, injuries, or anything that worries you, call your pediatrician or poison control."
    }
  }
};

// WEEK 48 (authored + accuracy-verified 2026-06-21)
const WEEK_48: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 48",
        "title": "Almost\none.",
        "say": "sleep holds steady",
        "body": "all that cruising and standing burns real energy — most nights look the same, and that's a good sign."
      },
      {
        "color": "rose",
        "eyebrow": "two naps",
        "title": "Two naps,\nfor now.",
        "say": "don't rush the drop",
        "body": "most babies this age still nap twice a day. the one-nap shift usually comes later, often after the first birthday — let her lead."
      },
      {
        "color": "honey",
        "eyebrow": "crib pull-ups",
        "title": "She stands\nup in there.",
        "say": "lower the mattress",
        "body": "if she's pulling to stand in the crib, drop the mattress to its lowest setting so she can't tip over the rail. boring is safe."
      },
      {
        "color": "caramel",
        "eyebrow": "still back, still bare",
        "title": "Sack, not\nblanket.",
        "say": "nothing loose in the crib",
        "body": "a sleep sack keeps her warm without a loose blanket. back to sleep and an empty crib never expire."
      },
      {
        "color": "blush",
        "eyebrow": "so close",
        "title": "Big moves,\nbig rest.",
        "say": "protect the naps",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "Keep both naps for now",
          "note": "the one-nap drop usually comes after a year"
        },
        {
          "label": "Crib mattress on the lowest setting",
          "note": "she can pull to stand now"
        },
        {
          "label": "Sleep sack, not a loose blanket"
        },
        {
          "label": "Same wind-down every night",
          "note": "bath, book, song, bed"
        },
        {
          "label": "Still on the back, still an empty crib"
        },
        {
          "label": "Expect a few first-steps-fueled rough nights"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "When sleep gets bumpy near one",
      "items": [
        "new skills (standing, steps) can stir up night wakings for a week or two",
        "teething near the first-year molars can break up sleep",
        "a too-early one-nap push often backfires into overtiredness",
        "skipped or short naps usually mean a harder bedtime, not an easier one",
        "keep bedtime calm and consistent — these bumps usually pass on their own"
      ],
      "foot": "if sleep changes come with fever, ear-pulling, or just seem off to you, call your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 48",
        "title": "Table-food\nera.",
        "say": "she eats with you",
        "body": "around now she can share more of what's on your plate, softened and cut small — meals are turning into family time."
      },
      {
        "color": "rose",
        "eyebrow": "milk shift ahead",
        "title": "Whole milk\nat one.",
        "say": "not before the birthday",
        "body": "whole cow's milk can become a drink at 12 months, not before. keep nursing or formula until then, and ask your pediatrician about the switch."
      },
      {
        "color": "honey",
        "eyebrow": "cup, not bottle",
        "title": "Sip from\na cup.",
        "say": "open or straw",
        "body": "start offering an open or straw cup with meals now. easing off the bottle by around 12–18 months is good for teeth and tummies."
      },
      {
        "color": "caramel",
        "eyebrow": "safe table foods",
        "title": "Soft, small,\nsquishable.",
        "say": "always seated, always watched",
        "body": "cut grapes and cherry tomatoes into quarters, skip whole nuts and hard chunks. no honey until after the first birthday."
      },
      {
        "color": "blush",
        "eyebrow": "messy and growing",
        "title": "Let her\nfeed herself.",
        "say": "mess means learning",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "Offer 3 meals plus a snack or two"
        },
        {
          "label": "Practice an open or straw cup at meals"
        },
        {
          "label": "Soft table foods cut small",
          "note": "grapes & tomatoes quartered, no whole nuts"
        },
        {
          "label": "Keep nursing or formula until 12 months",
          "note": "whole milk starts at one, not before"
        },
        {
          "label": "Still no honey before the first birthday"
        },
        {
          "label": "Seated and supervised for every bite"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Easing toward the cup",
      "items": [
        "offer a straw or open cup of water or milk at every meal",
        "let her hold and tip it herself, even if most of it spills at first",
        "drop one bottle at a time — the midday one is usually easiest to lose",
        "by ~12–18 months, aim for cups over bottles for healthier teeth",
        "whole milk can fill the bottle's old role once she's one, per your pediatrician"
      ],
      "foot": "every baby weans from the bottle on her own timeline — ask your pediatrician if you're unsure."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 48",
        "title": "On the\nmove.",
        "say": "steps are coming",
        "body": "cruising along the couch, maybe a wobbly step or two — she's wiring up balance for walking, and every baby gets there on her own clock."
      },
      {
        "color": "rose",
        "eyebrow": "first steps",
        "title": "Cruise,\nthen go.",
        "say": "a range, not a deadline",
        "body": "many babies take first steps anywhere from 9 to 15 months. let her pull up, cruise, and tumble — those wobbles are how balance is built."
      },
      {
        "color": "honey",
        "eyebrow": "more words",
        "title": "Words are\nlanding.",
        "say": "name everything",
        "body": "she may have a couple of real words now and copy your sounds and gestures. talk through your day — naming things is how language grows."
      },
      {
        "color": "caramel",
        "eyebrow": "little copycat",
        "title": "She mimics\nyou.",
        "say": "you're the model",
        "body": "waving, clapping, pretending to talk on the phone — copying is real learning. play it back and make it a game."
      },
      {
        "color": "blush",
        "eyebrow": "barefoot is best",
        "title": "Let her\nwobble.",
        "say": "floor time over shoes",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "Give lots of safe floor and cruising space"
        },
        {
          "label": "Let her go barefoot indoors",
          "note": "bare feet help balance more than shoes"
        },
        {
          "label": "Name objects and actions all day"
        },
        {
          "label": "Copy her sounds and gestures back"
        },
        {
          "label": "Read together and let her turn the pages"
        },
        {
          "label": "Re-check babyproofing now that she pulls up"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Cruising toward walking",
      "items": [
        "pulling to stand and cruising along furniture come before steps",
        "push toys she can lean on build confidence and leg strength",
        "barefoot indoors helps her feel the floor and balance better",
        "expect lots of sit-downs and tumbles — that's the practice working",
        "walking can land anytime from about 9 to 15 months, all normal"
      ],
      "foot": "milestones are ranges, not deadlines — share any worries at her well-visits."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 48",
        "title": "Newly\nmobile.",
        "say": "the world got bigger",
        "body": "now that she's pulling up and cruising, her reach just doubled — a quick safety sweep keeps the adventures happy ones."
      },
      {
        "color": "rose",
        "eyebrow": "babyproof again",
        "title": "Get down\nto her level.",
        "say": "crawl the room",
        "body": "kneel and look for cords, outlets, and tippy furniture. anchor bookshelves and dressers to the wall — climbers are coming."
      },
      {
        "color": "honey",
        "eyebrow": "first teeth",
        "title": "Brush the\nlittle ones.",
        "say": "a smear of paste",
        "body": "wipe or brush new teeth twice a day with a rice-grain smear of fluoride toothpaste. a first dental visit by age one is the goal."
      },
      {
        "color": "caramel",
        "eyebrow": "big feelings",
        "title": "Clingy is\nnormal.",
        "say": "connection, not spoiling",
        "body": "separation worries can spike around now. quick goodbyes and a calm return teach her you always come back."
      },
      {
        "color": "blush",
        "eyebrow": "almost a year",
        "title": "Steady\nhands here.",
        "say": "you've got this",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "Re-babyproof at her new standing height"
        },
        {
          "label": "Anchor dressers and shelves to the wall",
          "note": "tip-overs are the new risk now she climbs"
        },
        {
          "label": "Cover outlets and tuck away cords"
        },
        {
          "label": "Brush new teeth twice a day",
          "note": "rice-grain smear of fluoride paste"
        },
        {
          "label": "Keep up well-visits and any vaccines"
        },
        {
          "label": "Keep goodbyes short and warm"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Safety sweep for a stander",
      "items": [
        "anchor all heavy furniture and TVs to the wall",
        "move breakables and hot drinks well out of arm's reach",
        "lock cabinets with cleaners, meds, and small objects",
        "add gates at stairs and pad sharp table corners",
        "keep cords, blind pulls, and button batteries fully out of reach"
      ],
      "foot": "this isn't medical advice — bring any health or development questions to your pediatrician."
    }
  }
};

// WEEK 49 (authored + accuracy-verified 2026-06-21)
const WEEK_49: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 49",
        "title": "sleep at\nnearly a year",
        "say": "big skills, same rules",
        "body": "your baby is pulling up, cruising, maybe taking steps — all that daytime drive can ripple into the night, and that's completely normal."
      },
      {
        "color": "rose",
        "eyebrow": "one or two",
        "title": "the nap\nquestion",
        "say": "follow the cues",
        "body": "some babies are easing toward one longer midday nap while others still need two. watch their sleepy signs, not the clock — both are fine right now."
      },
      {
        "color": "honey",
        "eyebrow": "crib practice",
        "title": "standing,\nnot settling",
        "say": "calm and quiet",
        "body": "if they pop up to stand and get stuck, gently lay them back down with few words. practicing sitting down during the day makes nights smoother."
      },
      {
        "color": "caramel",
        "eyebrow": "never changes",
        "title": "back, firm,\nand bare",
        "say": "every single night",
        "body": "back to sleep, firm flat surface, nothing soft in the crib, room-share rather than bed-share. a plain sleep sack keeps them warm without loose blankets."
      },
      {
        "color": "blush",
        "eyebrow": "almost there",
        "title": "rest finds\nits rhythm",
        "say": "bumps then settles",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep back-sleeping and a bare crib every night"
        },
        {
          "label": "make sure the mattress is on its lowest setting",
          "note": "a confident stander can topple over a high rail"
        },
        {
          "label": "watch nap cues to see if one nap is emerging",
          "note": "resisting the second nap is often the first sign"
        },
        {
          "label": "practice sitting back down during daytime play"
        },
        {
          "label": "hold a steady, predictable wind-down routine"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons sleep wobbles near one",
      "items": [
        "new motor skills like walking get rehearsed at night",
        "a one-to-two nap shift can shorten or shift sleep",
        "separation awareness peaks, so goodbyes feel bigger",
        "molars can stir up teething again",
        "a familiar routine is the strongest comfort you can give"
      ],
      "foot": "short rough patches are normal — call your pediatrician if sleep changes come with fever, pain, or seem off."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 49",
        "title": "joining the\nfamily table",
        "say": "they eat what you eat",
        "body": "around now your little one can share more of the meals you're already making — soft, small, and safe versions of family and table foods."
      },
      {
        "color": "rose",
        "eyebrow": "real meals",
        "title": "family food,\nbaby-sized",
        "say": "watch the salt",
        "body": "offer soft pieces of what's on your plate, just cut small and low in added salt and sugar. eating together is one of the best ways they learn."
      },
      {
        "color": "honey",
        "eyebrow": "bottle prep",
        "title": "easing off\nthe bottle",
        "say": "gradual is kind",
        "body": "many families start trading bottles for an open or straw cup around now. offer water or milk in a cup at meals so the shift feels slow and easy."
      },
      {
        "color": "caramel",
        "eyebrow": "keep it safe",
        "title": "small bites,\nsitting up",
        "say": "always supervised",
        "body": "no honey before one, and keep round, hard, or sticky foods off the tray. cut grapes and similar foods tiny to lower choking risk."
      },
      {
        "color": "blush",
        "eyebrow": "nourished + loved",
        "title": "every shared\nmeal counts",
        "say": "appetite comes and goes",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "offer soft, small pieces of family and table foods"
        },
        {
          "label": "serve water or milk in an open or straw cup at meals",
          "note": "gentle practice for easing off bottles over the coming months"
        },
        {
          "label": "keep breastmilk or formula as the main milk until 12 months",
          "note": "no cow's milk as a drink yet"
        },
        {
          "label": "skip honey and all choking-risk foods entirely"
        },
        {
          "label": "go easy on added salt and sugar in family dishes"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to ease off the bottle",
      "items": [
        "introduce a cup at meals now so the change is gradual",
        "start by swapping the least-loved bottle for a cup",
        "keep the bedtime feed last to drop if it's comforting",
        "offer milk feeds steady until your provider says to switch",
        "expect appetite to dip as growth slows — that's normal"
      ],
      "foot": "every baby's pace differs — ask your pediatrician about timing milk, weaning, and any allergy concerns."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 49",
        "title": "on the verge\nof walking",
        "say": "ranges, not deadlines",
        "body": "cruising the furniture, standing alone for a beat, maybe a wobbly step — every baby reaches walking on their own timeline, and that's okay."
      },
      {
        "color": "rose",
        "eyebrow": "up and going",
        "title": "those first\nwobbly steps",
        "say": "lots of practice",
        "body": "they'll let go of the couch, balance, and try a step or two before plopping down. bare feet help them feel the floor and find their balance."
      },
      {
        "color": "honey",
        "eyebrow": "first words",
        "title": "one to three\nlittle words",
        "say": "every baby differs",
        "body": "\"mama,\" \"dada,\" or \"bye\" may be landing with real meaning now. name everything and narrate your day to feed those words along."
      },
      {
        "color": "caramel",
        "eyebrow": "home check",
        "title": "baby-proof\nfor a walker",
        "say": "a quick sweep",
        "body": "anchor furniture, gate the stairs, pad sharp corners, and tuck cords away. a new walker reaches higher and roams farther than last week."
      },
      {
        "color": "blush",
        "eyebrow": "right on time",
        "title": "their pace\nis the right pace",
        "say": "first steps vary widely",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "give safe, open space to cruise and practice steps"
        },
        {
          "label": "name objects and actions all day to grow words"
        },
        {
          "label": "anchor heavy furniture and gate the stairs",
          "note": "new walkers climb and reach fast"
        },
        {
          "label": "let them go barefoot indoors for better balance"
        },
        {
          "label": "bring milestone questions to the 12-month well-visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things many babies near one are doing",
      "items": [
        "pulling up, cruising, and maybe standing alone",
        "saying one to three words with meaning",
        "understanding simple words and \"no\"",
        "picking up tiny bits with a thumb-finger pinch",
        "copying gestures like waving, clapping, and pointing"
      ],
      "foot": "these are typical ranges, not deadlines — if you're ever unsure about your baby's progress, check with your pediatrician."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 49",
        "title": "caring through\nthe big leaps",
        "say": "closeness still wins",
        "body": "as your baby grows braver, they still circle back to you to refuel — that secure base is exactly what makes bold exploring possible."
      },
      {
        "color": "rose",
        "eyebrow": "feelings are big",
        "title": "clinginess\nis connection",
        "say": "it passes",
        "body": "separation worry often peaks near one. quick, confident goodbyes and a familiar caregiver help them feel safe while you're away."
      },
      {
        "color": "honey",
        "eyebrow": "setting limits",
        "title": "gentle \"no,\"\nthen redirect",
        "say": "calm beats stern",
        "body": "they're testing what \"no\" means. a steady voice plus moving them toward something safe teaches far more than a big reaction."
      },
      {
        "color": "caramel",
        "eyebrow": "keeping well",
        "title": "the 12-month\nvisit is close",
        "say": "jot questions down",
        "body": "a check-up is coming around a year, often with vaccines. mild fussiness or a low fever afterward can be normal — follow your provider's guidance."
      },
      {
        "color": "blush",
        "eyebrow": "you're their safe place",
        "title": "steady love,\nsteady baby",
        "say": "you're doing great",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "offer calm, quick goodbyes to ease separation worry"
        },
        {
          "label": "meet clinginess with closeness, not pressure"
        },
        {
          "label": "use simple words plus redirection for limits"
        },
        {
          "label": "start a question list for the 12-month well-visit",
          "note": "jot things down as they come up"
        },
        {
          "label": "keep up handwashing and regular well-checks"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 ways to support a near-one-year-old",
      "items": [
        "be a reliable home base they can return to",
        "name big feelings simply (\"you're sad we said bye\")",
        "keep routines predictable so the world feels safe",
        "redirect gently instead of long explanations",
        "take care of yourself too — your calm steadies them"
      ],
      "foot": "trust your gut — for any fever, persistent fussiness, or feeding or behavior changes that worry you, call your pediatrician."
    }
  }
};

// WEEK 50 (authored + accuracy-verified 2026-06-21)
const WEEK_50: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 50",
        "title": "almost\none.",
        "say": "you made it here",
        "body": "sleep is mostly settling into a real rhythm now — and the wobbles that show up are usually growth, not a step back."
      },
      {
        "color": "rose",
        "eyebrow": "two naps",
        "title": "still two,\nfor now.",
        "say": "the merge comes later",
        "body": "most babies hold onto two naps right up to and past a year. the drop to one usually waits until 14-18 months — no rush to force it."
      },
      {
        "color": "honey",
        "eyebrow": "new tricks",
        "title": "pulling up\nin the crib.",
        "say": "practice = wakeups",
        "body": "babies this age love to stand up at the rail mid-sleep. give them lots of daytime practice and they figure out how to lie back down faster."
      },
      {
        "color": "caramel",
        "eyebrow": "still sacred",
        "title": "back, sack,\nempty crib.",
        "say": "every single sleep",
        "body": "on the back, firm flat surface, nothing else in there — no pillow, no blanket, no lovey yet. a sleep sack with arms out is perfect."
      },
      {
        "color": "blush",
        "eyebrow": "you're doing it",
        "title": "rest is\ncoming.",
        "say": "rhythm over rules",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "keep both naps for now — let the one-nap merge wait",
          "note": "most babies aren't ready until 14-18 months"
        },
        {
          "label": "give lots of daytime standing + sitting practice",
          "note": "fewer stuck-standing wakeups at night"
        },
        {
          "label": "every sleep on the back, firm flat surface, empty crib"
        },
        {
          "label": "sleep sack with arms out — no loose blankets or pillows yet"
        },
        {
          "label": "lower the crib mattress if you haven't — they can pull to stand now"
        },
        {
          "label": "hold a calm, predictable bedtime routine"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 reasons sleep wobbles near one",
      "items": [
        "new skills — pulling up, cruising, maybe first steps to rehearse",
        "separation awareness peaks, so goodbyes at bedtime feel bigger",
        "teeth, including the molars that can start around now",
        "a nap that's getting a touch too long or too early",
        "excitement and a busy brain that's hard to switch off"
      ],
      "foot": "most regressions pass in 1-2 weeks; if sleep changes come with fever, pain, or new breathing worries, call your pediatrician."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 50",
        "title": "the big\nswitches.",
        "say": "ease in slowly",
        "body": "whole milk, an open cup, and three meals a day are all on the horizon now — none of it has to happen overnight."
      },
      {
        "color": "rose",
        "eyebrow": "at twelve months",
        "title": "whole milk\nis next.",
        "say": "wait for the year",
        "body": "cow's milk as a drink starts at 12 months, not before. when you get there you can begin swapping, and whole milk is the usual pick unless your pediatrician says otherwise."
      },
      {
        "color": "honey",
        "eyebrow": "bye-bye bottle",
        "title": "offer the\ncup.",
        "say": "open or straw",
        "body": "start trading bottles for an open or straw cup with meals — pediatric dentists like to see the bottle gone around a year for little teeth."
      },
      {
        "color": "caramel",
        "eyebrow": "still off-limits",
        "title": "no honey\nyet.",
        "say": "until the year",
        "body": "honey stays off the menu until 12 months because of infant botulism risk. keep cutting round foods small and skip choking hazards."
      },
      {
        "color": "blush",
        "eyebrow": "they're learning",
        "title": "messy\nis good.",
        "say": "let them explore",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "keep breast milk or formula as the main drink until 12 months",
          "note": "cow's milk as a drink starts at the year, not before"
        },
        {
          "label": "start offering an open or straw cup with meals"
        },
        {
          "label": "no honey before the first birthday"
        },
        {
          "label": "aim for 3 meals plus a couple of snacks",
          "note": "your baby decides how much"
        },
        {
          "label": "keep foods soft and small — cut grapes + cherry tomatoes, no whole nuts or popcorn"
        },
        {
          "label": "offer iron-rich foods — meat, beans, lentils, fortified cereal"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 first-birthday food moves",
      "items": [
        "at 12 months you can begin whole cow's milk as a drink",
        "phase the bottle out in favor of an open or straw cup",
        "honey is finally safe once your baby turns one",
        "keep offering a rainbow — appetite naturally dips as growth slows",
        "let them self-feed; texture and mess are how they learn"
      ],
      "foot": "don't switch milks or drop a feed without a quick check with your pediatrician at the 1-year visit, especially with allergies or low weight gain."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 50",
        "title": "so close\nto one.",
        "say": "every baby's clock",
        "body": "waving, clapping, pointing, maybe a wobbly step or two — this is a big, social stretch, and the timing is a range, never a deadline."
      },
      {
        "color": "rose",
        "eyebrow": "on the move",
        "title": "cruising to\nfirst steps.",
        "say": "well past one is ok",
        "body": "many babies cruise along furniture and some take first steps near a year. plenty of healthy babies walk well after 12 months, even into 16-18 months — all of it is normal."
      },
      {
        "color": "honey",
        "eyebrow": "little signals",
        "title": "waves, claps,\npoints.",
        "say": "huge brain work",
        "body": "pointing to show you something and waving bye-bye are real communication wins. name what they point at — you're building words."
      },
      {
        "color": "caramel",
        "eyebrow": "talk back",
        "title": "first words\nbloom.",
        "say": "babble counts too",
        "body": "a meaningful 'mama,' 'dada,' or one other word may appear around now. lots of expressive babble with gestures counts just as much."
      },
      {
        "color": "blush",
        "eyebrow": "you're their guide",
        "title": "narrate\nit all.",
        "say": "your voice teaches",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "make safe floor space for cruising and pulling up"
        },
        {
          "label": "wave, clap, and point together — copy their gestures back"
        },
        {
          "label": "name objects as they point so words attach to things"
        },
        {
          "label": "read together every day, even just a page"
        },
        {
          "label": "offer cause-and-effect toys — stacking, banging, putting in + taking out"
        },
        {
          "label": "remember milestones are ranges, not deadlines",
          "note": "bring any specific worry to the 1-year visit"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things many babies do near one",
      "items": [
        "pull to stand and cruise along furniture",
        "wave bye-bye and clap",
        "point at things they want or want to show you",
        "say a first word or two with meaning",
        "follow a simple 'where's the ball?' with a look or point"
      ],
      "foot": "ranges, not deadlines — but mention it at the well visit if your baby isn't pointing, babbling, or responding to their name, or seems to lose a skill."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 50",
        "title": "prep for\nthe big one.",
        "say": "the 1-year visit",
        "body": "the 12-month well check is a big one — growth, development, bloodwork, and vaccines all in one stop. a little prep makes it smoother."
      },
      {
        "color": "rose",
        "eyebrow": "what to expect",
        "title": "the year\ncheckup.",
        "say": "ask your questions",
        "body": "expect length, weight, and head measures, a development check, and usually a finger-stick for iron and lead. jot your questions down beforehand."
      },
      {
        "color": "honey",
        "eyebrow": "shots ahead",
        "title": "vaccines\n+ comfort.",
        "say": "mild fuss is ok",
        "body": "the 1-year visit often includes mmr, varicella, hep a, and others. a low fever or fussiness after is common — follow your pediatrician's guidance on comfort."
      },
      {
        "color": "caramel",
        "eyebrow": "newly mobile",
        "title": "re-baby-\nproof.",
        "say": "they reach higher now",
        "body": "a pulling-up, cruising baby finds new dangers — anchor furniture and tvs, latch low cabinets, and move cords and small objects up and away."
      },
      {
        "color": "blush",
        "eyebrow": "you've got this",
        "title": "almost a\nwhole year.",
        "say": "look how far",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "schedule the 12-month well visit if you haven't"
        },
        {
          "label": "write down your questions before the appointment",
          "note": "milk transition, sleep, words, eating"
        },
        {
          "label": "anchor furniture and tvs to the wall",
          "note": "newly standing babies pull and climb"
        },
        {
          "label": "move cords, small objects, and round foods up and out of reach"
        },
        {
          "label": "keep brushing those new teeth twice a day with a rice-grain of fluoride paste"
        },
        {
          "label": "expect mild fussiness or low fever after shots",
          "note": "follow your pediatrician on comfort + meds"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "5 things for the 1-year visit",
      "items": [
        "growth check — length, weight, and head circumference plotted",
        "a developmental and behavior screen",
        "a finger-stick to check iron (anemia) and lead",
        "this round's vaccines — mmr, varicella, hep a and more",
        "a chat about whole milk, the cup, and dropping the bottle"
      ],
      "foot": "this is general info, not medical advice — your pediatrician tailors the visit; call sooner for a high fever, a reaction that worsens, or anything that worries you."
    }
  }
};

// WEEK 51 (authored + accuracy-verified 2026-06-21)
const WEEK_51: Record<string, CategoryContent> = {
  "sleep": {
    "label": "Sleep",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 51",
        "title": "Almost\none.",
        "say": "big-kid sleep",
        "body": "sleep is steadier now — most of the night plus a nap or two, on a body that's about to walk."
      },
      {
        "color": "rose",
        "eyebrow": "the schedule",
        "title": "One nap,\ncoming.",
        "say": "not yet, though",
        "body": "many babies hold two naps near a year and drop to one closer to 15–18 months. let her show you when she's ready — no rush."
      },
      {
        "color": "honey",
        "eyebrow": "safe sleep",
        "title": "Still on\nthe back.",
        "say": "sack, arms out",
        "body": "crib stays bare — no pillow, blanket, or bumper for a while yet. a sleep sack keeps her warm; swaddling is long behind you now that she rolls and pulls up."
      },
      {
        "color": "caramel",
        "eyebrow": "new wobbles",
        "title": "Pulls up,\nthen stuck.",
        "say": "she'll learn down",
        "body": "new walkers sometimes stand in the crib and fuss. give a calm hand to practice sitting back down by day, and keep nights boring."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "You're\nclose.",
        "say": "one year, wow",
        "body": "scroll for this week's sleep guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's sleep",
      "items": [
        {
          "label": "Keep ~11–12 hrs overnight as the anchor"
        },
        {
          "label": "Two naps is still fine near a year",
          "note": "one nap usually comes later"
        },
        {
          "label": "Crib stays bare — sleep sack, arms out"
        },
        {
          "label": "Always down on the back, firm flat surface"
        },
        {
          "label": "Practice sitting back down from standing",
          "note": "by day, so nights stay calm"
        },
        {
          "label": "Same short wind-down every night"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Sleep near one year",
      "items": [
        "Most need ~11–12 hrs at night plus a nap or two by day",
        "Two naps now, one nap usually by 15–18 months",
        "Teething or new walking can ruffle sleep for a few nights",
        "Crib still bare — no pillow or blanket yet",
        "Lower the mattress if she's pulling to stand"
      ],
      "foot": "Sleep needs are ranges, not rules — bring any real worry to the 1-year checkup."
    }
  },
  "feed": {
    "label": "Feed",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 51",
        "title": "Pull up\na chair.",
        "say": "family meals",
        "body": "she's becoming a little eater at the table with you — same food, smaller and softer, more and more her own way."
      },
      {
        "color": "rose",
        "eyebrow": "table foods",
        "title": "What you're\nhaving.",
        "say": "soft, small bits",
        "body": "offer pieces of the family meal, cut small and easy to gum. let her self-feed with fingers and a loaded spoon — mess is part of learning."
      },
      {
        "color": "honey",
        "eyebrow": "the big one",
        "title": "Honey\nafter one.",
        "say": "wait for the day",
        "body": "keep honey out until she turns one — even a taste, even baked in. once she's one, a little is fine. cow's milk as a drink can start at one too."
      },
      {
        "color": "caramel",
        "eyebrow": "still no",
        "title": "Skip the\nchoke risk.",
        "say": "cut it down",
        "body": "whole grapes, nuts, popcorn, hot dog coins, and hard raw chunks still wait. halve or quarter the round things and stay close while she eats."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "She's\ngot this.",
        "say": "messy and proud",
        "body": "scroll for this week's feed guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's feed",
      "items": [
        {
          "label": "Offer soft pieces of the family meal"
        },
        {
          "label": "Let her self-feed — fingers + a loaded spoon"
        },
        {
          "label": "No honey until she turns one",
          "note": "then a little is fine"
        },
        {
          "label": "Cut round foods small",
          "note": "grapes, hot dogs — quarter them"
        },
        {
          "label": "Skip nuts, popcorn, hard raw chunks"
        },
        {
          "label": "Sips of water with meals are good now"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "At the table near one",
      "items": [
        "Breast milk or formula stays the main drink until one",
        "At one, cow's milk as a drink and honey both become ok",
        "Self-feeding is messy — that's the skill, not a setback",
        "Always sit with her and watch while she eats",
        "Appetite swings day to day as growth slows — normal"
      ],
      "foot": "This is general guidance, not a diet plan — your pediatrician knows your baby best."
    }
  },
  "grow": {
    "label": "Grow",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 51",
        "title": "First\nsteps.",
        "say": "any week now",
        "body": "cruising the couch turns into letting go — some babies walk before one, plenty walk well after. all of it is right on time."
      },
      {
        "color": "rose",
        "eyebrow": "on the move",
        "title": "Let go &\ncruise.",
        "say": "barefoot is best",
        "body": "she pulls up and shuffles along furniture, maybe stands alone for a beat. bare feet grip best — skip the shoes indoors while she learns."
      },
      {
        "color": "honey",
        "eyebrow": "first words",
        "title": "Words\narriving.",
        "say": "or soon after",
        "body": "a real \"mama,\" \"dada,\" or \"uh-oh\" may pop out, plus lots of pointing and babble. name what she points at — that's how words land."
      },
      {
        "color": "caramel",
        "eyebrow": "little games",
        "title": "Wave &\npeekaboo.",
        "say": "copycat season",
        "body": "she waves bye, claps, and loves to imitate you. these back-and-forth games are big brain work dressed up as fun."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "Look how\nfar.",
        "say": "nearly a year",
        "body": "scroll for this week's grow guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's grow",
      "items": [
        {
          "label": "Give safe space to cruise and let go"
        },
        {
          "label": "Bare feet indoors while she learns to walk"
        },
        {
          "label": "Name what she points at, all day"
        },
        {
          "label": "Play wave, clap, and peekaboo"
        },
        {
          "label": "Read together — let her turn the pages"
        },
        {
          "label": "Childproof again at her new standing height"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "What's coming around one",
      "items": [
        "First steps land anywhere from ~9 to 18 months",
        "One or two real words may appear, plus lots of pointing",
        "She copies you — waving, clapping, \"talking\" on the phone",
        "Pulls up, cruises, maybe stands alone briefly",
        "Stranger and separation feelings can run high — normal"
      ],
      "foot": "Milestones are ranges, not deadlines — share any worry at the 1-year checkup."
    }
  },
  "care": {
    "label": "Care",
    "story": [
      {
        "color": "blush",
        "eyebrow": "week 51",
        "title": "The big\ncheckup.",
        "say": "one-year visit",
        "body": "her 12-month well-visit is around the corner — a weigh-in, a few questions, and usually some vaccines. a good moment to ask anything."
      },
      {
        "color": "rose",
        "eyebrow": "book it",
        "title": "Prep the\nvisit.",
        "say": "jot it down",
        "body": "write your questions ahead — eating, walking, sleep, words. bring how naps and meals actually go so the day reflects real life."
      },
      {
        "color": "honey",
        "eyebrow": "vaccines",
        "title": "Shots\nthis visit.",
        "say": "a few are due",
        "body": "the one-year visit usually includes several vaccines. a mild fever or fussiness for a day after can be normal — follow your pediatrician's guidance."
      },
      {
        "color": "caramel",
        "eyebrow": "after the shots",
        "title": "Extra\nsnuggles.",
        "say": "comfort first",
        "body": "nurse or bottle, cuddle, and let her rest. ask your provider before any fever medicine, and call if something feels off."
      },
      {
        "color": "blush",
        "eyebrow": "keep going",
        "title": "One year\nof you.",
        "say": "what a team",
        "body": "scroll for this week's care guide ↓"
      }
    ],
    "checklist": {
      "title": "This week's care",
      "items": [
        {
          "label": "Book or confirm the 12-month well-visit"
        },
        {
          "label": "Write your questions down ahead of time"
        },
        {
          "label": "Expect several vaccines at this visit"
        },
        {
          "label": "Plan extra comfort for the day after shots"
        },
        {
          "label": "Ask before giving any fever medicine"
        },
        {
          "label": "Re-childproof at her new standing reach"
        }
      ]
    },
    "articles": [],
    "info": {
      "kind": "fives",
      "title": "Bring to the 1-year visit",
      "items": [
        "Your real questions — eating, walking, sleep, words",
        "How naps and meals actually go day to day",
        "Any words, waves, or new tricks you've seen",
        "Your insurance card and vaccine record",
        "A favorite comfort item for after the shots"
      ],
      "foot": "After vaccines, mild fever or fussiness can be normal — always call your pediatrician if you're worried."
    }
  }
};

// "Ask your specialist — bring these three" questions, ported from the legacy
// topic screen. Attached to the resolved content by getManualContent so they
// render as the 4th below-deck module.
const SPECIALIST_QS_W1: Record<string, string[]> = {
  sleep: ['When should sleep get longer?', 'Is a swaddle still safe?', 'When do I move to a crib?'],
  feed:  ['Is my baby getting enough?', 'How do I know my latch is right?', 'Should I be pumping yet?'],
  grow:  ['Is my baby on track for this week?', 'When is the next leap?', 'How do I know it’s a regression?'],
  care:  ['What temperature counts as a real fever?', 'When should I worry about the cord stump?', 'Is this spit-up or reflux?'],
};
const SPECIALIST_QS_W0: Record<string, string[]> = {
  hospital: ['When in labor should I head to the hospital?', 'Can we do skin-to-skin right away?', 'What are my pain-relief options?'],
  sleep:    ['Bassinet or crib to start?', 'How do I set up safe sleep?', 'Do I need a sleep sack yet?'],
  feed:     ['Should I take a breastfeeding class?', 'What pump does my insurance cover?', 'How much formula should I keep on hand?'],
  care:     ['What bath products are safe for a newborn?', 'How often will I really change diapers?', 'What belongs in a diaper caddy?'],
};

export const WEEKS: Record<number, Record<string, CategoryContent>> = {
  0: WEEK_0, 1: WEEK_1, 2: WEEK_2, 3: WEEK_3, 4: WEEK_4, 5: WEEK_5, 6: WEEK_6, 7: WEEK_7,
  8: WEEK_8, 9: WEEK_9, 10: WEEK_10, 11: WEEK_11, 12: WEEK_12, 13: WEEK_13, 14: WEEK_14, 15: WEEK_15,
  16: WEEK_16, 17: WEEK_17, 18: WEEK_18, 19: WEEK_19, 20: WEEK_20, 21: WEEK_21, 22: WEEK_22, 23: WEEK_23,
  24: WEEK_24, 25: WEEK_25, 26: WEEK_26, 27: WEEK_27, 28: WEEK_28, 29: WEEK_29, 30: WEEK_30, 31: WEEK_31,
  32: WEEK_32, 33: WEEK_33, 34: WEEK_34, 35: WEEK_35, 36: WEEK_36, 37: WEEK_37, 38: WEEK_38, 39: WEEK_39,
  40: WEEK_40, 41: WEEK_41, 42: WEEK_42, 43: WEEK_43, 44: WEEK_44, 45: WEEK_45, 46: WEEK_46, 47: WEEK_47,
  48: WEEK_48, 49: WEEK_49, 50: WEEK_50, 51: WEEK_51, 52: WEEK_52,
};

// Resolve which seeded week a requested week should read from: the nearest
// seeded week AT OR BELOW it (so week 5 reads week 4, not week 1), never
// dropping below week 1 for a born baby (week 0 is prep-only).
function resolveWeekKey(week: number): number {
  if (WEEKS[week]) return week;
  if (week <= 0) return 0;
  let best = 1;
  for (const k of Object.keys(WEEKS)) {
    const n = Number(k);
    if (n >= 1 && n <= week && n > best) best = n;
  }
  return best;
}

/**
 * Resolve the Manual content for a given week + category. Reads from the nearest
 * earlier seeded week (Week 1 is the baseline floor), then falls back to Week 1's
 * version of the category, so the app's chips always render something on-stage.
 */
// splitHelps — separates commerce from education. Story cards keep their teaching
// body but lose the `shop` link sticker; those products consolidate into the
// `helps` lane (rendered as its own disclosed "things that help" card). `learn`
// links stay on the story (they're educational, not products). If a week already
// declares an explicit `helps`, we trust it and leave the story untouched.
function splitHelps(content: CategoryContent): CategoryContent {
  if (content.helps) return content;
  const picks: HelpPick[] = [];
  let touched = false;
  const story = content.story.map((card) => {
    if (card.link?.kind === 'shop') {
      picks.push({ tag: card.eyebrow, label: card.link.label, url: card.link.url });
      touched = true;
      const { link, ...rest } = card;
      return rest;
    }
    return card;
  });
  if (!picks.length) return content;
  return { ...content, story: touched ? story : content.story, helps: { picks } };
}

export function getManualContent(week: number, category: string, lang: 'en' | 'es' = 'en'): CategoryContent | null {
  const wk = resolveWeekKey(week);
  const w = WEEKS[wk] ?? WEEKS[1];
  let content = w?.[category] ?? WEEK_1[category] ?? WEEK_0[category] ?? null;
  if (!content) return null;
  // Spanish overlay: use the translated week/category when it exists, else fall
  // back to the English content so partially-translated rollouts still render.
  if (lang === 'es') {
    const esContent = WEEKS_ES[wk]?.[category];
    if (esContent) content = esContent;
  }
  content = splitHelps(content);
  const qs = (wk === 0 ? SPECIALIST_QS_W0 : SPECIALIST_QS_W1)[category]
    ?? SPECIALIST_QS_W1[category] ?? SPECIALIST_QS_W0[category];
  return qs ? { ...content, specialistQs: qs } : content;
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
