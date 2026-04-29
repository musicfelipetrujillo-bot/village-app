// Manual tab — the editorial product hook. Two audiences (Baby / Mom),
// 5 categories under each. Tapping a category opens a filtered article
// list driven by manual_articles (week_range × audience × category).
//
// Data source ships in a follow-up phase (manual_articles migration +
// API). Until then the screen renders the navigation surface and the
// "this week" hero card sourced from existing weekly-journey content.
import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { useHomeStore } from '@store/home';
import { getManualProgress, markManualItemComplete } from '@api/manual';
import {
  YolkCircle, YolkRing, ScribbleMark, LeafSprig, DotCluster, SparkleMark,
} from '@components/shared/DecorativeMarks';

type Audience = 'baby' | 'mom';

// The category tiles used to render generic Unicode emoji which felt off-brand
// against the rest of the editorial chrome. Tiles now compose the same hand-
// drawn `DecorativeMarks` vocabulary used on Home + Village headers, picking a
// mark and tint per category so the tile art reads as part of the moodboard
// system rather than a sticker pack.
type TileMarkKind = 'yolkCircle' | 'yolkRing' | 'leafSprig' | 'dotCluster' | 'sparkle';

interface CategoryTile {
  key: string;
  label: string;
  blurb: string;
  mark: TileMarkKind;
  markTint: string;
  bg: string;
}

const BABY_CATEGORIES = (t: (k: string) => string): CategoryTile[] => [
  { key: 'feed',  label: t('manual.babyFeed'),  blurb: t('manual.babyFeedBlurb'),  mark: 'yolkCircle', markTint: COLORS.rust,      bg: COLORS.blush },
  { key: 'sleep', label: t('manual.babySleep'), blurb: t('manual.babySleepBlurb'), mark: 'yolkRing',   markTint: COLORS.brownDeep, bg: COLORS.yolkLight },
  { key: 'grow',  label: t('manual.babyGrow'),  blurb: t('manual.babyGrowBlurb'),  mark: 'leafSprig',  markTint: COLORS.olive,     bg: COLORS.lime },
  { key: 'care',  label: t('manual.babyCare'),  blurb: t('manual.babyCareBlurb'),  mark: 'dotCluster', markTint: COLORS.diner,     bg: COLORS.dinerLight },
  { key: 'tips',  label: t('manual.babyTips'),  blurb: t('manual.babyTipsBlurb'),  mark: 'sparkle',    markTint: COLORS.brownDeep, bg: COLORS.ceramicDeep },
];

const MOM_CATEGORIES = (t: (k: string) => string): CategoryTile[] => [
  { key: 'feel',    label: t('manual.momFeel'),    blurb: t('manual.momFeelBlurb'),    mark: 'yolkRing',   markTint: COLORS.rust,      bg: COLORS.blush },
  { key: 'heal',    label: t('manual.momHeal'),    blurb: t('manual.momHealBlurb'),    mark: 'leafSprig',  markTint: COLORS.olive,     bg: COLORS.lime },
  { key: 'nourish', label: t('manual.momNourish'), blurb: t('manual.momNourishBlurb'), mark: 'yolkCircle', markTint: COLORS.rust,      bg: COLORS.yolkLight },
  // "Rest" reads better as a soft moon-like ring on a quiet ceramic ground —
  // the prior dotCluster on dinerLight read as busy/active, the opposite of rest.
  { key: 'rest',    label: t('manual.momRest'),    blurb: t('manual.momRestBlurb'),    mark: 'yolkRing',   markTint: COLORS.textLight, bg: COLORS.ceramicDeep },
  { key: 'tips',    label: t('manual.momTips'),    blurb: t('manual.momTipsBlurb'),    mark: 'sparkle',    markTint: COLORS.brownDeep, bg: COLORS.ceramicDeep },
];

// Renders the per-category mark inside a fixed 60×60 wrapper. The wrapper sits
// inside `tileArt` (which is `alignItems:center, justifyContent:center`) so the
// marks get centered automatically — and because every mark is `position:
// absolute` with top/left props, we anchor each one with manual offsets that
// roughly center it in the 60-square wrapper.
function TileMark({ kind, tint }: { kind: TileMarkKind; tint: string }) {
  return (
    <View style={styles.tileMarkWrap}>
      {kind === 'yolkCircle' && <YolkCircle size={52} top={4} left={4} tint={tint} opacity={0.85} />}
      {kind === 'yolkRing'   && <YolkRing   size={50} top={5} left={5} tint={tint} />}
      {kind === 'leafSprig'  && <LeafSprig  size={56} top={2} left={2} tint={tint} />}
      {kind === 'dotCluster' && <DotCluster        top={14} left={12} tint={tint} />}
      {kind === 'sparkle'    && <SparkleMark size={42} top={6} left={18} tint={tint} />}
    </View>
  );
}

