// V4 Phase G3 — Perks list (brand deals feed, category + age filters)
// Reworked 2026-08-09 to the "mamas corner" calm pattern (Felipe: "calm and
// organized, not chaotic/wordy"): calm header (BackButton + dot + lowercase
// title + bee), ONE short intro line, a quiet chip filter row, and ONE quiet
// bordered list of rows (logo/emoji square + brand + ≤5-word blurb + chevron).
// The editorial masthead + card-heavy feed were cut. Nav + data unchanged.
import React, { useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { BackButton } from '@components/shared/BackButton';
import { usePerksStore } from '@store/perks';
import { useHomeStore } from '@store/home';
import {
  categoryLabel,
  type PerkCard,
  type DealCategory,
} from '@api/perks';
import type { AgeTag } from '@api/events';
import { useT } from '@/i18n';

type TFn = (key: string, params?: Record<string, string | number>) => string;

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

const ROSE = '#C24A63', ROSE_DEEP = '#9E2F4C';
const INK = '#43260F', INKSOFT = '#7A5A3A';

const CATEGORY_FILTER_KEYS: { key: DealCategory | 'all'; labelKey: string }[] = [
  { key: 'all',      labelKey: 'perksList.filterAll' },
  { key: 'feeding',  labelKey: 'perksList.filterFeeding' },
  { key: 'gear',     labelKey: 'perksList.filterGear' },
  { key: 'learning', labelKey: 'perksList.filterLearning' },
  { key: 'health',   labelKey: 'perksList.filterHealth' },
  { key: 'apparel',  labelKey: 'perksList.filterApparel' },
];

const CATEGORY_EMOJI: Record<DealCategory, string> = {
  feeding: '🍼', sleep: '😴', gear: '🧸', apparel: '👕',
  health: '🩹', learning: '📚', services: '✨', other: '🎁',
};

export default function PerksListScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { perks, loading, fetchPerks } = usePerksStore();
  const { babyProfile } = useHomeStore();
  const [category, setCategory] = React.useState<DealCategory | 'all'>('all');
  const [ageOnly, setAgeOnly] = React.useState(true);

  const babyAgeTag = useCallback((): AgeTag | null => {
    if (!babyProfile) return null;
    const w = babyProfile.current_week_number;
    if (w <= 0) return 'pregnancy';
    if (w <= 13) return '0-3mo';
    if (w <= 26) return '3-6mo';
    if (w <= 52) return '6-12mo';
    return '12mo+';
  }, [babyProfile]);

  const load = useCallback(() => {
    const tag = ageOnly ? babyAgeTag() : null;
    fetchPerks({
      ageTags: tag ? [tag] : null,
      category: category === 'all' ? null : category,
    });
  }, [fetchPerks, category, ageOnly, babyAgeTag]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(194,74,99,0.30)', 'rgba(194,74,99,0.10)', 'rgba(252,247,239,0)']}
        locations={[0, 0.5, 1]}
        style={styles.pageWash}
      />

      {/* calm header — chevron back, dot, lowercase title, mine link, bee */}
      <View style={styles.header}>
        <BackButton color={ROSE} accessibilityLabel={t('perksList.backA11y')} />
        <View style={styles.dot} />
        <Text style={styles.hTitle}>{t('perksList.title')}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => navigation.navigate('MyClaims')} accessibilityLabel={t('perksList.mineA11y')} hitSlop={8}>
          <Text style={styles.mineLink}>{t('perksList.mine').toLowerCase()}</Text>
        </TouchableOpacity>
        <View style={styles.beeWrap}><Image source={VILLIE_BEE} style={styles.bee} /></View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={ROSE} />}
      >
        {/* one calm line */}
        <Text style={styles.intro}>{t('perksList.mastheadTitle')}</Text>

        {/* quiet filter chips */}
        <View style={styles.filterRow}>
          {CATEGORY_FILTER_KEYS.map((f) => {
            const on = category === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, on && styles.chipActive]}
                onPress={() => setCategory(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, on && styles.chipTextActive]}>{t(f.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* quiet age-match toggle */}
        {babyProfile && (
          <TouchableOpacity
            style={styles.ageRow}
            onPress={() => setAgeOnly((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: ageOnly }}
          >
            <View style={[styles.ageCheck, ageOnly && styles.ageCheckActive]}>
              {ageOnly && <Text style={styles.ageCheckMark}>✓</Text>}
            </View>
            <Text style={styles.ageText} numberOfLines={1}>
              {t('perksList.ageMatchToggleNamed', { name: babyProfile.baby_name ?? t('perksList.ageMatchToggleYourBaby') })}
            </Text>
          </TouchableOpacity>
        )}

        {loading && perks.length === 0 ? (
          <View style={styles.group}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, i < 2 && styles.divider]}>
                <View style={[styles.iconSquare, styles.skelSquare]} />
                <View style={{ flex: 1 }}>
                  <View style={styles.skelLineWide} />
                  <View style={styles.skelLineNarrow} />
                </View>
              </View>
            ))}
          </View>
        ) : perks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('perksList.emptyTitle')}</Text>
            <Text style={styles.emptyBody}>
              {ageOnly ? t('perksList.emptyBodyAgeOn') : t('perksList.emptyBodyAgeOff')}
            </Text>
          </View>
        ) : (
          <View style={styles.group}>
            {perks.map((p, i) => (
              <PerkRow
                key={p.id}
                perk={p}
                last={i === perks.length - 1}
                onPress={() => navigation.navigate('PerkDetail', { id: p.id })}
                t={t}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function PerkRow({ perk, onPress, last, t }: { perk: PerkCard; onPress: () => void; last: boolean; t: TFn }) {
  // ≤5-word blurb: prefer the offer label (e.g. "20% off"), else the category.
  const blurb = perk.discount_label ?? categoryLabel(perk.category);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.row, !last && styles.divider]}
      accessibilityRole="button"
      accessibilityLabel={perk.brand_name}
    >
      {perk.brand_logo_url ? (
        <Image source={{ uri: perk.brand_logo_url }} style={styles.iconSquare} resizeMode="cover" />
      ) : (
        <View style={styles.iconSquare}><Text style={{ fontSize: 17 }}>{CATEGORY_EMOJI[perk.category]}</Text></View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{perk.brand_name}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>{blurb}</Text>
      </View>
      {perk.already_claimed
        ? <View style={styles.claimedPill}><Text style={styles.claimedPillText}>{t('perksList.claimedPill')}</Text></View>
        : <Text style={styles.chevron}>›</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },

  // calm header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingTop: 58, paddingBottom: 6, paddingHorizontal: 18,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ROSE },
  hTitle: { fontFamily: FONTS.v2_bold, fontSize: 17, color: INK, textTransform: 'lowercase' },
  mineLink: { fontFamily: FONTS.bodySemiBold, fontSize: 13.5, color: ROSE, textTransform: 'lowercase' },
  beeWrap: { opacity: 0.65 },
  bee: { width: 34, height: 34, transform: [{ rotate: '-12deg' }] },

  scroll: { paddingBottom: 120 },

  // one calm line
  intro: { paddingHorizontal: 22, paddingTop: 12, fontFamily: FONTS.v3_display, fontSize: 22, lineHeight: 28, color: INK, letterSpacing: -0.5 },

  // quiet filter chips
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 22, paddingTop: 16 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999,
    borderWidth: 1, borderColor: 'rgba(194,74,99,0.22)', backgroundColor: COLORS.v2_paper,
  },
  chipActive: { backgroundColor: ROSE, borderColor: ROSE },
  chipText: { fontSize: 12.5, fontFamily: FONTS.bodySemiBold, color: INKSOFT },
  chipTextActive: { color: '#FFFCF6' },

  // quiet age toggle
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 22, paddingTop: 14 },
  ageCheck: {
    width: 19, height: 19, borderRadius: 5,
    borderWidth: 1.5, borderColor: ROSE, alignItems: 'center', justifyContent: 'center',
  },
  ageCheckActive: { backgroundColor: ROSE },
  ageCheckMark: { color: '#FFFCF6', fontSize: 12, fontFamily: FONTS.bodySemiBold },
  ageText: { flex: 1, fontSize: 12, color: INKSOFT, fontFamily: FONTS.v2_body },

  // one quiet bordered group
  group: {
    marginHorizontal: 22, marginTop: 18, backgroundColor: COLORS.v2_paper, borderRadius: 18, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 15 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(122,74,40,0.12)' },
  iconSquare: { width: 40, height: 40, borderRadius: 11, backgroundColor: '#F6EAF0', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: FONTS.v3_display, fontSize: 16, color: INK, letterSpacing: -0.3 },
  rowSub: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: INKSOFT, marginTop: 1 },
  chevron: { fontFamily: FONTS.v2_link, fontSize: 20, color: '#C9B7A2' },
  claimedPill: { backgroundColor: '#F6EAF0', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(194,74,99,0.28)' },
  claimedPillText: { fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 0.4, color: ROSE_DEEP, fontWeight: '600' },

  // skeleton
  skelSquare: { backgroundColor: '#EFE2E8' },
  skelLineWide: { height: 12, width: '55%', borderRadius: 6, backgroundColor: '#EFE2E8' },
  skelLineNarrow: { height: 9, width: '32%', borderRadius: 5, backgroundColor: '#F1E7EC', marginTop: 7 },

  // empty
  empty: { alignItems: 'center', paddingVertical: 56, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: INK, marginBottom: 5 },
  emptyBody: { fontSize: 13, color: INKSOFT, textAlign: 'center', fontFamily: FONTS.v2_body },
});
