// Villie Boxes — order history.
//
// Reads the signed-in user's villie_box_orders (owner RLS) and shows each one
// with a status pill (driven by the stripe-webhook lifecycle), the boxes it
// contained, the amount charged, and where it's shipping. Empty state routes
// back to the hub.

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import {
  boxesApi, getBox, formatPrice, ORDER_STATUS_META,
  type BoxOrderRow, type BoxId,
} from '@api/boxes';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

const T = {
  paper: COLORS.v2_paper,
  cream: COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  cinnamon: COLORS.v2_cinnamon,
  caramel: COLORS.v2_caramel,
  cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut,
  rule: 'rgba(61,31,14,0.13)',
};

type Nav = NativeStackNavigationProp<HomeStackParamList>;

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

// One line summary of what an order contained.
function orderSummary(o: BoxOrderRow): string {
  if (o.is_bundle) return 'The Full Journey · all three boxes';
  const names = o.items.map((it) => {
    const b = getBox(it.box_id);
    return b ? `The ${b.pop} Box` : it.box_id;
  });
  return names.join(' · ') || 'Villie box';
}

// Up to three hero swatches representing the boxes in the order.
function orderHeroes(o: BoxOrderRow): (readonly string[])[] {
  const ids: BoxId[] = o.is_bundle ? ['delivery', 'newborn', 'mama'] : o.items.map((it) => it.box_id);
  return ids.map((id) => getBox(id)?.hero ?? (['#E8C4B6', '#EADBA8'] as readonly string[])).slice(0, 3);
}

export default function BoxOrdersScreen() {
  const navigation = useNavigation<Nav>();
  const [orders, setOrders] = useState<BoxOrderRow[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    boxesApi.listMyOrders()
      .then(setOrders)
      .catch(() => { setError(true); setOrders([]); });
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backBtn}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d="M15 18l-6-6 6-6" stroke={T.cocoa} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>

        <Text style={styles.title}>Your <Text style={styles.titleEm}>orders</Text></Text>

        {orders === null ? (
          <View style={{ paddingTop: 60, alignItems: 'center' }}>
            <ActivityIndicator color={T.cinnamon} />
          </View>
        ) : orders.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={styles.emptyTitle}>{error ? 'Couldn’t load orders' : 'No orders yet'}</Text>
            <Text style={styles.emptyBody}>
              {error
                ? 'Something went wrong loading your orders. Pull back and try again.'
                : 'When you order a Villie box, it’ll show up here with its status and shipping details.'}
            </Text>
            <TouchableOpacity
              onPress={() => (error ? load() : navigation.navigate('BoxesHub'))}
              accessibilityRole="button"
              style={styles.emptyCta}
            >
              <Text style={styles.emptyCtaText}>{error ? 'Try again' : 'Explore the boxes →'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 14, marginTop: 18 }}>
            {orders.map((o) => {
              const meta = ORDER_STATUS_META[o.status];
              return (
                <View key={o.id} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.heroes}>
                      {orderHeroes(o).map((hero, i) => (
                        <LinearGradient
                          key={i}
                          colors={hero as readonly [string, string, ...string[]]}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={[styles.heroDot, { marginLeft: i === 0 ? 0 : -10, zIndex: 3 - i }]}
                        />
                      ))}
                    </View>
                    <View style={[styles.pill, meta.done ? styles.pillDone : styles.pillPending]}>
                      <Text style={[styles.pillText, meta.done ? styles.pillTextDone : styles.pillTextPending]}>
                        {meta.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardSummary} numberOfLines={2}>{orderSummary(o)}</Text>
                  <Text style={styles.cardMeta}>
                    {fmtDate(o.created_at)} · {formatPrice(o.amount_cents / 100)}
                    {o.ship_city ? ` · to ${o.ship_city}${o.ship_state ? `, ${o.ship_state}` : ''}` : ''}
                  </Text>
                  <Text style={styles.cardRef}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  scroll: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 60 },

  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
    marginLeft: -4, marginBottom: 8,
  },
  title: {
    fontFamily: FONTS.v3_display, fontSize: 34, lineHeight: 36,
    color: T.cocoa, letterSpacing: -1.2, marginTop: 8,
  },
  titleEm: { fontFamily: FONTS.v3_display_italic, color: T.cinnamon, fontSize: 32 },

  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 12 },
  emptyEmoji: { fontSize: 52 },
  emptyTitle: { fontFamily: FONTS.v2_display_big, fontSize: 20, color: T.cocoa, marginTop: 16 },
  emptyBody: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21,
    color: T.walnut, textAlign: 'center', marginTop: 8,
  },
  emptyCta: {
    marginTop: 24, backgroundColor: T.cinnamon, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 24,
  },
  emptyCtaText: { fontFamily: FONTS.v2_bold, fontSize: 14, color: T.paper },

  card: {
    backgroundColor: T.paper, borderRadius: 16, padding: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroes: { flexDirection: 'row', alignItems: 'center' },
  heroDot: {
    width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
    borderWidth: 2, borderColor: T.paper,
  },
  pill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  pillDone: { backgroundColor: 'rgba(122,74,36,0.10)' },
  pillPending: { backgroundColor: 'rgba(217,108,136,0.12)' },
  pillText: { fontFamily: FONTS.v2_bold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  pillTextDone: { color: T.walnut },
  pillTextPending: { color: T.cinnamon },

  cardSummary: { fontFamily: FONTS.v3_display, fontSize: 17, color: T.cocoa, marginTop: 14 },
  cardMeta: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: T.walnut, marginTop: 6 },
  cardRef: { fontFamily: FONTS.v2_mono, fontSize: 10.5, color: T.caramel, letterSpacing: 1, marginTop: 8 },
});
