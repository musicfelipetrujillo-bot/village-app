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
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import {
  MenuButton, MenuPanel, MenuGroup, MenuItem, MENU_ICONS,
} from '@components/shared/HamburgerMenu';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { GlassHighlight } from '@components/shared/GlassHighlight';
import { V3Card } from '@components/shared/V3Card';
import { ManualPieceOverlay, type OverlayPiece } from '@screens/manual/ManualPieceOverlay';
import { useFocusEffect } from '@react-navigation/native';
import { Animated } from 'react-native';

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

// ─── Chapter sub-palette (Sleep/Feed/Grow/Care/Wins ; Feel/Heal/etc) ──
type ChapterMeta = { ch: string; cat: string; bg: string; fg: string };

const BABY_CHAPTERS: ChapterMeta[] = [
  // Sleep — was sage-olive #DAE0BC, swapped to warm caramel per Felipe's
  // call ("don't really love those greens on the baby's manual"). Reads
  // as "warm milk before bed" — calming + on-brand vs olive.
  { ch: 'Sleep', cat: 'sleep', bg: T.caramel, fg: T.cocoa },
  { ch: 'Feed',  cat: 'feed',  bg: T.butter,  fg: T.cocoa },
  { ch: 'Grow',  cat: 'grow',  bg: T.blush,   fg: T.cocoa },
  { ch: 'Care',  cat: 'care',  bg: '#F2C0C8', fg: T.cocoa },
  { ch: 'Wins',  cat: 'tips',  bg: T.marigold, fg: T.cocoa },
];

const MOM_CHAPTERS: ChapterMeta[] = [
  { ch: 'Feel',    cat: 'feel',    bg: T.blush,   fg: T.cocoa },
  { ch: 'Heal',    cat: 'heal',    bg: '#DAE0BC', fg: T.cocoa },
  { ch: 'Nourish', cat: 'nourish', bg: T.butter,  fg: T.cocoa },
  { ch: 'Rest',    cat: 'rest',    bg: T.parchment, fg: T.cocoa },
  { ch: 'Tips',    cat: 'tips',    bg: T.marigold, fg: T.cocoa },
];

// Static handoff intro copy per chapter — replaces the SUB_LEAD map
// in the v9 ManualCategoryScreen. Wire to milestone_library in Phase 4.2.
const CHAPTER_INTRO: Record<string, string> = {
  Sleep: 'What\'s normal at this week. What\'s not.',
  Feed:  'Cluster feeding is exhaustion, not failure.',
  Grow:  'The leap that breaks the routine, and what comes next.',
  Care:  'Common rashes, bumps, and when to call.',
  Wins:  'The small things moms wish they knew week one.',
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
  Sleep: T.caramel, Feed: T.butter, Grow: T.blush, Care: '#F2C0C8', Wins: T.marigold,
  Feel: T.blush, Heal: '#DAE0BC', Nourish: T.butter, Rest: T.parchment, Tips: T.marigold,
};

const PIECES_BY_CHAPTER: Record<string, Piece[]> = {
  // ── BABY ────────────────────────────────────────────────────────────
  Sleep: [
    { kind: 'video', num: '01', title: 'Why your 6-month-old is suddenly waking.',
      expert: 'Dr. A. Rodriguez · IBCLC', dur: '1:55' },
    { kind: 'article', num: '02', title: 'Separation anxiety wakings.', dur: '4 min read',
      excerpt: 'What looks like regression at six months is, almost always, exactly what’s supposed to happen — three big leaps landing in the same week.' },
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
      excerpt: 'Around four months, intake plateaus while distractibility doubles. Less time on the breast doesn’t mean less milk — it means more efficient transfer.' },
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
      excerpt: 'The same syllable, over and over — ba ba ba — isn’t random. It’s the practice ground for the first real word, usually three to six weeks away.' },
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
      excerpt: '100.4°F under three months is an ER call. Over six months, it’s the behavior — not the number — that tells you whether to wait or page the nurse line.' },
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
  Wins: [
    { kind: 'video', num: '01', title: 'The burp at the switch.',
      expert: 'Annie R. · doula', dur: '1:18' },
    { kind: 'article', num: '02', title: 'Small things week one.', dur: '2 min read',
      excerpt: 'The half-second she focused on your face. The way his foot tucked into your palm. These count. Write them down before you forget.' },
    { kind: 'illustration', num: '03', title: 'Wins, mapped by week.',
      caption: 'Most parents log six to eight tiny wins in week 26 — usually around sleep and feed transitions.' },
    { kind: 'checklist', num: '04', title: 'Today’s three.',
      steps: [
        'One thing she did that was new.',
        'One thing you did that worked.',
        'One thing someone else noticed.',
      ] },
  ],
  // ── MOM ─────────────────────────────────────────────────────────────
  Feel: [
    { kind: 'video', num: '01', title: 'The postpartum brain isn’t broken.',
      expert: 'Dr. S. Patel · perinatal psych', dur: '2:45' },
    { kind: 'article', num: '02', title: 'When the village goes quiet.', dur: '6 min read',
      excerpt: 'Month four is when the texts thin out. The baby is "easy" by now, the casseroles stopped, and yet — this is often the heaviest stretch.' },
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
      excerpt: 'C-section scars keep maturing for a full year. Tightness at month six is normal; numbness that’s shrinking is the body re-mapping itself.' },
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
      excerpt: 'Postpartum thirst rivals pregnancy thirst. A glass of water before each feed beats a third espresso by 4 p.m. — every time.' },
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
      <Text style={styles.pieceArticleTitleSmall}>{piece.title}</Text>
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

