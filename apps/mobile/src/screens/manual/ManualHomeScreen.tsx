// Manual tab — the editorial product hook. Two audiences (Baby / Mom),
// 5 categories under each. Tapping a category opens a 2-col video grid for
// that (audience, category) bucket (ManualCategoryScreen).
//
// 2026-05-01 video pivot: Manual is now a short-video library (Mux-hosted,
// ≤2 min, EN+ES captions). The home surface composes:
//   1. editorial header (eyebrow + Playfair italic title + decorative marks)
//   2. "This week to watch" — 4-thumbnail curated row (list_this_week_manual)
//   3. audience toggle (Mom / Baby)
//   4. 5-tile category grid — all tiles equally weighted; Care now carries
//      symptom/triage videos (gas vs colic, reflux normal-or-call) which the
//      prior article-era Manual couldn't source from milestone_library.
//
// Tapping a category tile → ManualCategory grid. Tapping a "this week"
// thumbnail → ManualVideo player. The standalone "Continue Week N →" pill
// from the article-era home is gone — Home owns weekly journey routing.
import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image,
  ActivityIndicator, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// v9 compact rows don't use the SVG tile art — chapters now render as
// horizontal rows with spine + Roman numeral + Playfair italic accent.
// ManualTileArt is kept in the codebase for potential reuse but no
// longer imported here.
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useUserStore } from '@store/user';
import { useHomeStore } from '@store/home';
import {
  listThisWeekManual,
  formatDuration,
  type ManualVideoTile,
} from '@/api/manual';

// Bee flight path — starts 60px below resting spot, rises with a 2.5-cycle
// sine bob, ends exactly at rest. Computed once at module load.
const _BEE_N = 60;
const _BEE_INPUT = Array.from({ length: _BEE_N + 1 }, (_, i) => i / _BEE_N);
const _BEE_SINE_Y = _BEE_INPUT.map(
  t => (1 - t) * (60 - Math.sin(t * Math.PI * 2.5) * 20)
);
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

// AsyncStorage key — gates the FIRST focus per app session so the bee
// doesn't auto-replay on every cold launch the same day. In-session
// tab refocus still replays the bee.
const BEE_LAST_PLAYED_KEY = 'village.beeLastPlayedDate.v1';

const PAGE_BANNER = require('../../../assets/gradients/banner-rust-light.png');

type Audience = 'baby' | 'mom';

// The category tiles used to render generic Unicode emoji which felt off-brand
// against the rest of the editorial chrome. Tiles now compose the same hand-
// drawn `DecorativeMarks` vocabulary used on Home + Village headers, picking a
// mark and tint per category so the tile art reads as part of the moodboard
// system rather than a sticker pack.
type TileMarkKind = 'yolkCircle' | 'yolkRing' | 'leafSprig' | 'dotCluster' | 'sparkle';

