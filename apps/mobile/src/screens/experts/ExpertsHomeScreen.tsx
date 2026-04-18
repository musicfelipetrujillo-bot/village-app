import React, { useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import { COLORS } from '@utils/constants';
import { useExpertsStore } from '@store/experts';
import { useAuthStore } from '@store/auth';
import { SpecialistCard } from '@components/experts/SpecialistCard';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';
import type { SpecialtyType } from 'shared/src/types/v1';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'ExpertsHome'>;

// Miami default coords — used if location permission denied
const MIAMI_LAT = 25.7617;
const MIAMI_LNG = -80.1918;

const FILTER_CHIPS: { label: string; key: string; value?: Partial<{ specialty: SpecialtyType; language: string; telehealthOnly: boolean }> }[] = [
  { label: 'All',            key: 'all' },
  { label: '🌐 Virtual',     key: 'virtual',   value: { telehealthOnly: true } },
  { label: 'Habla Español',  key: 'spanish',   value: { language: 'es' } },
  { label: '🤱 IBCLC',       key: 'ibclc',     value: { specialty: 'lactation_consultant' } },
  { label: '🤝 Doula',       key: 'doula',     value: { specialty: 'doula' } },
  { label: '😴 Sleep Coach', key: 'sleep',     value: { specialty: 'sleep_coach' } },
  { label: '🏃 Pelvic PT',   key: 'pelvic',    value: { specialty: 'pelvic_floor_pt' } },
  { label: '💜 Therapist',   key: 'therapist', value: { specialty: 'ppd_therapist' } },
  { label: '🥗 Dietitian',   key: 'dietitian', value: { specialty: 'perinatal_dietitian' } },
];

export default function ExpertsHomeScreen({ navigation }: Props) {
  const { results, loading, filters, search, setFilters } = useExpertsStore();
  const [activeChip, setActiveChip] = React.useState('all');

  const doSearch = useCallback(async (extraFilters = {}) => {
    let lat = MIAMI_LAT;
    let lng = MIAMI_LNG;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
    } catch {}
    search({ lat, lng, radiusMiles: 15, ...extraFilters });
  }, [search]);

  useEffect(() => { doSearch(); }, []);

  const applyChip = (chip: typeof FILTER_CHIPS[0]) => {
    setActiveChip(chip.key);
    doSearch(chip.value ?? {});
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>The <Text style={styles.logoAccent}>Village</Text></Text>
        <Text style={styles.pageTitle}>Specialists</Text>
        <Text style={styles.pageSub}>Verified · Near Miami · EN & ES</Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipContent}
      >
        {FILTER_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.chip, activeChip === chip.key && styles.chipActive]}
            onPress={() => applyChip(chip)}
          >
            <Text style={[styles.chipText, activeChip === chip.key && styles.chipTextActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.rust} />
          <Text style={styles.loadingText}>Finding specialists near you…</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <SpecialistCard
              specialist={item}
              onPress={() => navigation.navigate('SpecialistProfile', { specialistId: item.id })}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>No specialists found nearby.</Text>
              <Text style={styles.emptySubText}>Try expanding your search radius.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: COLORS.cream,
  },
  logo: { fontFamily: 'serif', fontSize: 18, color: COLORS.textDark, marginBottom: 2 },
  logoAccent: { color: COLORS.rust, fontStyle: 'italic' },
  pageTitle: {
    fontFamily: 'serif',
    fontSize: 26,
    color: COLORS.textDark,
    fontStyle: 'italic',
  },
  pageSub: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },

  chipScroll: { flexGrow: 0 },
  chipContent: { paddingHorizontal: 16, paddingBottom: 14, gap: 8, flexDirection: 'row' },
  chip: {
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 50,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  chipActive: { backgroundColor: COLORS.rust, borderColor: COLORS.rust },
  chipText: { fontSize: 12, fontWeight: '600', color: COLORS.textMid },
  chipTextActive: { color: 'white' },

  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 10 },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: COLORS.textLight },

  empty: { alignItems: 'center', paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textDark, marginBottom: 4 },
  emptySubText: { fontSize: 13, color: COLORS.textLight },
});
