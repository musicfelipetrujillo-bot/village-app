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
  BOXES, computeBoxPricing, bundlePricing, formatPrice, type Box,
} from '@api/boxes';
import {
  useBoxesStore, cartTotal, type HubLayout,
} from '@store/boxes';
import type { HomeStackParamList } from '@/navigation/HomeNavigator';

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

// Small Feather-ish trust icon (shield / truck / heart) — same icon language
// as the gear CPSC badges. Falls back to a dot if an unknown key sneaks in.
const TRUST_ICONS: Record<string, string> = {
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  truck: 'M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 18.5a2 2 0 100-4 2 2 0 000 4zM18.5 18.5a2 2 0 100-4 2 2 0 000 4z',
  heart: 'M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z',
};

function TrustIcon({ name }: { name: string }) {
  const d = TRUST_ICONS[name] ?? 'M12 12m-1 0a1 1 0 102 0 1 1 0 10-2 0';
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24">
      <Path d={d} stroke={T.walnut} strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 16, height: 1.5, backgroundColor: T.walnut, marginRight: 8 }} />
      <Text style={styles.eyebrow}>{children}</Text>
    </View>
  );
}

function LayoutToggle({ value, onChange }: { value: HubLayout; onChange: (l: HubLayout) => void }) {
  return (
    <View style={styles.toggle}>
      {(['compact', 'editorial'] as HubLayout[]).map((opt) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.toggleBtn, active && styles.toggleBtnActive]}
          >
            <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function BoxCard({ box, compact, onPress }: { box: Box; compact: boolean; onPress: () => void }) {
  // "Now" price with no customization (full box).
  const pricing = computeBoxPricing(box, new Set(), new Set());
  return (
    <TouchableOpacity activeOpacity={0.93} onPress={onPress} style={styles.card}>
      {/* Hero gradient band — taller in editorial, slimmer in compact. */}
      <LinearGradient
        colors={box.hero as readonly [string, string, ...string[]]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.cardHero, { height: compact ? 92 : 150 }]}
      >
        <LinearGradient
          colors={[box.glow, 'rgba(255,255,255,0)']}
          start={{ x: 0.15, y: 0.1 }} end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={styles.cardBadge}>
          <Text style={styles.cardBadgeText}>{box.badge}</Text>
        </View>
        {!compact && (
          <Text style={[styles.cardHeroPop, { color: box.popColor }]}>{box.pop}</Text>
        )}
      </LinearGradient>

      <View style={styles.cardBody}>
        <Text style={styles.cardStage}>{box.stage}</Text>
        <Text style={styles.cardTitle}>
          The <Text style={[styles.cardTitleEm, { color: T.caramel }]}>{box.pop}</Text> Box
        </Text>
        <Text style={styles.cardTagline} numberOfLines={compact ? 2 : 3}>{box.tagline}</Text>

        <View style={styles.cardPriceRow}>
          <Text style={styles.cardPriceNow}>{formatPrice(box.price)}</Text>
          <Text style={styles.cardPriceWas}>{formatPrice(box.was)}</Text>
          <View style={styles.cardSaveChip}>
            <Text style={styles.cardSaveChipText}>save {formatPrice(box.was - box.price)}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Text style={styles.cardItemCount}>{pricing.totalCount} items</Text>
        </View>

        {!compact && (
          <View style={styles.cardTrustRow}>
            {box.trust.map(([icon, label]) => (
              <View key={label} style={styles.cardTrustChip}>
                <TrustIcon name={icon} />
                <Text style={styles.cardTrustText}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.cardCtaRow}>
          <Text style={styles.cardCta}>View box →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function BoxesHubScreen() {
  const navigation = useNavigation<Nav>();
  const hubLayout = useBoxesStore((s) => s.hubLayout);
  const setHubLayout = useBoxesStore((s) => s.setHubLayout);
  const cart = useBoxesStore((s) => s.cart);
  const toggleBundle = useBoxesStore((s) => s.toggleBundle);

  const compact = hubLayout === 'compact';
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

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{BOXES.length} boxes</Text>
          <LayoutToggle value={hubLayout} onChange={setHubLayout} />
        </View>

        <View style={{ gap: 18, marginTop: 4 }}>
          {BOXES.map((box) => (
            <BoxCard
              key={box.id}
              box={box}
              compact={compact}
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
    backgroundColor: T.paper, borderRadius: 20, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
    shadowColor: '#43260F', shadowOpacity: 0.06, shadowRadius: 16,
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
  cardItemCount: { fontFamily: FONTS.v2_label, fontSize: 11.5, color: T.walnut },

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