// ═══════════════════════════════════════════════════════════════════════
// Chapter palette — light tile pastel + deep accent (mark tint).
// Mirrors the 5-family system in ManualCategoryScreen.CHAPTER_THEME and
// HomeScreen's MANUAL_PILL_COLORS, so all three surfaces speak the same
// color story: tile bg here = chapter bg there, mark tint here = chapter
// accent there.
//
// v9 chapter family palette — kit canon (brand kit page 02·E + phone mockup).
// 5 families across 10 chapters — each mom chapter and its baby counterpart
// share the same family so paired concepts read as the same room. Within mom
// (5 chapters) the 5 families never repeat; same for baby.
//
//   Pair                Family
//   ──────────────────  ──────────────────────────────────────
//   feel  / grow   →    SALMON   (empathy, warmth, expansion)
//   heal  / care   →    MOSS     (body, recovery, garden)
//   nourish / feed →    BUTTER   (fuel, halo)
//   rest  / sleep  →    SAGE     (kit "cool exhale", quiet)
//   tips  / tips   →    MARIGOLD (kit "hero pop", small wins)
// ═══════════════════════════════════════════════════════════════════════
type ChapterFamily = { bg: string; accent: string };
const FAMILY_SALMON:   ChapterFamily = { bg: '#FBE3DF', accent: '#EDA8A0' };
const FAMILY_MOSS:     ChapterFamily = { bg: '#E6EAD0', accent: '#606E46' };
const FAMILY_BUTTER:   ChapterFamily = { bg: '#FDF1D0', accent: '#FAD080' };
const FAMILY_SAGE:     ChapterFamily = { bg: '#EEEACE', accent: '#D8CEB0' };
const FAMILY_MARIGOLD: ChapterFamily = { bg: '#FBE890', accent: '#F2C130' };
const TILE_FAMILY: Record<string, Record<string, ChapterFamily>> = {
  mom: {
    feel:    FAMILY_SALMON,
    heal:    FAMILY_MOSS,
    nourish: FAMILY_BUTTER,
    rest:    FAMILY_SAGE,
    tips:    FAMILY_MARIGOLD,
  },
  baby: {
    feed:  FAMILY_BUTTER,    // baby feeding = mom nourishing (same family)
    sleep: FAMILY_SAGE,      // sleep = sage "cool exhale"
    grow:  FAMILY_SALMON,    // growth/milestones = warmth + empathy
    care:  FAMILY_MOSS,      // body/healing = moss garden
    tips:  FAMILY_MARIGOLD,  // small wins = marigold hero pop
  },
};

interface CategoryTile {
  key: string;
  /** Editorial title prefix — e.g. "Time to", "How they", "Real-world". */
  prefix: string;
  /** Italic emphasized word with terminal period — e.g. "feel.", "grow.". */
  emWord: string;
  /** Roman numeral for the row decoration. */
  roman: string;
  /** Static page number for the "p. NN" folio mark. */
  folio: number;
  label: string;
  blurb: string;
  mark: TileMarkKind;
  markTint: string;
  bg: string;
}

// markTint now flows from each chapter's accent (deep family color) so the
// hand-drawn mark sits in the same color story as the tile bg — pink tile +
// terracotta mark, sage tile + moss mark, etc.
//
// v9 compact-row additions:
//   • `prefix` + `emWord` — composes the editorial chapter title
//     ("Time to feel.", "Real-world tips.", "How they grow.") matching
//     ManualCategoryScreen.HERO_TITLE so the row → page transition keeps
//     the same wording. EN-only for now; ES will add when localized.
//   • `roman` — Roman numeral for the row (decorative).
//   • `folio` — static page number for the "p. NN" mark (decorative).
const BABY_CATEGORIES = (t: (k: string) => string): CategoryTile[] => [
  { key: 'feed',  prefix: 'How they', emWord: 'feed.',  roman: 'I',   folio: 14, label: t('manual.babyFeed'),  blurb: t('manual.babyFeedBlurb'),  mark: 'yolkCircle', markTint: TILE_FAMILY.baby.feed.accent,  bg: TILE_FAMILY.baby.feed.bg },
  { key: 'sleep', prefix: 'How they', emWord: 'sleep.', roman: 'II',  folio: 28, label: t('manual.babySleep'), blurb: t('manual.babySleepBlurb'), mark: 'yolkRing',   markTint: TILE_FAMILY.baby.sleep.accent, bg: TILE_FAMILY.baby.sleep.bg },
  { key: 'grow',  prefix: 'How they', emWord: 'grow.',  roman: 'III', folio: 42, label: t('manual.babyGrow'),  blurb: t('manual.babyGrowBlurb'),  mark: 'leafSprig',  markTint: TILE_FAMILY.baby.grow.accent,  bg: TILE_FAMILY.baby.grow.bg },
  { key: 'care',  prefix: 'How to',   emWord: 'care.',  roman: 'IV',  folio: 56, label: t('manual.babyCare'),  blurb: t('manual.babyCareBlurb'),  mark: 'dotCluster', markTint: TILE_FAMILY.baby.care.accent,  bg: TILE_FAMILY.baby.care.bg },
  { key: 'tips',  prefix: 'Tiny',     emWord: 'wins.',  roman: 'V',   folio: 70, label: t('manual.babyTips'),  blurb: t('manual.babyTipsBlurb'),  mark: 'sparkle',    markTint: TILE_FAMILY.baby.tips.accent,  bg: TILE_FAMILY.baby.tips.bg },
];

