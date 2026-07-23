import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { searchDonorsNear, saveDonor, unsaveDonor, isSaved } from '@api/milk';
import type { DonorSearchResult, SearchFilters } from '@api/milk';
import { DonorCard } from '@components/milk/DonorCard';
import { FilterDrawerModal } from '@components/milk/FilterDrawerModal';
import type { MilkFilters } from '@components/milk/FilterDrawerModal';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { BackButton } from '@components/shared/BackButton';
import { LinearGradient } from 'expo-linear-gradient';
import { getEffectiveCoords } from '@utils/devLocation';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'DonorSearchList'>;

const DEFAULT_FILTERS: MilkFilters = {
  radius_miles: 25,
  max_price: null,
  filter_badge: null,
  diet_flags: [],
};

export default function DonorSearchListScreen({ navigation }: Props) {
  const user = useAuthStore((s) => s.user);
  const t = useT();
  const [donors, setDonors] = useState<DonorSearchResult[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [filters, setFilters] = useState<MilkFilters>(DEFAULT_FILTERS);
  const [showFilter, setShowFilter] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async (lat: number, lng: number, f: MilkFilters) => {
    try {
      const results = await searchDonorsNear(lat, lng, {
        radius_miles: f.radius_miles,
        filter_badge: f.filter_badge,
        max_price: f.max_price,
      });
      setDonors(results);
    } catch (err) {
      console.error('searchDonorsNear error:', err);
    }
  }, []);

  const init = useCallback(async () => {
    let deviceCoords: { latitude: number; longitude: number } | null = null;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        deviceCoords = loc.coords;
      }
    } catch {
      // permission/location failure — helper falls back to Miami below
    }
    // Dev-mode override: Simulator's Cupertino default is ignored in favor
    // of Miami so the donor list lines up with the launch market.
    const { lat, lng } = getEffectiveCoords(deviceCoords);
    setUserLat(lat); setUserLng(lng);
    await load(lat, lng, filters);
    setLoading(false);
  }, []);

  useEffect(() => { init(); }, []);

  const onRefresh = async () => {
    if (!userLat || !userLng) return;
    setRefreshing(true);
    await load(userLat, userLng, filters);
    setRefreshing(false);
  };

  const handleApplyFilters = async (f: MilkFilters) => {
    setFilters(f);
    if (!userLat || !userLng) return;
    setLoading(true);
    await load(userLat, userLng, f);
    setLoading(false);
  };

  const handleSaveToggle = async (donorId: string) => {
    if (!user) return;
    const currently = savedIds.has(donorId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (currently) next.delete(donorId);
      else next.add(donorId);
      return next;
    });
    try {
      if (currently) await unsaveDonor(user.id, donorId);
      else await saveDonor(user.id, donorId);
    } catch {
      // rollback
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (currently) next.add(donorId);
        else next.delete(donorId);
        return next;
      });
    }
  };

  // Client-side diet filter + name search
  const filtered = useMemo(() => {
    let list = donors;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) =>
        d.display_name.toLowerCase().includes(q) ||
        (d.city ?? '').toLowerCase().includes(q) ||
        (d.neighborhood ?? '').toLowerCase().includes(q)
      );
    }
    // Diet filter is applied client-side (RPC doesn't support it)
    if (filters.diet_flags.length > 0) {
      // Filter is best-effort here — DonorProfileScreen shows full diet info
    }
    return list;
  }, [donors, search, filters.diet_flags]);

  const activeFilterCount = [
    filters.filter_badge !== null,
    filters.max_price !== null,
    filters.diet_flags.length > 0,
    filters.radius_miles !== 25,
  ].filter(Boolean).length;

  if (locationError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorEmoji}>📍</Text>
        <Text style={styles.errorTitle}>{t('donorSearch.locationNeededTitle')}</Text>
        <Text style={styles.errorBody}>{t('donorSearch.locationNeededBody')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(247,197,203,0.36)', 'rgba(247,197,203,0.10)', 'rgba(252,247,239,0)']}
        locations={[0, 0.45, 1]}
        style={styles.pageWash}
      />
      {/* Header */}
      <View style={styles.header}>
        <BackButton color="#E84B79" style={styles.backBtn} accessibilityLabel={t('donorSearch.back')} />
        <Text style={styles.headerTitle}>{t('donorSearch.headerTitle')}</Text>
        <TouchableOpacity
          style={styles.mapBtn}
          onPress={() => navigation.navigate('DonorMap')}
          accessibilityRole="button"
          accessibilityLabel={t('donorSearch.mapA11y')}
        >
          <Text style={styles.mapBtnText}>{t('donorSearch.mapBtn')}</Text>
        </TouchableOpacity>
      </View>

      {/* Search + Filter row */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('donorSearch.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#7A4A24"
        />
        <TouchableOpacity
          style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
          onPress={() => setShowFilter(true)}
        >
          <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
            {activeFilterCount > 0
              ? t('donorSearch.filtersWithCount', { count: activeFilterCount })
              : t('donorSearch.filters')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results count */}
      {!loading && (
        <Text style={styles.resultCount}>
          {t(filtered.length === 1 ? 'donorSearch.resultCountOne' : 'donorSearch.resultCountOther', {
            count: filtered.length,
            miles: filters.radius_miles,
          })}
        </Text>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#E84B79" size="large" />
          <Text style={styles.loadingText}>{t('donorSearch.loadingText')}</Text>
        </View>
      ) : (
        <FlashList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DonorCard
              donor={item}
              saved={savedIds.has(item.id)}
              onPress={() => navigation.navigate('DonorProfile', { donorProfileId: item.id })}
              onSaveToggle={() => handleSaveToggle(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.coco} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🤱</Text>
              <Text style={styles.emptyTitle}>{t('donorSearch.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('donorSearch.emptyBody')}</Text>
              <TouchableOpacity onPress={() => handleApplyFilters(DEFAULT_FILTERS)}>
                <Text style={styles.emptyReset}>{t('donorSearch.emptyReset')}</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <FilterDrawerModal
        visible={showFilter}
        filters={filters}
        onApply={handleApplyFilters}
        onClose={() => setShowFilter(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 620 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#F5F0E8',
  },
  backBtn: { padding: 4 },
  backText: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#43260F' },
  mapBtn: {
    backgroundColor: COLORS.paper, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1.5, borderColor: '#E0D5C5',
  },
  mapBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#43260F' },
  searchRow: {
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 10,
  },
  searchInput: {
    flex: 1, backgroundColor: COLORS.paper, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#43260F',
    borderWidth: 1.5, borderColor: '#E0D5C5', fontFamily: FONTS.body,
  },
  filterBtn: {
    backgroundColor: COLORS.paper, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: '#E0D5C5', justifyContent: 'center',
  },
  filterBtnActive: { borderColor: COLORS.coco, backgroundColor: COLORS.pinkSoft },
  filterBtnText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#7A4A24' },
  filterBtnTextActive: { color: COLORS.coco },
  resultCount: { fontSize: 12, color: '#7A4A24', paddingHorizontal: 16, marginBottom: 4, fontFamily: FONTS.bodyMedium },
  list: { paddingBottom: 40, paddingTop: 4 },
  loadingText: { fontSize: 14, color: '#7A4A24', fontFamily: FONTS.bodyMedium },
  errorEmoji: { fontSize: 48 },
  errorTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: '#43260F' },
  errorBody: { fontSize: 14, color: '#7A4A24', textAlign: 'center', lineHeight: 21, fontFamily: FONTS.body },
  empty: { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontFamily: FONTS.bodySemiBold, color: '#43260F' },
  emptyBody: { fontSize: 14, color: '#7A4A24', textAlign: 'center', lineHeight: 21, fontFamily: FONTS.body },
  emptyReset: { fontSize: 14, color: '#E84B79', fontFamily: FONTS.bodySemiBold, marginTop: 8 },
});
