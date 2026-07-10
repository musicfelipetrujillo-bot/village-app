// Villie Boxes — hub screen.
//
// Faithful RN port of the 2026-06 design handoff `villie-boxes.html` hub:
// editorial masthead → compact/editorial layout toggle → the three stage
// boxes (hero gradient band, badge, Caveat pop title, stage, tagline, price
// vs was, item count, trust chips) → the "Full Journey" bundle banner (all
// three at 10% off). A sticky cart bar surfaces when the cart is non-empty.
//
// Matches the app's v2/v3 brand kit (COLORS/FONTS) rather than the handoff's
// slightly-different hexes, per memory project_villie_boxes. One cinnamon
// spark per surface = the primary CTA.

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Animated, Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Rect, Ellipse, Polygon, Line } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import {
  BOXES, computeBoxPricing, bundlePricing, formatPrice, type Box,
} from '@api/boxes';
import { useBoxesStore, cartTotal } from '@store/boxes';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

// villie-bee.png — perched on the rim of the opened-box illustration so the
// art reads as villie-branded (the mascot greets you from inside the box).
const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');
const V_MARK = require('../../../assets/brand/villie-v-mark-v2.png');

// Soft per-box card tints (by index) — the plain paper cards blended into the
// cream page, so each card now sits on its own warm wash for separation.
const CARD_TINTS = ['#F8ECE2', '#FBE7EC', '#FBF1D6'];
const CARD_BORDERS = ['rgba(233,138,106,0.30)', 'rgba(217,108,136,0.28)', 'rgba(244,197,60,0.40)'];

const T = {
  paper: COLORS.v2_paper,
  cream: COLORS.v2_cream,
  parchment: COLORS.v2_parchment,
  butter: COLORS.v2_butter,
  cinnamon: COLORS.v2_cinnamon,
  caramel: COLORS.v2_caramel,
  blush: COLORS.v2_blush,
  cocoa: COLORS.v2_cocoa,
  walnut: COLORS.v2_walnut,
  rule: 'rgba(61,31,14,0.13)',
};

type Nav = NativeStackNavigationProp<HomeStackParamList>;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 16, height: 1.5, backgroundColor: T.walnut, marginRight: 8 }} />
      <Text style={styles.eyebrow}>{children}</Text>
    </View>
  );
}

// Opened gift box with items spilling up + the villie bee on the rim. Flat,
// brand-colored, compact (smaller than the photographic reference). The bee
// is the real mascot PNG layered over the SVG so the art is villie-branded.
// A 4-point sparkle for the twinkles drifting around the gift.
const STAR4 = 'M12 2c1 5 2 6 7 7-5 1-6 2-7 7-1-5-2-6-7-7 5-1 6-2 7-7z';

function Twinkle({ pos, delay, color, size = 13 }: { pos: object; delay: number; color: string; size?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(a, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0, duration: 800, useNativeDriver: true }),
      Animated.delay(700),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a, delay]);
  return (
    <Animated.View pointerEvents="none" style={[
      { position: 'absolute', opacity: a, transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] },
      pos,
    ]}>
      <Svg width={size} height={size} viewBox="0 0 24 24"><Path d={STAR4} fill={color} /></Svg>
    </Animated.View>
  );
}

// The balloon bunch lifting the box (villie pastel palette).
const BALLOONS = [
  { cx: 56, cy: 20, fill: '#F7C5CB' },
  { cx: 80, cy: 17, fill: '#F4B89C' },
  { cx: 42, cy: 30, fill: '#F4C868' },
  { cx: 96, cy: 32, fill: '#EE9C7C' },
  { cx: 67, cy: 30, fill: '#E98AA6' },
  { cx: 52, cy: 46, fill: '#FBEFD9' },
  { cx: 88, cy: 48, fill: '#F7C5CB' },
  { cx: 72, cy: 49, fill: '#E87B7B' },
];

