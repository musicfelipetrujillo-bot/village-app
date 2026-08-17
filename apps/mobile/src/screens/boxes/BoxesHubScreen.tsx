// Villie Boxes — hub screen.
//
// Reworked 2026-08-09 to the calm "mamas corner" pattern (Felipe: the old hub
// "feels super editorial"). One quiet header, one intro line, ONE warm rose→
// blush moment (the Full Journey bundle), a quiet bordered list of the three
// stage boxes, and a single scarlet cart spark. No masthead / eyebrow stack,
// no animated gift illustration, no dark bundle banner, no per-card taglines.
//
// Functionality preserved 1:1 — box taps → BoxDetail, bundle add/remove →
// toggleBundle, My orders → BoxOrders, sticky cart → BoxesCart. Catalog still
// reads from @api/boxes.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { BOXES, bundlePricing, formatPrice, isAmazonBox, type Box } from '@api/boxes';
import { useBoxesStore, cartTotal } from '@store/boxes';
import { BackButton } from '@components/shared/BackButton';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

const ROSE = '#C24A63', ROSE_DEEP = '#9E2F4C', BLUSH = '#E894AC', SCARLET = '#E14A32';
const INK = '#43260F', INKSOFT = '#7A5A3A';

type Nav = NativeStackNavigationProp<HomeStackParamList>;

// One box card — tells a mom what this box IS: name + stage + the plain-English
// description (tagline) + price, with a "what's inside" way in.
function BoxCard({ box, onPress }: { box: Box; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={styles.boxCard}
      accessibilityRole="button"
      accessibilityLabel={`The ${box.pop} Box, ${box.stage}, ${isAmazonBox(box) ? 'shop on Amazon' : formatPrice(box.price)}. ${box.tagline}`}
    >
      <View style={styles.boxTop}>
        <LinearGradient colors={[ROSE, BLUSH]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.boxIcon}>
          <Text style={styles.boxIconGlyph}>🎁</Text>
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.boxName}>The {box.pop} Box</Text>
          <Text style={styles.boxStage} numberOfLines={1}>{box.stage}</Text>
        </View>
        <Text style={styles.boxPrice}>{isAmazonBox(box) ? 'Amazon' : formatPrice(box.price)}</Text>
      </View>
      <Text style={styles.boxDesc} numberOfLines={3}>{box.tagline}</Text>
      <Text style={styles.boxInsideLink}>see what&apos;s inside  ›</Text>
    </TouchableOpacity>
  );
}

