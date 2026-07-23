// V1 Experts · Map view of nearby specialists.
// Mirrors DonorMapScreen architecture: react-native-maps with a custom
// pin per result, callout on tap with the headline data, tap callout to
// open SpecialistProfile.
//
// Pins are colored by specialty so the user can scan the map and tell at
// a glance which specialty is where. Legend in the corner explains the
// color → specialty mapping.
//
// Felipe 2026-05-28: parity with milk-side DonorMapScreen so the Specialists
// vertical reads as a peer surface, not a list-only tab.
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { specialistsApi } from '@api/specialists';
import type { Specialist, SpecialtyType } from 'shared/src/types/v1';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { BackButton } from '@components/shared/BackButton';
import { getEffectiveCoordsWithSource } from '@utils/devLocation';
import { getPreferredRadiusMiles } from '@store/user';
import { useT } from '@/i18n';
import type { ExpertsStackParamList } from '@/navigation/ExpertsNavigator';

type Props = NativeStackScreenProps<ExpertsStackParamList, 'SpecialistsMap'>;

// Specialty → pin color. Maps to the v2 brand palette so each kind of
// expert has a distinct read at small marker scale.
const SPECIALTY_COLOR: Record<string, string> = {
  ob_gyn: '#43260F',                // cocoa
  doula: '#F7C5CB',                 // salmon
  midwife: '#F7C5CB',               // blush
  lactation_consultant: '#F4C53C',  // butter
  pediatrician: '#F2E6DD',          // sage
  sleep_coach: '#E98A6A',           // caramel
  pelvic_floor_pt: '#E98A6A',       // moss
  perinatal_dietitian: '#7A4A24',   // amber
  ppd_therapist: '#7A4A28',         // walnut
};

// Short labels for the legend so it fits on a 130px card.
const SPECIALTY_SHORT: Record<string, string> = {
  ob_gyn: 'OB/GYN',
  doula: 'Doula',
  midwife: 'Midwife',
  lactation_consultant: 'Lactation',
  pediatrician: 'Pediatrician',
  sleep_coach: 'Sleep coach',
  pelvic_floor_pt: 'Pelvic floor PT',
  perinatal_dietitian: 'Dietitian',
  ppd_therapist: 'PPD therapist',
};