// A kraft box lifted by a bunch of pastel balloons, drifting up through a soft
// sky — our own villie-palette take on the reference (the brand bee floats
// along; a honey hex marks the box). Gently bobs + sways in a loop.
function GiftBoxArt({ size = 150 }: { size?: number }) {
  const w = size, h = size * 1.07;
  const f = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(f, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(f, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [f]);
  const translateY = f.interpolate({ inputRange: [0, 1], outputRange: [5, -8] });
  const rotate = f.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });
  return (
    <Animated.View style={{ width: w, height: h, transform: [{ translateY }, { rotate }] }}>
      <Svg width={w} height={h} viewBox="0 0 140 150">
        {/* soft clouds */}
        <Ellipse cx={30} cy={122} rx={30} ry={12} fill="#FFFFFF" opacity={0.45} />
        <Ellipse cx={112} cy={134} rx={28} ry={11} fill="#FFFFFF" opacity={0.4} />
        <Ellipse cx={70} cy={143} rx={42} ry={12} fill="#FFFFFF" opacity={0.32} />
        {/* strings */}
        {BALLOONS.map((b, i) => (
          <Line key={`s${i}`} x1={b.cx} y1={b.cy + 11} x2={70} y2={66} stroke="rgba(120,90,70,0.3)" strokeWidth={0.7} />
        ))}
        <Line x1={70} y1={66} x2={70} y2={101} stroke="rgba(120,90,70,0.45)" strokeWidth={1.3} />
        {/* balloons + gloss */}
        {BALLOONS.map((b, i) => (
          <Ellipse key={`b${i}`} cx={b.cx} cy={b.cy} rx={9.5} ry={12} fill={b.fill} />
        ))}
        {BALLOONS.map((b, i) => (
          <Ellipse key={`g${i}`} cx={b.cx - 3} cy={b.cy - 4} rx={2.4} ry={3.4} fill="#FFFFFF" opacity={0.5} />
        ))}
        {/* box — kraft body + cream label carrying the real villie V-mark logo
            (Image overlaid below), flanked by tiny honeycomb cells. */}
        <Rect x={50} y={101} width={40} height={38} rx={4} fill="#E7D2AC" />
        <Path d="M50 109 H90" stroke="#C9AF82" strokeWidth={1.1} />
        <Polygon points="55,106 58,106 59.5,108.5 58,111 55,111 53.5,108.5" fill="none" stroke="#C9A24A" strokeWidth={0.9} />
        <Polygon points="82,127 85,127 86.5,129.5 85,132 82,132 80.5,129.5" fill="none" stroke="#C9A24A" strokeWidth={0.9} />
        <Rect x={55} y={114} width={30} height={20} rx={4} fill="#FFFCF6" stroke="#E4D3B4" strokeWidth={0.8} />
      </Svg>
      <Image
        source={VILLIE_BEE}
        resizeMode="contain"
        accessible={false}
        style={{ position: 'absolute', top: 4, left: w * 0.26, width: 22, height: 22, transform: [{ rotate: '-14deg' }] }}
      />
      <Image
        source={V_MARK}
        resizeMode="contain"
        accessible={false}
        style={{ position: 'absolute', top: h * 0.755, left: w * 0.405, width: 28, height: 21 }}
      />
    </Animated.View>
  );
}

// Small gift glyph stamped on each card's hero thumbnail.
const GIFT_PATH = 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M8.5 7C6.6 7 5.5 4 7 3.2 8.6 2.4 12 7 12 7m0 0s3.4-4.6 5-3.8C18.5 4 17.4 7 15.5 7';

