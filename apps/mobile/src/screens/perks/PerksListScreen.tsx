// V4 Phase G3 — Perks list (brand deals feed, category + age filters)
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { cardLift, cardLiftBorder } from '@utils/cardLift';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { LinearGradient } from 'expo-linear-gradient';
import { usePerksStore } from '@store/perks';
import { useHomeStore } from '@store/home';
import {
  categoryLabel,
  type PerkCard,
  type DealCategory,
} from '@api/perks';
import { PerkCardSkeleton } from '@components/shared/SkeletonLoader';
import type { AgeTag } from '@api/events';
import { useT } from '@/i18n';

type TFn = (key: string, params?: Record<string, string | number>) => string;

const CATEGORY_FILTER_KEYS: { key: DealCategory | 'all'; labelKey: string }[] = [
  { key: 'all',      labelKey: 'perksList.filterAll' },
  { key: 'feeding',  labelKey: 'perksList.filterFeeding' },
  { key: 'gear',     labelKey: 'perksList.filterGear' },
  { key: 'learning', labelKey: 'perksList.filterLearning' },
  { key: 'health',   labelKey: 'perksList.filterHealth' },
  { key: 'apparel',  labelKey: 'perksList.filterApparel' },
];

export default function PerksListScreen() {
  const t = useT();
  const navigation = useNavigation<any>();
  const { perks, loading, fetchPerks } = usePerksStore();
  const { babyProfile } = useHomeStore();
  const [category, setCategory] = useState<DealCategory | 'all'>('all');
  const [ageOnly, setAgeOnly] = useState(true);

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
        colors={['rgba(233,138,106,0.40)', 'rgba(233,138,106,0.12)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityLabel={t('perksList.backA11y')}>
          <Text style={styles.back}>{t('perksList.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('perksList.title')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('MyClaims')} accessibilityLabel={t('perksList.mineA11y')}>
          <Text style={styles.headerLink}>{t('perksList.mine')}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.masthead}>
        <View style={styles.mastheadEyebrowRow}>
          <View style={styles.mastheadAccentBar} />
          <Text style={styles.mastheadEyebrow}>{t('perksList.mastheadEyebrow')}</Text>
        </View>
        <Text style={styles.mastheadTitle}>{t('perksList.mastheadTitle')}</Text>
        <Text style={styles.mastheadSub}>{t('perksList.mastheadSub')}</Text>
      </View>

      <View style={styles.filterRow}>
        {CATEGORY_FILTER_KEYS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, category === f.key && styles.chipActive]}
            onPress={() => setCategory(f.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: category === f.key }}
          >
            <Text style={[styles.chipText, category === f.key && styles.chipTextActive]}>
              {t(f.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
          <Text style={styles.ageText}>
            {t('perksList.ageMatchToggleNamed', { name: babyProfile.baby_name ?? t('perksList.ageMatchToggleYourBaby') })}
          </Text>
        </TouchableOpacity>
      )}

      {loading && perks.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <PerkCardSkeleton />
          <PerkCardSkeleton />
          <PerkCardSkeleton />
        </View>
      ) : (
        <FlashList
          data={perks}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <PerkCardView
              perk={item}
              onPress={() => navigation.navigate('PerkDetail', { id: item.id })}
              t={t}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('perksList.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>
                {ageOnly
                  ? t('perksList.emptyBodyAgeOn')
                  : t('perksList.emptyBodyAgeOff')}
              </Text>
            </View>
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={COLORS.coco} />}
        />
      )}
    </View>
  );
}