// Miami default region — matches the milk side so the empty state is
// consistent across verticals.
const MIAMI_REGION: Region = {
  latitude: 25.7617,
  longitude: -80.1918,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

export default function SpecialistsMapScreen({ navigation }: Props) {
  const t = useT();
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region>(MIAMI_REGION);

  const load = useCallback(async (lat: number, lng: number) => {
    try {
      const radius = getPreferredRadiusMiles();
      const results = await specialistsApi.search({ lat, lng, radiusMiles: radius });
      setSpecialists(results);
    } catch (err) {
      console.error('SpecialistsMapScreen search error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let deviceCoords: { latitude: number; longitude: number } | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          deviceCoords = loc.coords;
        }
      } catch {
        // Permission denied or location unavailable — fall through to Miami default.
      }
      const { lat, lng, isRealFix } = getEffectiveCoordsWithSource(deviceCoords);
      if (isRealFix) setUserLocation({ lat, lng });
      setRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.15, longitudeDelta: 0.15 });
      load(lat, lng);
    })();
  }, [load]);

  // Distinct specialties present in the results — drives the legend so it
  // only shows entries the user can actually see on the map.
  const presentSpecialties = Array.from(
    new Set(specialists.map((s) => s.specialty).filter((s): s is SpecialtyType => Boolean(s))),
  );

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      {/* Header */}
      <View style={styles.header}>
        <BackButton color="#E84B79" />
        <Text style={styles.headerTitle}>Specialists nearby</Text>
        <Text style={styles.countText}>{specialists.length}</Text>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        region={region}
        showsUserLocation={!!userLocation}
        showsMyLocationButton
      >
        {specialists.map((s) => {
          if (s.lat == null || s.lng == null) return null;
          const color = SPECIALTY_COLOR[s.specialty] ?? '#7A4A24';
          return (
            <Marker
              key={s.id}
              coordinate={{ latitude: s.lat, longitude: s.lng }}
            >
              {/* Custom pin colored by specialty */}
              <View style={[styles.pin, { backgroundColor: color }]}>
                <Text style={styles.pinText}>🩺</Text>
              </View>
              <Callout
                tooltip
                onPress={() => navigation.navigate('SpecialistProfile', { specialistId: s.id })}
              >
                <View style={styles.callout}>
                  <Text style={styles.calloutName} numberOfLines={1}>
                    {s.full_name}
                  </Text>
                  <Text style={styles.calloutMeta} numberOfLines={1}>
                    {SPECIALTY_SHORT[s.specialty] ?? s.specialty} · {s.city ?? ''}
                  </Text>
                  {s.rating_avg > 0 ? (
                    <Text style={styles.calloutRating}>
                      ★ {s.rating_avg.toFixed(1)} · {s.review_count} reviews
                    </Text>
                  ) : null}
                  <Text style={styles.calloutTap}>Tap to view profile →</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Loading overlay — sits above the map until the first results land */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#E84B79" size="large" />
        </View>
      )}

      {/* Legend — only renders specialties actually present in current results */}
      {presentSpecialties.length > 0 && (
        <View style={styles.legend}>
          {presentSpecialties.slice(0, 5).map((sp) => (
            <View key={sp} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: SPECIALTY_COLOR[sp] }]} />
              <Text style={styles.legendLabel}>{SPECIALTY_SHORT[sp] ?? sp}</Text>
            </View>
          ))}
          {presentSpecialties.length > 5 && (
            <Text style={styles.legendMore}>+{presentSpecialties.length - 5} more</Text>
          )}
        </View>
      )}

      {/* Bottom CTA — back to list view */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.listViewBtn}
          onPress={() => navigation.navigate('ExpertsHome', undefined)}
        >
          <Text style={styles.listViewText}>View list →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 12, paddingHorizontal: 16,
    backgroundColor: '#FFFCF6', zIndex: 10,
    borderBottomWidth: 1, borderBottomColor: '#E8E0D5',
  },
  backText: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#43260F' },
  countText: { fontSize: 13, color: '#7A4A24', fontFamily: FONTS.bodySemiBold },
  map: { flex: 1 },
  pin: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FFFCF6',
    shadowColor: '#43260F', shadowOpacity: 0.20, shadowRadius: 4, elevation: 4,
  },
  pinText: { fontSize: 16 },
  callout: {
    backgroundColor: COLORS.paper, borderRadius: 12, padding: 12,
    minWidth: 180, maxWidth: 220,
    shadowColor: '#43260F', shadowOpacity: 0.12, shadowRadius: 8,
  },
  calloutName: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#43260F', marginBottom: 4 },
  calloutMeta: { fontSize: 12, color: '#7A4A24', fontFamily: FONTS.bodyMedium, marginBottom: 4 },
  calloutRating: { fontSize: 12, color: '#7A4A24', fontFamily: FONTS.bodyMedium, marginBottom: 4 },
  calloutTap: { fontSize: 11, color: '#7A4A24', fontFamily: FONTS.body },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,240,232,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  legend: {
    position: 'absolute', top: 120, right: 12,
    backgroundColor: COLORS.paper, borderRadius: 10, padding: 8, gap: 6,
    shadowColor: '#43260F', shadowOpacity: 0.10, shadowRadius: 4, elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: '#7A4A24', fontFamily: FONTS.bodyMedium },
  legendMore: {
    fontSize: 10, color: '#7A4A24', fontFamily: FONTS.body,
    marginTop: 2, fontStyle: 'italic',
  },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 34,
    backgroundColor: 'rgba(245,240,232,0.95)',
    borderTopWidth: 1, borderTopColor: '#E8E0D5',
  },
  listViewBtn: {
    backgroundColor: '#43260F', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  listViewText: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#FFFCF6' },
});