const MOM_CATEGORIES = (t: (k: string) => string): CategoryTile[] => [
  { key: 'feel',    prefix: 'Time to',    emWord: 'feel.',    roman: 'I',   folio: 14, label: t('manual.momFeel'),    blurb: t('manual.momFeelBlurb'),    mark: 'yolkRing',   markTint: TILE_FAMILY.mom.feel.accent,    bg: TILE_FAMILY.mom.feel.bg },
  { key: 'heal',    prefix: 'Time to',    emWord: 'heal.',    roman: 'II',  folio: 28, label: t('manual.momHeal'),    blurb: t('manual.momHealBlurb'),    mark: 'leafSprig',  markTint: TILE_FAMILY.mom.heal.accent,    bg: TILE_FAMILY.mom.heal.bg },
  { key: 'nourish', prefix: 'Time to',    emWord: 'nourish.', roman: 'III', folio: 42, label: t('manual.momNourish'), blurb: t('manual.momNourishBlurb'), mark: 'yolkCircle', markTint: TILE_FAMILY.mom.nourish.accent, bg: TILE_FAMILY.mom.nourish.bg },
  { key: 'rest',    prefix: 'Time to',    emWord: 'rest.',    roman: 'IV',  folio: 56, label: t('manual.momRest'),    blurb: t('manual.momRestBlurb'),    mark: 'yolkRing',   markTint: TILE_FAMILY.mom.rest.accent,    bg: TILE_FAMILY.mom.rest.bg },
  { key: 'tips',    prefix: 'Real-world', emWord: 'tips.',    roman: 'V',   folio: 70, label: t('manual.momTips'),    blurb: t('manual.momTipsBlurb'),    mark: 'sparkle',    markTint: TILE_FAMILY.mom.tips.accent,    bg: TILE_FAMILY.mom.tips.bg },
];

// Per-category tile artwork is now the SVG component at
// `@components/shared/ManualTileArt`. The mapping from category key
// to scene lives there (SCENE_BY_CATEGORY) so the screen never has
// to know which key maps to which illustration.

