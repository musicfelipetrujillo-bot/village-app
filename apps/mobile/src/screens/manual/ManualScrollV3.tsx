// ManualScrollV3 — v3 brand kit Manual entry rebuild.
//
// Pixel-faithful port of the TOP CHROME from `ManualScroll` in the
// 2026-05-24 design handoff (/Users/gp/Downloads/design_handoff_villie/
// manual-flow.jsx, lines 145-306). Combines what's currently split
// across ManualHomeScreen + ManualCategoryScreen into one scroll
// surface per the handoff's "single-scroll page with sticky-ish
// header" pattern.
//
// SHIPPING STATUS: side-by-side preview. NOT wired into the
// navigator — to A/B against the current ManualHomeScreen, swap the
// import in `apps/mobile/src/navigation/ManualNavigator.tsx`:
//
//     // import ManualHomeScreen from '@screens/manual/ManualHomeScreen';
//     import ManualHomeScreen from '@screens/manual/ManualScrollV3';
//
// Scope: top chrome (header + mom/baby toggle + chapter chips +
// week-progress card + colored chapter band). The full piece stream
// (video / article / illustration / checklist) is deferred to Phase
// 4.2 after layout approval. Tapping any chapter chip navigates into
// the existing ManualCategoryScreen so the content path stays whole.
//
// The hamburger menu in the header was already shipped in Phase 2
// (HamburgerMenu component) — we reuse it here too.

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Dimensions, findNodeHandle, UIManager, Share, Alert,
} from 'react-native';
import {
  listManualVideos, listManualPieces, formatDuration,
  type ManualVideo, type ManualAudience, type ManualPiece,
} from '@/api/manual';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, FONTS, PLACEHOLDER_BABY_NAME } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import { homeApi } from '@/api/home';
import ManualSwipeDeck from '@/components/manual/ManualSwipeDeck';
import ManualModules from '@/components/manual/ManualModules';
import { getManualContent } from '@/manual/manualWeekContent';
import {
  MenuButton, MenuPanel, MenuGroup, MenuItem, MENU_ICONS,
} from '@components/shared/HamburgerMenu';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { GlassHighlight } from '@components/shared/GlassHighlight';
import { HoneycombBackdrop } from '@components/shared/HoneycombBackdrop';
import { V3Card } from '@components/shared/V3Card';
import { ManualPieceOverlay, type OverlayPiece } from '@screens/manual/ManualPieceOverlay';
import { useFocusEffect } from '@react-navigation/native';
import { Animated } from 'react-native';
import { buildManualChapterHtml, type ManualPdfPiece } from '@utils/manualPdf';

// ─── Tokens ────────────────────────────────────────────────────────────
const T = {
  paper:     COLORS.v2_paper,
  cream:     COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  card:      COLORS.v2_card,
  butter:    COLORS.v2_butter,
  marigold:  COLORS.v2_marigold,
  caramel:   COLORS.v2_caramel,   // warm "milk before bed" — used for baby/sleep chapter
  cinnamon:  COLORS.v2_cinnamon,
  blush:     COLORS.v2_blush,
  salmon:    COLORS.v2_salmon,
  sage:      COLORS.v2_sage,
  moss:      COLORS.v2_moss,
  cocoa:     COLORS.v2_cocoa,
  walnut:    COLORS.v2_walnut,
  amber:     COLORS.v2_amber,
  rule:      'rgba(61,31,14,0.13)',
};

// ─── Chapter sub-palette (Sleep/Feed/Grow/Care/Soothe ; Feel/Heal/etc) ──
type ChapterMeta = { ch: string; cat: string; bg: string; fg: string };

const BABY_CHAPTERS: ChapterMeta[] = [
  // Sleep — was sage-olive #F2E6DD, swapped to warm caramel per Felipe's
  // call ("don't really love those greens on the baby's manual"). Reads
  // as "warm milk before bed" — calming + on-brand vs olive.
  // Band tints are light washes of each chapter's pill color, so the page
  // matches the selected chip (terracotta / amber / rose / olive / wine).
  { ch: 'Sleep', cat: 'sleep', bg: '#F0D7C3', fg: T.cocoa },   // light terracotta
  { ch: 'Feed',  cat: 'feed',  bg: '#F7EBCC', fg: T.cocoa },   // light amber
  { ch: 'Grow',  cat: 'grow',  bg: '#FAE2E7', fg: T.cocoa },   // light rose
  { ch: 'Care',  cat: 'care',  bg: '#EAEDD8', fg: T.cocoa },   // light olive
  // Soothe dropped 2026-06-10 — its content folded into Sleep + Care.
];

// Week 0 (before baby) uses a prep-oriented pill set — Hospital leads, then the
// nursery / feeding / care setup. 'hospital' has no CHIP_TONE entry, so its
// active chip falls back to cinnamon — giving week 0 a deliberately distinct look.
const WEEK0_CHAPTERS: ChapterMeta[] = [
  { ch: 'Hospital', cat: 'hospital', bg: '#E7E0D2', fg: T.cocoa },
  { ch: 'Sleep', cat: 'sleep', bg: '#F0D7C3', fg: T.cocoa },
  { ch: 'Feed',  cat: 'feed',  bg: '#F7EBCC', fg: T.cocoa },
  { ch: 'Care',  cat: 'care',  bg: '#EAEDD8', fg: T.cocoa },
];

const MOM_CHAPTERS: ChapterMeta[] = [
  { ch: 'Feel',    cat: 'feel',    bg: '#FAE2E7', fg: T.cocoa },  // light rose
  { ch: 'Heal',    cat: 'heal',    bg: '#F0D7C3', fg: T.cocoa },  // light terracotta
  { ch: 'Nourish', cat: 'nourish', bg: '#F7EBCC', fg: T.cocoa },  // light amber
  { ch: 'Rest',    cat: 'rest',    bg: '#EAEDD8', fg: T.cocoa },  // light olive
  { ch: 'Tips',    cat: 'tips',    bg: '#F4DDE6', fg: T.cocoa },  // light wine
];

// Static handoff intro copy per chapter — replaces the SUB_LEAD map
// in the v9 ManualCategoryScreen. Wire to milestone_library in Phase 4.2.
const CHAPTER_INTRO: Record<string, string> = {
  Sleep: 'What\'s normal at this week. What\'s not.',
  Feed:  'Cluster feeding is exhaustion, not failure.',
  Grow:  'The leap that breaks the routine, and what comes next.',
  Care:  'Common rashes, bumps, and when to call.',
  Soothe: 'Crying, the witching hour, and what actually calms a baby.',
  Feel:  'You\'re not broken. This is the postpartum brain.',
  Heal:  'Your body, week by week — what to expect.',
  Nourish: 'Eating to recover, not to lose.',
  Rest:  'Sleep when you can. Other people can do the rest.',
  Tips:  'The small wins moms wish they knew week one.',
};

// ─── Piece stream types + content ──────────────────────────────────────
// Phase 4.2 — replaces the streamPlaceholder block with a full inline
// stream of 4 mixed pieces per chapter. Static content per chapter
// (verbatim where possible from the handoff SLEEP_PIECES + chapter
// vibes) so each chapter scrolls to its own bottom without a detail
// screen detour. Wire to milestone_library + Mux video assets in 4.3.

type PieceVideo = {
  kind: 'video'; num: string; title: string; expert: string; dur: string;
};
type PieceArticle = {
  kind: 'article'; num: string; title: string; dur: string; excerpt: string;
};
type PieceIllustration = {
  kind: 'illustration'; num: string; title: string; caption: string;
};
type PieceChecklist = {
  kind: 'checklist'; num: string; title: string; steps: string[];
};
type Piece = PieceVideo | PieceArticle | PieceIllustration | PieceChecklist;

// Lookup of chapter band color by chapter name — used by the
// illustration progress bars so the "current" row tints with the
// selected chapter, while other rows pull from sibling chapter colors
// (matches handoff lines 393-398 cross-chapter palette).
const CHAPTER_BG_BY_NAME: Record<string, string> = {
  Sleep: T.caramel, Feed: T.butter, Grow: T.blush, Care: '#F7C5CB', Soothe: '#EFB2C8',
  Feel: T.blush, Heal: '#F2E6DD', Nourish: T.butter, Rest: T.parchment, Tips: T.marigold,
};

// Bold Gen Z chip color per chapter — the ACTIVE chip fills with its saturated
// family color (sections stay light; the pop lives on the small element).
// fg picked for WCAG contrast: light text on rose/berry/caramel, dark on honey/blush.
// Each chapter keeps its own color on the active chip, but in a deep, white-
// text-legible version of its hue family (the original light tints — honey,
// caramel, blush — could not carry white text). fg is white across the board so
// the selected state reads the same way for every chapter.
// Five distinct hues so the chips never blur together (Grow/Care/Soothe used to
// all read pink). All deep enough for white text. Care takes the garden-green
// (its "health/soothe ailments" family) to break the pink cluster; Soothe goes
// deep wine. Mom chapters mirror their baby pair's color.
const CHIP_TONE: Record<string, { bg: string; fg: string }> = {
  sleep:   { bg: '#C46A45', fg: '#FFFCF6' }, // terracotta (orange)
  feed:    { bg: '#BE851F', fg: '#FFFCF6' }, // amber (gold)
  grow:    { bg: '#D96C88', fg: '#FFFCF6' }, // rose (pink)
  care:    { bg: '#6F7A43', fg: '#FFFCF6' }, // olive (green)
  soothe:  { bg: '#A8466B', fg: '#FFFCF6' }, // wine (deep berry)
  feel:    { bg: '#D96C88', fg: '#FFFCF6' }, // rose
  heal:    { bg: '#C46A45', fg: '#FFFCF6' }, // terracotta
  nourish: { bg: '#BE851F', fg: '#FFFCF6' }, // amber
  rest:    { bg: '#6F7A43', fg: '#FFFCF6' }, // olive
  tips:    { bg: '#A8466B', fg: '#FFFCF6' }, // wine
};