function PerkCardView({ perk, onPress, t }: { perk: PerkCard; onPress: () => void; t: TFn }) {
  // Concept B feed-row pattern — eyebrow + italic Playfair brand + title +
  // bullet-dot meta + footer chips. Mirrors SpecialistCard / DonorCard.
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9} accessibilityRole="button">
      {/* Eyebrow row — category + partner badge */}
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardCategory}>{categoryLabel(perk.category).toUpperCase()}</Text>
        {perk.is_partner && <Text style={styles.partnerBadge}>{t('perksList.partnerBadge')}</Text>}
      </View>
      {/* Italic Playfair brand — the editorial hero line. Brand carries
          the italic-terra accent the way a surname does on the specialist
          card; the perk title sits in body type underneath. */}
      <Text style={styles.brandHero}>{perk.brand_name}</Text>
      <Text style={styles.cardTitle} numberOfLines={2}>{perk.title}</Text>
      {perk.short_description ? (
        <Text style={styles.cardDesc} numberOfLines={2}>{perk.short_description}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        {perk.discount_label && (
          <View style={styles.offerChip}>
            <Text style={styles.offerChipText}>{perk.discount_label.toUpperCase()}</Text>
          </View>
        )}
        {perk.already_claimed && (
          <View style={styles.claimedChip}>
            <Text style={styles.claimedChipText}>{t('perksList.claimedPill').toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 620 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  back: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },
  headerLink: { fontSize: 14, color: '#E84B79', fontFamily: FONTS.bodySemiBold },

  // Editorial masthead — see EventsListScreen for rationale. Same accent-bar
  // + uppercase eyebrow + Playfair italic signature so the page matches the
  // Home / Me magazine spread.
  masthead: {
    backgroundColor: COLORS.paper,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
  },
  mastheadEyebrowRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
  },
  mastheadAccentBar: {
    width: 12, height: 2, backgroundColor: COLORS.coco,
    marginRight: 8, borderRadius: 1,
  },
  mastheadEyebrow: {
    fontSize: 11, lineHeight: 16, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.barkSoft, textTransform: 'uppercase',
  },
  mastheadTitle: {
    fontSize: 28, lineHeight: 34,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark, marginBottom: 4,
  },
  mastheadSub: {
    fontSize: 13, lineHeight: 19, color: COLORS.barkSoft,
    fontFamily: FONTS.body, maxWidth: 340,
  },

  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.paper,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.18)', backgroundColor: COLORS.paper,
  },
  chipActive: { backgroundColor: COLORS.coco, borderColor: COLORS.coco },
  chipText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  chipTextActive: { color: '#FFFCF6' },

  ageRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: COLORS.paper,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  ageCheck: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: COLORS.coco,
    alignItems: 'center', justifyContent: 'center',
  },
  ageCheckActive: { backgroundColor: COLORS.coco },
  ageCheckMark: { color: '#FFFCF6', fontSize: 13, fontFamily: FONTS.bodySemiBold },
  ageText: { fontSize: 12, color: COLORS.barkSoft, flex: 1 },

  // Perk card — paper-lifted v3 surface (was flat per blend audit).
  card: {
    backgroundColor: COLORS.v2_card,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    ...cardLiftBorder,
    ...cardLift,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCategory: { fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.6, color: '#C76B41' }, // Perks signature: coral
  partnerBadge: {
    fontSize: 9, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.6, color: COLORS.sand,
    backgroundColor: 'rgba(196,163,90,0.15)', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2,
  },
  // Italic Playfair brand hero — the editorial accent that carries each card.
  brandHero: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: FONTS.headerItalic,
    fontStyle: 'italic',
    color: '#C76B41', // Perks signature: coral brand line
    marginTop: 2,
  },
  cardTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 4 },
  cardDesc: { fontSize: 12, color: COLORS.barkSoft, marginTop: 6, lineHeight: 17 },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 12, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.sandSoft,
  },
  offerChip: {
    borderWidth: 1, borderColor: COLORS.coco, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  offerChipText: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.6, color: '#7A4A24',
  },
  claimedChip: {
    borderWidth: 1, borderColor: COLORS.sage, borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  claimedChipText: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.6, color: COLORS.sage,
  },
  arrow: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: COLORS.coco },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 4 },
  emptyBody: { fontSize: 13, color: COLORS.textLight, textAlign: 'center' },
});
