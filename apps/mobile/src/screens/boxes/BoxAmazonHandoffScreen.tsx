// Villie Boxes — Amazon affiliate hand-off (Delivery box).
//
// The mom lands here after "Send my box to Amazon" on the detail screen. Two
// groups (see resolveAmazonItems):
//   • cart items (consumables) → one tap pre-adds them all to her Amazon cart.
//   • link items (apparel)     → she opens each to pick her own size.
// Every cart item is ALSO individually tappable, which doubles as the fallback
// if Amazon's (unofficial) add-to-cart URL ever stops working.
//
// All links carry tag=villieapp-20 and open in the system browser via
// Linking.openURL — never a WebView — so affiliate attribution survives.

import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { getBox, resolveAmazonItems, formatPrice, type BoxItem } from '@api/boxes';
import {
  buildAmazonCartUrl, buildAmazonProductUrl, AMAZON_DISCLOSURE,
} from '@utils/amazon';
import { useAnalytics } from '@hooks/useAnalytics';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

const T = {
  paper: COLORS.v2_paper,
  cream: COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  cinnamon: COLORS.v2_cinnamon,
  cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut,
  rose: '#C23E63',
  rule: 'rgba(61,31,14,0.13)',
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

function Arrow() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path d="M5 12h14M13 6l6 6-6 6" stroke={T.rose} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ItemRow({ item, onPress, label }: { item: BoxItem; onPress: () => void; label: string }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.t} <Text style={styles.rowQty}>{item.q}</Text></Text>
        <Text style={styles.rowNote} numberOfLines={1}>{item.n}</Text>
      </View>
      <Arrow />
    </TouchableOpacity>
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
  const estValue = useMemo(
    () => [...cart, ...links].reduce((s, it) => s + it.v, 0),
    [cart, links],
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

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Back">
          <Text style={styles.backChevron}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Send to Amazon</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.lede}>Your {box.pop} Box is ready.</Text>
        <Text style={styles.sub}>
          Add the essentials to your Amazon cart in one tap, then choose your size on the few that need it.
          {estValue > 0 ? `  ≈ ${formatPrice(estValue)} value.` : ''}
        </Text>

        {cart.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Add to your cart</Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={sendCart}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityLabel={`Add ${cart.length} essentials to my Amazon cart`}
            >
              <Text style={styles.primaryBtnText}>Add {cart.length} essentials to my Amazon cart →</Text>
            </TouchableOpacity>
            <View style={styles.card}>
              {cart.map((it, i) => (
                <View key={it.asin}>
                  {i > 0 && <View style={styles.divider} />}
                  <ItemRow
                    item={it}
                    label={`Open ${it.t} on Amazon`}
                    onPress={() => open(buildAmazonProductUrl(it.asin!, subtag))}
                  />
                </View>
              ))}
            </View>
            <Text style={styles.hint}>Tap any single item to add just that one instead.</Text>
          </>
        )}

        {links.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 26 }]}>Pick your size on Amazon</Text>
            <View style={styles.card}>
              {links.map((it, i) => (
                <View key={it.asin}>
                  {i > 0 && <View style={styles.divider} />}
                  <ItemRow
                    item={it}
                    label={`Choose your size for ${it.t} on Amazon`}
                    onPress={() => open(buildAmazonProductUrl(it.asin!, subtag))}
                  />
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
  scroll: { paddingHorizontal: 20, paddingBottom: 48 },

  lede: { fontFamily: FONTS.v2_display, fontSize: 24, color: T.cocoa, letterSpacing: -0.4, marginTop: 4 },
  sub: { fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21, color: T.walnut, marginTop: 8 },

  sectionTitle: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase',
    color: T.walnut, marginTop: 24, marginBottom: 12,
  },

  primaryBtn: {
    backgroundColor: T.rose, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  primaryBtnText: { fontFamily: FONTS.v2_link, fontSize: 15.5, color: T.paper, letterSpacing: 0.1 },

  card: {
    backgroundColor: T.paper, borderRadius: 16, borderWidth: 1, borderColor: T.rule,
    paddingHorizontal: 16, overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowTitle: { fontFamily: FONTS.v2_label, fontSize: 15, color: T.cocoa },
  rowQty: { fontFamily: FONTS.v2_body, fontSize: 13, color: T.walnut },
  rowNote: { fontFamily: FONTS.v2_body, fontSize: 12.5, color: T.walnut, marginTop: 2 },
  divider: { height: 1, backgroundColor: T.rule },

  hint: { fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut, marginTop: 8, marginLeft: 4 },

  disclosure: {
    fontFamily: FONTS.v2_body, fontSize: 11.5, lineHeight: 16, color: T.walnut,
    marginTop: 28, textAlign: 'center', opacity: 0.85,
  },
});