const PIECES_BY_CHAPTER: Record<string, Piece[]> = {
  // ── BABY ────────────────────────────────────────────────────────────
  Sleep: [
    { kind: 'video', num: '01', title: 'Why your 6-month-old is suddenly waking.',
      expert: 'Dr. A. Rodriguez · IBCLC', dur: '1:55' },
    { kind: 'article', num: '02', title: 'Separation anxiety wakings.', dur: '4 min read',
      excerpt: 'What looks like regression at six months is almost always exactly what’s supposed to happen: three big developmental leaps tend to land in the same week. Your baby is realizing you still exist when you leave the room, and that new awareness is what wakes them. It passes, and steady, boring responses at 2am help it pass faster.' },
    { kind: 'illustration', num: '03', title: 'Wake windows by age.',
      caption: 'Your baby is in 2–3 hour windows. Watch for rubbing eyes and the 30-min "I’m done" face.' },
    { kind: 'checklist', num: '04', title: 'Tonight’s plan.',
      steps: [
        'Bath, lotion, lights low by 6:45.',
        'Same book, same song, same chair.',
        'Down drowsy at 7:00 — not asleep.',
        'First wake-up: hand on chest, 2 min before you pick up.',
      ] },
  ],
  Feed: [
    { kind: 'video', num: '01', title: 'Cluster feeding isn’t low supply.',
      expert: 'Mara K. · IBCLC', dur: '2:10' },
    { kind: 'article', num: '02', title: 'The 4-month feeding plateau.', dur: '3 min read',
      excerpt: 'Around four months, intake plateaus while distractibility doubles. Less time on the breast doesn’t mean less milk; it means your baby has gotten faster and more efficient at the very same meal. Track steady weight gain and wet diapers rather than minutes, and try feeding somewhere dim and quiet when the world gets too interesting.' },
    { kind: 'illustration', num: '03', title: 'Ounces per feed by age.',
      caption: 'Most six-month-olds take 6–8 oz, four to five times a day. Your rhythm will look slightly different. That’s fine.' },
    { kind: 'checklist', num: '04', title: 'First solids starter list.',
      steps: [
        'Avocado, mashed soft.',
        'Banana, ripe and warm.',
        'Sweet potato, baked through.',
        'Iron-fortified oat cereal, thinned.',
      ] },
  ],
  Grow: [
    { kind: 'video', num: '01', title: 'The week before pulling up.',
      expert: 'Dr. L. Ngo · PT', dur: '1:42' },
    { kind: 'article', num: '02', title: 'Babbling into first words.', dur: '4 min read',
      excerpt: 'The same syllable over and over, ba ba ba, isn’t random; it’s the practice ground for the first real word, usually three to six weeks away. Narrate your day back to your baby and leave little pauses where a reply will eventually go. That call-and-response is exactly how the sounds turn into meaning.' },
    { kind: 'illustration', num: '03', title: 'Motor milestones by week.',
      caption: 'Rolling, sitting, crawling, pulling — they overlap. Your baby is on their own ladder.' },
    { kind: 'checklist', num: '04', title: 'Set the floor up for the next leap.',
      steps: [
        'Two-foot-square floor mat in the main room.',
        'One object just out of reach.',
        'Couch corner padded for new pullers-up.',
        'Outlet covers in three rooms, today.',
      ] },
  ],
  Care: [
    { kind: 'video', num: '01', title: 'Teething or just fussy?',
      expert: 'Dr. P. Hayes · Pediatrics', dur: '2:30' },
    { kind: 'article', num: '02', title: 'Fevers: when to call.', dur: '3 min read',
      excerpt: 'Under three months, 100.4°F is an ER call with no waiting. Over six months it’s the behavior, not the number, that matters: a baby who is drinking, weeing, and consolable is usually riding it out fine. Page the nurse line for a fever past three days, a rash that doesn’t fade when pressed, or a baby you simply can’t settle.' },
    { kind: 'illustration', num: '03', title: 'Common rashes, by look.',
      caption: 'Heat rash, eczema, baby acne, and one to watch — petechiae. Tap any row to compare.' },
    { kind: 'checklist', num: '04', title: 'The medicine drawer.',
      steps: [
        'Infant Tylenol, dated.',
        'Saline drops + nasal aspirator.',
        'Pedialyte sachets, two.',
        'Thermometer, batteries checked.',
      ] },
  ],
  Soothe: [
    { kind: 'video', num: '01', title: 'The 5 S’s, in order.',
      expert: 'Annie R. · doula', dur: '2:10' },
    { kind: 'article', num: '02', title: 'Why the witching hour happens.', dur: '4 min read',
      excerpt: 'Evening fussiness peaks around six weeks, and it usually isn’t hunger. An overtired, over-stimulated nervous system needs winding down, not more input. Dim the lights, drop your voice, and slow everything down. You aren’t failing; you’re co-regulating a brand-new system that can’t settle itself yet.' },
    { kind: 'illustration', num: '03', title: 'Cries, decoded.',
      caption: 'Hungry, tired, overstimulated, or in pain — the pitch, the rhythm, and what came just before it tell you which. Tap any row.' },
    { kind: 'checklist', num: '04', title: 'The calm-down ladder.',
      steps: [
        'Swaddle snug, arms tucked in.',
        'Side-hold with a steady shush.',
        'Slow sway or gentle bounce.',
        'Skin-to-skin if it keeps climbing.',
      ] },
  ],
  // ── MOM ─────────────────────────────────────────────────────────────
  Feel: [
    { kind: 'video', num: '01', title: 'The postpartum brain isn’t broken.',
      expert: 'Dr. S. Patel · perinatal psych', dur: '2:45' },
    { kind: 'article', num: '02', title: 'When the village goes quiet.', dur: '6 min read',
      excerpt: 'Month four is when the texts thin out. The baby is "easy" by now, the casseroles have stopped, and yet this is often the heaviest stretch of all. Saying that out loud to one person isn’t complaining; it’s how you keep the village from going quiet for good.' },
    { kind: 'illustration', num: '03', title: 'Mood, mapped postpartum.',
      caption: 'The dip at week 16 is normal. The dip that doesn’t lift by week 20 is the one to flag.' },
    { kind: 'checklist', num: '04', title: 'Today’s small mercies.',
      steps: [
        'One window opened for five minutes.',
        'One text sent to the friend you’ve been meaning to.',
        'One thing eaten warm.',
        'One ten-minute walk, even with the stroller.',
      ] },
  ],
  Heal: [
    { kind: 'video', num: '01', title: 'Pelvic floor at six months.',
      expert: 'Dr. J. Okafor · PT-DPT', dur: '3:05' },
    { kind: 'article', num: '02', title: 'The scar you forgot about.', dur: '4 min read',
      excerpt: 'C-section scars keep maturing for a full year. Tightness at month six is normal, and numbness that is slowly shrinking is just the body re-mapping itself. Gentle daily massage once you’re cleared keeps the tissue mobile, and anything hot, spreading, or newly painful is worth a same-day call.' },
    { kind: 'illustration', num: '03', title: 'Healing curve, week by week.',
      caption: 'Bleeding stops by week 6. Strength comes back by month 4. The full mat-leave body returns somewhere between months 9 and 14.' },
    { kind: 'checklist', num: '04', title: 'This week’s body checks.',
      steps: [
        'Notice any leaking when you sneeze.',
        'Check the c-section scar — pink is fine, red is not.',
        'Stretch the hip flexors, two minutes.',
        'Drink a full glass of water before coffee.',
      ] },
  ],
  Nourish: [
    { kind: 'video', num: '01', title: 'Eating to keep up.',
      expert: 'Maya L. · RD, IBCLC', dur: '2:20' },
    { kind: 'article', num: '02', title: 'Why the third coffee isn’t the answer.', dur: '3 min read',
      excerpt: 'Postpartum thirst rivals pregnancy thirst, and dehydration reads almost exactly like the afternoon crash you’re trying to caffeinate away. A full glass of water before each feed beats a third espresso by 4 p.m. nearly every time. Keep a bottle wherever you usually sit down to nurse.' },
    { kind: 'illustration', num: '03', title: 'Plate, postpartum.',
      caption: 'Half plate veg, a fist of protein, a thumb of fat, a cupped hand of slow carbs. Repeat at every meal you can.' },
    { kind: 'checklist', num: '04', title: 'Today’s easy four.',
      steps: [
        'A glass of water before the first feed.',
        'A protein at breakfast.',
        'A handful of nuts within arm’s reach.',
        'A warm dinner, even if it’s leftovers.',
      ] },
  ],
  Rest: [
    { kind: 'video', num: '01', title: 'Stealing ten minutes.',
      expert: 'Tara P. · sleep coach', dur: '1:35' },
    { kind: 'article', num: '02', title: '4 a.m. is not "tomorrow."', dur: '3 min read',
      excerpt: 'The reason you feel ruined at 4 a.m. isn’t the wake-up. It’s that your brain coded the night as one long block instead of two shorter ones.' },
    { kind: 'illustration', num: '03', title: 'Sleep debt, by week.',
      caption: 'Two short naps before noon clear more debt than a single afternoon block. Map the windows you actually have.' },
    { kind: 'checklist', num: '04', title: 'Build a 90-minute window.',
      steps: [
        'Phone in the next room.',
        'Eye mask within reach.',
        'Door closed, sign on the handle.',
        'No to-do list before you lie down.',
      ] },
  ],
  Tips: [
    { kind: 'video', num: '01', title: 'Hand-offs that actually work.',
      expert: 'Annie R. · doula', dur: '2:00' },
    { kind: 'article', num: '02', title: 'The small mercies notebook.', dur: '2 min read',
      excerpt: 'Three lines a day, written before bed. By month six you’ll have a map of what worked, what didn’t, and what only you ever noticed.' },
    { kind: 'illustration', num: '03', title: 'Where the time actually goes.',
      caption: 'Real moms log roughly 11 hours of direct baby care in a 24-hour day. The other 13 is the part nobody warns you about.' },
    { kind: 'checklist', num: '04', title: 'The hand-off list.',
      steps: [
        'Diapers, top shelf changing table.',
        'Bottles in fridge, dated.',
        'Sleep song queued.',
        'Pediatrician number on the fridge.',
      ] },
  ],
};

// Eyebrow meta for each piece kind (handoff lines 129-143).
const PIECE_LABEL_META: Record<Piece['kind'], string> = {
  video:        'Watch · short film',
  article:      'Read',
  illustration: 'See',
  checklist:    'Do',
};

function PieceLabel({ kind, num }: { kind: Piece['kind']; num: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Text style={{
        fontFamily: FONTS.v2_mono, fontSize: 10, color: T.amber,
        letterSpacing: 2.2, textTransform: 'uppercase', fontWeight: '600',
      }}>
        {num} · {PIECE_LABEL_META[kind]}
      </Text>
    </View>
  );
}

// Toggleable checklist row (kept in its own component so each piece
// gets isolated useState — toggling row 2 of one chapter doesn’t
// flip rows in another chapter or another piece on this page).
function ChecklistPiece({ piece, accentBg, accentFg }: {
  piece: PieceChecklist; accentBg: string; accentFg: string;
}) {
  const [checked, setChecked] = useState<boolean[]>(
    () => piece.steps.map((_, i) => i === 0),
  );
  const toggle = (i: number) =>
    setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)));

  return (
    <View>
      <PieceLabel kind="checklist" num={piece.num} />
      <Text style={styles.checklistTitle}>{piece.title}</Text>
      <V3Card contentStyle={{ overflow: 'hidden' }}>
        {piece.steps.map((step, j) => {
          const done = checked[j];
          return (
            <TouchableOpacity
              key={j}
              onPress={() => toggle(j)}
              activeOpacity={0.85}
              style={[
                styles.checklistRow,
                j === 0 ? null : styles.checklistRowDivider,
                done ? { backgroundColor: T.parchment } : null,
              ]}
            >
              <View style={[
                styles.checkbox,
                done
                  ? { backgroundColor: accentBg, borderColor: accentBg }
                  : { borderColor: T.rule },
              ]}>
                {done ? (
                  <Svg width={11} height={11} viewBox="0 0 24 24">
                    <Path d="M5 13l4 4L19 7" stroke={accentFg} strokeWidth={3}
                      fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                ) : null}
              </View>
              <Text style={[
                styles.checklistStep,
                done ? styles.checklistStepDone : null,
              ]}>
                {step}
              </Text>
            </TouchableOpacity>
          );
        })}
      </V3Card>
    </View>
  );
}

// ─── Atoms ─────────────────────────────────────────────────────────────
function Eyebrow({ children, color = T.walnut }: { children: React.ReactNode; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 16, height: 1.5, backgroundColor: color, marginRight: 8 }} />
      <Text style={{
        fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
        textTransform: 'uppercase', fontWeight: '500', color,
      }}>{children}</Text>
    </View>
  );
}

// ─── Playbook preview (V5 Phase 5.1.5) ────────────────────────────────────
// Not the real personalization engine (that's 5.2 Baby Check-in + 5.3 Pro),
// but a tangible preview: the mom tunes her approach and the sample plan +
// plays react live, so the toggle leads somewhere instead of into an empty
// teaser. All copy is illustrative + clearly labelled "sample" — never
// presented as medical advice.
type PbSleep = 'cosleep' | 'training' | 'mixed';
type PbFeed = 'breast' | 'formula' | 'mixed';
type PbSolids = 'notyet' | 'starting' | 'going';

const PB_SLEEP_OPTS: { key: PbSleep; en: string; es: string }[] = [
  { key: 'cosleep', en: 'Co-sleeping', es: 'Colecho' },
  { key: 'training', en: 'Sleep training', es: 'Entrenamiento' },
  { key: 'mixed', en: 'A mix', es: 'Mixto' },
];
const PB_FEED_OPTS: { key: PbFeed; en: string; es: string }[] = [
  { key: 'breast', en: 'Breast', es: 'Pecho' },
  { key: 'formula', en: 'Formula', es: 'Fórmula' },
  { key: 'mixed', en: 'Mixed', es: 'Mixto' },
];
const PB_SOLIDS_OPTS: { key: PbSolids; en: string; es: string }[] = [
  { key: 'notyet', en: 'Not yet', es: 'Aún no' },
  { key: 'starting', en: 'Starting', es: 'Empezando' },
  { key: 'going', en: 'Going strong', es: 'En marcha' },
];

