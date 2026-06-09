// ManualCategory — context-driven chapter pages (v9 design).
//
// Pixel-faithful port of /private/tmp/manual-recipe-v9-context.html.
// All decorative colors hardcoded from the v9 CSS variables (NOT routed
// through brand-v2 cinnamon tokens) so this screen reads exactly as
// the mockup intends, regardless of any future brand-token shifts.
//
// Mom tab → mom × {feel, heal, nourish, rest, tips}
// Baby tab → baby × {feed, sleep, grow, care, tips}
//
// Five identity-distinct papers per chapter:
//   (1) Week hero — pink-cream w/ decorative yolks, big Playfair italic
//       week number, RUST arrow CTA → routes to weekly guide
//   (2) The Manual — book-spread paper, bold COCO book spine on the
//       left edge, Roman numeral chapters, italic "p. N" folio mark
//   (3) Ask Specialist — clinical-chart paper, SAGE "For your visit"
//       file-folder tab on top-left edge, Q1/Q2/Q3 form labels,
//       sage corner-fold mark top-right, signed-off footer stamp
//   (4) Quick Watches — coco-cream, video thumbnail strip, durations
//   (5) Mom Hacks — sage-cream, vertical bullet list, scattered sage
//       dots, villie bee mascot tucked in the corner
//
// Italics deliberately appear on each card title (one per card, not
// one per screen) — chapter-of-a-book editorial feel.
//
// Videos are short (≤2 min, DB-enforced), Mux-hosted, EN+ES caption-aware.
// Tapping a thumbnail opens ManualVideoScreen for the full-screen player.
// Watched state is persisted server-side (manual_video_progress) and
// surfaced as a "Watched" overlay on the thumbnail.
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Share,
  Alert, Dimensions, findNodeHandle, UIManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import { FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import {
  listManualVideos,
  formatDuration,
  type ManualVideo,
  type ManualAudience,
} from '@/api/manual';
import {
  MenuButton, MenuPanel, MenuGroup, MenuItem, MENU_ICONS,
} from '@components/shared/HamburgerMenu';
import { buildManualChapterHtml, type ManualPdfPiece } from '@utils/manualPdf';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

type ParamList = {
  ManualCategory: { audience: ManualAudience; category: string; label: string };
};

// ═══════════════════════════════════════════════════════════════════════
// V9 palette — exact CSS variable values from the v9 mockup.
// Use these directly for this screen; do NOT route through COLORS.coco/
// rust since those resolve to brand-v2 cinnamon (#D96C88), which is a
// different shade than the v9 mockup's --coco (#AD795B) / --rust
// (#D96C88). The screen is meant to look exactly like the mockup.
// ═══════════════════════════════════════════════════════════════════════
const V9 = {
  paper: '#FFFCF6',
  bgPink: '#FAEDE3',
  bgBook: '#FBF3E0',
  bgChart: '#EDE9DC',
  bgCoco: '#F4E2D1',
  bgSage: '#F2E6DD',

  bark: '#43260F',
  barkSoft: '#7A4A24',

  // Kit canon (2026-05-16): old rust/rust-deep retired; cinnamon family is the
  // app's canonical warm action color. Token names kept for grep compatibility
  // across the Manual file (60+ refs in masthead + week hero + tile SVG).
  rust: '#D96C88',     // cinnamon (was #D96C88)
  rustDeep: '#D96C88', // action-deep (was #7A4A24)
  sage: '#E98A6A',
  sageDeep: '#E98A6A',
  coco: '#AD795B',
  cocoDeep: '#E98A6A',
  sand: '#EADBA8',
  sandDeep: '#F2E6DD',

  pink: '#E8C4B6',
  pinkDeep: '#E98A6A',
  pinkSoft: '#F2D5C5',
} as const;

// ═══════════════════════════════════════════════════════════════════════
// Chapter theme — each chapter wears its own signature color family so
// the 10 chapter pages feel like distinct rooms in the same house, not
// 10 instances of the same template. Five color families mapped across
// mom + baby so semantics line up: Feel↔Grow (terracotta — warmth),
// Heal↔Care (moss — body), Nourish↔Feed (amber — gold), Rest↔Sleep
// (slate — calm), Tips↔Tips (cinnamon — practical).
//
// All accent colors verified WCAG AA (≥ 4.5:1) against V9.paper #FFFCF6
// for text use. Light bg tints stay well above ~14:1 against V9.bark.
//
// Where the theme lands:
//   • Masthead — eyebrow bar/text, italic accent, heart dot
//   • Week hero — card bg, top dash, yolk, eyebrow, CTA arrow + text
//   • Manual book — eyebrow + CTA text
//   • Ask Specialist — STAYS sage (deliberate cross-cut: clinical paper)
//   • Quick Watches — eyebrow + CTA text
//   • Mom Hacks — eyebrow + CTA text (sage bg stays for the "exhale" cue)
// ═══════════════════════════════════════════════════════════════════════
export type ChapterTheme = {
  accent: string;       // primary chapter accent (CTA, eyebrow, italic)
  accentDeep: string;   // darker variant (week eyebrow, CTA text)
  bg: string;           // week hero card background tint
  yolkBg: string;       // week hero decorative yolk
};
export const CHAPTER_THEME_DEFAULT: ChapterTheme = {
  accent: V9.rust, accentDeep: V9.rustDeep, bg: V9.bgPink, yolkBg: V9.pink,
};
// Kit canon (2026-05-16): chapter colors map to 5 brand palette tokens shared
// across paired mom+baby chapters. Within mom (5 chapters) colors never
// repeat; same for baby. Paired chapters (mom/rest ↔ baby/sleep) intentionally
// wear the same family — the sister concept reads as the same room.
//
//   Feel/Grow    → Salmon   #F7C5CB (empathy, warmth, expansion)
//   Heal/Care    → Moss     #E98A6A (body, recovery, garden)
//   Nourish/Feed → Butter   #F4C53C (fuel, halo)
//   Rest/Sleep   → Sage     #F2E6DD (kit "cool exhale", quiet drowsy)
//   Tips/Tips    → Marigold #F4C53C (kit "hero pop", small-wins spark)
// Single source of truth shared with the Manual home chips (ManualScrollV3
// CHIP_TONE). accent = the chapter's deep color (dots/bars + accent text);
// bg/yolkBg = a light wash of it. Pairing mirrors the home: sleep↔heal,
// feed↔nourish, grow↔feel, care↔rest, soothe↔tips.
export const CHAPTER_THEME: Record<string, ChapterTheme> = {
  // Grow / Feel — rose
  'baby/grow':  { accent: '#D96C88', accentDeep: '#D96C88', bg: '#FAE2E7', yolkBg: '#FAE2E7' },
  'mom/feel':   { accent: '#D96C88', accentDeep: '#D96C88', bg: '#FAE2E7', yolkBg: '#FAE2E7' },
  // Sleep / Heal — terracotta
  'baby/sleep': { accent: '#C46A45', accentDeep: '#C46A45', bg: '#F0D7C3', yolkBg: '#F0D7C3' },
  'mom/heal':   { accent: '#C46A45', accentDeep: '#C46A45', bg: '#F0D7C3', yolkBg: '#F0D7C3' },
  // Feed / Nourish — amber (accentDeep darker so accent text stays legible)
  'baby/feed':  { accent: '#BE851F', accentDeep: '#9A6A18', bg: '#F7EBCC', yolkBg: '#F7EBCC' },
  'mom/nourish':{ accent: '#BE851F', accentDeep: '#9A6A18', bg: '#F7EBCC', yolkBg: '#F7EBCC' },
  // Care / Rest — olive
  'baby/care':  { accent: '#6F7A43', accentDeep: '#6F7A43', bg: '#EAEDD8', yolkBg: '#EAEDD8' },
  'mom/rest':   { accent: '#6F7A43', accentDeep: '#6F7A43', bg: '#EAEDD8', yolkBg: '#EAEDD8' },
  // Soothe / Tips — wine
  'baby/soothe':{ accent: '#A8466B', accentDeep: '#A8466B', bg: '#F4DDE6', yolkBg: '#F4DDE6' },
  'mom/tips':   { accent: '#A8466B', accentDeep: '#A8466B', bg: '#F4DDE6', yolkBg: '#F4DDE6' },
  'baby/tips':  { accent: '#A8466B', accentDeep: '#A8466B', bg: '#F4DDE6', yolkBg: '#F4DDE6' },
};

// ── Chapter masthead — "[prefix] [italic accent]." ─────────────────────
export const HERO_TITLE: Record<string, { prefix: string; em: string }> = {
  'mom/feel':    { prefix: 'Time to',    em: 'feel.'    },
  'mom/heal':    { prefix: 'Time to',    em: 'heal.'    },
  'mom/nourish': { prefix: 'Time to',    em: 'nourish.' },
  'mom/rest':    { prefix: 'Time to',    em: 'rest.'    },
  'mom/tips':    { prefix: 'Real-world', em: 'tips.'    },
  'baby/feed':   { prefix: 'How they',   em: 'feed.'    },
  'baby/sleep':  { prefix: 'How they',   em: 'sleep.'   },
  'baby/grow':   { prefix: 'How they',   em: 'grow.'    },
  'baby/care':   { prefix: 'How to',     em: 'care.'    },
  'baby/soothe': { prefix: 'How to',     em: 'soothe.'  },
  'baby/tips':   { prefix: 'Tiny',       em: 'wins.'    },
};

// ── Sub-lead — short masthead body under the chapter title ─────────────
export const SUB_LEAD: Record<string, string> = {
  'mom/feel':    'The hormone hangover, named without the spiral.',
  'mom/heal':    'Lochia, stitches, the slow rebuild — without the panic.',
  'mom/nourish': 'Eat to live through the season, not to optimize.',
  'mom/rest':    'Broken nights, real recovery, rhythms that survive.',
  'mom/tips':    'The small wins moms wish they knew week one.',
  'baby/feed':   'Cluster feeds, latch worries, supply doubts — calmly explained.',
  'baby/sleep':  'What is normal at this week. What is not.',
  'baby/grow':   'The leap, the regression, the breakthrough.',
  'baby/care':   'Gas vs colic. Reflux normal or call. Without panic.',
  'baby/soothe': 'Crying, the witching hour, and what actually calms a baby.',
  'baby/tips':   'The tiny things that change everything.',
};

export const MANUAL_BULLETS: Record<string, string[]> = {
  'mom/feel': [
    'Hormones drop hard at days 3–5. Tears without a reason are normal.',
    'Baby blues lift by week 2. Anything past that, talk to your OB.',
    'Name what you feel, even quietly. It loosens its grip.',
  ],
  'mom/heal': [
    'Bleeding (lochia) thins from red to pink to brown over 4–6 weeks.',
    'Stitches dissolve on their own. Rinse, do not wipe.',
    'C-section incision: dry, no soaking baths, watch for spreading redness.',
  ],
  'mom/nourish': [
    'Eat every 3 hours, even when you forget. Set a phone alarm.',
    'Protein at breakfast keeps the afternoon crash away.',
    'Hydrate to the color of pale straw, not water-clear.',
  ],
  'mom/rest': [
    'Sleep when the baby sleeps is real advice, badly worded. Lie down.',
    'A 20-minute nap resets cortisol better than scrolling.',
    'Pass night feeds to a partner when you can. Even once.',
  ],
  'mom/tips':    ['Microwave a wet washcloth for 20s. Heat on sore breasts.', 'Keep a snack on every floor of the house.', 'Velcro robes beat tied ones with one hand.'],
  'baby/feed':   ['8–12 feeds in 24 hours is normal at this age.', 'Cluster feeding in evenings is a growth spurt, not low supply.', 'Wet diapers: at least 6 a day after day 5.'],
  'baby/sleep':  ['Day-night confusion peaks in week 2–3. It passes.', 'Newborns sleep 14–17 hrs in chunks. Not in a row.', 'Always on the back. Firm surface. Nothing in the crib.'],
  'baby/grow':   ['Big leap around week 5. Crying spikes, then settles.', 'Tracking weight, not days. Pediatrician decides "behind."', 'New skill = old sleep regression. Both at once is normal.'],
  'baby/care':   ['Gas: legs curl, eased by burping. Colic: 3+ hrs, 3+ days, 3+ wks.', 'Reflux spit-up is normal. Projectile + weight loss is not.', 'Fever under 3 months: call, do not wait.'],
  'baby/soothe': ['Crying peaks around weeks 4 to 6, usually evenings, then eases.', "The 5 S's, in order: swaddle, side-hold, shush, swing, suck.", 'Colic is crying 3+ hrs a day, 3+ days a week, 3+ weeks. It passes.'],
  'baby/tips':   ['White noise = vacuum cleaner pitch, not ocean.', 'Swaddle until they fight it. Then sleep sack.', 'Pacifier dipped in breastmilk takes faster.'],
};

export const SPECIALIST_QS: Record<string, string[]> = {
  'mom/feel':    ['Is what I am feeling baby blues or PPD?', 'When should I worry about my mood?', 'Can I be screened today?'],
  'mom/heal':    ['Is my bleeding amount normal for this week?', 'When can I expect stitches to fully heal?', 'What activity is safe right now?'],
  'mom/nourish': ['Should I take a postpartum multivitamin?', 'What if I am breastfeeding and not hungry?', 'Any foods to avoid right now?'],
  'mom/rest':    ['How much sleep is too little before it is dangerous?', 'Can sleep deprivation cause PPD?', 'Is melatonin safe while nursing?'],
  'mom/tips':    ['Any postpartum doulas you recommend?', 'When can I drive again?', 'When can I exercise?'],
  'baby/feed':   ['Is my baby getting enough?', 'How do I know my latch is right?', 'Should I be pumping yet?'],
  'baby/sleep':  ['When should sleep get longer?', 'Is a swaddle still safe?', 'When do I move to a crib?'],
  'baby/grow':   ['Is my baby on track for this week?', 'When is the next leap?', 'How do I know it is a regression?'],
  'baby/care':   ['When is gas actually colic?', 'When should I worry about reflux?', 'What temperature is a real fever?'],
  'baby/soothe': ['Is this normal crying or colic?', 'When does crying cross into a worry?', 'Could reflux or feeding be part of it?'],
  'baby/tips':   ['Any sleep coach you trust?', 'Best swaddle brand at this age?', 'Pacifier or no pacifier?'],
};

export const MOM_HACKS: Record<string, string[]> = {
  'mom/feel':    ['Step outside for 10 minutes of morning light.', 'Tell one person exactly how you feel today.', 'Stop reading mom Instagram for 48 hours.'],
  'mom/heal':    ['Frozen pads ("padsicles") for the first 3 days.', 'Peri bottle, warm water, before and after.', "Don't stand longer than 20 min in week 1."],
  'mom/nourish': ['Pre-portion snacks at the start of the week.', 'Keep a water bottle in every nursing spot.', 'Smoothie packs in the freezer for ugly mornings.'],
  'mom/rest':    ['Phone on do-not-disturb after 8 pm.', 'Blackout the nursery, even for naps.', 'Trade one shift with a partner this week.'],
  'mom/tips':    ['Set 2 alarms — one to eat, one to drink.', 'Hands-free pump while you scroll.', 'Order groceries the day you run out, not the next.'],
  'baby/feed':   ['Track feeds with a sticky note, not an app.', 'One side per feed in the first 4 weeks.', 'Burp at the switch, not just the end.'],
  'baby/sleep':  ['White noise the whole nap, not just for 5 min.', 'Wake-windows over schedules in month 1.', 'Same wind-down song every night.'],
  'baby/grow':   ['Tummy time on your chest counts.', 'Track wet diapers, not ounces.', 'Photograph the same outfit every week.'],
  'baby/care':   ['Bicycle legs for gas. Knees-to-chest for colic.', 'Coconut oil on the cradle cap, gentle comb.', 'Cool wet washcloth for teething drool rash.'],
  'baby/soothe': ['White noise the whole time, as loud as a shower.', 'Motion and sound together beat either one alone.', 'Hand the baby off for ten minutes when you hit your limit.'],
  'baby/tips':   ['Diaper before feed, not after, to avoid spit-up.', 'Onesies that snap from the side at 3 am.', 'Two diaper stations, not one.'],
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

export default function ManualCategoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ParamList, 'ManualCategory'>>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const { audience, category } = route.params;

  const [videos, setVideos] = useState<ManualVideo[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const list = await listManualVideos(audience, category, lang);
          if (!cancelled) setVideos(list);
        } catch (e) {
          console.error('manual-category load', e);
          if (!cancelled) setVideos([]);
        }
      })();
      return () => { cancelled = true; };
    }, [audience, category, lang]),
  );

  // Tapping any thumb plays the whole chapter row as a playlist, starting at
  // the tapped clip (auto-advances through the rest).
  const onCardPress = (video: ManualVideo) => {
    const playlist = videos.map((v) => v.id);
    const startIndex = Math.max(0, playlist.indexOf(video.id));
    navigation.navigate('ManualVideo' as never, {
      audience, category, videoId: video.id, playlist, playlistIndex: startIndex,
    } as never);
  };

  // Dead-end CTA handlers — wired 2026-05-16 so the "Explore", "Save",
  // "Watch the row", "More hacks" labels are now tappable. Lite destinations
  // until dedicated detail screens exist; see docs/V9_UNRESOLVED_CTAS.md.

  // Return to chapter selector — invites the user to explore other chapters.
  const goToChapterList = () => navigation.navigate('ManualHome' as never);
  // "Explore the manual →" — opens the chapter's full-picture read rather than
  // bouncing back to ManualHome (the page the user came from to get here).
  const goToChapterRead = () =>
    navigation.navigate('ManualChapterRead' as never, {
      audience, category, label: route.params.label,
    } as never);

  // Share the 3 "Ask your specialist" questions via native share sheet so
  // the user can text/email them to herself, save to notes, or hand them
  // to her provider directly. No new screen needed.
  const shareQuestions = async () => {
    if (!questions.length) return;
    const heroEm = hero.em.replace(/\.$/, '');
    const title = `Questions for my next visit — ${hero.prefix} ${heroEm} (week ${week})`;
    const body = questions.map((q, i) => `${i + 1}. ${q}`).join('\n\n');
    try {
      await Share.share({ message: `${title}\n\n${body}\n\n— from villie` });
    } catch {
      /* user cancelled — no-op */
    }
  };

  // Play the first available video in the chapter row. If videos haven't
  // loaded yet, fall back to the chapter list.
  const watchFirstVideo = () => {
    if (videos[0]) onCardPress(videos[0]);
    else goToChapterList();
  };

  const babyProfile = useHomeStore((s) => s.babyProfile);
  const week = Math.max(1, babyProfile?.current_week_number ?? 1);

  // ─── Hamburger menu state ──────────────────────────────────────────
  // v3 brand kit headline change: replaces the old audience tag pill in
  // the top-right with a Library / This chapter / More dropdown. The
  // trigger's on-screen rect is measured on layout so the MenuPanel can
  // anchor to its bottom-right edge (Modal-hosted; the panel doesn't
  // need to live in the trigger's layout tree).
  const [menuOpen, setMenuOpen] = useState(false);
  const [anchor, setAnchor] = useState({ right: 22, top: 64 });
  const triggerRef = useRef<View>(null);
  const screenWidth = Dimensions.get('window').width;

  const openMenu = () => {
    // Measure trigger position so the panel slides under it. Falls back
    // to the prior anchor if measurement isn't ready (e.g. first tap
    // before initial layout settles).
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

  // Shared close-then-act wrapper. Closing first feels native — the
  // menu collapses, the user sees their action take effect.
  const closeAnd = (fn?: () => void) => () => {
    setMenuOpen(false);
    if (fn) setTimeout(fn, 80);
  };

  // ─── Menu actions ─────────────────────────────────────────────────
  // Wired against the existing app primitives; placeholders for the
  // few that don't have backing infra yet (chapter-level save, reading
  // history, PDF generation).
  const goToCompleteManual = () => navigation.navigate('ManualHome' as never);
  const goToSavedChapters = () => navigation.navigate('SavedManual' as never);
  const goToReadingHistory = () => Alert.alert(
    t('manualMenu.historyComingTitle'),
    t('manualMenu.historyComingBody'),
  );
  const saveThisChapter = () => Alert.alert(
    t('manualMenu.saveChapterComingTitle'),
    t('manualMenu.saveChapterComingBody'),
  );
  const shareThisChapter = async () => {
    // Reuse the same Share API + URL convention as video sharing;
    // chapter pages don't have their own share-landing yet, so link to
    // the audience+category. Future: dedicated /m/c/<audience>/<cat> page.
    const url = `https://villieapp.com/m/?c=${audience}-${category}`;
    const heroEm = hero.em.replace(/\.$/, '');
    try {
      await Share.share({
        message: `${hero.prefix} ${heroEm} — week ${week} · villie\n${url}`,
      });
    } catch { /* user cancelled */ }
  };
  const printChapterPdf = async () => {
    // Dynamic require defers native-module resolution to call time. Build 11
    // throws "Native module not registered" → caught and downgraded to the
    // "coming soon" placeholder. Build 12+ has the native frameworks linked
    // and the call lands a real PDF. See sibling ManualScrollV3 for details.
    try {
      const Print = require('expo-print');
      const Sharing = require('expo-sharing');
      const ownerName = babyProfile?.baby_name?.trim() || (lang === 'es' ? 'tu bebé' : "your baby");
      // Category screen doesn't carry a full piece stream — the PDF
      // captures the chapter masthead + video list. Videos map to the
      // PdfPiece 'video' shape so the printed PDF mirrors what the user
      // can watch on this screen.
      // DB videos don't carry an expert byline; omit until manual_videos
      // schema grows an expert_name column.
      const pieces: ManualPdfPiece[] = videos.map((v, i): ManualPdfPiece => ({
        kind: 'video',
        num: String(i + 1).padStart(2, '0'),
        title: v.title,
        dur: formatDuration(v.duration_seconds ?? 0) || undefined,
      }));
      const html = buildManualChapterHtml({
        chapterName: route.params.label,
        chapterIntro: subLead || undefined,
        week,
        who: audience,
        ownerName,
        pieces,
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
  const subscribeDigest = () => {
    // Cross-tab nav to Me → NotificationPreferences. Use the parent
    // navigator (tab navigator) rather than the local stack.
    navigation.getParent()?.navigate('Me' as never, {
      screen: 'NotificationPreferences',
    } as never);
  };

  const key = `${audience}/${category}`;
  const hero       = HERO_TITLE[key]     ?? { prefix: 'Read about', em: 'this.' };
  const subLead    = SUB_LEAD[key]       ?? '';
  const bullets    = MANUAL_BULLETS[key] ?? [];
  const questions  = SPECIALIST_QS[key]  ?? [];
  const hacks      = MOM_HACKS[key]      ?? [];
  const theme      = CHAPTER_THEME[key]  ?? CHAPTER_THEME_DEFAULT;

  // (No card-level onPress for now — wiring real destinations is a follow-up.
  // The HeroKey type stays exported for that future routing layer.)

  return (
    <View style={styles.container}>
      {/* Top nav — Back · audience tag · hamburger menu (v3 brand kit) */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>← {t('common.back')}</Text>
        </TouchableOpacity>
        <View style={styles.headerRight}>
          {/* Liquid-glass pill — audience context (MOM / BABY). Kept
              alongside the menu because the screen otherwise loses the
              "which manual am I in" signal on scroll. */}
          <View style={styles.audienceTagPill}>
            <LinearGradient
              colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.55 }}
              style={StyleSheet.absoluteFill as any}
              pointerEvents="none"
            />
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(173,121,91,0.10)']}
              start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill as any}
              pointerEvents="none"
            />
            <Text style={styles.audienceTag}>
              {audience === 'mom' ? 'Mom' : 'Baby'}
            </Text>
          </View>
          {/* v3 hamburger — Library / This chapter / More */}
          <View ref={triggerRef} collapsable={false}>
            <MenuButton
              onPress={openMenu}
              expanded={menuOpen}
              a11yLabel={t('manualMenu.triggerA11y')}
            />
          </View>
        </View>
      </View>

      {/* Hamburger menu panel — Modal-hosted so it can break out of
          the ScrollView clip. */}
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
            onPress={closeAnd(goToReadingHistory)}
          />
        </MenuGroup>
        <MenuGroup label={t('manualMenu.groupThisChapter')}>
          <MenuItem
            title={t('manualMenu.saveChapter', { chapter: route.params.label })}
            sub={t('manualMenu.saveChapterSub')}
            icon={MENU_ICONS.save}
            onPress={closeAnd(saveThisChapter)}
          />
          <MenuItem
            title={t('manualMenu.shareChapter')}
            sub={t('manualMenu.shareChapterSub')}
            icon={MENU_ICONS.share}
            onPress={closeAnd(shareThisChapter)}
          />
          <MenuItem
            title={t('manualMenu.printPdf')}
            sub={t('manualMenu.printPdfSub', { chapter: route.params.label, week })}
            icon={MENU_ICONS.printer}
            onPress={closeAnd(printChapterPdf)}
          />
        </MenuGroup>
        <MenuGroup label={t('manualMenu.groupMore')}>
          <MenuItem
            title={t('manualMenu.subscribe')}
            sub={t('manualMenu.subscribeSub')}
            icon={MENU_ICONS.mailHeart}
            onPress={closeAnd(subscribeDigest)}
          />
        </MenuGroup>
      </MenuPanel>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ─── Masthead ─── */}
        <View style={styles.masthead}>
          <View style={styles.villieMasthead} pointerEvents="none">
            <Image source={VILLIE_BEE} style={styles.villieMastheadImg} resizeMode="contain" />
          </View>
          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowBar, { backgroundColor: theme.accent }]} />
            <Text style={[styles.eyebrowText, { color: theme.accentDeep }]}>A field guide</Text>
          </View>
          <View style={styles.titleRow}>
            <Text style={styles.title}>
              {hero.prefix} <Text style={[styles.italicAccent, { color: theme.accentDeep }]}>{hero.em}</Text>
            </Text>
            <View style={[styles.heartDot, { backgroundColor: theme.accent }]} />
          </View>
          {!!subLead && <Text style={styles.lead}>{subLead}</Text>}
        </View>

        {/* Week hero card removed 2026-05-16 — the "Week N" callout was
            redundant with the rest of the screen: every chapter card below
            already speaks to the user's current week implicitly through
            its content. The masthead + lead carry the chapter identity;
            the manual / specialist / quick-watches / hacks cards carry
            the substance. The week number lives on as the folio mark
            (`p. {week}`) inside the Manual book card. */}

        {/* ─── CARD · The Manual (book spread) ─── */}
        <View style={styles.bookCard} accessibilityLabel="The manual. What to actually know.">
          <View style={styles.bookSpine} pointerEvents="none" />
          <View style={styles.bookSpineHighlight} pointerEvents="none" />
          <View style={styles.bookYolkRing} pointerEvents="none" />

          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowBar, { backgroundColor: theme.accent }]} />
            <Text style={[styles.eyebrowText, { color: theme.accentDeep }]}>The manual</Text>
          </View>
          <Text style={styles.bookTitle}>
            What to actually <Text style={[styles.italicAccent, { color: theme.accentDeep }]}>know.</Text>
          </Text>

          {bullets.map((b, i) => (
            <View key={i} style={[styles.chapterRow, i > 0 && styles.chapterRowDivider]}>
              <Text style={styles.chapterNum}>{ROMAN[i] ?? String(i + 1)}.</Text>
              <Text style={styles.chapterText}>{b}</Text>
            </View>
          ))}

          <TouchableOpacity
            onPress={goToChapterRead}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="link"
            accessibilityLabel="Read the full picture for this chapter"
          >
            <Text style={[styles.bookCta, { color: theme.accentDeep }]}>Explore the manual →</Text>
          </TouchableOpacity>
          <Text style={styles.folio}>p. {week}</Text>
        </View>

        {/* ─── CARD 3 · Ask Specialist (clinical chart) ─── */}
        <View style={styles.chartCardWrap}>
          {/* Liquid-glass file-folder tab: chart paper base + subtle top-edge
              specular highlight for the iOS 26 frosted feel. */}
          <View style={styles.chartTab}>
            <LinearGradient
              colors={['rgba(255,255,255,0.40)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
              style={[StyleSheet.absoluteFill as any, { borderTopLeftRadius: 6, borderTopRightRadius: 6 }]}
              pointerEvents="none"
            />
            <Text style={styles.chartTabText}>For your visit</Text>
          </View>
          <View style={styles.chartCard} accessibilityLabel="Ask your specialist. Bring these three.">
            {/* Hard-cutoff sage corner-fold (50/50, not smooth) */}
            <LinearGradient
              colors={[V9.sageDeep, V9.sageDeep, 'transparent', 'transparent']}
              locations={[0, 0.5, 0.5, 1]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.chartFold}
              pointerEvents="none"
            />

            <View style={styles.eyebrowRow}>
              <View style={[styles.eyebrowBar, { backgroundColor: V9.sageDeep }]} />
              <Text style={[styles.eyebrowText, { color: V9.sageDeep }]}>Ask your specialist</Text>
            </View>
            <Text style={styles.chartTitle}>
              Bring these <Text style={[styles.italicAccent, { color: theme.accentDeep }]}>three.</Text>
            </Text>

            {questions.map((q, i) => (
              <View key={i} style={[styles.qRow, i < questions.length - 1 && styles.qRowDivider]}>
                {/* Liquid-glass Q-chip: sage base + soft top highlight */}
                <View style={styles.qTag}>
                  <LinearGradient
                    colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={[StyleSheet.absoluteFill as any, { borderRadius: 3 }]}
                    pointerEvents="none"
                  />
                  <Text style={styles.qTagText}>Q{i + 1}</Text>
                </View>
                <Text style={styles.qText}>{q}</Text>
              </View>
            ))}

            <View style={styles.chartFooter}>
              <Text style={styles.chartStamp}>— signed, your week-{week} self</Text>
              <TouchableOpacity
                onPress={shareQuestions}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Share these 3 questions with your provider"
              >
                <Text style={[styles.cardCtaRust, { color: theme.accentDeep }]}>Share these →</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ─── CARD 4 · Quick Watches ─── */}
        <View style={styles.softCardCoco} accessibilityLabel="Quick watches. Two minutes, exactly.">
          <View style={styles.scribbleAbs} pointerEvents="none">
            <View style={[styles.scribbleLineCoco, { width: 20, transform: [{ rotate: '-6deg' }] }]} />
            <View style={[styles.scribbleLineCoco, { width: 14, transform: [{ rotate: '2deg' }] }]} />
            <View style={[styles.scribbleLineCoco, { width: 16, transform: [{ rotate: '-3deg' }] }]} />
          </View>

          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowBar, { backgroundColor: theme.accent }]} />
            <Text style={[styles.eyebrowText, { color: theme.accentDeep }]}>Quick watches</Text>
          </View>
          <Text style={styles.cardTitle}>
            Two minutes, <Text style={[styles.italicAccent, { color: theme.accentDeep }]}>exactly.</Text>
          </Text>

          {/* v9 spec: ALWAYS render exactly 3 slots in a row. Real video where
              videos[i] exists; gradient placeholder otherwise. This keeps the
              row layout intact when the DB has 0/1/2 videos (without this, a
              single thumb would stretch to 100% via flex:1). */}
          <View style={styles.vidStrip}>
            {[0, 1, 2].map((i) => {
              const v = videos[i];
              if (v) {
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.vidThumb}
                    activeOpacity={0.9}
                    onPress={() => onCardPress(v)}
                    accessibilityRole="button"
                    accessibilityLabel={t('manual.videoCardA11y', {
                      title: v.title,
                      duration: formatDuration(v.duration_seconds),
                    })}
                  >
                    <Image source={{ uri: v.thumbnail_url }} style={StyleSheet.absoluteFill as any} resizeMode="cover" />
                    <View style={styles.vidDuration}>
                      <Text style={styles.vidDurationText}>{formatDuration(v.duration_seconds)}</Text>
                    </View>
                    {v.is_watched && (
                      <View style={styles.vidWatched}>
                        <Text style={styles.vidWatchedText}>{t('manual.watched')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }
              const gradient =
                i === 0 ? [V9.pinkSoft, V9.pinkDeep] as const
                : i === 1 ? ['#F2E6DD', V9.coco] as const
                : ['#F2E6DD', V9.sage] as const;
              return (
                <LinearGradient
                  key={`sk-${i}`}
                  colors={gradient as unknown as readonly [string, string, ...string[]]}
                  start={{ x: 0.15, y: 0 }}
                  end={{ x: 0.85, y: 1 }}
                  style={styles.vidThumb}
                >
                  <Text style={styles.vidPlaceholderGlyph}>▷</Text>
                </LinearGradient>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={watchFirstVideo}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={videos.length ? `Play all ${videos.length} videos in this chapter` : 'Browse all chapters'}
          >
            <Text style={[styles.cardCtaRust, { color: theme.accentDeep }]}>Watch the row →</Text>
          </TouchableOpacity>
        </View>

        {/* ─── CARD 5 · Mom Hacks ─── */}
        <View style={styles.softCardSage} accessibilityLabel="Mom hacks. Try one tonight.">
          <View style={styles.sageDots} pointerEvents="none">
            <View style={[styles.sageDot, { top: 14, left: 8, width: 6, height: 6 }]} />
            <View style={[styles.sageDot, { top: 4,  left: 28, width: 4, height: 4 }]} />
            <View style={[styles.sageDot, { top: 26, left: 42, width: 7, height: 7 }]} />
            <View style={[styles.sageDot, { top: 38, left: 18, width: 4, height: 4 }]} />
            <View style={[styles.sageDot, { top: 46, left: 36, width: 6, height: 6 }]} />
          </View>
          <View style={styles.villieCardMascot} pointerEvents="none">
            <Image source={VILLIE_BEE} style={styles.villieCardMascotImg} resizeMode="contain" />
          </View>

          <View style={styles.eyebrowRow}>
            <View style={[styles.eyebrowBar, { backgroundColor: theme.accent }]} />
            <Text style={[styles.eyebrowText, { color: theme.accentDeep }]}>Mom hacks &amp; tips</Text>
          </View>
          <Text style={styles.cardTitle}>
            Try one <Text style={[styles.italicAccent, { color: theme.accentDeep }]}>tonight.</Text>
          </Text>

          <View style={styles.chipStrip}>
            {hacks.map((h, i) => (
              <View key={i} style={styles.chipRow}>
                <View style={styles.chipBulletSage} />
                <Text style={styles.chipText}>{h}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={goToChapterRead}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="link"
            accessibilityLabel="Read the full picture for this chapter"
          >
            <Text style={[styles.cardCtaRust, { color: theme.accentDeep }]}>Read the full picture →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Shadow recipes — RN can't do CSS multi-shadow + inset, so each card
// gets the "lifted off the page" shadow from v9 approximated via
// elevation + shadowColor + shadowOffset.
// ═══════════════════════════════════════════════════════════════════════
const cardShadow = {
  shadowColor: V9.coco,
  shadowOpacity: 0.28,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 22,
  elevation: 4,
};
const weekCardShadow = {
  shadowColor: V9.coco,
  shadowOpacity: 0.30,
  shadowOffset: { width: 0, height: 10 },
  shadowRadius: 22,
  elevation: 5,
};
const sageCardShadow = {
  shadowColor: V9.sageDeep,
  shadowOpacity: 0.30,
  shadowOffset: { width: 0, height: 8 },
  shadowRadius: 22,
  elevation: 4,
};
const arrowShadow = {
  shadowColor: V9.rust,
  shadowOpacity: 0.45,
  shadowOffset: { width: 0, height: 3 },
  shadowRadius: 10,
  elevation: 4,
};

const styles = StyleSheet.create({
  // ── Page chrome ──────────────────────────────────────────────────────
  container: { flex: 1, backgroundColor: V9.paper },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 8, paddingHorizontal: 20,
    backgroundColor: V9.paper,
  },
  back: { fontSize: 13, color: V9.coco, fontFamily: FONTS.bodySemiBold },
  // Right cluster — audience tag + hamburger menu trigger. 10px gap so
  // the pill + chip read as two distinct affordances, not a compound.
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // ── Liquid-glass audience tag pill (iOS 26 styling) ─────────────────
  // Visible-body recipe: high-opacity warm-tinted backdrop + soft top
  // highlight + bottom warm wash + coco hairline border. Reads as a
  // distinct glass lozenge against cream paper, not invisible film.
  audienceTagPill: {
    paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(253, 250, 245, 0.80)', // visible parchment glass
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(173, 121, 91, 0.32)', // visible coco hairline (was invisible white)
    shadowColor: V9.coco,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  audienceTag: {
    fontSize: 10.5, color: V9.coco, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.6, textTransform: 'uppercase',
    // ensure text sits above the gradient layers
    zIndex: 2,
  },
  content: { paddingHorizontal: 20, paddingBottom: 60 },

  // ── Masthead ─────────────────────────────────────────────────────────
  masthead: { position: 'relative', marginTop: 6, marginBottom: 16, paddingRight: 74 },
  villieMasthead: {
    position: 'absolute', top: 4, right: -6,
    width: 74, height: 74, opacity: 0.55,
    transform: [{ rotate: '14deg' }],
    zIndex: 1,
  },
  villieMastheadImg: { width: '100%', height: '100%' },

  // Shared eyebrow row (label + 16x1 hairline bar)
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  eyebrowBar: { width: 16, height: 1, marginRight: 8 },
  eyebrowText: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 1.8, textTransform: 'uppercase',
  },

  titleRow: {
    flexDirection: 'row', alignItems: 'flex-end',
    flexWrap: 'wrap', marginTop: 8, marginBottom: 6,
  },
  title: {
    fontFamily: FONTS.headerBold, fontSize: 40, lineHeight: 40,
    letterSpacing: -1.2, color: V9.bark,
  },
  italicAccent: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: V9.rust,
  },
  heartDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: V9.rust,
    marginLeft: 5, marginBottom: 8,
  },
  lead: {
    fontSize: 13, lineHeight: 19, color: V9.barkSoft,
    fontFamily: FONTS.body, marginTop: 6, maxWidth: '92%',
  },

  // ── Shared scribbles ─────────────────────────────────────────────────
  scribbleLineBark: { height: 1.1, backgroundColor: V9.bark, opacity: 0.55 },
  scribbleLineCoco: { height: 1.1, backgroundColor: V9.cocoDeep, opacity: 0.65 },

  // ── CARD 1 · Week hero ───────────────────────────────────────────────
  weekCard: {
    backgroundColor: V9.bgPink,
    borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 16,
    marginBottom: 12,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.22)',
    ...weekCardShadow,
  },
  weekTopBar: {
    position: 'absolute', top: 0, left: 18,
    width: 34, height: 2, backgroundColor: V9.rust,
    zIndex: 3,
  },
  weekYolkOuter: {
    position: 'absolute', top: -22, right: -22,
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: V9.pink, opacity: 0.85, zIndex: 0,
  },
  weekYolkInner: {
    position: 'absolute', top: -4, right: -4,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: V9.coco, opacity: 0.55, zIndex: 0,
  },
  weekScribble: {
    position: 'absolute', top: 24, right: 80,
    gap: 2, opacity: 0.55, zIndex: 1,
  },
  weekEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: V9.rustDeep,
    letterSpacing: 1.8, textTransform: 'uppercase',
    paddingTop: 6, zIndex: 2,
  },
  weekNum: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 36, lineHeight: 36, letterSpacing: -1,
    color: V9.bark, marginTop: 4, marginBottom: 8, zIndex: 2,
  },
  weekBody: {
    fontSize: 13, lineHeight: 18, color: V9.bark,
    fontFamily: FONTS.body, maxWidth: '78%', zIndex: 2,
  },
  weekCta: {
    marginTop: 10, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', zIndex: 2,
  },
  weekCtaText: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: V9.rustDeep,
  },
  weekCtaArrow: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: V9.rust,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', // clip glass overlays to circle
    ...arrowShadow,
  },
  weekCtaArrowGlyph: {
    color: V9.paper,
    fontSize: 18,
    lineHeight: 18, // clamp to fontSize so the Text box is glyph-tight
    fontFamily: FONTS.bodyBold,
    fontWeight: '700',
    textAlign: 'center',
    includeFontPadding: false, // Android: kill the extra font padding
    marginTop: -1, // optical fudge — arrow glyph sits slightly low in most fonts
    textAlignVertical: 'center', // Android: vertical center inside the Text box
  },

  // ── CARD 2 · Book spread ─────────────────────────────────────────────
  bookCard: {
    backgroundColor: V9.bgBook,
    borderRadius: 16,
    paddingTop: 14, paddingLeft: 22, paddingRight: 16, paddingBottom: 28,
    marginBottom: 10,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.18)',
    ...cardShadow,
  },
  bookSpine: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: 4, backgroundColor: V9.coco, zIndex: 2,
  },
  bookSpineHighlight: {
    position: 'absolute', left: 4, top: 0, bottom: 0,
    width: 2, backgroundColor: 'rgba(173,121,91,0.25)', zIndex: 1,
  },
  bookYolkRing: {
    position: 'absolute', top: -22, right: -22,
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 1.6, borderColor: V9.coco,
    opacity: 0.40, zIndex: 0,
  },
  bookTitle: {
    fontFamily: FONTS.headerBold, fontSize: 20, lineHeight: 22,
    letterSpacing: -0.5, color: V9.bark,
    marginTop: 6, marginBottom: 10, zIndex: 2,
  },
  chapterRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 6, zIndex: 2,
  },
  chapterRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(173,121,91,0.18)',
  },
  chapterNum: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 13, color: V9.cocoDeep,
    width: 28, paddingTop: 1,
  },
  chapterText: {
    flex: 1, fontSize: 11.5, lineHeight: 16,
    color: V9.bark, fontFamily: FONTS.body,
  },
  bookCta: {
    fontSize: 11.5, fontFamily: FONTS.bodySemiBold,
    color: V9.rust, letterSpacing: 0.5,
    marginTop: 10, zIndex: 2,
  },
  folio: {
    position: 'absolute', bottom: 8, right: 14,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 10, color: V9.coco, opacity: 0.55,
    zIndex: 2,
  },

  // ── CARD 3 · Clinical chart ──────────────────────────────────────────
  chartCardWrap: { position: 'relative', marginTop: 14, marginBottom: 10 },
  chartTab: {
    position: 'absolute', top: -14, left: 14,
    paddingHorizontal: 12, paddingTop: 3, paddingBottom: 4,
    borderTopLeftRadius: 6, borderTopRightRadius: 6,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: 'rgba(107,122,75,0.28)',
    backgroundColor: V9.bgChart,
    overflow: 'hidden', // clip glass highlight gradient
    zIndex: 3,
  },
  chartTabText: {
    fontSize: 9, fontFamily: FONTS.bodyBold, color: V9.sageDeep,
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  chartCard: {
    backgroundColor: V9.bgChart,
    borderRadius: 14,
    paddingTop: 18, paddingHorizontal: 16, paddingBottom: 12,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(107,122,75,0.28)',
    ...cardShadow,
    shadowColor: V9.sageDeep,
  },
  chartFold: {
    position: 'absolute', top: 0, right: 0,
    width: 32, height: 32,
    opacity: 0.20, borderTopRightRadius: 14,
    zIndex: 1,
  },
  chartTitle: {
    fontFamily: FONTS.headerBold, fontSize: 20, lineHeight: 22,
    letterSpacing: -0.5, color: V9.bark,
    marginTop: 6, marginBottom: 8, zIndex: 2,
  },
  qRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingTop: 7, paddingBottom: 6,
    zIndex: 2,
  },
  qRowDivider: {
    borderBottomWidth: 1, borderStyle: 'dashed',
    borderBottomColor: 'rgba(107,122,75,0.30)',
  },
  qTag: {
    backgroundColor: V9.sageDeep,
    paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 3, marginRight: 8, marginTop: 1,
    overflow: 'hidden', // clip glass highlight gradient
  },
  qTagText: {
    fontSize: 9, fontFamily: FONTS.bodyBold, color: V9.paper,
    letterSpacing: 0.8,
  },
  qText: {
    flex: 1, fontSize: 11.5, lineHeight: 16,
    color: V9.bark, fontFamily: FONTS.body,
  },
  chartFooter: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10, zIndex: 2,
  },
  chartStamp: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    fontSize: 10, color: V9.sageDeep, opacity: 0.75,
  },

  // ── Shared "soft cards" used for Quick Watches + Mom Hacks ───────────
  softCardCoco: {
    backgroundColor: V9.bgCoco,
    borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    marginBottom: 10,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(173,121,91,0.18)',
    ...cardShadow,
  },
  softCardSage: {
    backgroundColor: V9.bgSage,
    borderRadius: 16,
    paddingTop: 14, paddingBottom: 14, paddingLeft: 16, paddingRight: 80,
    minHeight: 162,
    marginBottom: 10,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(107,122,75,0.22)',
    ...sageCardShadow,
  },
  cardTitle: {
    fontFamily: FONTS.headerBold, fontSize: 20, lineHeight: 22,
    letterSpacing: -0.5, color: V9.bark,
    marginTop: 6, marginBottom: 6, zIndex: 2,
  },
  cardCtaRust: {
    fontSize: 11.5, fontFamily: FONTS.bodySemiBold,
    color: V9.rust, letterSpacing: 0.5,
    marginTop: 8, zIndex: 2,
  },

  // Scribble for Quick Watches top-right (coco-deep, not bark)
  scribbleAbs: {
    position: 'absolute', top: 16, right: 16,
    gap: 2, zIndex: 1,
  },

  // ── Video strip ──────────────────────────────────────────────────────
  vidStrip: { flexDirection: 'row', gap: 6, marginTop: 4, marginBottom: 8, zIndex: 2 },
  vidThumb: {
    flex: 1, height: 64, borderRadius: 7,
    position: 'relative', overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(61,31,13,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  vidPlaceholderGlyph: { fontSize: 22, color: V9.paper, opacity: 0.85 },
  vidDuration: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: 'rgba(28,16,8,0.78)',
    paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3,
  },
  vidDurationText: { color: V9.paper, fontSize: 8.5, fontFamily: FONTS.bodySemiBold },
  vidWatched: {
    position: 'absolute', top: 4, left: 4,
    backgroundColor: 'rgba(92,107,58,0.92)',
    paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 3,
  },
  vidWatchedText: {
    color: V9.paper, fontSize: 8, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.4, textTransform: 'uppercase',
  },

  // ── Mom Hacks ────────────────────────────────────────────────────────
  sageDots: {
    position: 'absolute', bottom: -4, right: 36,
    width: 60, height: 60, opacity: 0.40, zIndex: 0,
  },
  sageDot: {
    position: 'absolute', borderRadius: 999,
    backgroundColor: V9.sageDeep,
  },
  villieCardMascot: {
    position: 'absolute', bottom: 4, right: 6,
    width: 64, height: 64, zIndex: 1,
    transform: [{ rotate: '-10deg' }],
  },
  villieCardMascotImg: { width: '100%', height: '100%' },
  chipStrip: { gap: 5, marginTop: 2, marginBottom: 8, zIndex: 2 },
  chipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  chipBulletSage: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: V9.sageDeep, marginTop: 6,
  },
  chipText: {
    flex: 1, fontSize: 11.5, lineHeight: 16,
    color: V9.bark, fontFamily: FONTS.body,
  },
});
