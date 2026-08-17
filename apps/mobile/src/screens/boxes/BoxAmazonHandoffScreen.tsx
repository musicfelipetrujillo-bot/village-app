// Villie Boxes — Amazon affiliate hand-off (Delivery box).
//
// Two numbered steps, high contrast, no fluff:
//   1 · Add to cart — one tap pre-adds the consumables to her Amazon cart.
//                     (each is also individually tappable = fallback.)
//   2 · Pick your size — apparel opens per-item so she chooses her own size.
// All links carry tag=villieapp-20 and open in the system browser via
// Linking.openURL — never a WebView — so affiliate attribution survives.

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking,
} from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { getBox, resolveAmazonItems, type BoxItem } from '@api/boxes';
import {
  buildAmazonCartUrl, buildAmazonProductUrl, AMAZON_DISCLOSURE,
} from '@utils/amazon';
import { useAnalytics } from '@hooks/useAnalytics';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

const T = {
  paper: COLORS.v2_paper,
  cream: COLORS.v2_cream,
  card: COLORS.v2_card,
  cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut,
  rose: '#B62F52',
  rule: 'rgba(61,31,14,0.16)',
};

type Nav = NativeStackNavigationProp<HomeStackParamList>;
type Rt = RouteProp<HomeStackParamList, 'BoxAmazonHandoff'>;

const open = async (url: string) => {
  try {
    await Linking.openURL(url);
  } catch {
    /* system browser missing — nothing else we can safely do */
  }
};

function StepHead({ n, label }: { n: number; label: string }) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{n}</Text></View>
      <Text style={styles.stepLabel}>{label}</Text>
    </View>
  );
}

export default function BoxAmazonHandoffScreen() {
  const navigation = useNavigation<Nav>();
  const { trackEvent } = useAnalytics();
  const { boxId, removed = [] } = useRoute<Rt>().params;
  const box = getBox(boxId);

  const removedSet = useMemo(() => new Set(removed), [removed]);
  const { cart, links } = useMemo(
    () => (box ? resolveAmazonItems(box, removedSet) : { cart: [], links: [] }),
    [box, removedSet],
  );

  if (!box) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontFamily: FONTS.v2_body, color: T.walnut }}>Box not found.</Text>
      </View>
    );
  }

  const subtag = `box_${boxId}`;
  const cartUrl = buildAmazonCartUrl(
    cart.map((it) => ({ asin: it.asin!, qty: it.qty })),
    subtag,
  );

  const sendCart = () => {
    trackEvent('box_amazon_handoff', {
      box_id: boxId,
      cart_count: cart.length,
      link_count: links.length,
      item_count: cart.length + links.length,
    });
    if (cartUrl) open(cartUrl);
  };

  const row = (it: BoxItem, right: React.ReactNode, label: string) => (
    <TouchableOpacity
      key={it.asin}
      style={styles.row}
      onPress={() => open(buildAmazonProductUrl(it.asin!, subtag))}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowLeft}>
        {it.icon ? <Text style={styles.rowIcon}>{it.icon}</Text> : null}
        <Text style={styles.rowName} numberOfLines={1}>{it.t}</Text>
      </View>
      {right}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>The {box.pop} Box</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {cart.length > 0 && (
          <>
            <StepHead n={1} label="Add to your Amazon cart" />
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={sendCart}
              activeOpacity={0.9}
              accessibilityRole="button"
              accessibilityLabel={`Add ${cart.length} essentials to my Amazon cart`}
            >
              <Text style={styles.primaryBtnText}>Add all {cart.length} to cart  →</Text>
            </TouchableOpacity>
            <View style={styles.card}>
              {cart.map((it, i) => (
                <View key={it.asin}>
                  {i > 0 && <View style={styles.divider} />}
                  {row(it, <Text style={styles.rowQty}>{it.q}</Text>, `Add ${it.t} to Amazon`)}
                </View>
              ))}
            </View>
            <Text style={styles.microHint}>Or tap one item to add just that.</Text>
          </>
        )}

        {links.length > 0 && (
          <>
            <StepHead n={cart.length > 0 ? 2 : 1} label="Pick your size on Amazon" />
            <View style={styles.card}>
              {links.map((it, i) => (
                <View key={it.asin}>
                  {i > 0 && <View style={styles.divider} />}
                  {row(it, <Text style={styles.rowAction}>choose size ›</Text>, `Choose your size for ${it.t}`)}
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.disclosure}>{AMAZON_DISCLOSURE}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 56, paddingBottom: 10, paddingHorizontal: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backChevron: { fontSize: 30, color: T.cocoa, marginTop: -4 },
  headerTitle: { fontFamily: FONTS.v2_display, fontSize: 18, color: T.cocoa, letterSpacing: -0.3 },
  scroll: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 48 },

  // Numbered step header — rose badge + dark label for strong hierarchy.
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, marginBottom: 12 },
  stepBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: T.rose, alignItems: 'center', justifyContent: 'center' },
  stepBadgeText: { fontFamily: FONTS.v2_link, fontSize: 13, color: '#fff' },
  stepLabel: { fontFamily: FONTS.v2_display, fontSize: 18, color: T.cocoa, letterSpacing: -0.3 },

  primaryBtn: {
    backgroundColor: T.rose, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  primaryBtnText: { fontFamily: FONTS.v2_link, fontSize: 16, color: '#fff', letterSpacing: 0.2 },

  card: {
    backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.rule,
    paddingHorizontal: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 15 },
  rowLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 20 },
  rowName: { flex: 1, minWidth: 0, fontFamily: FONTS.v2_bold, fontSize: 15.5, color: T.cocoa },
  rowQty: { fontFamily: FONTS.v2_label, fontSize: 13.5, color: T.walnut },
  rowAction: { fontFamily: FONTS.v2_link, fontSize: 13.5, color: T.rose },
  divider: { height: 1, backgroundColor: T.rule },

  microHint: { fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut, marginTop: 8, marginLeft: 2 },

  disclosure: {
    fontFamily: FONTS.v2_body, fontSize: 11.5, lineHeight: 16, color: T.walnut,
    marginTop: 30, textAlign: 'center',
  },
});