export default function BoxesHubScreen() {
  const navigation = useNavigation<Nav>();
  const cart = useBoxesStore((s) => s.cart);
  const toggleBundle = useBoxesStore((s) => s.toggleBundle);

  const bundle = bundlePricing();
  const bundleInCart = cart.some((l) => l.kind === 'bundle');
  // The Full Journey bundle Stripe-charges all three boxes together — it can't
  // include an Amazon-fulfilled box, so hide it while any box is on Amazon.
  const hasAmazonBox = BOXES.some(isAmazonBox);
  const cartCount = cart.length;
  const total = cartTotal(cart);

  return (
    <View style={styles.container}>
      <WarmGlowBackdrop />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(247,197,203,0.40)', 'rgba(247,197,203,0.10)', 'rgba(252,247,239,0)']}
        locations={[0, 0.5, 1]}
        style={styles.pageWash}
      />

      {/* calm header */}
      <View style={styles.header}>
        <BackButton color={ROSE} />
        <View style={styles.dot} />
        <Text style={styles.hTitle}>villie boxes</Text>
        <TouchableOpacity
          style={styles.ordersLink}
          onPress={() => navigation.navigate('BoxOrders')}
          accessibilityRole="button"
          accessibilityLabel="My orders"
        >
          <Text style={styles.ordersLinkText}>my orders ›</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* one calm line */}
        <Text style={styles.intro}>The right things, gathered for each stage.</Text>

        {/* the one warm moment — the Full Journey bundle (Stripe boxes only) */}
        {!hasAmazonBox && (
          <TouchableOpacity
            style={styles.heroCard}
            activeOpacity={0.92}
            onPress={toggleBundle}
            accessibilityRole="button"
            accessibilityLabel={bundleInCart ? 'Remove the full journey bundle from cart' : 'Add all three boxes to cart'}
          >
            <LinearGradient colors={[ROSE, BLUSH]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroInner}>
              <View style={styles.heroBee}><Image source={VILLIE_BEE} style={{ width: 26, height: 26 }} resizeMode="contain" /></View>
              <Text style={styles.heroTitle}>the full journey</Text>
              <Text style={styles.heroSub}>all three boxes, bundled at 10% off</Text>
              <View style={styles.heroPriceRow}>
                <Text style={styles.heroNow}>{formatPrice(bundle.now)}</Text>
                <Text style={styles.heroWas}>{formatPrice(bundle.was)}</Text>
                <View style={styles.heroSaveChip}><Text style={styles.heroSaveText}>save {formatPrice(bundle.save)}</Text></View>
              </View>
              <View style={[styles.heroPill, bundleInCart && styles.heroPillAdded]}>
                <Text style={styles.heroPillText}>{bundleInCart ? '✓ in cart' : 'add all three ›'}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* the three stage boxes — a descriptive card each */}
        {BOXES.map((box) => (
          <BoxCard
            key={box.id}
            box={box}
            onPress={() => navigation.navigate('BoxDetail', { boxId: box.id })}
          />
        ))}

        <Text style={styles.foot}>Photos and pricing are placeholders pending the launch catalog.</Text>
      </ScrollView>

      {/* sticky cart bar — the one scarlet spark */}
      {cartCount > 0 && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => navigation.navigate('BoxesCart')}
          accessibilityRole="button"
          accessibilityLabel={`View cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}, ${formatPrice(total)}`}
          style={styles.cartBar}
        >
          <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cartCount}</Text></View>
          <Text style={styles.cartBarText}>View cart</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.cartBarTotal}>{formatPrice(total)}  →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  pageWash: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },

  // Header — calm: back + dot + lowercase title + orders link
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingTop: 58, paddingBottom: 6, paddingHorizontal: 18,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ROSE },
  hTitle: { fontFamily: FONTS.v2_bold, fontSize: 17, color: INK },
  ordersLink: { marginLeft: 'auto' },
  ordersLinkText: { fontFamily: FONTS.v2_link, fontSize: 13, color: ROSE },

  scroll: { paddingBottom: 120 },

  // Intro — one calm line
  intro: {
    paddingHorizontal: 22, paddingTop: 12,
    fontFamily: FONTS.v3_display, fontSize: 22, lineHeight: 28, color: INK, letterSpacing: -0.5,
  },

  // Hero — the one warm moment (Full Journey bundle)
  heroCard: {
    marginHorizontal: 22, marginTop: 18, borderRadius: 20,
    shadowColor: ROSE_DEEP, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.20, shadowRadius: 20, elevation: 4,
  },
  heroInner: { borderRadius: 20, paddingVertical: 18, paddingHorizontal: 18, overflow: 'hidden' },
  heroBee: { position: 'absolute', top: 14, right: 16, opacity: 0.9 },
  heroTitle: { fontFamily: FONTS.v3_display, fontSize: 22, color: '#FFFDF8', letterSpacing: -0.4 },
  heroSub: { fontFamily: FONTS.v2_body, fontSize: 13, color: 'rgba(255,253,248,0.92)', marginTop: 4, maxWidth: '82%' },
  heroPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  heroNow: { fontFamily: FONTS.v2_display_big, fontSize: 24, color: '#FFFDF8' },
  heroWas: { fontFamily: FONTS.v2_body, fontSize: 13, color: 'rgba(255,253,248,0.78)', textDecorationLine: 'line-through' },
  heroSaveChip: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  heroSaveText: { fontFamily: FONTS.v2_bold, fontSize: 10.5, color: '#FFFDF8' },
  heroPill: { marginTop: 14, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.24)', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  heroPillAdded: { backgroundColor: 'rgba(255,255,255,0.16)' },
  heroPillText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: '#fff', letterSpacing: 0.3 },

  // Descriptive box cards — one per box, with the plain-English description
  boxCard: {
    marginHorizontal: 22, marginTop: 12, backgroundColor: COLORS.v2_paper, borderRadius: 18,
    paddingVertical: 15, paddingHorizontal: 15,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(122,74,40,0.14)',
  },
  boxTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boxIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  boxIconGlyph: { fontSize: 19 },
  boxName: { fontFamily: FONTS.v3_display, fontSize: 17, color: INK, letterSpacing: -0.3 },
  boxStage: { fontFamily: FONTS.v2_body, fontSize: 11.5, color: INKSOFT, marginTop: 1 },
  boxPrice: { fontFamily: FONTS.v2_bold, fontSize: 16, color: ROSE },
  boxDesc: { fontFamily: FONTS.v2_body, fontSize: 13, color: '#6B5540', lineHeight: 19, marginTop: 11 },
  boxInsideLink: { fontFamily: FONTS.v2_link, fontSize: 12.5, color: ROSE, marginTop: 10 },

  foot: {
    fontFamily: FONTS.v2_body, fontSize: 11, lineHeight: 16,
    color: INKSOFT, opacity: 0.7, marginTop: 22, marginHorizontal: 22, textAlign: 'center',
  },

  // Sticky cart bar — one scarlet spark
  cartBar: {
    position: 'absolute', left: 16, right: 16, bottom: 24,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: SCARLET, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 18,
    shadowColor: ROSE_DEEP, shadowOpacity: 0.20, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  cartBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  cartBadgeText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: '#FFFDF8' },
  cartBarText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: '#FFFDF8' },
  cartBarTotal: { fontFamily: FONTS.v2_bold, fontSize: 15, color: '#FFFDF8' },
});
