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

import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Dimensions, findNodeHandle, UIManager, Share, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import {
  MenuButton, MenuPanel, MenuGroup, MenuItem, MENU_ICONS,
} from '@components/shared/HamburgerMenu';

// villie-bee.png — meticulous v9 mascot, brought forward to v3 for the
// "lived-in" feel. Used as small atmospheric perches on key cards.
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// ─── Tokens ────────────────────────────────────────────────────────────
const T = {
  paper:     COLORS.v2_paper,
  cream:     COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  card:      COLORS.v2_card,
  butter:    COLORS.v2_butter,
  marigold:  COLORS.v2_marigold,
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
  { ch: 'Sleep', cat: 'sleep', bg: '#DAE0BC', fg: T.cocoa },
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

  const [who, setWho] = useState<'mom' | 'baby'>('baby');
  const list = who === 'baby' ? BABY_CHAPTERS : MOM_CHAPTERS;
  const [chapter, setChapter] = useState<ChapterMeta>(list[0]);

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

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Marigold halo behind the title block */}
        <View style={styles.marigoldHalo} pointerEvents="none" />

        {/* Atmosphere bees — drift through the page background as the
            user scrolls. Low opacity, varied rotations + sizes, inside
            the ScrollView so they move with content not pinned to viewport. */}
        <View pointerEvents="none" style={styles.atmosphereBee1}>
          <Image source={VILLIE_BEE} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessible={false} />
        </View>
        <View pointerEvents="none" style={styles.atmosphereBee2}>
          <Image source={VILLIE_BEE} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessible={false} />
        </View>
        <View pointerEvents="none" style={styles.atmosphereBee3}>
          <Image source={VILLIE_BEE} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessible={false} />
        </View>
        <View pointerEvents="none" style={styles.atmosphereBee4}>
          <Image source={VILLIE_BEE} resizeMode="contain" style={{ width: '100%', height: '100%' }} accessible={false} />
        </View>

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

        {/* Week progress banner — sage, "X more to complete" */}
        <View style={styles.weekBanner}>
          <LinearGradient
            colors={['rgba(253,251,246,0.28)', 'rgba(253,251,246,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.5 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: 10 }]}
            pointerEvents="none"
          />
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

        {/* COLORED CHAPTER BAND — full-width identity surface */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={openSelectedChapter}
          style={[styles.chapterBand, { backgroundColor: chapter.bg }]}
        >
          <LinearGradient
            colors={['rgba(253,251,246,0.22)', 'rgba(253,251,246,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 0.42 }}
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

        {/* Piece-stream placeholder — Phase 4.2 will replace this with the
            full video / article / illustration / checklist stream. For
            now, tapping the colored band above opens the existing
            ManualCategoryScreen which has the production read experience. */}
        <View style={styles.streamPlaceholder}>
          <Text style={styles.streamPlaceholderText}>
            {lang === 'es'
              ? 'Las piezas del capítulo viven en la pantalla detallada — toca arriba para entrar.'
              : 'Chapter pieces live on the detail screen — tap above to enter.'}
          </Text>
        </View>
      </ScrollView>

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
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.paper },
  scroll: { paddingTop: 56, paddingBottom: 96 },

  marigoldHalo: {
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
    shadowOpacity: 0.18, shadowRadius: 14, elevation: 2,
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

  // Colored chapter band — full-width
  chapterBand: {
    marginTop: 18,
    paddingHorizontal: 22, paddingTop: 22, paddingBottom: 20,
    overflow: 'hidden',
    shadowColor: T.walnut, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18, shadowRadius: 18, elevation: 3,
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

  // Stream placeholder
  streamPlaceholder: {
    marginTop: 24, marginHorizontal: 22,
    padding: 20, borderRadius: 10,
    backgroundColor: T.card,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
    alignItems: 'center',
  },
  streamPlaceholderText: {
    fontFamily: FONTS.v2_body, fontSize: 12.5, color: T.walnut,
    textAlign: 'center', lineHeight: 18,
  },
});
