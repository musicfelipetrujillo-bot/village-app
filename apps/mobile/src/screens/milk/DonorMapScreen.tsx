import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { searchDonorsNear } from '@api/milk';
import type { DonorSearchResult } from '@api/milk';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { getEffectiveCoordsWithSource } from '@utils/devLocation';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'DonorMap'>;

const BADGE_COLOR: Record<string, string> = {
  none: '#9A8070',
  basic: COLORS.statusAlert,
  verified: '#6B7C3F',
  verified_bloodwork: COLORS.statusSuccess,
};

// Miami default region
const MIAMI_REGION: Region = {
  latitude: 25.7617,
  longitude: -80.1918,
  latitudeDelta: 0.3,
  longitudeDelta: 0.3,
};

export default function DonorMapScreen({ navigation }: Props) {
  const t = useT();
  const [donors, setDonors] = useState<DonorSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [region, setRegion] = useState<Region>(MIAMI_REGION);
  const [selected, setSelected] = useState<DonorSearchResult | null>(null);

  const load = useCallback(async (lat: number, lng: number) => {
    try {
      const results = await searchDonorsNear(lat, lng, { radius_miles: 50 });
      setDonors(results);
    } catch (err) {
      console.error('DonorMapScreen search error:', err);
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
        // permission/location failure — fall through to Miami via helper
      }
      // In dev (Simulator) the helper hands back Miami so the Cupertino
      // default doesn't pollute the map. Real devices in prod keep real GPS.
      const { lat, lng, isRealFix } = getEffectiveCoordsWithSource(deviceCoords);
      if (isRealFix) setUserLocation({ lat, lng });
      setRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.15, longitudeDelta: 0.15 });
      load(lat, lng);
    })();
  }, []);

  return (
    <View style={styles.container}>
      <V9PageBackdrop />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('donorMap.back')}
        >
          <Text style={styles.backText}>{t('donorMap.backLabel')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('donorMap.headerTitle')}</Text>
        <Text style={styles.donorCount}>{t('donorMap.donorCount', { count: donors.length })}</Text>
      </View>

      {/* Map */}
      <MapView
        style={styles.map}
        region={region}
        showsUserLocation={!!userLocation}
        showsMyLocationButton
      >
        {donors.map((donor) => {
          if (!donor.lat || !donor.lng) return null;
          const color = BADGE_COLOR[donor.badge_level] ?? BADGE_COLOR.none;
          return (
            <Marker
              key={donor.id}
              coordinate={{ latitude: donor.lat, longitude: donor.lng }}
              onPress={() => setSelected(donor)}
            >
              {/* Custom pin colored by badge */}
              <View style={[styles.pin, { backgroundColor: color }]}>
                <Text style={styles.pinText}>🤱</Text>
              </View>
              <Callout tooltip onPress={() => navigation.navigate('DonorProfile', { donorProfileId: donor.id })}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{donor.display_name}</Text>
                  <Text style={styles.calloutPrice}>{t('donorMap.calloutPrice', { price: donor.price_per_oz.toFixed(2), oz: donor.supply_oz_available })}</Text>
                  <Text style={styles.calloutTap}>{t('donorMap.calloutTap')}</Text>
                </View>
              </Callout>
            </Marker>
          );
        })}
      </MapView>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color="#C07840" size="large" />
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { key: 'basic', labelKey: 'donorMap.legendBasic' },
          { key: 'verified', labelKey: 'donorMap.legendVerified' },
          { key: 'verified_bloodwork', labelKey: 'donorMap.legendBloodwork' },
        ].map(({ key, labelKey }) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: BADGE_COLOR[key] }]} />
            <Text style={styles.legendLabel}>{t(labelKey)}</Text>
          </View>
        ))}
      </View>

      {/* Bottom CTA */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.listViewBtn}
          onPress={() => navigation.navigate('DonorSearchList')}
        >
          <Text style={styles.listViewText}>{t('donorMap.viewList')}</Text>
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
    backgroundColor: '#FDFBF6', zIndex: 10,
    borderBottomWidth: 1, borderBottomColor: '#E8E0D5',
  },
  backText: { fontSize: 15, color: '#C07840', fontFamily: FONTS.bodySemiBold },
  headerTitle: { fontSize: 17, fontFamily: FONTS.bodySemiBold, color: '#2C1810' },
  donorCount: { fontSize: 13, color: '#A77349', fontFamily: FONTS.bodySemiBold },
  map: { flex: 1 },
  pin: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#FDFBF6',
    shadowColor: '#6B2E0E', shadowOpacity: 0.20, shadowRadius: 4, elevation: 4,
  },
  pinText: { fontSize: 18 },
  callout: {
    backgroundColor: COLORS.paper, borderRadius: 12, padding: 12,
    minWidth: 160, shadowColor: '#6B2E0E', shadowOpacity: 0.12, shadowRadius: 8,
  },
  calloutName: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 4 },
  calloutPrice: { fontSize: 13, color: '#A77349', fontFamily: FONTS.bodyMedium, marginBottom: 4 },
  calloutTap: { fontSize: 11, color: '#9A8070', fontFamily: FONTS.body },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245,240,232,0.8)',
    alignItems: 'center', justifyContent: 'center',
  },
  legend: {
    position: 'absolute', top: 120, right: 12,
    backgroundColor: COLORS.paper, borderRadius: 10, padding: 8, gap: 6,
    shadowColor: '#6B2E0E', shadowOpacity: 0.10, shadowRadius: 4, elevation: 3,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 11, color: '#6B5C52', fontFamily: FONTS.bodyMedium },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, paddingBottom: 34,
    backgroundColor: 'rgba(245,240,232,0.95)',
    borderTopWidth: 1, borderTopColor: '#E8E0D5',
  },
  listViewBtn: {
    backgroundColor: '#2C1810', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  listViewText: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: '#FDFBF6' },
});