function pbSleepLine(k: PbSleep, lang: 'en' | 'es'): string {
  const en: Record<PbSleep, string> = {
    cosleep: 'Contact naps, room dim and calm — wake windows around 1.5–2 hrs.',
    training: 'Crib naps on a rhythm — wake windows around 2 hrs, drowsy-but-awake.',
    mixed: 'Blend contact + crib naps — wake windows around 1.5–2 hrs.',
  };
  const es: Record<PbSleep, string> = {
    cosleep: 'Siestas en brazos, cuarto en penumbra — ventanas de ~1.5–2 h.',
    training: 'Siestas en cuna con ritmo — ventanas de ~2 h, somnoliento pero despierto.',
    mixed: 'Mezcla brazos + cuna — ventanas de ~1.5–2 h.',
  };
  return (lang === 'es' ? es : en)[k];
}
function pbFeedLine(k: PbFeed, lang: 'en' | 'es'): string {
  const en: Record<PbFeed, string> = {
    breast: 'Nurse on cue — roughly every 2.5–3 hrs, longer stretch after the last evening feed.',
    formula: 'Bottles every 3–4 hrs — watch fullness cues, never force the last ounce.',
    mixed: 'Alternate breast + bottle — keep the bedtime feed at the breast if you can.',
  };
  const es: Record<PbFeed, string> = {
    breast: 'Pecho a demanda — cada ~2.5–3 h, tramo más largo tras la última toma de la noche.',
    formula: 'Biberón cada 3–4 h — observa señales de saciedad, sin forzar la última onza.',
    mixed: 'Alterna pecho + biberón — deja la toma de dormir al pecho si puedes.',
  };
  return (lang === 'es' ? es : en)[k];
}
function pbSolidsLine(k: PbSolids, lang: 'en' | 'es'): string | null {
  if (k === 'notyet') return null;
  const en: Record<'starting' | 'going', string> = {
    starting: 'One solids sit-down a day — single-ingredient purées, milk still leads.',
    going: 'Two to three solids meals — soft finger foods, offer water in an open cup.',
  };
  const es: Record<'starting' | 'going', string> = {
    starting: 'Una comida de sólidos al día — purés de un ingrediente, la leche sigue primero.',
    going: 'Dos o tres comidas de sólidos — trozos blandos, agua en vaso abierto.',
  };
  return (lang === 'es' ? es : en)[k];
}
/** Two short "plays" that shift with the sleep + feed approach. */
function pbPlays(sleep: PbSleep, feed: PbFeed, lang: 'en' | 'es'): { title: string; body: string }[] {
  const es = lang === 'es';
  const sleepPlay = {
    cosleep: es
      ? { title: 'Noche tranquila, juntas', body: 'Rutina corta y constante, luz cálida y baja. Si comparten cama, repasa la lista de sueño seguro antes de acostarse.' }
      : { title: 'A calm night, together', body: 'Short, consistent wind-down with warm low light. If you share sleep space, run the safe-sleep checklist first.' },
    training: es
      ? { title: 'Pausa antes de entrar', body: 'Dale uno o dos minutos para reacomodarse antes de responder. Anota qué despertares cedieron solos esta semana.' }
      : { title: 'Pause before you go in', body: 'Give a minute or two to resettle before responding. Note which wake-ups self-resolved this week.' },
    mixed: es
      ? { title: 'Lee la noche', body: 'Empieza en la cuna; si la noche es dura, acércala. Sin culpa — flexibilidad es una estrategia.' }
      : { title: 'Read the night', body: 'Start in the crib; if it’s a rough night, bring her close. No guilt — flexibility is a strategy.' },
  }[sleep];
  const feedPlay = {
    breast: es
      ? { title: 'Protege tu suministro', body: 'Hidrátate y come algo en cada toma de la noche. El racimo de la tarde es normal — no es poca leche.' }
      : { title: 'Protect your supply', body: 'Hydrate and snack at night feeds. The evening cluster is normal — it’s not low supply.' },
    formula: es
      ? { title: 'Tomas con calma', body: 'Biberón a ritmo pausado, pausas para eructar. Prepara la noche con anticipación para menos fricción a las 3 a.m.' }
      : { title: 'Paced bottles', body: 'Paced bottle feeding with burst breaks. Pre-make the night bottle so 3 a.m. has less friction.' },
    mixed: es
      ? { title: 'Equilibra el día', body: 'Pecho cuando estén tranquilas, biberón cuando necesites un relevo. Ambos cuentan como nutrir.' }
      : { title: 'Balance the day', body: 'Breast when you’re settled, bottle when you need a hand-off. Both count as nourishing.' },
  }[feed];
  return [sleepPlay, feedPlay];
}