export default function ManualHomeScreen() {
  const navigation = useNavigation<any>();
  const t = useT();
  const [audience, setAudience] = useState<Audience>('mom');
  const babyProfile = useHomeStore((s) => s.babyProfile);
  const week = Math.max(1, babyProfile?.current_week_number ?? 1);

  const tiles = useMemo(
    () => (audience === 'baby' ? BABY_CATEGORIES(t) : MOM_CATEGORIES(t)),
    [audience, t],
  );

  // Numbered editorial reading list — moodboard's "DAY N · EARLY MORNING"
  // pattern. 4 items mapped to the four moments of the week's journey, each
  // routes into WeeklyJourney (the existing screen owns the long-form copy).
  // Filled checkmark = completed, open circle = todo; the "X/N watched"
  // strip + thin progress fill animate off real data from migration 049's
  // manual_completions ledger. Tapping a row marks it complete (idempotent
  // upsert) and immediately optimistically updates the local Set so the UI
  // doesn't wait on the server roundtrip before flipping the indicator.
  const readingItems = useMemo(() => [
    { n: '01', titleKey: 'manual.todayItem01Title', bodyKey: 'manual.todayItem01Body' },
    { n: '02', titleKey: 'manual.todayItem02Title', bodyKey: 'manual.todayItem02Body' },
    { n: '03', titleKey: 'manual.todayItem03Title', bodyKey: 'manual.todayItem03Body' },
    { n: '04', titleKey: 'manual.todayItem04Title', bodyKey: 'manual.todayItem04Body' },
  ], []);
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());

  // Refresh progress on focus + on week change. WeeklyJourney is the screen
  // that the rows route into — coming back to Manual should reflect any
  // new completions written elsewhere (we keep the optimistic-update path
  // for snappy taps, this is the safety net).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getManualProgress(week)
        .then((set) => { if (!cancelled) setDoneSet(set); })
        .catch(() => { /* fail-soft: keep local Set, ledger isn't load-bearing */ });
      return () => { cancelled = true; };
    }, [week]),
  );

  const handleRowPress = useCallback((itemKey: string) => {
    // Optimistic: mark done locally first so the open circle flips to a
    // filled check before the navigation happens. Server write is fire-and-
    // forget — failure means the next focus-refresh will reconcile.
    setDoneSet((prev) => {
      if (prev.has(itemKey)) return prev;
      const next = new Set(prev);
      next.add(itemKey);
      return next;
    });
    markManualItemComplete(week, itemKey).catch(() => { /* fail-soft */ });
    navigation.navigate('WeeklyJourney' as never, { week } as never);
  }, [navigation, week]);

  const watchedCount = readingItems.filter((i) => doneSet.has(i.n)).length;
  const totalCount = readingItems.length;
  const progressPct = totalCount === 0 ? 0 : Math.round((watchedCount / totalCount) * 100);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {/* Editorial decoration — yolk circle behind eyebrow + leaf sprig
              top-right + scribble next to title, mirroring the moodboard's
              hand-drawn marker accents on the Manual hero. */}
          <YolkCircle size={48} top={-6} left={-12} tint={COLORS.yolkLight} opacity={0.55} />
          <LeafSprig size={48} top={-4} right={4} tint={COLORS.olive} />
          <ScribbleMark size={28} top={64} right={20} tint={COLORS.brownDeep} />
          <Text style={styles.eyebrow}>{t('manual.eyebrow')}</Text>
          <Text style={styles.title}>
            {t('manual.title')}<Text style={styles.titleItalic}>{t('manual.titleAccent')}</Text>
          </Text>
          <Text style={styles.subtitle}>{t('manual.subtitle')}</Text>
        </View>

        {/* Numbered editorial reading list — moodboard pattern.
            "WEEK N · TODAY'S READING" eyebrow + 4 numbered items, each
            opens WeeklyJourney (source of the long-form copy). */}
        <View style={styles.readingBlock}>
          <View style={styles.readingHeader}>
            <View style={styles.readingAccentBar} />
            <Text style={styles.readingHeaderText}>
              {t('manual.todayEyebrow', { week })}
            </Text>
          </View>
          {/* Progress strip — moodboard's "X/N watched" + thin filled bar. */}
          <Text style={styles.readingProgressLabel}>
            {watchedCount}/{totalCount} watched.
          </Text>
          <View style={styles.readingProgressTrack}>
            <View style={[styles.readingProgressFill, { width: `${progressPct}%` }]} />
          </View>
          {readingItems.map((item, idx) => {
            const isDone = doneSet.has(item.n);
            return (
              <TouchableOpacity
                key={item.n}
                style={[styles.readingRow, idx === readingItems.length - 1 && styles.readingRowLast]}
                onPress={() => handleRowPress(item.n)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={t(item.titleKey)}
                accessibilityState={{ checked: isDone }}
              >
                {/* Filled check for completed items, open circle for todo. */}
                <View style={[styles.readingCheck, isDone && styles.readingCheckDone]}>
                  {isDone ? <Text style={styles.readingCheckMark}>✓</Text> : null}
                </View>
                <Text style={styles.readingNumDisplay}>{item.n}</Text>
                <View style={styles.readingBody}>
                  <Text style={styles.readingTitle}>{t(item.titleKey)}</Text>
                  <Text style={styles.readingDesc} numberOfLines={2}>{t(item.bodyKey)}</Text>
                </View>
                <Text style={styles.readingArrow}>›</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={styles.readingContinuePill}
            onPress={() => navigation.navigate('WeeklyJourney' as never, { week } as never)}
            accessibilityRole="button"
          >
            <Text style={styles.readingContinuePillText}>
              {t('manual.todayContinue', { week })} →
            </Text>
          </TouchableOpacity>
        </View>

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

        {/* Category grid */}
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.key}
              style={styles.tile}
              onPress={() => navigation.navigate('ManualCategory' as never, {
                audience, category: tile.key, label: tile.label,
              } as never)}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityLabel={`${tile.label} — ${tile.blurb}`}
            >
              <View style={[styles.tileArt, { backgroundColor: tile.bg }]}>
                <TileMark kind={tile.mark} tint={tile.markTint} />
              </View>
              <Text style={styles.tileLabel}>{tile.label}</Text>
              <Text style={styles.tileBlurb} numberOfLines={2}>{tile.blurb}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.ceramic },
  content: { paddingTop: 64, paddingBottom: 96, paddingHorizontal: 20 },

  header: { marginBottom: 24 },
  eyebrow: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, color: COLORS.diner,
    letterSpacing: 1.6, textTransform: 'uppercase', marginBottom: 10,
  },
  title: {
    fontSize: 38, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    lineHeight: 44, marginBottom: 6,
  },
  titleItalic: {
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
  },
  subtitle: {
    fontSize: 14, fontFamily: FONTS.body, color: COLORS.textMid,
    fontStyle: 'italic', lineHeight: 20,
  },

  // Numbered editorial reading list — moodboard pattern.
  readingBlock: {
    backgroundColor: COLORS.paper,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: COLORS.ceramicDeep,
  },
  readingHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginBottom: 10,
  },
  readingAccentBar: {
    width: 18, height: 2, backgroundColor: COLORS.diner, borderRadius: 1,
  },
  readingHeaderText: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.6,
    color: COLORS.diner, textTransform: 'uppercase',
  },
  // "X/N watched" strip — moodboard pattern.
  readingProgressLabel: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid,
    marginBottom: 6,
  },
  readingProgressTrack: {
    height: 3, borderRadius: 2, backgroundColor: COLORS.ceramicDeep,
    marginBottom: 4, overflow: 'hidden',
  },
  readingProgressFill: {
    height: '100%', backgroundColor: COLORS.diner,
  },
  readingRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.ceramicDeep,
  },
  readingRowLast: { borderBottomWidth: 0 },
  // Open circle / filled check indicator. Open circle = todo, filled diner =
  // watched. Replaces the inline italic number.
  readingCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, borderColor: COLORS.ceramicDeep,
    backgroundColor: COLORS.paper,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 2,
  },
  readingCheckDone: {
    backgroundColor: COLORS.yolkLight,
    borderColor: COLORS.yolkLight,
  },
  readingCheckMark: {
    fontSize: 13, color: COLORS.brownDeep, fontFamily: FONTS.bodySemiBold,
    lineHeight: 14,
  },
  // Prominent Playfair italic number — moodboard's "01 / 02 / 03 / 04"
  // editorial accent. Sits between the check indicator and the title block.
  readingNumDisplay: {
    fontSize: 28, fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.diner, marginTop: -4,
    minWidth: 32,
  },
  readingBody: { flex: 1 },
  readingTitle: {
    fontSize: 16, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    marginBottom: 3, lineHeight: 21,
  },
  readingDesc: {
    fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMid,
    lineHeight: 17,
  },
  readingArrow: {
    fontSize: 22, color: COLORS.textLight, fontFamily: FONTS.bodySemiBold,
    marginTop: 2,
  },
  // Yellow "Continue Week N" pill — moodboard's yolk-tinted CTA.
  readingContinuePill: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.yolkLight,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 999,
    marginTop: 12, marginBottom: 14,
  },
  readingContinuePillText: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep,
    letterSpacing: 0.3,
  },

  toggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.ceramicDeep,
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
  toggleBtnActive: { backgroundColor: COLORS.paper },
  toggleText: {
    fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid,
    letterSpacing: 0.4,
  },
  toggleTextActive: { color: COLORS.brownDeep },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: {
    width: '47.5%',
    backgroundColor: COLORS.paper,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1, borderColor: COLORS.ceramicDeep,
  },
  tileArt: {
    width: '100%', height: 80, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  // Fixed 60×60 positioning origin for the absolutely-positioned DecorativeMark
  // children. Centered by tileArt's flex centering — each mark uses manual
  // top/left offsets in `<TileMark/>` to sit roughly centered in this box.
  tileMarkWrap: { width: 60, height: 60 },
  tileLabel: {
    fontSize: 16, fontFamily: FONTS.headerBold, color: COLORS.brownDeep,
    marginBottom: 2,
  },
  tileBlurb: {
    fontSize: 12, fontFamily: FONTS.body, color: COLORS.textMid,
    lineHeight: 16,
  },
});
