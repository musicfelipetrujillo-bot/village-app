// Villie Boxes — cart screen.
//
// Lists committed cart lines (customized single boxes + the Full Journey
// bundle) with a live per-line breakdown, lets the user remove lines, and
// rolls up to a total. "Checkout →" carries into BoxesCheckoutScreen (Stripe
// PaymentSheet). Pricing is derived from @api/boxes — never stored.

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import {
  getBox, computeBoxPricing, bundlePricing, formatPrice, BOXES,
} from '@api/boxes';
import {
  useBoxesStore, cartLineTotal, cartTotal, type CartLine,
} from '@store/boxes';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

const T = {
  paper: COLORS.v2_paper,
  cream: COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  butter: COLORS.v2_butter,
  cinnamon: COLORS.v2_cinnamon,
  caramel: COLORS.v2_caramel,
  cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut,
  rule: 'rgba(61,31,14,0.13)',
};

type Nav = NativeStackNavigationProp<HomeStackParamList>;

// One human-readable line summary for a cart line.
function lineMeta(line: CartLine): { title: string; sub: string; hero: readonly string[]; was: number; now: number } {
  if (line.kind === 'bundle') {
    const b = bundlePricing();
    return {
      title: 'The Full Journey',
      sub: 'All three boxes · 10% off',
      hero: ['#E27C9D', '#C8814A', '#C25A78'],
      was: b.was,
      now: b.now,
    };
  }
  const box = getBox(line.boxId)!;
  const p = computeBoxPricing(box, new Set(line.removed), new Set(line.addons));
  const bits: string[] = [`${p.includedCount} items`];
  if (line.addons.length) bits.push(`${line.addons.length} add-on${line.addons.length === 1 ? '' : 's'}`);
  if (line.removed.length) bits.push(`${line.removed.length} removed`);
  return {
    title: `The ${box.pop} Box`,
    sub: bits.join(' · '),
    hero: box.hero,
    was: p.was,
    now: p.now,
  };
}

export default function BoxesCartScreen() {
  const navigation = useNavigation<Nav>();
  const cart = useBoxesStore((s) => s.cart);
  const removeCartLine = useBoxesStore((s) => s.removeCartLine);
  const clearCart = useBoxesStore((s) => s.clearCart);

  const total = cartTotal(cart);
  const wasTotal = cart.reduce((s, l) => s + lineMeta(l).was, 0);
  const saved = wasTotal - total;

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.head}>
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
          {cart.length > 0 && (
            <TouchableOpacity onPress={clearCart} accessibilityRole="button">
              <Text style={styles.clear}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.title}>Your <Text style={styles.titleEm}>cart</Text></Text>

        {cart.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🧺</Text>
            <Text style={styles.emptyTitle}>Nothing in the cart yet</Text>
            <Text style={styles.emptyBody}>
              Curated boxes for delivery, baby&apos;s first weeks, and your recovery — start with the one that&apos;s next.
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('BoxesHub')}
              accessibilityRole="button"
              style={styles.emptyCta}
            >
              <Text style={styles.emptyCtaText}>Explore the boxes →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 14, marginTop: 18 }}>
            {cart.map((line, i) => {
              const m = lineMeta(line);
              return (
                <View key={`${line.kind}-${i}`} style={styles.line}>
                  <LinearGradient
                    colors={m.hero as readonly [string, string, ...string[]]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.lineSwatch}
                  />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.lineTitle} numberOfLines={1}>{m.title}</Text>
                    <Text style={styles.lineSub} numberOfLines={1}>{m.sub}</Text>
                    <View style={styles.linePriceRow}>
                      <Text style={styles.lineNow}>{formatPrice(cartLineTotal(line))}</Text>
                      <Text style={styles.lineWas}>{formatPrice(m.was)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeCartLine(i)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${m.title}`}
                    style={styles.lineRemove}
                  >
                    <Svg width={16} height={16} viewBox="0 0 24 24">
                      <Path d="M6 6l12 12M18 6L6 18" stroke={T.walnut} strokeWidth={2} fill="none" strokeLinecap="round" />
                    </Svg>
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Totals */}
            <View style={styles.totals}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Retail value</Text>
                <Text style={styles.totalWas}>{formatPrice(wasTotal)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>You save</Text>
                <Text style={styles.totalSave}>−{formatPrice(saved)}</Text>
              </View>
              <View style={[styles.totalRow, styles.totalGrand]}>
                <Text style={styles.grandLabel}>Total</Text>
                <Text style={styles.grandValue}>{formatPrice(total)}</Text>
              </View>
              <Text style={styles.shipNote}>Shipping &amp; tax calculated at checkout.</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {cart.length > 0 && (
        <View style={styles.checkoutBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkoutTotal}>{formatPrice(total)}</Text>
            <Text style={styles.checkoutMeta}>{cart.length} {cart.length === 1 ? 'item' : 'items'}</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('BoxesCheckout')}
            accessibilityRole="button"
            accessibilityLabel={`Checkout, ${formatPrice(total)}`}
            style={styles.checkoutBtn}
          >
            <Text style={styles.checkoutBtnText}>Checkout →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// silence unused import lints if BOXES is not referenced after edits
void BOXES;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  scroll: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 130 },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
    marginLeft: -4,
  },
  clear: { fontFamily: FONTS.v2_link, fontSize: 13, color: T.walnut },

  title: {
    fontFamily: FONTS.v3_display, fontSize: 34, lineHeight: 36,
    color: T.cocoa, letterSpacing: -1.2, marginTop: 14,
  },
  titleEm: { fontFamily: FONTS.v3_display_italic, color: T.cinnamon, fontSize: 32 },

  // ── Empty ─────────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 12 },
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

  // ── Line ──────────────────────────────────────────────────────────────
  line: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14,
    backgroundColor: T.paper, borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  lineSwatch: { width: 54, height: 54, borderRadius: 12, overflow: 'hidden' },
  lineTitle: { fontFamily: FONTS.v3_display, fontSize: 16, color: T.cocoa },
  lineSub: { fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut, marginTop: 2 },
  linePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  lineNow: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.cocoa },
  lineWas: {
    fontFamily: FONTS.v2_body, fontSize: 12, color: T.walnut,
    textDecorationLine: 'line-through', opacity: 0.7,
  },
  lineRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },

  // ── Totals ────────────────────────────────────────────────────────────
  totals: {
    backgroundColor: T.paper, borderRadius: 16, padding: 16, marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  totalLabel: { fontFamily: FONTS.v2_label, fontSize: 13, color: T.walnut },
  totalWas: { fontFamily: FONTS.v2_body, fontSize: 13, color: T.walnut, textDecorationLine: 'line-through' },
  totalSave: { fontFamily: FONTS.v2_bold, fontSize: 13, color: T.cinnamon },
  totalGrand: {
    marginBottom: 8, marginTop: 4, paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  grandLabel: { fontFamily: FONTS.v2_bold, fontSize: 16, color: T.cocoa },
  grandValue: { fontFamily: FONTS.v2_display_big, fontSize: 22, color: T.cocoa },
  shipNote: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: T.walnut, opacity: 0.8 },

  // ── Checkout bar ──────────────────────────────────────────────────────
  checkoutBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 30,
    backgroundColor: T.paper,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  checkoutTotal: { fontFamily: FONTS.v2_display_big, fontSize: 24, color: T.cocoa },
  checkoutMeta: { fontFamily: FONTS.v2_label, fontSize: 11.5, color: T.walnut, marginTop: 1 },
  checkoutBtn: {
    backgroundColor: T.cinnamon, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28,
  },
  checkoutBtnText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.paper },
});