function BoxCard({ box, tint, border, onPress }: { box: Box; tint: string; border: string; onPress: () => void }) {
  // "Now" price with no customization (full box).
  const pricing = computeBoxPricing(box, new Set(), new Set());
  return (
    <TouchableOpacity activeOpacity={0.93} onPress={onPress} style={[styles.card, { backgroundColor: tint, borderColor: border }]}>
      <View style={styles.cardRow}>
        {/* Hero gradient thumbnail with a gift glyph stamp. */}
        <LinearGradient
          colors={box.hero as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.cardThumb}
        >
          <LinearGradient
            colors={[box.glow, 'rgba(255,255,255,0)']}
            start={{ x: 0.15, y: 0.1 }} end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <Svg width={30} height={30} viewBox="0 0 24 24">
            <Path d={GIFT_PATH} stroke="#FFFFFF" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </LinearGradient>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardStage}>{box.stage}</Text>
          <Text style={styles.cardTitle}>
            The <Text style={[styles.cardTitleEm, { color: T.caramel }]}>{box.pop}</Text> Box
          </Text>
          <Text style={styles.cardItemCount}>{pricing.totalCount} items</Text>
        </View>
      </View>

      <Text style={styles.cardTagline} numberOfLines={2}>{box.tagline}</Text>

      <View style={styles.cardPriceRow}>
        <Text style={styles.cardPriceNow}>{formatPrice(box.price)}</Text>
        <Text style={styles.cardPriceWas}>{formatPrice(box.was)}</Text>
        <View style={styles.cardSaveChip}>
          <Text style={styles.cardSaveChipText}>save {formatPrice(box.was - box.price)}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.cardCta}>View box →</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function BoxesHubScreen() {
  const navigation = useNavigation<Nav>();
  const cart = useBoxesStore((s) => s.cart);
  const toggleBundle = useBoxesStore((s) => s.toggleBundle);

  const bundle = bundlePricing();
  const bundleInCart = cart.some((l) => l.kind === 'bundle');
  const cartCount = cart.length;
  const total = cartTotal(cart);

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Back + masthead */}
        <View style={styles.headRow}>
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
          <TouchableOpacity
            onPress={() => navigation.navigate('BoxOrders')}
            accessibilityRole="button"
            accessibilityLabel="Your orders"
          >
            <Text style={styles.ordersLink}>My orders →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ marginTop: 8 }}><Eyebrow>curated by villie</Eyebrow></View>
        <Text style={styles.title}>
          Villie <Text style={styles.titleEm}>Boxes</Text>
        </Text>
        <Text style={styles.sub}>
          The right things, gathered for each stage — so you can stop building registries and
          start resting.
        </Text>

        {/* Opened gift-box illustration — villie-branded masthead visual. */}
        <LinearGradient
          colors={['#F8DDE9', '#EFDCEE', '#E2DAF4']}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={styles.heroArtBand}
        >
          <Twinkle pos={{ top: 24, left: 40 }} delay={0} color="#FFFFFF" size={10} />
          <Twinkle pos={{ top: 60, left: 28 }} delay={500} color="#FBEFD9" size={8} />
          <Twinkle pos={{ top: 40, right: 44 }} delay={1000} color="#FFFFFF" size={11} />
          <Twinkle pos={{ bottom: 30, right: 36 }} delay={1500} color="#FFFFFF" size={8} />
          <Twinkle pos={{ bottom: 46, left: 52 }} delay={2000} color="#FBEFD9" size={9} />
          <GiftBoxArt size={150} />
        </LinearGradient>

        <View style={styles.countRow}>
          <Text style={styles.toggleLabel}>{BOXES.length} boxes</Text>
          <Text style={styles.countHint}>tap any box to customize →</Text>
        </View>

        <View style={{ gap: 14, marginTop: 4 }}>
          {BOXES.map((box, i) => (
            <BoxCard
              key={box.id}
              box={box}
              tint={CARD_TINTS[i % CARD_TINTS.length]}
              border={CARD_BORDERS[i % CARD_BORDERS.length]}
              onPress={() => navigation.navigate('BoxDetail', { boxId: box.id })}
            />
          ))}
        </View>

        {/* Full Journey bundle banner */}
        <View style={styles.bundle}>
          <View style={styles.bundleHalo} pointerEvents="none" />
          <Text style={styles.bundleEyebrow}>the full journey</Text>
          <Text style={styles.bundleTitle}>
            All three boxes, <Text style={styles.bundleTitleEm}>one tap.</Text>
          </Text>
          <Text style={styles.bundleBlurb}>
            Delivery, Newborn &amp; Mama — bundled at 10% off so the whole first chapter is handled.
          </Text>
          <View style={styles.bundlePriceRow}>
            <Text style={styles.bundleNow}>{formatPrice(bundle.now)}</Text>
            <Text style={styles.bundleWas}>{formatPrice(bundle.was)}</Text>
            <View style={styles.bundleSaveChip}>
              <Text style={styles.bundleSaveText}>save {formatPrice(bundle.save)}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={toggleBundle}
            activeOpacity={0.9}
            accessibilityRole="button"
            style={[styles.bundleBtn, bundleInCart && styles.bundleBtnAdded]}
          >
            <Text style={[styles.bundleBtnText, bundleInCart && styles.bundleBtnTextAdded]}>
              {bundleInCart ? '✓ Added to cart' : 'Add all three'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.foot}>
          Photos and final retail pricing are placeholders pending the launch catalog.
        </Text>
      </ScrollView>

      {/* Sticky cart bar */}
      {cartCount > 0 && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => navigation.navigate('BoxesCart')}
          accessibilityRole="button"
          accessibilityLabel={`View cart, ${cartCount} ${cartCount === 1 ? 'item' : 'items'}, ${formatPrice(total)}`}
          style={styles.cartBar}
        >
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>{cartCount}</Text>
          </View>
          <Text style={styles.cartBarText}>View cart</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.cartBarTotal}>{formatPrice(total)}  →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  scroll: { paddingTop: 56, paddingHorizontal: 22, paddingBottom: 140 },

  headRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: T.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
    marginLeft: -4,
  },
  ordersLink: { fontFamily: FONTS.v2_link, fontSize: 13, color: T.cinnamon },

  eyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '500', color: T.walnut,
  },
  title: {
    fontFamily: FONTS.v3_display, fontSize: 38, lineHeight: 40,
    color: T.cocoa, letterSpacing: -1.4, marginTop: 12,
  },
  titleEm: { fontFamily: FONTS.v3_display_italic, color: T.cinnamon, fontSize: 36 },
  sub: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21,
    color: T.walnut, marginTop: 12,
  },

  heroArtBand: {
    marginTop: 18, borderRadius: 22, height: 178,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(217,108,136,0.20)',
  },
  countRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 22, marginBottom: 14,
    paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  countHint: {
    fontFamily: FONTS.v2_link, fontSize: 11.5, color: T.cinnamon,
  },

  // ── Box card (compact, tinted) ────────────────────────────────────────
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardThumb: {
    width: 72, height: 72, borderRadius: 16, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 22, marginBottom: 16,
    paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.rule,
  },
  toggleLabel: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.8,
    textTransform: 'uppercase', fontWeight: '600', color: T.walnut,
  },
  toggle: {
    flexDirection: 'row', backgroundColor: T.parchment, borderRadius: 11, padding: 3,
  },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9 },
  toggleBtnActive: { backgroundColor: T.paper },
  toggleText: {
    fontFamily: FONTS.v2_label, fontSize: 12, color: T.walnut, textTransform: 'capitalize',
  },
  toggleTextActive: { color: T.cocoa, fontFamily: FONTS.v2_bold },

  // ── Box card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: T.paper, borderRadius: 20, overflow: 'hidden', padding: 16,
    borderWidth: 1, borderColor: T.rule,
    shadowColor: '#43260F', shadowOpacity: 0.07, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 2,
  },
  cardHero: { justifyContent: 'flex-end', padding: 14 },
  cardBadge: {
    position: 'absolute', top: 12, left: 12,
    backgroundColor: 'rgba(255,255,255,0.82)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  cardBadgeText: {
    fontFamily: FONTS.v2_mono, fontSize: 9.5, letterSpacing: 1.2,
    textTransform: 'uppercase', fontWeight: '600', color: T.cocoa,
  },
  cardHeroPop: { fontFamily: FONTS.v3_display_italic, fontSize: 40, lineHeight: 42 },

  cardBody: { padding: 18 },
  cardStage: {
    fontFamily: FONTS.v2_mono, fontSize: 10, letterSpacing: 1.4,
    textTransform: 'uppercase', fontWeight: '600', color: T.caramel,
  },
  cardTitle: {
    fontFamily: FONTS.v3_display, fontSize: 23, lineHeight: 26,
    color: T.cocoa, letterSpacing: -0.6, marginTop: 6,
  },
  cardTitleEm: { fontFamily: FONTS.v3_display_italic, fontSize: 23 },
  cardTagline: {
    fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 19,
    color: T.walnut, marginTop: 8,
  },

  cardPriceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 8 },
  cardPriceNow: { fontFamily: FONTS.v2_display_big, fontSize: 22, color: T.cocoa },
  cardPriceWas: {
    fontFamily: FONTS.v2_body, fontSize: 13, color: T.walnut,
    textDecorationLine: 'line-through', opacity: 0.7,
  },
  cardSaveChip: {
    backgroundColor: 'rgba(217,108,136,0.12)', borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 3,
  },
  cardSaveChipText: {
    fontFamily: FONTS.v2_bold, fontSize: 10.5, color: T.cinnamon,
    textTransform: 'lowercase',
  },
  cardItemCount: { fontFamily: FONTS.v2_label, fontSize: 11.5, color: T.walnut, marginTop: 4 },

  cardTrustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  cardTrustChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.cream, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  cardTrustText: { fontFamily: FONTS.v2_label, fontSize: 11, color: T.walnut },

  cardCtaRow: {
    marginTop: 16, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.rule,
  },
  cardCta: { fontFamily: FONTS.v2_link, fontSize: 14, color: T.cinnamon },

  // ── Bundle banner ─────────────────────────────────────────────────────
  bundle: {
    marginTop: 24, backgroundColor: T.cocoa, borderRadius: 22, padding: 22,
    overflow: 'hidden',
  },
  bundleHalo: {
    position: 'absolute', top: -50, right: -40, width: 170, height: 170,
    borderRadius: 85, backgroundColor: 'rgba(244,197,60,0.16)',
  },
  bundleEyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 10.5, letterSpacing: 2.4,
    textTransform: 'uppercase', fontWeight: '600', color: T.butter,
  },
  bundleTitle: {
    fontFamily: FONTS.v3_display, fontSize: 26, lineHeight: 29,
    color: T.paper, letterSpacing: -0.8, marginTop: 10,
  },
  bundleTitleEm: { fontFamily: FONTS.v3_display_italic, color: T.butter, fontSize: 25 },
  bundleBlurb: {
    fontFamily: FONTS.v2_body, fontSize: 13, lineHeight: 19,
    color: 'rgba(252,247,239,0.82)', marginTop: 10,
  },
  bundlePriceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  bundleNow: { fontFamily: FONTS.v2_display_big, fontSize: 28, color: T.paper },
  bundleWas: {
    fontFamily: FONTS.v2_body, fontSize: 14, color: 'rgba(252,247,239,0.7)',
    textDecorationLine: 'line-through',
  },
  bundleSaveChip: {
    backgroundColor: 'rgba(244,197,60,0.18)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  bundleSaveText: { fontFamily: FONTS.v2_bold, fontSize: 11, color: T.butter },
  bundleBtn: {
    marginTop: 18, backgroundColor: T.cinnamon, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  bundleBtnAdded: { backgroundColor: 'rgba(252,247,239,0.16)' },
  bundleBtnText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.paper },
  bundleBtnTextAdded: { color: T.paper },

  foot: {
    fontFamily: FONTS.v2_body, fontSize: 11, lineHeight: 16,
    color: T.walnut, opacity: 0.7, marginTop: 22, textAlign: 'center',
  },

  // ── Sticky cart bar ───────────────────────────────────────────────────
  cartBar: {
    position: 'absolute', left: 16, right: 16, bottom: 24,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.cinnamon, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 18,
    shadowColor: '#43260F', shadowOpacity: 0.18, shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  cartBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  cartBadgeText: { fontFamily: FONTS.v2_bold, fontSize: 12, color: T.paper },
  cartBarText: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.paper },
  cartBarTotal: { fontFamily: FONTS.v2_bold, fontSize: 15, color: T.paper },
});
