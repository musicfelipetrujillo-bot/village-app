import React, { useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { COLORS, FONTS } from '@utils/constants';
import { getEffectiveCoords } from '@utils/devLocation';
import { useT } from '@/i18n';
import { useExpertsStore } from '@store/experts';
import { useAuthStore } from '@store/auth';
import { useUserStore, getPreferredRadiusMiles } from '@store/user';
import { SpecialistCard } from '@components/experts/SpecialistCard';
import { ExpertsListSkeleton } from '@components/shared/SkeletonLoader';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { HoneycombBackdrop } from '@components/shared/HoneycombBackdrop';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';
import type { SpecialtyType } from 'shared/src/types/v1';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'ExpertsHome'>;

type ChipFilter = Partial<{ specialty: SpecialtyType; language: string; telehealthOnly: boolean; insurance: string }>;

const FILTER_CHIPS: { i18nKey: string; key: string; value?: ChipFilter }[] = [
  { i18nKey: 'expertsHome.chipAll',        key: 'all' },
  { i18nKey: 'expertsHome.chipVirtual',    key: 'virtual',   value: { telehealthOnly: true } },
  { i18nKey: 'expertsHome.chipSpanish',    key: 'spanish',   value: { language: 'es' } },
  { i18nKey: 'expertsHome.chipIbclc',      key: 'ibclc',     value: { specialty: 'lactation_consultant' } },
  { i18nKey: 'expertsHome.chipDoula',      key: 'doula',     value: { specialty: 'doula' } },
  { i18nKey: 'expertsHome.chipSleep',      key: 'sleep',     value: { specialty: 'sleep_coach' } },
  { i18nKey: 'expertsHome.chipPelvic',     key: 'pelvic',    value: { specialty: 'pelvic_floor_pt' } },
  { i18nKey: 'expertsHome.chipTherapist',  key: 'therapist', value: { specialty: 'ppd_therapist' } },
  { i18nKey: 'expertsHome.chipDietitian',  key: 'dietitian', value: { specialty: 'perinatal_dietitian' } },
];

export default function ExpertsHomeScreen({ navigation, route }: Props) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { results, loading, filters, search, setFilters } = useExpertsStore();
  const profile = useUserStore((s) => s.profile);
  // Pre-select the chip whose value.specialty matches the deeplink hint. If
  // there's no hint or no chip matches, fall through to 'all'.
  const incomingSpecialty = route.params?.specialty;
  const initialChipKey = useMemo(() => {
    if (!incomingSpecialty) return 'all';
    const match = FILTER_CHIPS.find((c) => c.value?.specialty === incomingSpecialty);
    return match?.key ?? 'all';
  }, [incomingSpecialty]);
  const [activeChip, setActiveChip] = React.useState(initialChipKey);
  // Care two-tier filter — clinical (NPI-verified) vs extra hands (background-checked).
  const [tier, setTier] = React.useState<'all' | 'clinical' | 'help'>('all');
  const displayResults = useMemo(
    () => (tier === 'all' ? results : results.filter((r) => (r.provider_kind ?? 'clinical') === tier)),
    [results, tier],
  );

  // "My insurance" chip is conditional — only shown when the user has set
  // insurance_provider on their profile. The chip value passes that string
  // through as the LIKE filter on `specialist_insurances.insurance_name`
  // (the RPC already does case-insensitive matching).
  const insuranceProvider = profile?.insurance_provider?.trim() ?? '';
  const chips = useMemo(() => {
    if (!insuranceProvider) return FILTER_CHIPS;
    // Insert just after "All" so it's the next-most-prominent CTA.
    const myIns: typeof FILTER_CHIPS[0] = {
      i18nKey: 'expertsHome.chipMyInsurance',
      key: 'my_insurance',
      value: { insurance: insuranceProvider },
    };
    return [FILTER_CHIPS[0], myIns, ...FILTER_CHIPS.slice(1)];
  }, [insuranceProvider]);

  const doSearch = useCallback(async (extraFilters: ChipFilter = {}) => {
    let deviceCoords: { latitude: number; longitude: number } | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        deviceCoords = loc.coords;
      }
    } catch {}
    // Dev-mode override: Simulator's Cupertino default is replaced with Miami.
    const { lat, lng } = getEffectiveCoords(deviceCoords);
    // Use the user's saved radius pref (A2.a) — falls back to default when
    // store is empty (cold launch before fetchProfile resolves).
    search({ lat, lng, radiusMiles: getPreferredRadiusMiles(), ...extraFilters });
  }, [search]);

  // On mount, run the initial search with the deeplinked specialty filter
  // applied (when ExpertsHome was opened with `route.params.specialty`).
  // Falls through to a clean unfiltered search when no hint is present.
  useEffect(() => {
    if (incomingSpecialty) {
      doSearch({ specialty: incomingSpecialty });
    } else {
      doSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to deeplink params arriving AFTER mount — e.g. when user already
  // visited Experts (so screen is mounted with no params), then taps a
  // village_supports CTA on WeeklyJourneyScreen. React Navigation merges the
  // new params onto the existing screen instead of remounting, so the mount
  // effect above doesn't re-run. We re-sync the active chip + re-fire search
  // here. Skipping the very first run is handled by guarding on a ref so we
  // don't double-fire alongside the mount effect.
  const didMountRef = React.useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setActiveChip(initialChipKey);
    if (incomingSpecialty) {
      doSearch({ specialty: incomingSpecialty });
    } else {
      doSearch();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingSpecialty]);

  const applyChip = (chip: typeof FILTER_CHIPS[0]) => {
    setActiveChip(chip.key);
    doSearch(chip.value ?? {});
  };

  // Hero + chips render inside FlashList ListHeaderComponent so the
  // magazine-cover photo scrolls away as the user reads down the
  // specialist results. Standard mobile pattern — scroll back to top
  // to re-filter. Hero stays full-size at rest.
  const ListHeader = (
    <>
      {/* v3 editorial masthead 2026-05-24 — replaces the KenBurns photo
          header per Felipe. See MilkConnectHomeScreen for the pattern. */}
      <View style={[styles.mastheadWrap, { paddingTop: insets.top + 10 }]}>
        {/* Soft peach hero wash — ties the masthead to the Specialists tile
            color (Village hub) so the section reads warm + colored. */}
        <LinearGradient
          colors={['#F5CBB2', 'rgba(245,203,178,0)']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <HoneycombBackdrop accent="#F3B79C" intensity="playful" scene="specialists" />
        <View style={styles.mastheadUtility}>
          <TouchableOpacity
            onPress={() => navigation.getParent()?.navigate('Village' as never)}
            accessibilityRole="button"
            accessibilityLabel={t('common.backToVillage')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.backLink}>← {t('common.backToVillage')}</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.utilityPill}
              onPress={() => navigation.navigate('SpecialistsMap')}
              accessibilityRole="button"
              accessibilityLabel="Map view"
            >
              <Text style={styles.utilityPillText}>Map</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.utilityPill}
              onPress={() => navigation.navigate('Favorites')}
              accessibilityRole="button"
              accessibilityLabel={t('expertsHome.savedBtn')}
            >
              <Text style={styles.utilityPillText}>{t('expertsHome.savedBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.mastheadEyebrowRow}>
          <View style={styles.mastheadEyebrowBar} />
          <Text style={styles.mastheadEyebrowText}>{t('expertsHome.eyebrow')}</Text>
        </View>
        <Text style={styles.mastheadTitle}>
          {t('expertsHome.homeTitleRoman')}{' '}
          <Text style={styles.mastheadTitleItalic}>{t('expertsHome.homeTitleItalic')}</Text>
        </Text>
        <Text style={styles.mastheadDeck}>{t('expertsHome.homeSub')}</Text>
        <View style={styles.mastheadRule} />
      </View>

      {/* Care tier toggle — clinical vs extra hands */}
      <View style={styles.tierRow}>
        {(['all', 'clinical', 'help'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.tierSeg, tier === k && styles.tierSegActive]}
            onPress={() => setTier(k)}
            accessibilityRole="button"
            accessibilityState={{ selected: tier === k }}
          >
            <Text style={[styles.tierSegText, tier === k && styles.tierSegTextActive]}>
              {k === 'all' ? 'All' : k === 'clinical' ? 'Clinical' : 'Extra hands'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
        {chips.map((chip) => {
          const label = chip.key === 'my_insurance'
            ? t('expertsHome.chipMyInsurance', { name: insuranceProvider })
            : t(chip.i18nKey);
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.chip, activeChip === chip.key && styles.chipActive]}
              onPress={() => applyChip(chip)}
              accessibilityLabel={t('expertsHome.filterA11y', { label })}
              accessibilityRole="button"
              accessibilityState={{ selected: activeChip === chip.key }}
            >
              <Text style={[styles.chipText, activeChip === chip.key && styles.chipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </>
  );

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop hideClusters />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(243,183,156,0.38)', 'rgba(243,183,156,0.11)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      <FlashList
        data={loading ? [] : displayResults}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={ListHeader}
        ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
        renderItem={({ item }) => (
          <SpecialistCard
            specialist={item}
            onPress={() => navigation.navigate('SpecialistProfile', { specialistId: item.id })}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ExpertsListSkeleton />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>{t('expertsHome.emptyTitle')}</Text>
              <Text style={styles.emptySubText}>{t('expertsHome.emptySub')}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 640 },

  // Editorial header — cream-on-cream like Milk Hub. paddingBottom: 0 so
  // the bottom hairline closes the block (per docs/editorial-system.md
  // section 2 spacing scale).
  header: {
    backgroundColor: COLORS.cream,
    paddingTop: 56,
    paddingBottom: 0,
    paddingHorizontal: 20,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backToVillage: { paddingVertical: 4, paddingRight: 8 },
  backToVillageText: { fontSize: 14, color: '#D96C88', fontFamily: FONTS.bodySemiBold },
  headerActions: { flexDirection: 'row', gap: 8 },
  savedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFCF6',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(150,80,50,0.18)',
  },
  savedBtnText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  // Title block — relative so the YolkCircle / LeafSprig can absolute-position
  // around the eyebrow + title without escaping the header column.
  titleBlock: {
    position: 'relative',
    paddingTop: 4,
    paddingBottom: 14,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  eyebrowBar: {
    width: 22, height: 2, backgroundColor: '#7A4A24',  // v9 rust-deep
    marginRight: 10, borderRadius: 1,
  },
  // Canonical v9 eyebrow: 11pt, 1.6 letter-spacing, bodySemiBold,
  // rust-deep `#7A4A24`, uppercase. Unified across every hub + deep
  // screen so the page-to-page rhythm reads as one voice.
  eyebrow: {
    fontSize: 11, lineHeight: 22, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: '#7A4A24',
    textTransform: 'uppercase',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  // Page lead — italic Playfair, 32/38 per the canonical type scale.
  // Italic is reserved for the page lead; section titles below would use
  // headerBold (no italic) per the pinned rule.
  headerTitle: {
    fontSize: 32, lineHeight: 38,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: COLORS.bark,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14, lineHeight: 20,
    color: COLORS.barkSoft, fontFamily: FONTS.body,
    maxWidth: 320,
  },
  headerHairline: {
    height: 1,
    backgroundColor: 'rgba(44,26,14,0.08)',
    marginHorizontal: -20,
    marginTop: 4,
  },

  // Magazine-cover hero — full-bleed photo dominates the top of the
  // screen. Mirrors Milk Hub heroHeader pattern. Square edges (no border
  // radius) so the photo runs corner-to-corner like a print magazine cover.
  // v3 editorial masthead (replaces KenBurns photo header 2026-05-24).
  // Same recipe as MilkConnectHomeScreen.
  mastheadWrap: {
    paddingTop: 56,
    paddingHorizontal: 22,
    paddingBottom: 18,
    // Negate FlashList contentContainerStyle's paddingHorizontal:16
    marginHorizontal: -16,
    position: 'relative',
    overflow: 'hidden',
  },
  mastheadUtility: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  backLink: {
    fontFamily: FONTS.v2_mono, fontSize: 12, color: COLORS.v2_walnut,
    letterSpacing: 0.6,
  },
  utilityPill: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: COLORS.v2_parchment,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(61,31,14,0.13)',
  },
  utilityPillText: {
    fontSize: 12, color: COLORS.v2_cocoa, fontFamily: FONTS.v2_bold,
  },
  mastheadEyebrowRow: { flexDirection: 'row', alignItems: 'center' },
  mastheadEyebrowBar: {
    width: 16, height: 1.5, backgroundColor: COLORS.v2_walnut,
    marginRight: 8,
  },
  mastheadEyebrowText: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '500',
    color: COLORS.v2_walnut,
  },
  mastheadTitle: {
    marginTop: 6,
    fontFamily: FONTS.v3_display, fontSize: 36, lineHeight: 40,
    color: COLORS.v2_cocoa,
    letterSpacing: -0.9,
  },
  mastheadTitleItalic: {
    fontFamily: FONTS.v3_display_italic,
    color: '#C2784E', // Specialists signature: caramel / clay
    fontStyle: 'italic',
  },
  mastheadDeck: {
    marginTop: 10,
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 20,
    color: COLORS.v2_walnut,
    maxWidth: 340,
  },
  mastheadRule: {
    marginTop: 16,
    height: StyleSheet.hairlineWidth,
    width: 48,
    backgroundColor: 'rgba(61,31,14,0.13)',
  },

  tierRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  tierSeg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999, backgroundColor: '#F2E6DD' },
  tierSegActive: { backgroundColor: '#E06A88' },
  tierSegText: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, color: '#8A6A55' },
  tierSegTextActive: { color: '#fff' },
  chipScroll: { flexGrow: 0 },
  chipContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  chip: {
    backgroundColor: '#FFFCF6',
    borderWidth: 1.5,
    borderColor: 'rgba(150,80,50,0.18)',
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: COLORS.coco, borderColor: COLORS.coco },
  chipText: { fontSize: 12, fontFamily: FONTS.bodyMedium, color: COLORS.barkSoft },
  chipTextActive: { color: '#FFFCF6' },

  // gap removed — FlashList doesn't apply contentContainerStyle gap to its
  // cells, so the cards read as crammed. Real spacing comes from the
  // ItemSeparatorComponent below.
  list: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 100 },
  cardSeparator: { height: 16 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: FONTS.bodyMedium, color: COLORS.bark, marginBottom: 4 },
  emptySubText: { fontSize: 13, color: COLORS.textLight, fontFamily: FONTS.body },
});