// Time-of-day period drives the hero theming + the friend-voice line.
type PbPeriod = 'morning' | 'afternoon' | 'evening' | 'night';
function pbPeriod(hour: number): PbPeriod {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}
function pbPeriodLabel(p: PbPeriod, lang: 'en' | 'es'): string {
  const en: Record<PbPeriod, string> = { morning: 'MORNING', afternoon: 'AFTERNOON', evening: 'EVENING', night: 'TONIGHT' };
  const es: Record<PbPeriod, string> = { morning: 'MAÑANA', afternoon: 'TARDE', evening: 'NOCHE', night: 'MADRUGADA' };
  return (lang === 'es' ? es : en)[p];
}
// Warm, lowercase friend-voice (V10) — one line, sets the tone for the day.
function pbFriendLine(p: PbPeriod, lang: 'en' | 'es'): string {
  const en: Record<PbPeriod, string> = {
    morning: 'fresh start. here’s the shape of today.',
    afternoon: 'midday reset — you’re doing great.',
    evening: 'almost there. let’s ease into the night.',
    night: 'rough night? today can go slow. that’s allowed.',
  };
  const es: Record<PbPeriod, string> = {
    morning: 'buen comienzo. así se ve el día.',
    afternoon: 'pausa de mediodía — lo haces muy bien.',
    evening: 'ya casi. bajemos el ritmo hacia la noche.',
    night: '¿noche difícil? hoy puede ir lento. está bien.',
  };
  return (lang === 'es' ? es : en)[p];
}
type PbMoment = { h: number; clock: string; icon: string; label: string; sub: string };
// A sample day on realistic anchors (7:00 wake → 6:45 wind-down). Labels + the
// detail subline shift with the mom's sleep/feed/solids approach. Illustrative.
type PbNight = 'solid' | 'some' | 'rough';
function pbToday(sleep: PbSleep, feed: PbFeed, solids: PbSolids, lang: 'en' | 'es', night?: PbNight | null): PbMoment[] {
  const es = lang === 'es';
  const rough = night === 'rough';
  const nap = es
    ? { cosleep: 'Siesta en brazos', training: 'Siesta en cuna', mixed: 'Siesta' }[sleep]
    : { cosleep: 'Contact nap', training: 'Crib nap', mixed: 'Nap' }[sleep];
  const feedL = es
    ? { breast: 'Toma al pecho', formula: 'Biberón', mixed: 'Toma' }[feed]
    : { breast: 'Nurse', formula: 'Bottle', mixed: 'Feed' }[feed];
  const bed = es
    ? { cosleep: 'Rutina y a la cama, juntas', training: 'Rutina y a la cuna', mixed: 'Rutina y a dormir' }[sleep]
    : { cosleep: 'Wind-down → bed, together', training: 'Wind-down → crib', mixed: 'Wind-down → bed' }[sleep];
  // A rough night → overtired baby → shorter wake windows + earlier bed.
  const win = rough
    ? (es ? 'Ventana más corta hoy tras la noche dura — atenta a las señales de sueño temprano.' : 'Shorter window today after a rough night — watch for the early tired cues.')
    : sleep === 'training'
      ? (es ? 'Tras ~2 h despierta; a la cuna adormilada pero despierta.' : 'After a ~2 hr window; into the crib drowsy but still awake.')
      : (es ? 'Acuéstala tras ~1.5–2 h despierta — adormilada, todavía no dormida.' : 'Down after ~1.5–2 hrs awake — drowsy, not yet fully asleep.');
  const firstFeed = feed === 'formula'
    ? (es ? 'biberón a ritmo pausado, atenta a la saciedad' : 'a paced bottle, watching for fullness')
    : feed === 'mixed'
      ? (es ? 'pecho o biberón, sin prisa' : 'breast or bottle, no rush')
      : (es ? 'ofrece ambos lados, tómate tu tiempo' : 'offer both sides, take your time');
  const cadence = feed === 'formula'
    ? (es ? 'Cada ~3–4 h, a ritmo pausado; para al saciarse, sin forzar la última onza.' : 'Every ~3–4 hrs, paced — stop at fullness, never force the last ounce.')
    : (es ? 'A demanda, ~2.5–3 h; el racimo de la tarde es normal, no es poca leche.' : 'On cue, ~2.5–3 hrs — the evening cluster is normal, not low supply.');
  const solidsSub = solids === 'going'
    ? (es ? 'Más sólidos: trozos blandos para agarrar y agua en vaso abierto.' : 'Plus solids: soft finger foods she can grip, water in an open cup.')
    : solids === 'starting'
      ? (es ? 'Más un puré de un solo ingrediente — la leche sigue siendo lo primero.' : 'Plus one single-ingredient purée — milk still comes first for now.')
      : '';
  const bedSub = rough
    ? (es ? 'Adelanta la hora hoy: baño, cuento, luz baja y a la cama temprano.' : 'Bring it earlier tonight: bath, book, low light, into bed sooner.')
    : (es ? 'Baño, cuento, luz baja; a la cama adormilada cerca de las 7.' : 'Bath, book, low light — into bed drowsy by around 7.');
  const C = (h12: string, h24: string) => (es ? h24 : h12);
  return [
    { h: 7.0,   clock: C('7:00 AM', '7:00'),   icon: '🌅', label: es ? 'Despertar' : 'Morning wake', sub: `${es ? 'Primera toma del día' : 'First feed of the day'} — ${firstFeed}.` },
    { h: 9.25,  clock: C('9:15 AM', '9:15'),   icon: '🌙', label: nap, sub: win },
    { h: 11.5,  clock: C('11:30 AM', '11:30'), icon: '🍼', label: feedL, sub: solidsSub || cadence },
    { h: 14.25, clock: C('2:15 PM', '14:15'),  icon: '🌙', label: nap, sub: win },
    { h: 16.5,  clock: C('4:30 PM', '16:30'),  icon: '🍼', label: feedL, sub: cadence },
    { h: 18.75, clock: C('6:45 PM', '18:45'),  icon: '🛁', label: bed, sub: bedSub },
  ];
}
// Relative "in ~X" label for the next moment, rounded to feel human.
function pbRelative(minsUntil: number, lang: 'en' | 'es'): string {
  if (minsUntil <= 0) return lang === 'es' ? 'ahora' : 'now';
  if (minsUntil < 60) { const m = Math.max(5, Math.round(minsUntil / 5) * 5); return lang === 'es' ? `en ~${m} min` : `in ~${m} min`; }
  const h = Math.round(minsUntil / 60);
  return lang === 'es' ? `en ~${h} h` : `in ~${h} hr`;
}
// Friend-voice line once the mom logs last night — overrides the time-of-day line.
function pbNightLine(night: PbNight | null, lang: 'en' | 'es'): string | null {
  if (!night) return null;
  const en: Record<PbNight, string> = {
    solid: 'solid night — nice. here’s today.',
    some: 'a few wakes — you’ve got this. easy does it.',
    rough: 'rough night (3+). today’s a slow one — that’s allowed.',
  };
  const es: Record<PbNight, string> = {
    solid: 'buena noche — qué bien. así va hoy.',
    some: 'algunos despertares — tú puedes, con calma.',
    rough: 'noche difícil (3+). hoy vamos lento — está bien.',
  };
  return (lang === 'es' ? es : en)[night];
}
function pbClock(d: Date, lang: 'en' | 'es'): string {
  const h = d.getHours(); const m = d.getMinutes();
  const mm = m < 10 ? `0${m}` : `${m}`;
  if (lang === 'es') return `${h}:${mm}`;
  const ap = h < 12 ? 'AM' : 'PM'; let h12 = h % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${mm} ${ap}`;
}
// The hero "deck" — a fuller, reassuring read on the day. Reacts to a logged
// night first, otherwise to the time of day. This is the depth layer under the
// one-line friend voice; it's where the Playbook earns a "premium" read.
function pbDayDeck(period: PbPeriod, night: PbNight | null, lang: 'en' | 'es'): string {
  const es = lang === 'es';
  if (night === 'rough') return es
    ? 'Después de una noche dura, recogemos el día un poco: ventanas más cortas y la hora de dormir más temprano. Sigue sus señales antes que el reloj — y ve con calma contigo también.'
    : 'After a rough night, we’ve pulled the day in a little — shorter awake stretches and an earlier bedtime. Follow her cues over the clock, and go gentle on yourself today too.';
  if (night === 'some') return es
    ? 'Algunos despertares anoche, nada fuera de lo común. Mantén las ventanas de siempre y observa las primeras señales de cansancio antes de que se sobrecanse.'
    : 'A few wake-ups last night, nothing out of the ordinary. Keep the usual windows and catch the first tired cues before she gets overtired.';
  if (night === 'solid') return es
    ? 'Una buena noche por detrás. Hoy puedes estirar un poco las ventanas si la ves contenta y despierta, sin forzarlo.'
    : 'A solid night behind you. You can stretch the wake windows a touch today if she seems happy and alert — no need to push it.';
  const en: Record<PbPeriod, string> = {
    morning: 'Two naps and a handful of feeds ahead. Aim for the rhythm rather than the exact clock — her cues lead, the times are just a guide.',
    afternoon: 'One more nap and a couple of feeds before the bedtime routine. Keep things calm and predictable as the afternoon winds down.',
    evening: 'The day is winding down. Dim the lights, slow the pace, and let the bedtime routine do the heavy lifting from here.',
    night: 'Middle of the night is for the basics — feed, fresh diaper, back to sleep. Keep it boring and low-light so everyone resettles faster.',
  };
  const esm: Record<PbPeriod, string> = {
    morning: 'Dos siestas y varias tomas por delante. Busca el ritmo más que el reloj exacto — sus señales mandan, las horas solo orientan.',
    afternoon: 'Queda una siesta y un par de tomas antes de la rutina de dormir. Mantén todo en calma y predecible según baja la tarde.',
    evening: 'El día va cerrando. Baja las luces, afloja el ritmo y deja que la rutina de dormir haga el trabajo de aquí en adelante.',
    night: 'La madrugada es para lo básico — toma, pañal limpio, de vuelta a dormir. Aburrido y con poca luz para que todos se reacomoden antes.',
  };
  return (es ? esm : en)[period];
}

// ─── Screen ────────────────────────────────────────────────────────────
export default function ManualScrollV3() {
  const navigation = useNavigation<any>();
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';

  // Route params allow deep-linking from Home into a specific chapter
  // (e.g. tapping "Sleep · Separation anxiety wakings" on the Home
  // hero TOC). When passed, the screen initializes the view + chapter
  // from the params; otherwise defaults to the General Manual / first chapter.
  //
  // V5 Phase 5.1 (2026-05-29) — the previous "mom vs baby" audience toggle
  // was retired. The "Mom Manual" track moved to its own dedicated surface
  // (HomeStack/MomHub) so the Manual tab can lead with the baby-side
  // 52-week reference. Mom content was always editorial / weekly-digest in
  // shape, not chapter-paginated, so the split was always under tension.
  //
  // The new toggle reads "Manual" vs "Playbook":
  //   - Manual   = General Manual (the existing baby chapters, the static
  //                educational base — free in 5.3's tier model).
  //   - Playbook = personalized track that adapts to Baby Check-in answers
  //                + preferences (co-sleeping vs sleep-training, starting
  //                solids, etc). Coming-soon teaser in 5.1; real shape in
  //                5.2 (data) and 5.3 (Pro paywall).
  //
  // Legacy `audience: 'mom'` route params are coerced to the Manual view
  // (the closest non-broken landing) — anything that linked to a Mom
  // chapter now lands here gracefully instead of crashing.
  type ManualView = 'manual' | 'playbook';
  const route = useRoute();
  const initialParams = route.params as
    | { audience?: 'mom' | 'baby'; view?: ManualView; chapter?: string }
    | undefined;
  const initialView: ManualView =
    initialParams?.view === 'playbook' ? 'playbook' : 'manual';
  const initialChapter = (
    initialParams?.chapter
      ? BABY_CHAPTERS.find((c) => c.ch === initialParams.chapter) ?? BABY_CHAPTERS[0]
      : BABY_CHAPTERS[0]
  );

  const [view, setView] = useState<ManualView>(initialView);
  // The chip list and DB queries always run against the baby chapters now.
  // MOM_CHAPTERS is kept defined above for the eventual "Phase 2 — restore
  // Mom Manual as a tertiary track" optionality the voice memo flagged.
  // Week 0 shows the prep pills (Hospital · Sleep · Feed · Care); week 1+ shows
  // the baby chapters (Sleep · Feed · Grow · Care).
  const week = Math.max(0, babyProfile?.current_week_number ?? 1);
  const list = week === 0 ? WEEK0_CHAPTERS : BABY_CHAPTERS;
  // The DB API still takes a ManualAudience ('mom' | 'baby') — pin to baby.
  const who: ManualAudience = 'baby';
  const [chapter, setChapter] = useState<ChapterMeta>(initialChapter);

  // Playbook preview preferences (local-only until 5.2/5.3 wire the real
  // engine). The sample plan + plays react to these live.
  const [pbSleep, setPbSleep] = useState<PbSleep>('mixed');
  const [pbFeed, setPbFeed] = useState<PbFeed>('breast');
  const [pbSolids, setPbSolids] = useState<PbSolids>('notyet');

  // V5 5.2 — Playbook prefs now persist on the baby profile (migration 091).
  // Hydrate once when the profile loads (NULL = unset → keep the UI default),
  // then write each tune change through so it survives restarts.
  const pbHydratedRef = useRef(false);
  useEffect(() => {
    if (pbHydratedRef.current || !babyProfile) return;
    pbHydratedRef.current = true;
    if (babyProfile.pb_sleep_pref) setPbSleep(babyProfile.pb_sleep_pref);
    if (babyProfile.pb_feed_pref) setPbFeed(babyProfile.pb_feed_pref);
    if (babyProfile.pb_solids_pref) setPbSolids(babyProfile.pb_solids_pref);
  }, [babyProfile]);
  const persistPbPref = (
    patch: Partial<{ pb_sleep_pref: PbSleep; pb_feed_pref: PbFeed; pb_solids_pref: PbSolids }>,
  ) => {
    homeApi.updateBabyPlaybookPrefs(patch)
      .then(() => {
        const cur = useHomeStore.getState().babyProfile;
        if (cur) useHomeStore.getState().setBabyProfile({ ...cur, ...patch });
      })
      .catch(() => {}); // best-effort; local state already reflects the choice
  };
  const onSetPbSleep = (k: PbSleep) => { setPbSleep(k); persistPbPref({ pb_sleep_pref: k }); };
  const onSetPbFeed = (k: PbFeed) => { setPbFeed(k); persistPbPref({ pb_feed_pref: k }); };
  const onSetPbSolids = (k: PbSolids) => { setPbSolids(k); persistPbPref({ pb_solids_pref: k }); };
  const [tuneOpen, setTuneOpen] = useState(false);
  // Quick-log preview state (local until 5.2 wires the real Baby Check-in DB).
  const [logOpen, setLogOpen] = useState<null | 'sleep' | 'feed'>(null);
  const [lastNight, setLastNight] = useState<PbNight | null>(null);
  const [lastFeedLabel, setLastFeedLabel] = useState<string | null>(null);

  // Switch the view tab. We DON'T reset the selected chapter anymore — the
  // category the user was reading is preserved across the toggle so flipping
  // Manual ↔ Playbook ↔ Manual lands them back where they were.
  const switchView = (next: ManualView) => setView(next);

  // Chip click selects the chapter; the swipe deck below re-keys to it.
  // (Tap-to-open-chapter → ManualCategory was removed 2026-06-10 in favor of
  // the inline Stories-style ManualSwipeDeck.)
  const switchChapter = (next: ChapterMeta) => setChapter(next);

  // Static for the preview — wire to user progress in Phase 4.2.
  const doneCount = 2;
  const totalChapters = list.length;
  const remaining = totalChapters - doneCount;
  // Manual baseline content for the selected (week, category) — drives both the
  // story deck and the below-deck modules (checklist → article → infographic).
  const manualContent = getManualContent(week, chapter.cat);
  const ownerName = who === 'baby' ? (babyProfile?.baby_name ?? PLACEHOLDER_BABY_NAME) : 'Your';

  // Hamburger menu state (same recipe as ManualCategoryScreen)
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ right: 22, top: 64 });
  const triggerRef = useRef<View>(null);
  const screenWidth = Dimensions.get('window').width;

  const openMenu = () => {
    const node = triggerRef.current && findNodeHandle(triggerRef.current);
    if (node) {
      UIManager.measureInWindow(node, (x, y, w, h) => {
        if (w === 0) return setMenuOpen(true);
        setAnchor({ right: screenWidth - (x + w), top: y + h });
        setMenuOpen(true);
      });
    } else {
      setMenuOpen(true);
    }
  };
  const closeAnd = (fn?: () => void) => () => {
    setMenuOpen(false);
    if (fn) setTimeout(fn, 80);
  };
  const goToCompleteManual = () => navigation.navigate('ManualWeekIndex' as never);
  const goToSavedChapters = () => navigation.navigate('SavedManual' as never);
  const placeholder = (titleKey: string, bodyKey: string) =>
    Alert.alert(t(titleKey), t(bodyKey));
  const shareChapter = async () => {
    const url = `https://villieapp.com/m/?c=${who}-${chapter.cat}`;
    try {
      await Share.share({ message: `${chapter.ch} · week ${week} · villie\n${url}` });
    } catch { /* user cancelled */ }
  };

  // Compose the current screen's pieces into the ManualPdfPiece shape the
  // HTML builder expects. Prefers DB-authored pieces (chapterPieces) and
  // falls back to PIECES_BY_CHAPTER if the bucket is empty for this chapter.
  // Video pieces are inferred from `firstVideo` so the PDF shows the actual
  // Mux thumbnail's title — falling back to the static placeholder otherwise.
  const buildPdfPieces = (): ManualPdfPiece[] => {
    const fromDb: ManualPdfPiece[] = chapterPieces.map((p) => {
      if (p.kind === 'article') {
        return { kind: 'article', num: p.num, title: p.title, dur: p.dur ?? undefined, excerpt: (p as any).excerpt ?? '' };
      }
      if (p.kind === 'illustration') {
        return { kind: 'illustration', num: p.num, title: p.title, caption: (p as any).caption ?? undefined };
      }
      if (p.kind === 'checklist') {
        return { kind: 'checklist', num: p.num, title: p.title, steps: (p as any).steps ?? [] };
      }
      // Should not occur — listManualPieces returns only article/illustration/checklist
      return { kind: 'article', num: p.num, title: p.title, excerpt: '' };
    });
    const fallback = PIECES_BY_CHAPTER[chapter.ch] ?? [];
    const merged: ManualPdfPiece[] = fromDb.length ? fromDb : fallback.map((p): ManualPdfPiece => {
      if (p.kind === 'video') return { kind: 'video', num: p.num, title: p.title, dur: p.dur, expert: p.expert };
      if (p.kind === 'article') return { kind: 'article', num: p.num, title: p.title, dur: p.dur, excerpt: p.excerpt };
      if (p.kind === 'illustration') return { kind: 'illustration', num: p.num, title: p.title, caption: p.caption };
      return { kind: 'checklist', num: p.num, title: p.title, steps: p.steps };
    });
    // Prepend the live video piece (when present) so the PDF leads with
    // the current week's watch, matching the screen's piece order.
    if (firstVideo && !merged.find((p) => p.kind === 'video')) {
      // DB videos don't carry an expert byline; PIECES_BY_CHAPTER fallback
      // does. Live video card omits expert for now — wire when the
      // manual_videos schema grows an expert_name column.
      merged.unshift({
        kind: 'video',
        num: '01',
        title: firstVideo.title,
        dur: formatDuration(firstVideo.duration_seconds ?? 0) || undefined,
      });
    }
    return merged;
  };

  const exportChapterPdf = async () => {
    // Dynamic require keeps the native module reference out of the bundle's
    // top-level. On a stale build (Build 11) the JS shim resolves but the
    // native bridge throws "Native module 'ExpoPrint' not registered" —
    // caught below and the user sees the "coming soon" placeholder.
    // On Build 12+ the modules are linked and the call lands real PDFs.
    try {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      const ownerName = babyProfile?.baby_name?.trim() || (lang === 'es' ? 'tu bebé' : "your baby");
      const html = buildManualChapterHtml({
        chapterName: chapter.ch,
        chapterIntro: CHAPTER_INTRO[chapter.ch],
        week,
        who,
        ownerName,
        pieces: buildPdfPieces(),
      });
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          dialogTitle: t('manualMenu.pdfShareDialogTitle'),
          mimeType: 'application/pdf',
          UTI: 'com.adobe.pdf',
        });
      }
    } catch (err) {
      // "Native module not registered" on Build 11 lands here; treat as the
      // "coming soon" placeholder rather than a hard error so testers don't
      // think the app crashed. Real Build 12+ errors (network / disk / share
      // sheet cancellation) also funnel through here — the body copy stays
      // soft enough to read fine in either case.
      const msg = String((err as any)?.message ?? err);
      const isNativeMissing = /native module/i.test(msg) || /not registered/i.test(msg);
      console.warn('[manual] PDF export failed', err);
      if (isNativeMissing) {
        Alert.alert(t('manualMenu.pdfComingTitle'), t('manualMenu.pdfComingBody'));
      } else {
        Alert.alert(t('manualMenu.pdfErrorTitle'), t('manualMenu.pdfErrorBody'));
      }
    }
  };

  // ─── Phase 4.3 — Real Mux videos for the current chapter ─────────────
  // Pulls the per-chapter video bucket so the 'video' piece below can
  // swap its chapter-tinted placeholder for a real thumbnail + title +
  // duration. Re-fetches whenever (audience, category, lang) changes.
  // Empty list → renders the hand-authored placeholder copy (graceful
  // fallback for buckets that haven't been seeded yet). Errors are
  // logged but never block render — the placeholder takes over.
  const [chapterVideos, setChapterVideos] = useState<ManualVideo[]>([]);
  const [chapterPieces, setChapterPieces] = useState<ManualPiece[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Parallel fetch — videos + non-video pieces both keyed off
      // (audience, category). Non-video bucket may be empty until
      // clinical-advisor authoring lands; PIECES_BY_CHAPTER fallback
      // takes over per chapter in that case (see piece render branch).
      const [videos, pieces] = await Promise.all([
        listManualVideos(who as ManualAudience, chapter.cat, lang)
          .catch((e) => { console.warn('ManualScrollV3 listManualVideos failed', e); return [] as ManualVideo[]; }),
        listManualPieces(who as ManualAudience, chapter.cat, lang),
      ]);
      if (cancelled) return;
      setChapterVideos(videos);
      setChapterPieces(pieces);
    })();
    return () => { cancelled = true; };
  }, [who, chapter.cat, lang]);
  const firstVideo: ManualVideo | undefined = chapterVideos[0];

  const openVideo = (video: ManualVideo) => {
    // Play the chapter's videos as a playlist, starting at the tapped clip.
    const ids = chapterVideos.map((v) => v.id);
    const idx = Math.max(0, ids.indexOf(video.id));
    navigation.navigate('ManualVideo' as never, {
      audience: who, category: chapter.cat, videoId: video.id,
      playlist: ids, playlistIndex: idx,
    } as never);
  };

  // Piece detail overlay — article / illustration / checklist open in
  // a sheet-style Modal that lets the user close back to the same
  // scroll position. Video stays on its own nav screen (full Mux
  // player + watch-tracking is heavier than what a Modal should host).
  const [overlayPiece, setOverlayPiece] = useState<OverlayPiece | null>(null);
  const openPieceOverlay = (p: OverlayPiece) => setOverlayPiece(p);
  const closePieceOverlay = () => setOverlayPiece(null);

  // Atmospheric backdrop — bees + warm gradient via shared component.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [triggerAnim, setTriggerAnim] = useState(0);
  useFocusEffect(
    React.useCallback(() => {
      setTriggerAnim((n) => n + 1);
      return () => {};
    }, []),
  );

  // Manual masthead honeycomb — accent + thematic bee follow the selected
  // chapter (Sleep/Feed/Grow/Care/Soothe). Re-keys on chapter change so the
  // comb re-lights and the new bee animates in each time you switch.
  const chapterAccent = CHIP_TONE[chapter.cat]?.bg ?? '#D96C88';
  const manualScene = (['sleep', 'feed', 'grow', 'care', 'soothe'].includes(chapter.cat)
    ? chapter.cat
    : undefined) as any;
  // Playbook is mom-focused — carrying the selected baby chapter's bee + accent
  // onto it looked off (a "Sleep" baby bee hovering over the mom playbook). On
  // Playbook we swap to the communal "village" scene + a warm cinnamon accent so
  // the backdrop reads as mom's whole plan, then restore the chapter scene the
  // moment she flips back to the Manual.
  const isPlaybook = view === 'playbook';
  const backdropAccent = isPlaybook ? T.cinnamon : chapterAccent;
  const backdropScene = (isPlaybook ? 'village' : manualScene) as any;
  const backdropKey = isPlaybook ? 'playbook' : chapter.ch;

  // Playbook "right now" model — time-aware sample day + next move + voice.
  const pbNow = new Date();
  const pbCurPeriod = pbPeriod(pbNow.getHours());
  const pbIsNight = pbCurPeriod === 'night';
  const pbNowH = pbNow.getHours() + pbNow.getMinutes() / 60;
  const pbDay = pbToday(pbSleep, pbFeed, pbSolids, lang, lastNight);
  const pbNextIdx = pbDay.findIndex((m) => m.h > pbNowH);
  const pbNext = pbNextIdx >= 0 ? pbDay[pbNextIdx] : null;
  const pbRel = pbNext ? pbRelative((pbNext.h - pbNowH) * 60, lang) : '';
  const pbOneThing = pbPlays(pbSleep, pbFeed, lang)[0];
  const pbNowClock = pbClock(pbNow, lang);
  const pbHeroLine = pbNightLine(lastNight, lang) ?? pbFriendLine(pbCurPeriod, lang);
  const pbDeck = pbDayDeck(pbCurPeriod, lastNight, lang);
  const pbNightShort = lastNight
    ? (lang === 'es'
        ? { solid: 'Durmió bien', some: 'Algunos despertares', rough: 'Noche difícil' }[lastNight]
        : { solid: 'Slept well', some: 'A few wakes', rough: 'Rough night' }[lastNight])
    : '';
  const pbDoneCount = pbNextIdx === -1 ? pbDay.length : pbNextIdx;
  const pbProgress = pbDay.length ? pbDoneCount / pbDay.length : 0;
  const pbTuneSummary = [
    PB_SLEEP_OPTS.find((o) => o.key === pbSleep),
    PB_FEED_OPTS.find((o) => o.key === pbFeed),
    PB_SOLIDS_OPTS.find((o) => o.key === pbSolids),
  ].map((o) => (o ? (lang === 'es' ? o.es : o.en) : '')).join(' · ');

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop scrollY={scrollY} triggerAnim={triggerAnim} />
      <HoneycombBackdrop
        key={backdropKey}
        accent={backdropAccent}
        scene={backdropScene}
        intensity="subtle"
        topOffset={58}
        sceneInsetX={52}
      />
      <Animated.ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true },
        )}
        scrollEventThrottle={16}
      >

        {/* Header — eyebrow + title + hamburger */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Eyebrow>{lang === 'es' ? `Semana ${week} de 52` : `Week ${week} of 52`}</Eyebrow>
            <Text style={styles.bigTitle} numberOfLines={1}>
              {isPlaybook ? 'Your ' : (who === 'baby' ? `${ownerName}'s ` : 'Your ')}
              <Text style={styles.bigTitleItalic}>{isPlaybook ? 'playbook.' : 'manual.'}</Text>
            </Text>
          </View>
          <View ref={triggerRef} collapsable={false} style={{ paddingTop: 12 }}>
            <MenuButton onPress={openMenu} expanded={menuOpen} a11yLabel={t('manualMenu.triggerA11y')} />
          </View>
        </View>

        {/* Progress bar — 3px cinnamon fill */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(doneCount / totalChapters) * 100}%` }]} />
        </View>

        {/* Manual / Playbook toggle — embossed parchment track.
            V5 Phase 5.1 (2026-05-29): swap replaces the mom/baby track. */}
        <View style={styles.toggleTrack}>
          {(['manual', 'playbook'] as const).map((opt) => {
            const on = view === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => switchView(opt)}
                activeOpacity={0.85}
                style={[styles.toggleBtn, on && styles.toggleBtnOn]}
              >
                <Text style={[styles.toggleLabel, on && styles.toggleLabelOn]}>
                  {opt === 'manual'
                    ? (lang === 'es' ? 'Manual' : 'Manual')
                    : (lang === 'es' ? 'Playbook' : 'Playbook')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {view === 'playbook' ? (
          // V5 Phase 5.1.6 — Playbook PREVIEW, "one glance, one move".
          // Answer-mode: a time-aware hero ("what now?") + a glanceable today
          // timeline + one memorable focus, with the approach tuner tucked away.
          // Illustrative sample data until 5.2 (Baby Check-in) / 5.3 (Pro + AI).
          <View style={styles.pbWrap}>
            {/* Right-now hero — gradient, time-of-day theme, calm-dark at night. */}
            <LinearGradient
              colors={pbIsNight ? ['#3D1F0E', '#241208'] : ['#FCEFD6', '#F7E1BC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.pbHero, pbIsNight && styles.pbHeroNight]}
            >
              {/* Day-progress ring — right-side anchor + "where am I in the day". */}
              <View style={styles.pbRing} pointerEvents="none">
                <Svg width={52} height={52}>
                  <Circle cx={26} cy={26} r={21} strokeWidth={4} fill="none"
                    stroke={pbIsNight ? 'rgba(252,247,239,0.18)' : 'rgba(192,120,64,0.20)'} />
                  <Circle cx={26} cy={26} r={21} strokeWidth={4} fill="none" strokeLinecap="round"
                    stroke={pbIsNight ? T.butter : T.cinnamon}
                    strokeDasharray={2 * Math.PI * 21}
                    strokeDashoffset={2 * Math.PI * 21 * (1 - pbProgress)}
                    transform="rotate(-90 26 26)" />
                </Svg>
                <Text style={[styles.pbRingLabel, pbIsNight && styles.pbAccentNight]}>{pbDoneCount}/{pbDay.length}</Text>
              </View>
              <Text style={[styles.pbHeroEyebrow, pbIsNight && styles.pbHeroEyebrowNight]}>
                {pbPeriodLabel(pbCurPeriod, lang)} · {lang === 'es' ? 'TU PLAYBOOK' : 'YOUR PLAYBOOK'}
              </Text>
              <Text style={[styles.pbFriend, pbIsNight && styles.pbTextNight]}>
                {pbHeroLine}
              </Text>
              <Text style={[styles.pbDeck, pbIsNight && styles.pbDeckNight]}>
                {pbDeck}
              </Text>
              {lastNight ? (
                <View style={[styles.pbTunedPill, pbIsNight && styles.pbTunedPillNight]}>
                  <Text style={[styles.pbTunedPillText, pbIsNight && styles.pbAccentNight]}>
                    {lang === 'es' ? '✓ ajustado a anoche' : '✓ tuned for last night'}
                  </Text>
                </View>
              ) : null}
              <View style={[styles.pbHeroDivider, pbIsNight && styles.pbHeroDividerNight]} />
              {pbNext ? (
                <>
                  <Text style={[styles.pbNextLabel, pbIsNight && styles.pbDimNight]}>
                    {lang === 'es' ? 'SIGUE' : 'NEXT UP'}
                  </Text>
                  <View style={styles.pbNextRow}>
                    <Text style={styles.pbNextIcon}>{pbNext.icon}</Text>
                    <Text style={[styles.pbNextMove, pbIsNight && styles.pbTextNight]} numberOfLines={1}>{pbNext.label}</Text>
                  </View>
                  <View style={styles.pbNextTimeRow}>
                    <Text style={[styles.pbNextTime, pbIsNight && styles.pbAccentNight]}>
                      {pbNext.clock.split(' ')[0]}
                      {pbNext.clock.split(' ')[1] ? (
                        <Text style={[styles.pbNextTimeSuffix, pbIsNight && styles.pbAccentNight]}> {pbNext.clock.split(' ')[1]}</Text>
                      ) : null}
                    </Text>
                    <View style={[styles.pbRelChip, pbIsNight && styles.pbRelChipNight]}>
                      <Text style={[styles.pbRelChipText, pbIsNight && styles.pbAccentNight]}>{pbRel}</Text>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.pbNextLabel, pbIsNight && styles.pbDimNight]}>
                    {lang === 'es' ? 'A DESCANSAR' : 'WINDING DOWN'}
                  </Text>
                  <Text style={[styles.pbNextMove, pbIsNight && styles.pbTextNight]}>
                    {lang === 'es' ? 'El día terminó. Mañana retomamos el plan.' : 'Day’s done. We pick the plan back up in the morning.'}
                  </Text>
                </>
              )}
              {/* Streak — folded into the hero so nothing floats loose below it. */}
              <View style={[styles.pbHeroStreak, pbIsNight && styles.pbHeroStreakNight]}>
                <Text style={[styles.pbStreakText, pbIsNight && styles.pbDimNight]}>
                  🍯 {lang === 'es' ? '4 noches registradas' : '4 nights logged'}
                </Text>
                <View style={styles.pbStreakDots}>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <Text key={i} style={[styles.pbHex, i < 4 ? styles.pbHexOn : styles.pbHexOff]}>{i < 4 ? '⬢' : '⬡'}</Text>
                  ))}
                </View>
              </View>
            </LinearGradient>

            {/* Log today — ONE card holding the segmented control, the panel it
                opens (in-card, hairline-separated), and the logged result. The
                action and its options are a single object, not three loose bits.
                The value loop: logging sharpens the plan above. */}
            <View style={styles.pbLogCard}>
              <Text style={styles.pbCardEyebrow}>{lang === 'es' ? 'REGISTRO DE HOY' : 'LOG TODAY'}</Text>
              <View style={styles.pbLogSeg}>
                <TouchableOpacity
                  style={[styles.pbLogSegBtn, logOpen === 'sleep' && styles.pbLogSegBtnOn]}
                  onPress={() => setLogOpen((v) => (v === 'sleep' ? null : 'sleep'))}
                  activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ expanded: logOpen === 'sleep' }}
                >
                  <Text style={styles.pbLogIcon}>🌙</Text>
                  <Text style={[styles.pbLogSegText, logOpen === 'sleep' && styles.pbLogSegTextOn]}>{lang === 'es' ? 'Sueño' : 'Sleep'}</Text>
                </TouchableOpacity>
                <View style={styles.pbLogSegDivider} />
                <TouchableOpacity
                  style={[styles.pbLogSegBtn, logOpen === 'feed' && styles.pbLogSegBtnOn]}
                  onPress={() => setLogOpen((v) => (v === 'feed' ? null : 'feed'))}
                  activeOpacity={0.85} accessibilityRole="button" accessibilityState={{ expanded: logOpen === 'feed' }}
                >
                  <Text style={styles.pbLogIcon}>🍼</Text>
                  <Text style={[styles.pbLogSegText, logOpen === 'feed' && styles.pbLogSegTextOn]}>{lang === 'es' ? 'Toma' : 'Feed'}</Text>
                </TouchableOpacity>
              </View>

              {logOpen === 'sleep' ? (
                <View style={styles.pbLogExpand}>
                  <Text style={styles.pbLogQ}>{lang === 'es' ? '¿Cómo durmió anoche?' : 'How did last night go?'}</Text>
                  <View style={styles.pbChipRow}>
                    {([
                      { k: 'solid', en: 'Slept well', es: 'Durmió bien' },
                      { k: 'some', en: 'A few wakes', es: 'Algunos despertares' },
                      { k: 'rough', en: 'Rough (3+)', es: 'Difícil (3+)' },
                    ] as { k: PbNight; en: string; es: string }[]).map((o) => {
                      const on = lastNight === o.k;
                      return (
                        <TouchableOpacity key={o.k} onPress={() => { setLastNight(o.k); setLogOpen(null); }} activeOpacity={0.85}
                          accessibilityRole="button" accessibilityState={{ selected: on }}
                          style={[styles.pbChip, on && styles.pbChipOn]}>
                          <Text style={[styles.pbChipText, on && styles.pbChipTextOn]}>{lang === 'es' ? o.es : o.en}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              {logOpen === 'feed' ? (
                <View style={styles.pbLogExpand}>
                  <Text style={styles.pbLogQ}>{lang === 'es' ? '¿Cuándo fue la última toma?' : 'When was the last feed?'}</Text>
                  <View style={styles.pbChipRow}>
                    {([
                      { en: 'Just now', es: 'Ahora' },
                      { en: '30 min ago', es: 'Hace 30 min' },
                      { en: '1 hr ago', es: 'Hace 1 h' },
                      { en: '2 hr ago', es: 'Hace 2 h' },
                    ]).map((o) => {
                      const label = lang === 'es' ? o.es : o.en;
                      const on = lastFeedLabel === label;
                      return (
                        <TouchableOpacity key={o.en} onPress={() => { setLastFeedLabel(label); setLogOpen(null); }} activeOpacity={0.85}
                          accessibilityRole="button" accessibilityState={{ selected: on }}
                          style={[styles.pbChip, on && styles.pbChipOn]}>
                          <Text style={[styles.pbChipText, on && styles.pbChipTextOn]}>{label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ) : null}
              {!logOpen && (lastNight || lastFeedLabel) ? (
                <View style={styles.pbLoggedRow}>
                  {lastNight ? (
                    <View style={styles.pbLoggedChip}><Text style={styles.pbLoggedChipText}>🌙 {pbNightShort}</Text></View>
                  ) : null}
                  {lastFeedLabel ? (
                    <View style={styles.pbLoggedChip}><Text style={styles.pbLoggedChipText}>🍼 {lastFeedLabel}</Text></View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* Today timeline — a real spine: state-nodes + a detail subline +
                a thin "now" marker line dropped in at the current time. */}
            <Text style={styles.pbSectionLabel}>{lang === 'es' ? 'HOY · MUESTRA' : 'TODAY · SAMPLE'}</Text>
            {lastNight === 'rough' ? (
              <Text style={styles.pbPlanNote}>
                {lang === 'es' ? '↳ Plan más suave hoy — ventanas más cortas, dormir antes.' : '↳ Plan eased for today — shorter wake windows, earlier bed.'}
              </Text>
            ) : null}
            <View style={styles.pbTimeline}>
              {pbDay.map((m, i) => {
                const isNext = i === pbNextIdx;
                const isPast = pbNextIdx === -1 ? true : i < pbNextIdx;
                const isLast = i === pbDay.length - 1;
                return (
                  <React.Fragment key={`${m.clock}-${i}`}>
                    {isNext ? (
                      <View style={styles.pbNowRow}>
                        <Text style={styles.pbNowTime}>{pbNowClock}</Text>
                        <View style={styles.pbNowRail}><View style={styles.pbNowDot} /></View>
                        <View style={styles.pbNowLineWrap}>
                          <View style={styles.pbNowLine} />
                          <Text style={styles.pbNowLabel}>{lang === 'es' ? 'AHORA' : 'NOW'}</Text>
                        </View>
                      </View>
                    ) : null}
                    <View style={styles.pbTlRow}>
                      <Text style={[styles.pbTlTime, isNext && styles.pbTlAccent, isPast && styles.pbTlTimePast]}>{m.clock}</Text>
                      <View style={styles.pbTlRail}>
                        <View style={[styles.pbTlSeg, styles.pbTlSegTop, i === 0 && styles.pbTlSegHidden, (isPast || isNext) && styles.pbTlSegDone]} />
                        <View style={[styles.pbTlNode, isPast && styles.pbTlNodeDone, isNext && styles.pbTlNodeNext]} />
                        <View style={[styles.pbTlSeg, styles.pbTlSegBot, isLast && styles.pbTlSegHidden, isPast && styles.pbTlSegDone]} />
                      </View>
                      <View style={[styles.pbTlBody, isNext && styles.pbTlBodyNext]}>
                        <View style={styles.pbTlHead}>
                          <Text style={styles.pbTlIcon}>{m.icon}</Text>
                          <Text style={[styles.pbTlLabel, isNext && styles.pbTlLabelNext, isPast && styles.pbTlLabelPast]} numberOfLines={1}>{m.label}</Text>
                          {isNext ? (
                            <View style={styles.pbTlNowTag}>
                              <Text style={styles.pbTlNowTagText}>{lang === 'es' ? 'SIGUE' : 'NEXT'}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.pbTlSub, isPast && styles.pbTlSubPast]} numberOfLines={2}>{m.sub}</Text>
                      </View>
                    </View>
                  </React.Fragment>
                );
              })}
            </View>

            {/* Tonight's one thing — a single memorable focus, with an anchor. */}
            <Text style={styles.pbSectionLabel}>{lang === 'es' ? 'LO ÚNICO DE HOY' : "TONIGHT'S ONE THING"}</Text>
            <View style={styles.pbOneThing}>
              <View style={styles.pbOneThingRow}>
                <View style={styles.pbOneThingIcon}><Text style={styles.pbOneThingIconTxt}>✦</Text></View>
                <Text style={styles.pbOneThingTitle}>{pbOneThing.title}</Text>
              </View>
              <Text style={styles.pbOneThingBody}>{pbOneThing.body}</Text>
            </View>

            {/* Adjust your approach — tucked; the plan above reshapes live. */}
            <TouchableOpacity
              style={styles.pbTuneToggle}
              onPress={() => setTuneOpen((v) => !v)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ expanded: tuneOpen }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.pbTuneLabel}>{lang === 'es' ? 'Ajustar enfoque' : 'Adjust your approach'}</Text>
                <Text style={styles.pbTuneSummary} numberOfLines={1}>{pbTuneSummary}</Text>
              </View>
              <Text style={styles.pbTuneChevron}>{tuneOpen ? '⌃' : '⌄'}</Text>
            </TouchableOpacity>
            {tuneOpen ? (
              <View style={styles.pbTunePanel}>
                <Text style={styles.pbGroupLabel}>{lang === 'es' ? 'Sueño' : 'Sleep'}</Text>
                <View style={styles.pbChipRow}>
                  {PB_SLEEP_OPTS.map((o) => {
                    const on = pbSleep === o.key;
                    return (
                      <TouchableOpacity key={o.key} onPress={() => onSetPbSleep(o.key)} activeOpacity={0.85}
                        accessibilityRole="button" accessibilityState={{ selected: on }}
                        style={[styles.pbChip, on && styles.pbChipOn]}>
                        <Text style={[styles.pbChipText, on && styles.pbChipTextOn]}>{lang === 'es' ? o.es : o.en}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.pbGroupLabel}>{lang === 'es' ? 'Alimentación' : 'Feeding'}</Text>
                <View style={styles.pbChipRow}>
                  {PB_FEED_OPTS.map((o) => {
                    const on = pbFeed === o.key;
                    return (
                      <TouchableOpacity key={o.key} onPress={() => onSetPbFeed(o.key)} activeOpacity={0.85}
                        accessibilityRole="button" accessibilityState={{ selected: on }}
                        style={[styles.pbChip, on && styles.pbChipOn]}>
                        <Text style={[styles.pbChipText, on && styles.pbChipTextOn]}>{lang === 'es' ? o.es : o.en}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.pbGroupLabel}>{lang === 'es' ? 'Sólidos' : 'Solids'}</Text>
                <View style={styles.pbChipRow}>
                  {PB_SOLIDS_OPTS.map((o) => {
                    const on = pbSolids === o.key;
                    return (
                      <TouchableOpacity key={o.key} onPress={() => onSetPbSolids(o.key)} activeOpacity={0.85}
                        accessibilityRole="button" accessibilityState={{ selected: on }}
                        style={[styles.pbChip, on && styles.pbChipOn]}>
                        <Text style={[styles.pbChipText, on && styles.pbChipTextOn]}>{lang === 'es' ? o.es : o.en}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <Text style={styles.playbookTeaserFooter}>
              {lang === 'es' ? 'PERSONALIZADO A DIARIO · PARTE DE PRO' : 'PERSONALIZED DAILY · PART OF PRO'}
            </Text>
            <Text style={styles.pbDisclaimer}>
              {lang === 'es'
                ? 'Vista previa de muestra — orientativa, no es consejo médico. Ante cualquier duda, consulta a tu pediatra.'
                : 'Sample preview — illustrative, not medical advice. When in doubt, check with your pediatrician.'}
            </Text>
          </View>
        ) : (
          <>
        {/* Category chip row */}
        <View style={{ marginTop: 18 }}>
          <View style={styles.sectionHead}>
            <Eyebrow>
              {lang === 'es'
                ? 'Categorías del bebé'
                : `${ownerName === 'Your' ? 'Your' : `${ownerName}'s`} categories`}
            </Eyebrow>
            <TouchableOpacity onPress={goToCompleteManual} accessibilityRole="link">
              <Text style={styles.jumpLink}>
                {lang === 'es' ? 'salta semana' : 'tap to jump'} ›
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chipRow}>
            {list.map((c) => {
              const on = c.ch === chapter.ch;
              const tone = CHIP_TONE[c.cat] ?? { bg: T.cinnamon, fg: T.paper };
              return (
                <TouchableOpacity
                  key={c.ch}
                  onPress={() => switchChapter(c)}
                  activeOpacity={0.85}
                  // Active chip fills with the chapter's own (deep) color; text
                  // is white for every chapter, so selection reads consistently.
                  style={[styles.chip, on && styles.chipOn, on && { backgroundColor: tone.bg, borderColor: tone.bg, shadowColor: tone.bg }]}
                >
                  <Text style={[styles.chipLabel, on && styles.chipLabelOn, on && { color: tone.fg }]} numberOfLines={1}>{c.ch}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* SWIPE DECK — replaces the old tap-to-open chapter band. The user
            swipes through a short Stories-style deck for the selected chapter
            instead of navigating into a separate screen. Keyed by category so
            it resets to card 1 when the chapter chip changes.
            (Design-samples-first: card content is illustrative for now.) */}
        <View style={{ paddingHorizontal: 20 }}>
          <ManualSwipeDeck key={chapter.cat} story={manualContent?.story ?? []} category={chapter.cat} />
        </View>

        {/* Below-deck modules: checklist → article/video → infographic —
            the repeatable Manual baseline, driven by manualWeekContent. */}
        {manualContent && <ManualModules content={manualContent} />}

        {/* WEEK PROGRESS BANNER — Phase 4.6 swap: moved to bottom 2026-05-28.
            Reads as a quiet "how am I doing this week" status check after
            the user has scrolled through the chapter content. */}
        <View style={[styles.weekBanner, { marginTop: 28 }]}>
          <LinearGradient
            colors={['rgba(253,251,246,0.28)', 'rgba(253,251,246,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 10 }]}
            pointerEvents="none"
          />
          <GlassHighlight radius={10} height={10} />
          <View style={styles.weekBannerInner}>
            <View style={styles.weekBannerIconChip}>
              <Svg width={13} height={13} viewBox="0 0 24 24">
                <Path d="M5 13l4 4L19 7" stroke={T.moss} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.weekBannerTitle}>
                {lang === 'es'
                  ? (remaining === 1 ? '1 categoría más esta semana.' : `${remaining} categorías más esta semana.`)
                  : (remaining === 1 ? '1 more category to complete this week.' : `${remaining} more categories to complete this week.`)
                }
              </Text>
              <Text style={styles.weekBannerEyebrow}>{lang === 'es' ? 'Tu semana' : 'Your week'}</Text>
            </View>
            <Text style={styles.weekBannerCount}>{doneCount} / {totalChapters}</Text>
          </View>
          <View style={styles.weekBannerProgress}>
            <View style={[styles.weekBannerFill, { width: `${(doneCount / totalChapters) * 100}%` }]} />
          </View>
        </View>
          </>
        )}
      </Animated.ScrollView>

      {/* Hamburger menu */}
      <MenuPanel
        visible={menuOpen}
        onDismiss={() => setMenuOpen(false)}
        anchorRight={anchor.right}
        anchorTop={anchor.top}
      >
        <MenuGroup label={t('manualMenu.groupLibrary')} first>
          <MenuItem
            title={t('manualMenu.completeManual')}
            sub={t('manualMenu.completeManualSub')}
            count="52 wk"
            icon={MENU_ICONS.bookOpen}
            featured
            onPress={closeAnd(goToCompleteManual)}
          />
          <MenuItem
            title={t('manualMenu.savedChapters')}
            sub={t('manualMenu.savedChaptersSub')}
            icon={MENU_ICONS.bookmark}
            onPress={closeAnd(goToSavedChapters)}
          />
          <MenuItem
            title={t('manualMenu.readingHistory')}
            sub={t('manualMenu.readingHistorySub')}
            icon={MENU_ICONS.history}
            onPress={closeAnd(() => placeholder('manualMenu.historyComingTitle', 'manualMenu.historyComingBody'))}
          />
        </MenuGroup>
        <MenuGroup label={t('manualMenu.groupThisChapter')}>
          <MenuItem
            title={t('manualMenu.saveChapter', { chapter: chapter.ch })}
            sub={t('manualMenu.saveChapterSub')}
            icon={MENU_ICONS.save}
            onPress={closeAnd(() => placeholder('manualMenu.saveChapterComingTitle', 'manualMenu.saveChapterComingBody'))}
          />
          <MenuItem
            title={t('manualMenu.shareChapter')}
            sub={t('manualMenu.shareChapterSub')}
            icon={MENU_ICONS.share}
            onPress={closeAnd(shareChapter)}
          />
          <MenuItem
            title={t('manualMenu.printPdf')}
            sub={t('manualMenu.printPdfSub', { chapter: chapter.ch, week })}
            icon={MENU_ICONS.printer}
            onPress={closeAnd(exportChapterPdf)}
          />
        </MenuGroup>
        <MenuGroup label={t('manualMenu.groupMore')}>
          <MenuItem
            title={t('manualMenu.subscribe')}
            sub={t('manualMenu.subscribeSub')}
            icon={MENU_ICONS.mailHeart}
            onPress={closeAnd(() => navigation.getParent()?.navigate('Me' as never, { screen: 'NotificationPreferences' } as never))}
          />
        </MenuGroup>
      </MenuPanel>

      {/* Piece detail overlay — article / illustration / checklist */}
      <ManualPieceOverlay
        visible={overlayPiece !== null}
        onClose={closePieceOverlay}
        piece={overlayPiece}
        chapter={chapter}
        durFallback={lang === 'es' ? '2 min de lectura' : '2 min read'}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper },
  scroll: { paddingTop: 56, paddingBottom: 96 },

  marigoldHaloUnused: {
    position: 'absolute', top: 30, right: -110,
    width: 320, height: 320, borderRadius: 160,
    backgroundColor: 'rgba(242,193,48,0.15)',
  },

  // Header row — paddingHorizontal is added on rows individually so the
  // colored band can run edge-to-edge while everything else is contained.
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 16,
    paddingHorizontal: 22,
  },
  bigTitle: {
    fontFamily: FONTS.v3_display, fontSize: 30, lineHeight: 31,
    color: T.cocoa, letterSpacing: -0.9, marginTop: 6,
  },
  bigTitleItalic: {
    fontFamily: FONTS.v3_display_italic, color: T.salmon,
  },

  // Progress
  progressTrack: {
    marginTop: 14, marginHorizontal: 22,
    height: 3, backgroundColor: T.parchment, borderRadius: 2, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: T.cinnamon },

  // For mom / For baby toggle
  toggleTrack: {
    marginTop: 18, marginHorizontal: 22,
    backgroundColor: T.parchment, borderRadius: 100, padding: 4,
    flexDirection: 'row',
  },
  toggleBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 100, alignItems: 'center',
  },
  toggleBtnOn: {
    backgroundColor: T.paper,
    borderWidth: 1.5, borderColor: T.cinnamon,
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 2,
  },
  toggleLabel: {
    fontFamily: FONTS.v2_label, fontSize: 13, color: T.walnut,
  },
  toggleLabelOn: {
    fontFamily: FONTS.v2_bold, color: T.cocoa,
  },

  // Sections
  sectionHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 8, marginHorizontal: 22,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  jumpLink: {
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.amber, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '500',
  },

  // Chip row
  chipRow: {
    marginTop: 14, marginHorizontal: 22,
    flexDirection: 'row', gap: 8,
  },
  chip: {
    flex: 1, paddingVertical: 10, borderRadius: 999,
    backgroundColor: T.paper,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.10)',
    alignItems: 'center',
  },
  chipOn: {
    backgroundColor: T.cinnamon, borderColor: T.cinnamon,
    shadowColor: T.cinnamon, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.34, shadowRadius: 12, elevation: 3,
  },
  chipLabel: {
    fontFamily: FONTS.v2_link, fontSize: 13, color: T.cocoa,
  },
  chipLabelOn: {
    fontFamily: FONTS.v2_bold, color: T.paper,
  },

  // Week progress banner (sage)
  weekBanner: {
    marginTop: 18, marginHorizontal: 22,
    backgroundColor: T.sage, borderRadius: 10,
    padding: 12, paddingHorizontal: 14,
    overflow: 'hidden',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 20, elevation: 2,
  },
  weekBannerInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  weekBannerIconChip: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(96,110,70,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  weekBannerTitle: {
    fontFamily: FONTS.v2_bold, fontSize: 13, color: T.cocoa,
    lineHeight: 16, letterSpacing: -0.07,
  },
  weekBannerEyebrow: {
    marginTop: 3,
    fontFamily: FONTS.v2_mono, fontSize: 9.5, color: T.moss,
    letterSpacing: 1.7, textTransform: 'uppercase', fontWeight: '600',
  },
  weekBannerCount: {
    fontFamily: FONTS.v2_display_big, fontSize: 18, color: T.cocoa,
    letterSpacing: -0.36,
  },
  weekBannerProgress: {
    marginTop: 10, height: 4,
    backgroundColor: 'rgba(61,31,14,0.12)', borderRadius: 2, overflow: 'hidden',
  },
  weekBannerFill: { height: '100%', backgroundColor: T.moss },
  // Atmospheric bees — scattered low-opacity across the page background,
  // each at a different rotation + size so they read as a swarm not a
  // pattern. Positioned inside the ScrollView contentContainer so they
  // scroll with the content (feels "alive in the page" vs pinned).
  atmosphereBee1: {
    position: 'absolute', top: 120, right: 30,
    width: 28, height: 28,
    transform: [{ rotate: '18deg' }],
    opacity: 0.16,
  },
  atmosphereBee2: {
    position: 'absolute', top: 360, left: 18,
    width: 36, height: 36,
    transform: [{ rotate: '-32deg' }],
    opacity: 0.14,
  },
  atmosphereBee3: {
    position: 'absolute', top: 720, right: 40,
    width: 24, height: 24,
    transform: [{ rotate: '8deg' }],
    opacity: 0.20,
  },
  atmosphereBee4: {
    position: 'absolute', top: 980, left: 60,
    width: 32, height: 32,
    transform: [{ rotate: '-12deg' }],
    opacity: 0.18,
  },

  // Wrapper holds the deep shadow that lifts the band off the page.
  // Separate from the band itself so overflow:hidden on the band can
  // clip the inner gradients without clipping the shadow.
  chapterBandShadowWrap: {
    marginTop: 18,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    shadowColor: '#43260F',                 // cocoa shadow (deeper than walnut)
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  // Colored chapter band — full-bleed identity hero that drapes down from the
  // chips, with rounded bottom corners so it reads as a finished sheet (was a
  // raw edge-to-edge block). Top stays square to butt against the chip row.
  chapterBand: {
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 26,
    overflow: 'hidden',
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
  },
  bandHeadline: {
    fontFamily: FONTS.v3_display, fontSize: 42, lineHeight: 42,
    color: T.cocoa, letterSpacing: -1.6,
    marginTop: 12, marginBottom: 6,
  },
  bandHeadlineDot: {
    fontFamily: FONTS.v3_display_italic, color: T.cinnamon,
  },
  bandSub: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: T.cocoa, opacity: 0.88, maxWidth: 320, marginTop: 4,
  },
  bandCta: {
    marginTop: 14, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 14,
    backgroundColor: '#D96C88', borderRadius: 999,
  },
  bandCtaText: {
    fontFamily: FONTS.v2_link, fontSize: 12, color: T.paper, letterSpacing: 0.4,
  },

  // ─── Piece stream (Phase 4.2) ────────────────────────────────────
  // Outer wrap — slight breathing room after the chapter band's deep
  // shadow, then per-piece marginTop handles inter-piece rhythm.
  streamWrap: {
    paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28,
  },

  // Sections (article / illustration / checklist) share top hairline +
  // generous 26px lead, mirroring the editorial cadence in the handoff
  // (lines 363, 385, 418).
  pieceSection: {
    paddingTop: 26, marginTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  // Checklist sits in its own inset card (was full-bleed, edge-to-edge,
  // which read "loose" next to the inset chips + piece stream). Same 22px
  // horizontal inset as streamWrap so every block below the hero band lines up.
  checklistSection: { marginTop: 22, paddingHorizontal: 22 },

  // Every stream piece below the video is now an eyebrow + a contained card,
  // separated by a consistent gap (no redundant hairlines) — a clean card
  // stack that mirrors the Playbook.
  pieceCardWrap: { marginTop: 18 },
  pieceArticleCard: { paddingVertical: 16, paddingHorizontal: 16 },

  // Video piece — no top divider, sits closer to the chapter band so it
  // reads as "what's on the table for this chapter."
  pieceVideoWrap: { paddingTop: 18 },
  pieceVideoHero: {
    width: '100%', aspectRatio: 16 / 10,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  pieceVideoPlay: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(253,251,246,0.96)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22, shadowRadius: 22, elevation: 6,
  },
  pieceVideoDur: {
    position: 'absolute', bottom: 10, right: 10,
    paddingVertical: 4, paddingHorizontal: 9, borderRadius: 4,
    backgroundColor: 'rgba(61,31,14,0.72)',
  },
  pieceVideoDurText: {
    fontFamily: FONTS.v2_mono, fontSize: 10, fontWeight: '600',
    color: T.paper, letterSpacing: 1.2,
  },
  pieceVideoBody: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  pieceVideoTitle: {
    fontFamily: FONTS.v3_display, fontSize: 20, lineHeight: 23,
    color: T.cocoa, letterSpacing: -0.5,
  },
  pieceVideoExpert: {
    marginTop: 6,
    fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut,
  },

  // Article piece
  pieceArticleTitle: {
    fontFamily: FONTS.v3_display, fontSize: 26, lineHeight: 28,
    color: T.cocoa, letterSpacing: -0.72,
  },
  pieceArticleExcerpt: {
    marginTop: 10, marginBottom: 14,
    fontFamily: FONTS.v2_body, fontSize: 14.5, lineHeight: 22,
    color: T.cocoa,
  },
  pieceArticleCta: {
    fontFamily: FONTS.v2_mono, fontSize: 11,
    color: T.cinnamon, letterSpacing: 2.2,
    textTransform: 'uppercase', fontWeight: '700',
  },

  // Smaller display title used by illustration + checklist sections.
  pieceArticleTitleSmall: {
    fontFamily: FONTS.v3_display, fontSize: 22, lineHeight: 24,
    color: T.cocoa, letterSpacing: -0.48, marginBottom: 14,
  },

  // Illustration piece
  illustrationCardInner: {
    paddingVertical: 8, paddingHorizontal: 16,
  },
  illustrationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8,
  },
  illustrationRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  illustrationAge: {
    width: 56,
    fontFamily: FONTS.v2_body, fontSize: 11.5,
    fontWeight: '500', color: T.walnut,
  },
  illustrationAgeCurrent: {
    fontWeight: '700', color: T.cocoa,
  },
  illustrationTrack: {
    flex: 1, height: 11, borderRadius: 2,
    backgroundColor: T.parchment, overflow: 'hidden',
  },
  illustrationFill: { height: '100%' },
  illustrationRange: {
    width: 64, textAlign: 'right',
    fontFamily: FONTS.v2_mono, fontSize: 10,
    color: T.walnut, fontWeight: '500',
    letterSpacing: 0.4,
  },
  illustrationRangeCurrent: {
    color: T.cocoa, fontWeight: '700',
  },
  illustrationCaption: {
    marginTop: 10, marginHorizontal: 4,
    fontFamily: FONTS.v2_body, fontSize: 12, lineHeight: 17,
    color: T.amber,
  },

  // V5 Phase 5.1 — Playbook coming-soon teaser styles.
  // Mirrors the chapter band's lift recipe + adds a soft cinnamon halo
  // so it reads as "the same Manual surface, just empty for now," not a
  // visually disconnected page.
  playbookTeaserWrap: {
    marginTop: 24,
    backgroundColor: T.paper,
    borderRadius: 22,
    paddingHorizontal: 22, paddingTop: 22, paddingBottom: 24,
    borderWidth: 1, borderColor: 'rgba(192,120,64,0.22)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: T.cocoa,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 4,
  },
  playbookTeaserHalo: {
    position: 'absolute',
    top: -48, right: -48,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: T.butter, opacity: 0.28,
  },
  playbookTeaserTitle: {
    marginTop: 10,
    fontFamily: FONTS.v3_display, fontSize: 30, lineHeight: 32,
    color: T.cocoa, letterSpacing: -0.9, fontWeight: '700',
  },
  playbookTeaserTitleEm: {
    fontFamily: FONTS.v3_display_italic, color: T.cinnamon, fontWeight: '600',
  },
  playbookTeaserBody: {
    marginTop: 10,
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: T.walnut,
  },
  playbookTeaserBullets: {
    marginTop: 14, gap: 6,
  },
  playbookTeaserBullet: {
    fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 19,
    color: T.cocoa,
  },
  playbookTeaserFooter: {
    marginTop: 18,
    fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 1.6,
    textTransform: 'uppercase', fontWeight: '500',
    color: T.amber,
  },
  // ── Playbook preview (V5 5.1.5) ──
  pbSectionLabel: {
    marginTop: 22, marginBottom: 10,
    fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 2,
    textTransform: 'uppercase', fontWeight: '500', color: T.cinnamon,
  },
  pbGroupLabel: {
    marginTop: 10, marginBottom: 7,
    fontFamily: FONTS.v2_body, fontSize: 12.5, fontWeight: '600', color: T.walnut,
  },
  pbChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  pbChip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999,
    backgroundColor: T.parchment, borderWidth: 1, borderColor: 'transparent',
  },
  pbChipOn: { backgroundColor: T.cinnamon, borderColor: T.cinnamon },
  pbChipText: { fontFamily: FONTS.v2_body, fontSize: 13, fontWeight: '600', color: T.walnut },
  pbChipTextOn: { color: '#FFFCF6' },
  pbPlanCard: {
    marginTop: 18, borderRadius: 16, padding: 16,
    backgroundColor: 'rgba(192,120,64,0.07)',
    borderWidth: 1, borderColor: 'rgba(192,120,64,0.16)',
  },
  pbPlanLabel: {
    marginBottom: 10,
    fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '500', color: T.amber,
  },
  pbPlanRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 8 },
  pbPlanEmoji: { fontSize: 16, lineHeight: 21, width: 22, textAlign: 'center' },
  pbPlanText: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 20, color: T.cocoa },
  pbPlayCard: {
    marginTop: 10, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13,
    backgroundColor: T.card, borderWidth: 1, borderColor: T.rule,
  },
  pbPlayTitle: {
    fontFamily: FONTS.v3_display, fontSize: 17, lineHeight: 21,
    color: T.cocoa, fontWeight: '700', letterSpacing: -0.3,
  },
  pbPlayBody: {
    marginTop: 5, fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 19, color: T.walnut,
  },
  pbDisclaimer: {
    marginTop: 12, fontFamily: FONTS.v2_body, fontSize: 11, lineHeight: 16,
    fontStyle: 'italic', color: T.amber,
  },
  // ── Playbook restructure (V5 5.1.6 — "one glance, one move") ──
  pbWrap: { marginTop: 22 },
  pbHero: {
    borderRadius: 22, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22,
    backgroundColor: '#FBEFD9', overflow: 'hidden', position: 'relative',
    borderWidth: 1, borderColor: 'rgba(192,120,64,0.18)',
    shadowColor: T.cocoa, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14, shadowRadius: 22, elevation: 4,
  },
  pbHeroNight: { backgroundColor: T.cocoa, borderColor: 'rgba(252,247,239,0.14)' },
  pbHeroEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 2, paddingRight: 58,
    textTransform: 'uppercase', fontWeight: '500', color: T.cinnamon,
  },
  pbHeroEyebrowNight: { color: T.butter },
  pbFriend: {
    marginTop: 8, paddingRight: 58, fontFamily: FONTS.v2_body, fontSize: 15.5, lineHeight: 22,
    fontWeight: '600', color: T.cocoa,
  },
  pbTextNight: { color: '#FCF7EF' },
  pbDeck: {
    marginTop: 7, fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 20, color: T.walnut,
  },
  pbDeckNight: { color: 'rgba(252,247,239,0.78)' },
  pbHeroDivider: { height: 1, backgroundColor: 'rgba(61,31,14,0.12)', marginTop: 16, marginBottom: 14 },
  pbHeroDividerNight: { backgroundColor: 'rgba(252,247,239,0.16)' },
  pbNextLabel: {
    fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '500', color: T.amber,
  },
  pbDimNight: { color: 'rgba(252,247,239,0.6)' },
  pbNextRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6 },
  pbNextIcon: { fontSize: 18, lineHeight: 24 },
  pbNextMove: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 15, lineHeight: 21, fontWeight: '600', color: T.cocoa },
  pbNextTimeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, marginTop: 6 },
  pbNextTime: {
    fontFamily: FONTS.v3_display, fontSize: 38, lineHeight: 42,
    fontWeight: '800', color: T.cinnamon, letterSpacing: -1.2,
  },
  pbNextTimeSuffix: { fontFamily: FONTS.v3_display, fontSize: 18, fontWeight: '700' },
  pbRelChip: {
    backgroundColor: 'rgba(192,120,64,0.14)', borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 5, marginBottom: 8,
  },
  pbRelChipNight: { backgroundColor: 'rgba(244,197,60,0.16)' },
  pbRelChipText: { fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 0.4, fontWeight: '600', color: T.cinnamon },
  pbAccentNight: { color: T.butter },
  pbStreakRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, paddingHorizontal: 4,
  },
  pbHeroStreak: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(61,31,14,0.12)',
  },
  pbHeroStreakNight: { borderTopColor: 'rgba(252,247,239,0.18)' },
  // Log-today card (V5 5.1.8 — unified containment)
  pbLogCard: {
    marginTop: 4, backgroundColor: T.card, borderRadius: 18, padding: 14,
    borderWidth: 1, borderColor: T.rule,
    shadowColor: T.cocoa, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06, shadowRadius: 12, elevation: 2,
  },
  pbCardEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase',
    fontWeight: '500', color: T.amber, marginBottom: 10,
  },
  pbLogSeg: {
    flexDirection: 'row', alignItems: 'stretch', borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(192,120,64,0.22)', backgroundColor: T.paper,
  },
  pbLogSegBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  pbLogSegBtnOn: { backgroundColor: 'rgba(192,120,64,0.10)' },
  pbLogSegText: { fontFamily: FONTS.v2_body, fontSize: 14, fontWeight: '600', color: T.cocoa },
  pbLogSegTextOn: { color: T.cinnamon },
  pbLogSegDivider: { width: 1, backgroundColor: 'rgba(192,120,64,0.22)' },
  pbLogExpand: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.rule },
  pbLoggedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: T.rule },
  pbLoggedChip: { backgroundColor: 'rgba(192,120,64,0.10)', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  pbLoggedChipText: { fontFamily: FONTS.v2_body, fontSize: 12.5, fontWeight: '600', color: T.walnut },
  pbStreakText: { fontFamily: FONTS.v2_body, fontSize: 12.5, fontWeight: '600', color: T.amber },
  pbStreakDots: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pbHex: { fontSize: 13, lineHeight: 16 },
  pbHexOn: { color: T.cinnamon },
  pbHexOff: { color: 'rgba(192,120,64,0.28)' },
  pbTimeline: {
    marginTop: 4, backgroundColor: T.card, borderRadius: 16,
    borderWidth: 1, borderColor: T.rule, paddingHorizontal: 10, paddingVertical: 6,
  },
  pbTlRow: { flexDirection: 'row', alignItems: 'stretch', minHeight: 58 },
  pbTlTime: {
    width: 58, fontFamily: FONTS.v2_mono, fontSize: 11, color: T.amber,
    letterSpacing: 0.2, textAlign: 'right', paddingRight: 10, paddingTop: 18,
  },
  pbTlTimePast: { color: 'rgba(122,74,36,0.45)' },
  pbTlAccent: { color: T.cinnamon, fontWeight: '700' },
  pbTlRail: { width: 22, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  pbTlSeg: { position: 'absolute', left: 10, width: 2, backgroundColor: 'rgba(192,120,64,0.16)' },
  pbTlSegTop: { top: 0, height: '50%' },
  pbTlSegBot: { bottom: 0, height: '50%' },
  pbTlSegHidden: { backgroundColor: 'transparent' },
  pbTlSegDone: { backgroundColor: 'rgba(192,120,64,0.5)' },
  pbTlNode: {
    width: 12, height: 12, borderRadius: 6, borderWidth: 2,
    borderColor: 'rgba(192,120,64,0.32)', backgroundColor: T.card, zIndex: 2,
  },
  pbTlNodeDone: { backgroundColor: T.cinnamon, borderColor: T.cinnamon },
  pbTlNodeNext: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: T.cinnamon, backgroundColor: T.card },
  pbTlBody: { flex: 1, justifyContent: 'center', paddingVertical: 11, paddingLeft: 4, paddingRight: 4 },
  pbTlBodyNext: {
    backgroundColor: 'rgba(192,120,64,0.06)', borderRadius: 10,
    marginVertical: 5, paddingHorizontal: 10,
  },
  pbTlHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pbTlIcon: { fontSize: 14, width: 20, textAlign: 'center' },
  pbTlLabel: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 14, color: T.cocoa },
  pbTlLabelNext: { fontWeight: '700' },
  pbTlLabelPast: { color: 'rgba(61,31,14,0.55)' },
  pbTlNowTag: { backgroundColor: T.cinnamon, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pbTlNowTagText: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1, fontWeight: '700', color: '#FCF7EF' },
  pbTlSub: { marginLeft: 28, marginTop: 2, fontFamily: FONTS.v2_body, fontSize: 11.5, lineHeight: 15, color: T.amber },
  pbTlSubPast: { color: 'rgba(122,74,36,0.4)' },
  pbOneThing: {
    marginTop: 4, borderRadius: 16, padding: 16,
    backgroundColor: 'rgba(192,120,64,0.07)', borderWidth: 1, borderColor: 'rgba(192,120,64,0.18)',
  },
  pbOneThingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  pbOneThingIcon: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: T.cinnamon,
    alignItems: 'center', justifyContent: 'center',
  },
  pbOneThingIconTxt: { color: '#FCF7EF', fontSize: 13, lineHeight: 16, fontWeight: '700' },
  pbOneThingTitle: {
    flex: 1, fontFamily: FONTS.v3_display, fontSize: 18, lineHeight: 22,
    color: T.cocoa, fontWeight: '700', letterSpacing: -0.3,
  },
  pbOneThingBody: { fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 20, color: T.walnut },
  pbTuneToggle: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginTop: 22, borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13,
    backgroundColor: T.parchment,
  },
  pbTuneLabel: { fontFamily: FONTS.v2_body, fontSize: 14, fontWeight: '600', color: T.cocoa },
  pbTuneSummary: { marginTop: 2, fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut },
  pbTuneChevron: { fontFamily: FONTS.v2_body, fontSize: 16, fontWeight: '700', color: T.walnut },
  pbTunePanel: { marginTop: 12 },
  // ── Playbook: progress ring, quick-log, now-marker (V5 5.1.7) ──
  pbRing: { position: 'absolute', top: 16, right: 16, width: 52, height: 52 },
  pbRingLabel: {
    position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
    textAlign: 'center', lineHeight: 52, fontFamily: FONTS.v2_mono,
    fontSize: 11, fontWeight: '700', color: T.cinnamon,
  },
  pbTunedPill: {
    alignSelf: 'flex-start', marginTop: 10, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 5, backgroundColor: 'rgba(192,120,64,0.13)',
  },
  pbTunedPillNight: { backgroundColor: 'rgba(244,197,60,0.16)' },
  pbTunedPillText: { fontFamily: FONTS.v2_body, fontSize: 11.5, fontWeight: '600', color: T.cinnamon },
  pbLogRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  pbLogBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: 14, backgroundColor: T.card,
    borderWidth: 1.5, borderColor: 'rgba(192,120,64,0.28)',
  },
  pbLogBtnOn: { borderColor: T.cinnamon, backgroundColor: 'rgba(192,120,64,0.07)' },
  pbLogIcon: { fontSize: 15 },
  pbLogBtnText: { fontFamily: FONTS.v2_body, fontSize: 14, fontWeight: '600', color: T.cocoa },
  pbLogPanel: { marginTop: 10, borderRadius: 14, padding: 14, backgroundColor: T.parchment },
  pbLogQ: { fontFamily: FONTS.v2_body, fontSize: 13.5, fontWeight: '600', color: T.cocoa, marginBottom: 10 },
  pbLogConfirm: { marginTop: 10, paddingHorizontal: 2, fontFamily: FONTS.v2_body, fontSize: 12.5, fontWeight: '600', color: T.amber },
  pbPlanNote: { marginBottom: 8, fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 17, fontWeight: '600', color: T.cinnamon },
  pbNowRow: { flexDirection: 'row', alignItems: 'center', height: 24 },
  pbNowTime: { width: 58, textAlign: 'right', paddingRight: 10, fontFamily: FONTS.v2_mono, fontSize: 10, fontWeight: '700', color: T.cinnamon },
  pbNowRail: { width: 22, alignItems: 'center', justifyContent: 'center' },
  pbNowDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: T.cinnamon },
  pbNowLineWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  pbNowLine: { flex: 1, height: 1.5, borderRadius: 1, backgroundColor: T.cinnamon, opacity: 0.5 },
  pbNowLabel: { fontFamily: FONTS.v2_mono, fontSize: 8.5, letterSpacing: 1.2, fontWeight: '700', color: T.cinnamon },

  // Checklist piece — compact recipe (2026-05-29 per Felipe: less bulk,
  // so the chapter band can lead and the checklist doesn't dominate the
  // viewport).
  checklistTitle: {
    fontFamily: FONTS.v3_display, fontSize: 18, lineHeight: 22,
    color: T.cocoa, letterSpacing: -0.4, marginBottom: 10,
  },
  checklistRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 9, paddingHorizontal: 12,
  },
  checklistRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  checkbox: {
    width: 18, height: 18, borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  checklistStep: {
    flex: 1,
    fontFamily: FONTS.v2_body, fontSize: 13,
    color: T.cocoa, lineHeight: 17,
  },
  checklistStepDone: {
    color: T.walnut,
    textDecorationLine: 'line-through',
    textDecorationColor: T.amber,
  },
});
