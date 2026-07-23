import React, { useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Linking, Platform,
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
import { CareCard } from '@components/experts/CareCard';
import { ExpertsListSkeleton } from '@components/shared/SkeletonLoader';
import { BackButton } from '@components/shared/BackButton';
import { HubHeader } from '@components/shared/HubHeader';
import { daycaresApi, type Daycare } from '@api/daycares';
import type { Specialist } from 'shared/src/types/v1';

type CareRow =
  | { kind: 'header'; title: string; tag: string }
  | { kind: 'provider'; item: Specialist; idx: number }
  | { kind: 'daycare'; item: Daycare };
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
  // Care two-tier directory — grouped into Clinical (NPI-verified) + Extra hands
  // (background-checked) sections, with a text search + checked-only filter.
  const [tier, setTier] = React.useState<'all' | 'clinical' | 'help' | 'daycare'>('all');
  const [query, setQuery] = React.useState('');
  const [checkedOnly, setCheckedOnly] = React.useState(false);
  const [daycares, setDaycares] = React.useState<Daycare[]>([]);
  const [daycareLoading, setDaycareLoading] = React.useState(false);
  const [daycareError, setDaycareError] = React.useState(false);
  const listData: CareRow[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (tier === 'daycare') {
      return daycares
        .filter((d) => !q || d.name.toLowerCase().includes(q))
        .map((item) => ({ kind: 'daycare' as const, item }));
    }
    const rows = results.filter((r) => {
      if (checkedOnly && r.provider_kind === 'help' && !r.background_checked) return false;
      if (q && !`${r.full_name} ${r.credentials} ${r.specialty}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const clinical = rows.filter((r) => (r.provider_kind ?? 'clinical') === 'clinical');
    const help = rows.filter((r) => r.provider_kind === 'help');
    const out: CareRow[] = [];
    if ((tier === 'all' || tier === 'clinical') && clinical.length) {
      out.push({ kind: 'header', title: 'Clinical care', tag: 'NPI-verified' });
      clinical.forEach((item, idx) => out.push({ kind: 'provider', item, idx }));
    }
    if ((tier === 'all' || tier === 'help') && help.length) {
      out.push({ kind: 'header', title: 'Extra hands', tag: 'Background-checked' });
      help.forEach((item, idx) => out.push({ kind: 'provider', item, idx }));
    }
    return out;
  }, [results, tier, query, checkedOnly, daycares]);

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

  const resolveCoords = useCallback(async () => {
    let deviceCoords: { latitude: number; longitude: number } | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        deviceCoords = loc.coords;
      }
    } catch {}
    // Dev-mode override: Simulator's Cupertino default is replaced with Miami.
    return getEffectiveCoords(deviceCoords);
  }, []);

  const doSearch = useCallback(async (extraFilters: ChipFilter = {}) => {
    const { lat, lng } = await resolveCoords();
    // Use the user's saved radius pref (A2.a) — falls back to default when
    // store is empty (cold launch before fetchProfile resolves).
    search({ lat, lng, radiusMiles: getPreferredRadiusMiles(), ...extraFilters });
  }, [search, resolveCoords]);

  // Daycare tier is a separate data source (Google Places) — fetched lazily the
  // first time she opens the tier. villie lists, doesn't endorse.
  const fetchDaycares = useCallback(async () => {
    setDaycareLoading(true);
    setDaycareError(false);
    try {
      const { lat, lng } = await resolveCoords();
      setDaycares(await daycaresApi.listNear(lat, lng, getPreferredRadiusMiles()));
    } catch {
      setDaycareError(true);
    } finally {
      setDaycareLoading(false);
    }
  }, [resolveCoords]);

  useEffect(() => {
    if (tier === 'daycare' && !daycares.length && !daycareLoading && !daycareError) fetchDaycares();
  }, [tier, daycares.length, daycareLoading, daycareError, fetchDaycares]);

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
      {/* Canonical shared header (identical across all verticals). Map/Saved
          stay as text pills per Felipe; peach dot carries the Care identity. */}
      <View style={{ marginHorizontal: -18, paddingTop: insets.top + 6 }}>
        <HubHeader
          name="care"
          dotColor="#F3B79C"
          onBack={() => navigation.getParent()?.navigate('Village' as never)}
          backAccessibilityLabel={t('common.backToVillage')}
          right={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={styles.utilityPill} onPress={() => navigation.navigate('SpecialistsMap')} accessibilityRole="button" accessibilityLabel="Map view">
                <Text style={styles.utilityPillText}>Map</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.utilityPill} onPress={() => navigation.navigate('Favorites')} accessibilityRole="button" accessibilityLabel={t('expertsHome.savedBtn')}>
                <Text style={styles.utilityPillText}>{t('expertsHome.savedBtn')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      {/* Search + checked-only */}
      <View style={styles.careSearchRow}>
        <Text style={styles.careSearchIcon}>⌕</Text>
        <TextInput
          style={styles.careSearchInput}
          placeholder="search care · lactation, nanny, sleep…"
          placeholderTextColor="#A6957F"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {tier !== 'daycare' && (
          <TouchableOpacity onPress={() => setCheckedOnly((v) => !v)} style={[styles.checkedChip, checkedOnly && styles.checkedChipActive]} accessibilityRole="button" accessibilityState={{ selected: checkedOnly }}>
            <Text style={[styles.checkedChipText, checkedOnly && styles.checkedChipTextActive]}>🛡 checked</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Care tier toggle — clinical vs extra hands */}
      <View style={styles.tierRow}>
        {(['all', 'clinical', 'help', 'daycare'] as const).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.tierSeg, tier === k && styles.tierSegActive]}
            onPress={() => setTier(k)}
            accessibilityRole="button"
            accessibilityState={{ selected: tier === k }}
          >
            <Text style={[styles.tierSegText, tier === k && styles.tierSegTextActive]} numberOfLines={1} adjustsFontSizeToFit>
              {k === 'all' ? 'All' : k === 'clinical' ? 'Clinical' : k === 'help' ? 'Extra hands' : 'Daycare'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tier === 'daycare' ? (
        <Text style={styles.daycareDisclaimer}>Listings from public records. License #s are registry-listed — verify current status on FL CARES. Ages + price coming soon. villie lists, doesn't endorse or vet.</Text>
      ) : (
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
      )}
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
        data={(tier === 'daycare' ? daycareLoading : loading) ? [] : listData}
        keyExtractor={(row) => (row.kind === 'header' ? `h-${row.title}` : row.kind === 'daycare' ? `d-${row.item.place_id}` : row.item.id)}
        getItemType={(row) => row.kind}
        contentContainerStyle={styles.list}
        ListHeaderComponent={ListHeader}
        ItemSeparatorComponent={() => <View style={styles.careRowGap} />}
        renderItem={({ item: row }) =>
          row.kind === 'header' ? (
            <View style={styles.careSectionHead}>
              <Text style={styles.careSectionTitle}>{row.title}</Text>
              <Text style={styles.careSectionTag}>{row.tag}</Text>
            </View>
          ) : row.kind === 'daycare' ? (
            <DaycareCard daycare={row.item} />
          ) : (
            <CareCard
              specialist={row.item}
              index={row.idx}
              onPress={() => navigation.navigate('SpecialistProfile', { specialistId: row.item.id })}
            />
          )
        }
        ListEmptyComponent={
          (tier === 'daycare' ? daycareLoading : loading) ? (
            <ExpertsListSkeleton />
          ) : tier === 'daycare' && daycareError ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🗺️</Text>
              <Text style={styles.emptyText}>Couldn't load daycares</Text>
              <Text style={styles.emptySubText}>Check your connection or location and try again.</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{tier === 'daycare' ? '🏠' : '🔍'}</Text>
              <Text style={styles.emptyText}>{tier === 'daycare' ? 'No daycares nearby' : t('expertsHome.emptyTitle')}</Text>
              <Text style={styles.emptySubText}>{tier === 'daycare' ? 'Try widening your search radius in settings.' : t('expertsHome.emptySub')}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

// Daycare card — Google Places fields (name / rating / open-now / distance).
// Tap opens directions in the maps app. No detail screen yet (MVP).
function DaycareCard({ daycare: d }: { daycare: Daycare }) {
  const openMaps = () => {
    const q = encodeURIComponent(d.name);
    const url = Platform.OS === 'ios'
      ? `https://maps.apple.com/?q=${q}&ll=${d.lat},${d.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${d.lat},${d.lng}`;
    Linking.openURL(url).catch(() => {});
  };
  // CARES is the authoritative source for CURRENT license status/hours — there's
  // no API, so we one-tap the mom to the official search to verify herself.
  const openCares = () => Linking.openURL('https://caressearch.myflfamilies.com/PublicSearch').catch(() => {});
  return (
    <TouchableOpacity style={dc.card} activeOpacity={0.85} onPress={openMaps} accessibilityRole="button" accessibilityLabel={`${d.name}, ${d.distance_mi} miles away`}>
      <View style={dc.thumb}><Text style={dc.thumbEmoji}>🏠</Text></View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={dc.name} numberOfLines={1}>{d.name}</Text>
        {!!d.address && <Text style={dc.addr} numberOfLines={1}>{d.address}</Text>}
        <View style={dc.metaRow}>
          {typeof d.rating === 'number' && <Text style={dc.meta}>★ {d.rating.toFixed(1)}{d.ratings_count ? ` (${d.ratings_count})` : ''}</Text>}
          {typeof d.capacity === 'number' && <Text style={dc.meta}>cap. {d.capacity}</Text>}
          {d.open_now === true && <Text style={[dc.pill, dc.pillOpen]}>open now</Text>}
          {d.open_now === false && <Text style={[dc.pill, dc.pillClosed]}>closed</Text>}
        </View>
        {!!d.license_number && (
          <TouchableOpacity onPress={openCares} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }} accessibilityRole="link" accessibilityLabel={`Verify license ${d.license_number} on Florida CARES`}>
            <Text style={dc.licBadge}>📋 DCF registry · Lic #{d.license_number} · <Text style={dc.licVerify}>verify ›</Text></Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={dc.chevron}>›</Text>
        <Text style={dc.dist}>{d.distance_mi} mi</Text>
      </View>
    </TouchableOpacity>
  );
}

const dc = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.paper, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(61,31,14,0.08)', padding: 12 },
  thumb: { width: 52, height: 52, borderRadius: 13, backgroundColor: '#F3D9C6', alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 22 },
  name: { fontFamily: FONTS.v2_bold, fontSize: 15, color: COLORS.v2_cocoa },
  addr: { fontFamily: FONTS.v2_body, fontSize: 12, color: '#8A6A55', marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  meta: { fontFamily: FONTS.v2_mono, fontSize: 10.5, color: '#A6957F' },
  pill: { fontFamily: FONTS.bodySemiBold, fontSize: 10, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  pillOpen: { backgroundColor: '#E7F0E2', color: '#3B7D52' },
  pillClosed: { backgroundColor: '#F1E7D8', color: '#8A6A55' },
  licBadge: { fontFamily: FONTS.v2_mono, fontSize: 9.5, color: '#8A6A55', marginTop: 5, letterSpacing: 0.2 },
  licVerify: { color: '#B0234F', fontFamily: FONTS.v2_bold },
  chevron: { fontFamily: FONTS.v2_bold, fontSize: 18, color: '#C9B7A2' },
  dist: { fontFamily: FONTS.v2_mono, fontSize: 10, color: '#A6957F', marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  daycareDisclaimer: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: '#A0895F', paddingHorizontal: 4, paddingTop: 12, paddingBottom: 4, lineHeight: 16 },
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
  backToVillageText: { fontSize: 14, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
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
  // Compact Milk-Hub identity (dot + lowercase name).
  careIdRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 2 },
  careDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#F3B79C' },
  careName: { fontFamily: FONTS.v3_display, fontSize: 26, letterSpacing: -0.6, color: COLORS.v2_cocoa },

  careSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FDF7EC', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(61,31,14,0.14)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 4, marginTop: 2 },
  careSearchIcon: { fontSize: 18, color: '#B0234F' },
  careSearchInput: { flex: 1, fontFamily: FONTS.v2_body, fontSize: 13.5, color: '#3D2116', paddingVertical: 9 },
  checkedChip: { backgroundColor: '#EAF0DE', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  checkedChipActive: { backgroundColor: '#7B8A46' },
  checkedChipText: { fontFamily: FONTS.v2_mono, fontSize: 9.5, color: '#5B6B37', fontWeight: '600' },
  checkedChipTextActive: { color: '#fff' },
  careSectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22, marginBottom: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(61,31,14,0.12)' },
  careSectionTitle: { fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.2, textTransform: 'uppercase', color: '#8A6A55', fontWeight: '500' },
  careSectionTag: { fontFamily: FONTS.v2_mono, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase', color: '#7B8A46', fontWeight: '600' },
  careRowGap: { height: 10 },
  tierRow: { flexDirection: 'row', gap: 8, paddingTop: 14 },
  tierSeg: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 999, backgroundColor: '#F2E6DD' },
  tierSegActive: { backgroundColor: '#E84B79' },
  tierSegText: { fontFamily: FONTS.bodySemiBold, fontSize: 12.5, color: '#8A6A55' },
  tierSegTextActive: { color: '#fff' },
  // Secondary refinements — a single LIGHT text line (not a second row of
  // pills) so the tier toggle stays the one prominent filter, Milk-Hub clean.
  chipScroll: { flexGrow: 0 },
  chipContent: { paddingTop: 10, paddingBottom: 12, gap: 16, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingVertical: 2 },
  chipActive: {},
  chipText: { fontSize: 12.5, fontFamily: FONTS.bodySemiBold, color: COLORS.v2_walnut },
  chipTextActive: { color: '#E84B79', textDecorationLine: 'underline' },

  // gap removed — FlashList doesn't apply contentContainerStyle gap to its
  // cells, so the cards read as crammed. Real spacing comes from the
  // ItemSeparatorComponent below.
  list: { paddingHorizontal: 18, paddingTop: 0, paddingBottom: 100 },
  cardSeparator: { height: 16 },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: FONTS.bodyMedium, color: COLORS.bark, marginBottom: 4 },
  emptySubText: { fontSize: 13, color: COLORS.textLight, fontFamily: FONTS.body },
});