// ─── Screen ────────────────────────────────────────────────────────────
export default function ManualScrollV3() {
  const navigation = useNavigation<any>();
  const t = useT();
  const profile = useUserStore((s) => s.profile);
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const lang = (profile?.preferred_language ?? 'en') as 'en' | 'es';

  // Route params allow deep-linking from Home into a specific chapter
  // (e.g. tapping "Sleep · Separation anxiety wakings" on the Home
  // hero TOC). When passed, the screen initializes audience + chapter
  // from the params; otherwise defaults to baby / first chapter.
  const route = useRoute();
  const initialParams = route.params as
    | { audience?: 'mom' | 'baby'; chapter?: string }
    | undefined;
  const initialWho: 'mom' | 'baby' = initialParams?.audience ?? 'baby';
  const initialList = initialWho === 'baby' ? BABY_CHAPTERS : MOM_CHAPTERS;
  const initialChapter = (
    initialParams?.chapter
      ? initialList.find((c) => c.ch === initialParams.chapter) ?? initialList[0]
      : initialList[0]
  );

  const [who, setWho] = useState<'mom' | 'baby'>(initialWho);
  const list = who === 'baby' ? BABY_CHAPTERS : MOM_CHAPTERS;
  const [chapter, setChapter] = useState<ChapterMeta>(initialChapter);

  // Switch audience → reset to first chapter of new list
  const switchWho = (next: 'mom' | 'baby') => {
    setWho(next);
    const nextList = next === 'baby' ? BABY_CHAPTERS : MOM_CHAPTERS;
    setChapter(nextList[0]);
  };

  // Tap-to-jump: chip click sets selected chapter (and could scroll
  // band into view; deferred). Tap chapter band to open full chapter
  // screen (existing ManualCategoryScreen).
  const switchChapter = (next: ChapterMeta) => setChapter(next);
  const openSelectedChapter = () => {
    navigation.navigate('ManualCategory' as never, {
      audience: who, category: chapter.cat, label: chapter.ch,
    } as never);
  };

  // Static for the preview — wire to user progress in Phase 4.2.
  const doneCount = 2;
  const remaining = 5 - doneCount;
  const week = Math.max(1, babyProfile?.current_week_number ?? 1);
  const ownerName = who === 'baby' ? (babyProfile?.baby_name ?? 'Baby') : 'Your';

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
  const goToCompleteManual = () => navigation.navigate('ManualHome' as never);
  const goToSavedChapters = () => navigation.navigate('SavedManual' as never);
  const placeholder = (titleKey: string, bodyKey: string) =>
    Alert.alert(t(titleKey), t(bodyKey));
  const shareChapter = async () => {
    const url = `https://villieapp.com/m/?c=${who}-${chapter.cat}`;
    try {
      await Share.share({ message: `${chapter.ch} · week ${week} · villie\n${url}` });
    } catch { /* user cancelled */ }
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
    navigation.navigate('ManualVideo' as never, {
      audience: who, category: chapter.cat, videoId: video.id,
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

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop scrollY={scrollY} triggerAnim={triggerAnim} />
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
              {who === 'baby' ? `${ownerName}'s ` : 'Your '}
              <Text style={styles.bigTitleItalic}>manual.</Text>
            </Text>
          </View>
          <View ref={triggerRef} collapsable={false} style={{ paddingTop: 12 }}>
            <MenuButton onPress={openMenu} expanded={menuOpen} a11yLabel={t('manualMenu.triggerA11y')} />
          </View>
        </View>

        {/* Progress bar — 3px cinnamon fill */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(doneCount / 5) * 100}%` }]} />
        </View>

        {/* For mom / For baby toggle — embossed parchment track */}
        <View style={styles.toggleTrack}>
          {(['mom', 'baby'] as const).map((opt) => {
            const on = who === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => switchWho(opt)}
                activeOpacity={0.85}
                style={[styles.toggleBtn, on && styles.toggleBtnOn]}
              >
                <Text style={[styles.toggleLabel, on && styles.toggleLabelOn]}>
                  {opt === 'mom' ? (lang === 'es' ? 'Para mamá' : 'For mom') : (lang === 'es' ? 'Para el bebé' : 'For baby')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Category chip row */}
        <View style={{ marginTop: 18 }}>
          <View style={styles.sectionHead}>
            <Eyebrow>
              {lang === 'es'
                ? `${who === 'baby' ? 'Categorías del bebé' : 'Tus categorías'}`
                : `${ownerName === 'Your' || who === 'mom' ? 'Your' : `${ownerName}'s`} categories`}
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
              return (
                <TouchableOpacity
                  key={c.ch}
                  onPress={() => switchChapter(c)}
                  activeOpacity={0.85}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipLabel, on && styles.chipLabelOn]} numberOfLines={1}>{c.ch}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* TOP CHECKLIST — Phase 4.6 swap (2026-05-28 per Felipe):
            the actionable weekly checklist now sits FIRST so the page
            opens with something a sleep-deprived mom can DO right now.
            The progress meter (X/5 categories) moves to the bottom of
            the stream so it reads as a reward / status, not the lead. */}
        {(() => {
          const dbChecklist = chapterPieces.find((p) => p.kind === 'checklist');
          const checklistPiece: Piece | undefined = dbChecklist
            ? {
                kind: 'checklist',
                num: dbChecklist.num,
                title: dbChecklist.title,
                steps: dbChecklist.steps ?? [],
              }
            : (PIECES_BY_CHAPTER[chapter.ch] ?? []).find((p) => p.kind === 'checklist');
          if (!checklistPiece) return null;
          return (
            <TouchableOpacity
              onPress={() => openPieceOverlay(checklistPiece)}
              activeOpacity={0.85}
              style={[styles.pieceSection, { marginTop: 18 }]}
            >
              <ChecklistPiece
                piece={checklistPiece as Extract<Piece, { kind: 'checklist' }>}
                accentBg={chapter.bg}
                accentFg={chapter.fg}
              />
            </TouchableOpacity>
          );
        })()}

        {/* COLORED CHAPTER BAND — full-width identity surface with depth.
            Three-layer lift recipe (Felipe: "more depth, looks paper thin"):
            1. Inner top highlight gradient — light from above
            2. Cocoa-tinted floating shadow — band hovers off the page
            3. Hairline cocoa edge at top + bottom — band has thickness */}
        <View style={styles.chapterBandShadowWrap} pointerEvents="box-none">
          <TouchableOpacity
            activeOpacity={0.92}
            onPress={openSelectedChapter}
            style={[styles.chapterBand, { backgroundColor: chapter.bg }]}
          >
          {/* Top warm-paper highlight — "light hitting it from above" */}
          <LinearGradient
            colors={['rgba(253,251,246,0.38)', 'rgba(253,251,246,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          {/* iOS-26 wet-glass sheen — same recipe as the daily check-in
              card so the band reads with the same immersive depth, not
              flat color slab. */}
          <GlassHighlight radius={0} height={14} />
          {/* Bottom inner shadow — subtle inset so the lower edge has weight */}
          <LinearGradient
            colors={['rgba(61,31,14,0)', 'rgba(61,31,14,0.12)']}
            start={{ x: 0, y: 0.7 }} end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <Eyebrow color={T.cocoa}>
            {chapter.ch} · {lang === 'es' ? `semana ${week} de 52` : `week ${week} of 52`}
          </Eyebrow>
          <Text style={styles.bandHeadline}>
            {chapter.ch}<Text style={styles.bandHeadlineDot}>.</Text>
          </Text>
          <Text style={styles.bandSub}>{CHAPTER_INTRO[chapter.ch] ?? ''}</Text>
          <View style={styles.bandCta}>
            <Text style={styles.bandCtaText}>
              {lang === 'es' ? 'Abrir capítulo' : 'Open chapter'} →
            </Text>
          </View>
          </TouchableOpacity>
        </View>

        {/* ─── PIECE STREAM (Phase 4.2) ───────────────────────────────
            4 mixed pieces per chapter — video, article, illustration,
            checklist — rendered inline so the chapter scrolls to its
            own end without a detail-screen detour. Tap a video or
            article to open ManualCategoryScreen for the production
            read experience (full Mux player + article body) until 4.3
            wires individual piece detail screens. */}
        <View style={styles.streamWrap}>
          {/* Phase 4.5 — prefer DB-authored pieces when the bucket has
              any rows; fall back to the hand-authored PIECES_BY_CHAPTER
              otherwise. Bucket-by-bucket rollout: as clinical-advisor
              authoring lands, the DB rows automatically take over.
              We map ManualPiece → Piece so the existing render branches
              stay unchanged. The video kind always comes from
              PIECES_BY_CHAPTER (videos live in manual_videos, not
              manual_pieces) — it gets prepended below so the canonical
              "watch → read → see → do" cadence is preserved. */}
          {(() => {
            const fallback = PIECES_BY_CHAPTER[chapter.ch] ?? [];
            const videoPiece = fallback.find((p) => p.kind === 'video');
            const fallbackNonVideo = fallback.filter((p) => p.kind !== 'video');
            // Phase 4.6 swap: checklist now renders at the TOP of the page,
            // so drop it from the inline stream to avoid double-rendering.
            const dbNonVideo: Piece[] = chapterPieces
              .filter((p) => p.kind === 'article' || p.kind === 'illustration')
              .map((p): Piece => {
                if (p.kind === 'article') {
                  return {
                    kind: 'article', num: p.num, title: p.title,
                    dur: p.dur ?? '3 min read', excerpt: p.excerpt ?? '',
                  };
                }
                return {
                  kind: 'illustration', num: p.num, title: p.title,
                  caption: p.caption ?? '',
                };
              });
            const nonVideo = dbNonVideo.length > 0
              ? dbNonVideo
              : fallbackNonVideo.filter((p) => p.kind !== 'checklist');
            return [videoPiece, ...nonVideo].filter((x): x is Piece => Boolean(x));
          })().map((p, i) => {
            if (p.kind === 'video') {
              // Phase 4.3 — prefer the real first video in this chapter's
              // Mux bucket. Hand-authored copy survives as the fallback so
              // unseeded chapters still render a complete card.
              const real = firstVideo;
              const heroTitle = real?.title ?? p.title;
              const heroDur = real
                ? formatDuration(real.duration_seconds)
                : p.dur;
              const heroByline = real
                ? (real.is_watched
                    ? (lang === 'es' ? 'Visto' : 'Watched')
                    : p.expert)
                : p.expert;
              const onPress = real
                ? () => openVideo(real)
                : openSelectedChapter;
              return (
                <View key={`${chapter.ch}-${i}`} style={styles.pieceVideoWrap}>
                  <PieceLabel kind="video" num={p.num} />
                  <V3Card pressable={onPress} contentStyle={{ overflow: 'hidden' }}>
                    {/* Hero — real Mux thumb if present, else chapter tint */}
                    <View style={[
                      styles.pieceVideoHero,
                      { backgroundColor: chapter.bg },
                    ]}>
                      {real?.thumbnail_url ? (
                        <Image
                          source={{ uri: real.thumbnail_url }}
                          style={StyleSheet.absoluteFillObject as any}
                          resizeMode="cover"
                        />
                      ) : null}
                      {/* Top→bottom wash: lightens top, darkens bottom for
                          legibility of the play button + duration pill */}
                      <LinearGradient
                        colors={['rgba(253,251,246,0.28)', 'rgba(61,31,14,0.32)']}
                        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                        style={StyleSheet.absoluteFillObject}
                        pointerEvents="none"
                      />
                      <View style={styles.pieceVideoPlay}>
                        <Svg width={22} height={22} viewBox="0 0 24 24">
                          <Path d="M7 4 L21 12 L7 20 Z" fill={T.cocoa} />
                        </Svg>
                      </View>
                      <View style={styles.pieceVideoDur}>
                        <Text style={styles.pieceVideoDurText}>{heroDur}</Text>
                      </View>
                    </View>
                    <View style={styles.pieceVideoBody}>
                      <Text style={styles.pieceVideoTitle}>{heroTitle}</Text>
                      <Text style={styles.pieceVideoExpert}>{heroByline}</Text>
                    </View>
                  </V3Card>
                </View>
              );
            }
            if (p.kind === 'article') {
              return (
                <TouchableOpacity
                  key={`${chapter.ch}-${i}`}
                  onPress={() => openPieceOverlay(p)}
                  activeOpacity={0.85}
                  style={styles.pieceSection}
                >
                  <PieceLabel kind="article" num={p.num} />
                  <Text style={styles.pieceArticleTitle}>{p.title}</Text>
                  <Text style={styles.pieceArticleExcerpt}>{p.excerpt}</Text>
                  <Text style={styles.pieceArticleCta}>
                    {lang === 'es' ? `Continuar · ${p.dur} →` : `Continue · ${p.dur} →`}
                  </Text>
                </TouchableOpacity>
              );
            }
            if (p.kind === 'illustration') {
              const rows: { age: string; range: string; pct: number; color: string; current?: boolean }[] = [
                { age: '0–3 mo',  range: '60–90 min',  pct: 0.30, color: CHAPTER_BG_BY_NAME.Feed },
                { age: '3–6 mo',  range: '90–120 min', pct: 0.42, color: CHAPTER_BG_BY_NAME.Feel },
                { age: '6–9 mo',  range: '2–3 hr',     pct: 0.62, color: chapter.bg, current: true },
                { age: '9–12 mo', range: '3–4 hr',     pct: 0.78, color: CHAPTER_BG_BY_NAME.Heal },
                { age: '12+ mo',  range: '4–5 hr',     pct: 1.0,  color: CHAPTER_BG_BY_NAME.Tips },
              ];
              return (
                <TouchableOpacity
                  key={`${chapter.ch}-${i}`}
                  onPress={() => openPieceOverlay(p)}
                  activeOpacity={0.85}
                  style={styles.pieceSection}
                >
                  <PieceLabel kind="illustration" num={p.num} />
                  <Text style={styles.pieceArticleTitleSmall}>{p.title}</Text>
                  <V3Card contentStyle={styles.illustrationCardInner}>
                    {rows.map((r, j) => (
                      <View
                        key={r.age}
                        style={[
                          styles.illustrationRow,
                          j < rows.length - 1 ? styles.illustrationRowDivider : null,
                        ]}
                      >
                        <Text style={[
                          styles.illustrationAge,
                          r.current ? styles.illustrationAgeCurrent : null,
                        ]}>{r.age}</Text>
                        <View style={styles.illustrationTrack}>
                          <View style={[styles.illustrationFill, {
                            width: `${r.pct * 100}%`, backgroundColor: r.color,
                          }]} />
                        </View>
                        <Text style={[
                          styles.illustrationRange,
                          r.current ? styles.illustrationRangeCurrent : null,
                        ]}>{r.range}</Text>
                      </View>
                    ))}
                  </V3Card>
                  <Text style={styles.illustrationCaption}>{p.caption}</Text>
                </TouchableOpacity>
              );
            }
            if (p.kind === 'checklist') {
              return (
                <TouchableOpacity
                  key={`${chapter.ch}-${i}`}
                  onPress={() => openPieceOverlay(p)}
                  activeOpacity={0.85}
                  style={styles.pieceSection}
                >
                  <ChecklistPiece
                    piece={p}
                    accentBg={chapter.bg}
                    accentFg={chapter.fg}
                  />
                </TouchableOpacity>
              );
            }
            return null;
          })}
        </View>

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
            <Text style={styles.weekBannerCount}>{doneCount} / 5</Text>
          </View>
          <View style={styles.weekBannerProgress}>
            <View style={[styles.weekBannerFill, { width: `${(doneCount / 5) * 100}%` }]} />
          </View>
        </View>
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
            onPress={closeAnd(() => placeholder('manualMenu.pdfComingTitle', 'manualMenu.pdfComingBody'))}
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
    backgroundColor: T.cocoa, borderColor: T.cocoa,
    shadowColor: T.cocoa, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 12, elevation: 3,
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
    shadowColor: '#3D1F0E',                 // cocoa shadow (deeper than walnut)
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
    elevation: 10,
  },
  // Colored chapter band — full-width identity surface
  chapterBand: {
    paddingHorizontal: 22, paddingTop: 24, paddingBottom: 22,
    overflow: 'hidden',
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
    backgroundColor: 'rgba(61,31,14,0.85)', borderRadius: 999,
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

  // Checklist piece
  checklistRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 14,
  },
  checklistRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  checklistStep: {
    flex: 1,
    fontFamily: FONTS.v2_body, fontSize: 13.5,
    color: T.cocoa, lineHeight: 18,
  },
  checklistStepDone: {
    color: T.walnut,
    textDecorationLine: 'line-through',
    textDecorationColor: T.amber,
  },
});
