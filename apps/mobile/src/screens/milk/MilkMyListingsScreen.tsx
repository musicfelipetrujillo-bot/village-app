// Milk — the donor's own listings (was a placeholder). Reached after creating
// a listing and from the marketplace, so a donor can actually SEE + manage
// what she's shared. Reads milk_listings via getMyListings.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMilkStore } from '@store/milk';
import { getMyListings, type MilkListing } from '@api/milk';
import { FONTS } from '@utils/constants';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Nav = NativeStackNavigationProp<MilkStackParamList, 'DonorListingManager'>;

const C = {
  cream: '#FCF7EF', paper: '#FDF7EC',
  rose: '#E84B79', roseInk: '#B0234F',
  honey: '#F5C842', honeyInk: '#B98A1E',
  cocoa: '#3D2116', walnut: '#8A6A55', sage: '#7B8A46', muted: '#A6957F', hair: 'rgba(61,31,14,0.08)',
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Active', color: C.sage, bg: 'rgba(123,138,70,0.14)' },
  paused: { label: 'Paused', color: C.honeyInk, bg: 'rgba(185,138,30,0.14)' },
  sold_out: { label: 'Sold out', color: C.walnut, bg: 'rgba(138,106,85,0.14)' },
  deleted: { label: 'Removed', color: C.muted, bg: 'rgba(166,149,127,0.14)' },
};

export default function MilkMyListingsScreen() {
  const nav = useNavigation<Nav>();
  const donorProfile = useMilkStore((s) => s.donorProfile);
  const [listings, setListings] = useState<MilkListing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!donorProfile) { setLoading(false); return; }
    try {
      const rows = await getMyListings(donorProfile.id);
      setListings(rows);
    } catch { /* leave */ } finally { setLoading(false); }
  }, [donorProfile]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const goCreate = () => donorProfile && nav.navigate('CreateListing', { donorProfileId: donorProfile.id });

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => nav.goBack()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.back}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.title}>your listings</Text>
          <TouchableOpacity onPress={goCreate} accessibilityRole="button" accessibilityLabel="Add a listing" style={styles.addBtn}>
            <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" /></Svg>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.center}><ActivityIndicator color={C.rose} /></View>
        ) : listings.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Svg width={30} height={30} viewBox="0 0 24 24"><Path d="M12 3s6 7 6 11a6 6 0 11-12 0c0-4 6-11 6-11z" stroke={C.honeyInk} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" /></Svg>
            </View>
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptyBody}>When you list your extra milk, it shows up here for moms nearby to find.</Text>
            <TouchableOpacity style={styles.emptyCta} onPress={goCreate} activeOpacity={0.9} accessibilityRole="button">
              <Text style={styles.emptyCtaText}>＋ Create a listing</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 110 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={C.rose} />}>
            {listings.map((l) => {
              const st = STATUS[l.status] ?? STATUS.active;
              const free = l.price_per_oz <= 0;
              return (
                <View key={l.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View>
                      <Text style={styles.cardOz}>{l.oz_available}<Text style={styles.cardOzUnit}> oz available</Text></Text>
                      <Text style={styles.cardPrice}>{free ? 'Donating' : `$${l.price_per_oz.toFixed(2)} / oz`}{l.min_order_oz > 0 ? ` · min ${l.min_order_oz} oz` : ''}</Text>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: st.bg }]}><Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text></View>
                  </View>
                  <View style={styles.tagRow}>
                    {l.pickup_available && <View style={styles.tag}><Text style={styles.tagText}>Pickup</Text></View>}
                    {l.shipping_available && <View style={styles.tag}><Text style={styles.tagText}>Shipping{l.shipping_price ? ` · $${l.shipping_price}` : ''}</Text></View>}
                  </View>
                  {l.notes ? <Text style={styles.cardNotes}>{l.notes}</Text> : null}
                </View>
              );
            })}
            <TouchableOpacity style={styles.addRow} onPress={goCreate} activeOpacity={0.9} accessibilityRole="button">
              <Text style={styles.addRowText}>＋ Add another listing</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 },
  back: { fontSize: 30, color: C.roseInk, marginTop: -4 },
  title: { fontFamily: FONTS.v2_bold, fontSize: 17, color: C.cocoa },
  addBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.rose, alignItems: 'center', justifyContent: 'center' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 },
  emptyIcon: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#FBE9BE', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontFamily: FONTS.v2_display_big, fontSize: 21, color: C.cocoa },
  emptyBody: { fontFamily: FONTS.v2_body, fontSize: 13.5, lineHeight: 20, color: C.walnut, textAlign: 'center', marginTop: 8 },
  emptyCta: { backgroundColor: C.rose, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 26, marginTop: 20 },
  emptyCtaText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: '#fff' },

  card: { backgroundColor: C.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(224,106,136,0.16)', borderRadius: 16, padding: 16, marginBottom: 12 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardOz: { fontFamily: FONTS.v2_display_big, fontSize: 22, color: C.cocoa },
  cardOzUnit: { fontFamily: FONTS.v2_body, fontSize: 13, color: C.walnut },
  cardPrice: { fontFamily: FONTS.v2_link, fontSize: 13, color: C.roseInk, marginTop: 3 },
  statusPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  statusText: { fontFamily: FONTS.v2_label, fontSize: 11.5 },
  tagRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tag: { backgroundColor: '#F2E6DD', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontFamily: FONTS.v2_body, fontSize: 11, color: C.walnut },
  cardNotes: { fontFamily: FONTS.v2_body, fontSize: 12.5, lineHeight: 18, color: '#5A4030', marginTop: 10 },

  addRow: { alignItems: 'center', paddingVertical: 16, marginTop: 4 },
  addRowText: { fontFamily: FONTS.v2_link, fontSize: 14, color: C.roseInk },
});