export default function ManualHomeScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const lang = useUserStore((s) => s.profile?.preferred_language ?? 'en') as 'en' | 'es';
  const [audience, setAudience] = useState<Audience>('mom');
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const week = Math.max(1, babyProfile?.current_week_number ?? 1);

  // Bee flight: progress 0→1 drives X (left→right) + Y (below→rest, sine bob).
  // beeRandX/Y add a small random landing drift that fades in at the very end
  // so the bee settles at a slightly different spot each visit.
  const beeAnim    = useRef(new Animated.Value(0)).current;
  const beeRandX   = useRef(new Animated.Value(0)).current;
  const beeRandY   = useRef(new Animated.Value(0)).current;
  // First-focus-of-session ref. On the very first focus this session we
  // gate the play behind a daily AsyncStorage check (so cold-launching the
  // app a second time the same day doesn't re-trigger). On every
  // subsequent focus (leaving + returning to the tab) the animation
  // always replays.
  const firstFocusRef = useRef(true);
  const beeBaseX   = useRef(beeAnim.interpolate({ inputRange: [0, 1], outputRange: [-300, 0] })).current;
  const beeBaseY   = useRef(beeAnim.interpolate({ inputRange: _BEE_INPUT, outputRange: _BEE_SINE_Y })).current;
  const beeFade    = useRef(beeAnim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0, 0, 1] })).current;
  const beeTranslateX = useRef(Animated.add(beeBaseX, Animated.multiply(beeRandX, beeFade))).current;
  const beeTranslateY = useRef(Animated.add(beeBaseY, Animated.multiply(beeRandY, beeFade))).current;
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    (async () => {
      const isFirst = firstFocusRef.current;
      firstFocusRef.current = false;
      if (isFirst) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const last = await AsyncStorage.getItem(BEE_LAST_PLAYED_KEY);
          if (last === today) return;
          await AsyncStorage.setItem(BEE_LAST_PLAYED_KEY, today);
        } catch {
          // storage error → fall through and play
        }
      }
      if (cancelled) return;
      beeRandX.setValue((Math.random() - 0.5) * 24);
      beeRandY.setValue((Math.random() - 0.5) * 16);
      beeAnim.setValue(0);
      Animated.timing(beeAnim, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: true }).start();
    })();
    return () => { cancelled = true; };
  }, [beeAnim, beeRandX, beeRandY]));

  const tiles = useMemo(
    () => (audience === 'baby' ? BABY_CATEGORIES(t) : MOM_CATEGORIES(t)),
    [audience, t],
  );

  // "This week to watch" — up to 4 curated videos for the user's current
  // week. RPC fills with highest-priority videos when fewer than 4 are
  // tagged for the week, so the row never collapses. Re-fetched on focus
  // so a freshly-watched video flips its overlay without pull-to-refresh.
  const [thisWeek, setThisWeek] = useState<ManualVideoTile[]>([]);
  const [thisWeekLoading, setThisWeekLoading] = useState(true);
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      setThisWeekLoading(true);
      (async () => {
        try {
          const list = await listThisWeekManual(week, lang);
          if (!cancelled) setThisWeek(list);
        } catch (e) {
          console.error('manual this-week load', e);
          if (!cancelled) setThisWeek([]);
        } finally {
          if (!cancelled) setThisWeekLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [week, lang]),
  );

  return (
    <View style={styles.container}>
      {/* v9 page wash — soft U-shape gradient matching HomeScreen.
          Paper-white middle with warm pink wash at top + bottom so the
          tile cards land cleanly against near-white, not flat cream. */}
      <LinearGradient
        colors={[
          '#FDF1EB', '#FDF8F4', '#FCFCFB',
          '#FCFCFB', '#FCF6EF', '#F9E9DD', '#F5DFD3',
        ]}
        locations={[0, 0.12, 0.30, 0.62, 0.76, 0.90, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Editorial header — paper-leaning cover card. Was a saturated
            golden-rose banner; now a near-paper wash with the warmth
            backed off so the editorial type + tiles do the talking. */}
        <View style={styles.header}>
          <LinearGradient
            colors={['#FCF6EF', '#F8EDE0', '#F2DDD0']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          {/* iOS-26 wet-glass top sheen — matches Home's card chrome */}
          <LinearGradient
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 18,
            }}
            pointerEvents="none"
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: StyleSheet.hairlineWidth,
              backgroundColor: 'rgba(255,255,255,0.7)',
            }}
          />
          {/* Villie bee brand mark — flies in from left on focus */}
          <Animated.Image source={VILLIE_BEE} resizeMode="contain"
            accessible={false}
            style={[styles.headerBee, { transform: [{ translateX: beeTranslateX }, { translateY: beeTranslateY }, { rotate: '12deg' }] }]} />
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBar} />
            <Text style={styles.eyebrow}>{t('manual.eyebrow')}</Text>
          </View>
          <Text style={styles.title}>
            {t('manual.title')}<Text style={styles.titleItalic}>{t('manual.titleAccent')}</Text>
          </Text>
          <Text style={styles.subtitle}>{t('manual.subtitle')}</Text>
          <View style={styles.headerRule} />

          {/* Saved-content shortcut. Sits in the top-right corner of the
              editorial header so the eyebrow + title typography stays clean.
              Routes to SavedManualScreen (migration 065). */}
          <TouchableOpacity
            style={styles.savedLink}
            onPress={() => navigation.navigate('SavedManual' as never)}
            accessibilityRole="button"
            accessibilityLabel={t('manual.savedLinkA11y')}
          >
            <Text style={styles.savedLinkIcon}>♥</Text>
            <Text style={styles.savedLinkText}>{t('manual.savedLink')}</Text>
          </TouchableOpacity>
        </View>

        {/* "This week to watch" — up to 4 curated short videos for the user's
            current week. Horizontal scroll; tap a thumb to open the player. */}
        <View style={styles.thisWeekHead}>
          <Text style={styles.thisWeekEyebrow}>{t('manual.thisWeekEyebrow', { week })}</Text>
          <Text style={styles.thisWeekTitle}>{t('manual.thisWeekTitle')}</Text>
        </View>
        {thisWeekLoading ? (
          <View style={styles.thisWeekLoading}>
            <ActivityIndicator color="#C07840" />
          </View>
        ) : thisWeek.length === 0 ? (
          <Text style={styles.thisWeekEmpty}>{t('manual.thisWeekEmpty')}</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thisWeekRow}
          >
            {thisWeek.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={styles.thisWeekCard}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('ManualVideo' as never, {
                  audience: v.audience, category: v.category, videoId: v.id,
                } as never)}
                accessibilityRole="button"
                accessibilityLabel={t('manual.videoCardA11y', {
                  title: v.title,
                  duration: formatDuration(v.duration_seconds),
                })}
              >
                <View style={styles.thisWeekThumb}>
                  <Image source={{ uri: v.thumbnail_url }} style={styles.thisWeekImg} resizeMode="cover" />
                  <View style={styles.thisWeekDuration}>
                    <Text style={styles.thisWeekDurationText}>{formatDuration(v.duration_seconds)}</Text>
                  </View>
                  {v.is_watched && (
                    <View style={styles.thisWeekWatched}>
                      <Text style={styles.thisWeekWatchedText}>{t('manual.watched')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.thisWeekCardTitle} numberOfLines={2}>{v.title}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Audience toggle */}
        <View style={styles.toggle}>
          <TouchableOpacity
            style={[styles.toggleBtn, audience === 'mom' && styles.toggleBtnActive]}
            onPress={() => setAudience('mom')}
            accessibilityRole="tab"
            accessibilityState={{ selected: audience === 'mom' }}
          >
            <Text style={[styles.toggleText, audience === 'mom' && styles.toggleTextActive]}>
              {t('manual.toggleMom')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, audience === 'baby' && styles.toggleBtnActive]}
            onPress={() => setAudience('baby')}
            accessibilityRole="tab"
            accessibilityState={{ selected: audience === 'baby' }}
          >
            <Text style={[styles.toggleText, audience === 'baby' && styles.toggleTextActive]}>
              {t('manual.toggleBaby')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* v9 compact chapter rows — all 5 chapters visible at once.
            Each row: spine + Roman numeral + editorial title + one-line
            blurb + folio + glass arrow. Per-chapter paper bg from
            TILE_FAMILY so the row palette reads as "paper-per-chapter".
            Tap-to-open routes to ManualCategoryScreen for that chapter. */}
        <View style={styles.chapterRows}>
          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={[styles.chapterRow, { backgroundColor: tile.bg, borderColor: hexToRgba(tile.markTint, 0.22) }]}
              onPress={() => navigation.navigate('ManualCategory' as never, {
                audience, category: tile.key, label: tile.label,
              } as never)}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityLabel={`${tile.prefix} ${tile.emWord} ${tile.blurb}`}
            >
              {/* Family-tinted spine on the left edge */}
              <View style={[styles.chapterSpine, { backgroundColor: tile.markTint }]} />
              {/* Roman numeral — Playfair italic in family accent */}
              <Text style={[styles.chapterNum, { color: tile.markTint }]}>{tile.roman}.</Text>
              {/* Title + blurb */}
              <View style={styles.chapterBody}>
                <Text style={styles.chapterName} numberOfLines={1}>
                  {tile.prefix} <Text style={[styles.chapterNameEm, { color: tile.markTint }]}>{tile.emWord}</Text>
                </Text>
                <Text style={styles.chapterBlurb} numberOfLines={1}>{tile.blurb}</Text>
              </View>
              {/* Folio + glass arrow */}
              <View style={styles.chapterFoot}>
                <Text style={[styles.chapterFolio, { color: tile.markTint }]}>p. {tile.folio}</Text>
                <View style={[styles.chapterArrow, { borderColor: hexToRgba(tile.markTint, 0.32) }]}>
                  {/* iOS-26 glass sheen on the arrow disc */}
                  <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    style={StyleSheet.absoluteFill as never}
                  />
                  <Text style={[styles.chapterArrowGlyph, { color: tile.markTint }]}>→</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content: { paddingTop: 0, paddingBottom: 96, paddingHorizontal: 20 },

  // Editorial masthead mirroring HomeScreen's greetingBlock — sits on the
  // page gradient (no inner panel), bark text, hairline rule, single coco
  // accent on the eyebrow bar to mark Manual's identity.
  // Soft full-bleed cover card — matches InboxHomeScreen.header dimensions
  // exactly so every tab masthead reads the same size. marginHorizontal:-20
  // bleeds past the ScrollView's 20px content inset to reach the screen
  // edges. paddingBottom is tight so the hairline rule sits right at the
  // card's bottom edge.
  header: {
    marginHorizontal: -20,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 6,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    marginBottom: 8,
    shadowColor: '#6A3820',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 2,
    position: 'relative',
  },
  headerBee: {
    // Pushed further right than Village — bee sits at the very right edge.
    position: 'absolute',
    right: -2, top: 64,
    width: 88, height: 80,
    opacity: 0.55,
  },
  eyebrowRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 10,
  },
  // v9 rust-deep accent — matches HomeScreen section eyebrows and the
  // top-bar dash on chapter screens, so every "this is a brand section"
  // mark reads in the same rust voice.
  eyebrowBar: {
    width: 22, height: 2,
    backgroundColor: '#A77349',
    marginRight: 10,
  },
  eyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold,
    color: '#A77349',
    letterSpacing: 1.8, textTransform: 'uppercase',
  },
  // Bark bold body + coco italic accent — matches HomeScreen.greetingName.
  title: {
    fontSize: 32, fontFamily: FONTS.headerBold, color: COLORS.bark,
    lineHeight: 38, letterSpacing: -0.5, marginBottom: 8,
  },
  titleItalic: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#C07840',  // v9 rust-deep — one italic flourish in the brand spark color
  },
  subtitle: {
    fontSize: 14, fontFamily: FONTS.body,
    color: COLORS.barkSoft,
    fontStyle: 'italic', lineHeight: 22,
  },
  // Hairline rule — matches HomeScreen.greetingRule.
  headerRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 14,
    width: 48,
  },
  // Saved shortcut pinned to top-right of the header. Discreet enough to not
  // compete with the editorial title but tappable on a one-handed reach.
  savedLink: {
    position: 'absolute', top: 20, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(61,31,13,0.18)',
  },
  savedLinkIcon: { fontSize: 12, color: '#C07840' },
  savedLinkText: {
    fontSize: 11, color: COLORS.bark, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3,
  },

  // "This week to watch" — horizontal-scroll row of up to 4 curated thumbs.
  thisWeekHead: { marginBottom: 10 },
  thisWeekEyebrow: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#A77349',
    letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 5,
  },
  thisWeekTitle: {
    fontSize: 22, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark,
  },
  thisWeekLoading: {
    paddingVertical: 30, alignItems: 'flex-start',
    marginBottom: 18,
  },
  thisWeekEmpty: {
    fontSize: 13, fontFamily: FONTS.body, color: COLORS.barkSoft,
    fontStyle: 'italic', marginBottom: 18,
  },
  thisWeekRow: { gap: 12, paddingRight: 8, paddingBottom: 18 },
  thisWeekCard: { width: 160 },
  thisWeekThumb: {
    width: '100%', height: 90, // 16:9 ≈ for 160w
    borderRadius: 12, overflow: 'hidden',
    backgroundColor: COLORS.sandSoft,
    marginBottom: 6,
    position: 'relative',
  },
  thisWeekImg: { width: '100%', height: '100%' },
  thisWeekDuration: {
    position: 'absolute', right: 6, bottom: 6,
    backgroundColor: 'rgba(28, 16, 8, 0.78)',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5,
  },
  thisWeekDurationText: {
    color: COLORS.paper, fontSize: 10, fontFamily: FONTS.bodySemiBold,
  },
  thisWeekWatched: {
    position: 'absolute', left: 6, top: 6,
    backgroundColor: 'rgba(92, 107, 58, 0.92)',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5,
  },
  thisWeekWatchedText: {
    color: COLORS.paper, fontSize: 9, fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.5, textTransform: 'uppercase',
  },
  thisWeekCardTitle: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    lineHeight: 16,
  },

  toggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(100, 50, 30, 0.10)',
    borderRadius: 999,
    padding: 4,
    marginBottom: 18,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  // Active tab — v9 "parchment + cinnamon border" recipe (per the V9 audit
  // curated decision 2026-05-16). Cinnamon fill was over-firing the kit's
  // "one spark per screen" rule on a reading surface; parchment+border keeps
  // the active state legible without competing with the chapter pills or
  // the page italic-accent words. This recipe is RARE — kept only for
  // primary segmented controls on hero surfaces, not propagated to filter
  // chips or settings toggles.
  toggleBtnActive: {
    backgroundColor: '#EAE0C8',                  // parchment fill (kit token)
    borderWidth: 1.5,                            // visible cinnamon outline (hairline was too thin to register)
    borderColor: '#C07840',                      // cinnamon
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 2,
  },
  toggleText: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    letterSpacing: 0.4,
  },
  toggleTextActive: { color: '#3D1F0E' },         // cocoa (kit ink — readable on parchment)

  // ── v9 Compact chapter rows ────────────────────────────────────────
  // 5 horizontal rows replace the old 2-col tile grid. Layout: spine
  // (3px left bar) + Roman numeral (Playfair italic 18px) + title block
  // (Playfair 18 roman + 18 italic em accent) + 1-line blurb + folio +
  // glass arrow disc. ~80px tall — all 5 chapters visible at once on
  // a 380×694 usable area. Tap target = full row.
  chapterRows: { gap: 8 },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 80,
    borderRadius: 14,
    paddingVertical: 12,
    paddingLeft: 18,
    paddingRight: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    position: 'relative',
    // v9 paper lift — cocoa drop matching other v9 cards
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 3,
  },
  // Left-edge spine — family-tinted (terracotta/moss/amber/slate/cinnamon)
  chapterSpine: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    width: 3,
    opacity: 0.85,
  },
  chapterNum: {
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    fontSize: 18,
    width: 22,
    textAlign: 'center',
    flexShrink: 0,
  },
  chapterBody: { flex: 1, minWidth: 0 },
  chapterName: {
    fontFamily: FONTS.headerBold,
    fontSize: 18,
    lineHeight: 20,
    letterSpacing: -0.4,
    color: COLORS.bark,
    marginBottom: 2,
  },
  chapterNameEm: {
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  chapterBlurb: {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.barkSoft,
    fontFamily: FONTS.body,
  },
  chapterFoot: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
  },
  chapterFolio: {
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    fontSize: 10,
    opacity: 0.65,
  },
  chapterArrow: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  chapterArrowGlyph: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 12,
    fontFamily: FONTS.bodyBold,
    includeFontPadding: false,
  },
});

// Small util — convert 6-digit hex to rgba string with given alpha.
// Used for chapter row border + arrow border tinted by family accent.
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
