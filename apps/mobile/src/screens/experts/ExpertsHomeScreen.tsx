import React, { useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
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
import { KenBurnsImage } from '@components/shared/KenBurnsImage';
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
      <View style={styles.heroHeader} accessibilityElementsHidden importantForAccessibility="no">
        <KenBurnsImage
          source={{ uri: 'https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=1200&h=1400&fit=crop&crop=center&q=85' }}
          style={styles.heroHeaderImage}
        />
        <View style={styles.heroHeaderScrimTop} />
        <View style={styles.heroHeaderScrimMid} />
        <View style={styles.heroHeaderScrimBottom} />

        <View style={styles.heroActionBar}>
          <TouchableOpacity
            onPress={() => navigation.getParent()?.navigate('Village' as never)}
            accessibilityRole="button"
            accessibilityLabel={t('common.backToVillage')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.heroBackText}>{t('common.backToVillage')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.heroSavedBtn}
            onPress={() => navigation.navigate('Favorites')}
            accessibilityRole="button"
            accessibilityLabel={t('expertsHome.savedBtn')}
          >
            <Text style={styles.heroSavedBtnText}>{t('expertsHome.savedBtn')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCopy}>
          <View style={styles.heroEyebrowRow}>
            <View style={styles.heroEyebrowBar} />
            <Text style={styles.heroEyebrowText}>{t('expertsHome.eyebrow')}</Text>
          </View>
          <Text style={styles.heroTitle}>{t('expertsHome.homeTitle')}</Text>
          <Text style={styles.heroSub}>{t('expertsHome.homeSub')}</Text>
        </View>
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
      <FlashList
        data={loading ? [] : results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={ListHeader}
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
  backToVillageText: { fontSize: 14, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  headerActions: { flexDirection: 'row', gap: 8 },
  savedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 50,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  savedBtnText: { fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.textDark },

  // Title block — relative so the YolkCircle / LeafSprig can absolute-position
  // around the eyebrow + title without escaping the header column.
  titleBlock: {
    position: 'relative',
    paddingTop: 4,
    paddingBottom: 14,
  },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  eyebrowBar: {
    width: 22, height: 2, backgroundColor: COLORS.rust,
    marginRight: 10, borderRadius: 1,
  },
  // Canonical eyebrow values (editorial-system.md §1): 11pt, 1.6 letter-spacing,
  // bodySemiBold, rust, uppercase, lineHeight matches the eyebrow row siblings.
  eyebrow: {
    fontSize: 11, lineHeight: 22, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.rust,
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
    color: COLORS.brownDeep,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 14, lineHeight: 20,
    color: COLORS.textMid, fontFamily: FONTS.body,
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
  heroHeader: {
    height: 420,
    position: 'relative',
    backgroundColor: COLORS.brownDeep,
    overflow: 'hidden',
    // Negate FlashList contentContainerStyle's paddingHorizontal:16 so
    // the hero photo bleeds edge-to-edge.
    marginHorizontal: -16,
  },
  heroHeaderImage: { width: '100%', height: '100%' },
  // Immersive scrim — three stacked layers form a faux vertical gradient
  // (transparent at top, deep brown at bottom) so the typography sits in
  // a darkened lower-third while the upper photo stays clean. Adds depth
  // without requiring an extra native dep.
  heroHeaderScrimTop: {
    position: 'absolute', left: 0, right: 0, top: 0, height: '40%',
    backgroundColor: 'rgba(44,26,14,0.10)',
  },
  heroHeaderScrimMid: {
    position: 'absolute', left: 0, right: 0, top: '40%', height: '30%',
    backgroundColor: 'rgba(44,26,14,0.28)',
  },
  heroHeaderScrimBottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%',
    backgroundColor: 'rgba(44,26,14,0.55)',
  },
  heroActionBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBackText: {
    fontSize: 14,
    color: COLORS.cream,
    fontFamily: FONTS.bodySemiBold,
  },
  heroSavedBtn: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(253,250,245,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(253,250,245,0.35)',
  },
  heroSavedBtnText: {
    fontSize: 12, color: COLORS.cream, fontFamily: FONTS.bodySemiBold,
  },
  heroCopy: {
    position: 'absolute',
    left: 22, right: 22, bottom: 28,
  },
  heroEyebrowRow: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
  },
  heroEyebrowBar: {
    width: 22, height: 2, backgroundColor: COLORS.cream,
    marginRight: 10, borderRadius: 1, opacity: 0.85,
  },
  heroEyebrowText: {
    fontSize: 11, lineHeight: 16, letterSpacing: 1.6,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.cream,
    textTransform: 'uppercase',
    opacity: 0.92,
  },
  heroTitle: {
    fontSize: 36, lineHeight: 42,
    fontFamily: FONTS.headerItalic, fontStyle: 'italic',
    color: '#FFF',
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14, lineHeight: 20,
    fontFamily: FONTS.body,
    color: COLORS.cream,
    opacity: 0.9,
    maxWidth: 340,
  },

  chipScroll: { flexGrow: 0 },
  chipContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, gap: 8, flexDirection: 'row' },
  chip: {
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  chipText: { fontSize: 12, fontFamily: FONTS.bodyMedium, color: COLORS.textMid },
  chipTextActive: { color: 'white' },

  list: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 100, gap: 14 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: FONTS.bodyMedium, color: COLORS.textDark, marginBottom: 4 },
  emptySubText: { fontSize: 13, color: COLORS.textLight, fontFamily: FONTS.body },
});
