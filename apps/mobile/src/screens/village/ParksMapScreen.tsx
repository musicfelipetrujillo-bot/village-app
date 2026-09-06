// Villie Plans — baby-friendly parks near you.
//
// A curated map (insider picks + who each park is for) over the mom's location,
// with a tappable list below that opens directions. Data is hand-curated in
// utils/parks (Google can find parks; it can't tell you which are good for
// babies — that's the Villie value).

import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Dimensions } from 'react-native';
import MapView, { Marker, Callout, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { COLORS, FONTS } from '@utils/constants';
import { ScreenHeader } from '@components/shared/ScreenHeader';
import { PARKS, AGE_TONE, parkTone, parkDirectionsUrl, type Park } from '@utils/parks';

const T = {
  cream: COLORS.v2_cream,
  card: COLORS.v2_card,
  cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut,
  rose: '#C24A63',
  rule: 'rgba(61,31,14,0.13)',
};

// Center on the Grove by default (where the seed parks are); recenters on the
// mom's location once we have it.
const DEFAULT_REGION: Region = { latitude: 25.731, longitude: -80.238, latitudeDelta: 0.06, longitudeDelta: 0.06 };
const MAP_H = Math.round(Dimensions.get('window').height * 0.46);

const openDirections = (p: Park) => { Linking.openURL(parkDirectionsUrl(p)).catch(() => {}); };

function AgeChips({ park }: { park: Park }) {
  return (
    <View style={s.chipRow}>
      {park.ages.map((a) => (
        <View key={a} style={[s.chip, { backgroundColor: AGE_TONE[a] + '22', borderColor: AGE_TONE[a] + '55' }]}>
          <Text style={[s.chipText, { color: AGE_TONE[a] }]}>{a}</Text>
        </View>
      ))}
    </View>
  );
}

export default function ParksMapScreen() {
  const nav = useNavigation<any>();
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({}));
        if (!pos || cancelled) return;
        setHasUser(true);
        setRegion((r) => ({ ...r, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const parks = useMemo(() => PARKS, []);

  return (
    <View style={s.container}>
      <ScreenHeader
        title="parks nearby"
        onBack={() => nav.goBack()}
        backColor={T.rose}
        right={<Text style={s.count}>{parks.length}</Text>}
      />

      <MapView style={{ height: MAP_H }} region={region} showsUserLocation={hasUser} showsMyLocationButton>
        {parks.map((p) => (
          <Marker key={p.id} coordinate={{ latitude: p.lat, longitude: p.lng }}>
            <View style={[s.pin, { backgroundColor: parkTone(p) }]}><Text style={s.pinEmoji}>🌳</Text></View>
            <Callout tooltip onPress={() => openDirections(p)}>
              <View style={s.callout}>
                <Text style={s.calloutName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.calloutMeta} numberOfLines={1}>{p.area} · {p.ages.join(' · ')}</Text>
                <Text style={s.calloutGo}>open in maps ›</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
        {parks.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={s.card}
            activeOpacity={0.9}
            onPress={() => openDirections(p)}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}, ${p.area} — open in maps`}
          >
            <View style={[s.cardBar, { backgroundColor: parkTone(p) }]} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={s.cardHead}>
                <Text style={s.cardName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.cardArea} numberOfLines={1}>{p.area}</Text>
              </View>
              <AgeChips park={p} />
              <Text style={s.cardBlurb}>{p.blurb}</Text>
              <Text style={s.cardGo}>get directions ›</Text>
            </View>
          </TouchableOpacity>
        ))}
        <Text style={s.disclaimer}>Hand-picked by Villie · tell us your favorites and we’ll add them.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  count: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.rose },

  pin: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  pinEmoji: { fontSize: 16 },
  callout: { backgroundColor: T.card, borderRadius: 12, padding: 10, minWidth: 160, borderWidth: 1, borderColor: T.rule },
  calloutName: { fontFamily: FONTS.v2_bold, fontSize: 14, color: T.cocoa },
  calloutMeta: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, marginTop: 2 },
  calloutGo: { fontFamily: FONTS.v2_link, fontSize: 12, color: T.rose, marginTop: 6 },

  list: { padding: 18, paddingBottom: 48 },
  card: { flexDirection: 'row', gap: 14, backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.rule, padding: 16, marginBottom: 12 },
  cardBar: { width: 4, borderRadius: 2 },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  cardName: { flex: 1, fontFamily: FONTS.v2_display, fontSize: 17, color: T.cocoa, letterSpacing: -0.2 },
  cardArea: { fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase', color: T.walnut },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontFamily: FONTS.v2_label, fontSize: 11 },
  cardBlurb: { fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 19, color: T.walnut, marginTop: 8 },
  cardGo: { fontFamily: FONTS.v2_link, fontSize: 13, color: T.rose, marginTop: 8 },

  disclaimer: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, textAlign: 'center', marginTop: 10 },
});
