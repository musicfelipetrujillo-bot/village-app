// Villie Boxes — order confirmation.
//
// Terminal success screen after a captured PaymentSheet. The edge function
// has already persisted the draft order (a Stripe webhook flips it to 'paid');
// this screen just reassures the user, shows the amount + order reference, and
// routes back into the app.

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { formatPrice } from '@api/boxes';
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
type Rt = RouteProp<HomeStackParamList, 'BoxOrderConfirm'>;

export default function BoxOrderConfirmScreen() {
  const navigation = useNavigation<Nav>();
  const { orderId, amountCents } = useRoute<Rt>().params;

  const scale = useRef(new Animated.Value(0.6)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    ]).start();
  }, [scale, fade]);

  const ref = orderId.slice(0, 8).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.View style={[styles.check, { transform: [{ scale }] }]}>
          <Svg width={44} height={44} viewBox="0 0 24 24">
            <Path d="M5 13l4 4L19 7" stroke={T.paper} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>

        <Animated.View style={{ opacity: fade, alignItems: 'center' }}>
          <Text style={styles.eyebrow}>order placed</Text>
          <Text style={styles.title}>
            It&apos;s <Text style={styles.titleEm}>on its way.</Text>
          </Text>
          <Text style={styles.body}>
            Thank you, mama. Your box is being packed with care — we&apos;ll email tracking the moment
            it ships.
          </Text>

          <View style={styles.receipt}>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptKey}>Charged</Text>
              <Text style={styles.receiptVal}>{formatPrice(amountCents / 100)}</Text>
            </View>
            <View style={[styles.receiptRow, { marginBottom: 0 }]}>
              <Text style={styles.receiptKey}>Order ref</Text>
              <Text style={styles.receiptVal}>#{ref}</Text>
            </View>
          </View>
        </Animated.View>
      </View>

      <View style={styles.ctaBar}>
        <TouchableOpacity
          onPress={() => navigation.navigate('HomeRoot')}
          accessibilityRole="button"
          activeOpacity={0.9}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>Back to home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('BoxesHub')}
          accessibilityRole="button"
          style={styles.ctaGhost}
        >
          <Text style={styles.ctaGhostText}>Keep browsing boxes →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.cream },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  check: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: T.cinnamon,
    alignItems: 'center', justifyContent: 'center', marginBottom: 28,
    shadowColor: '#43260F', shadowOpacity: 0.18, shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }, elevation: 6,
  },
  eyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '600', color: T.caramel,
  },
  title: {
    fontFamily: FONTS.v3_display, fontSize: 32, lineHeight: 36,
    color: T.cocoa, letterSpacing: -1, marginTop: 10, textAlign: 'center',
  },
  titleEm: { fontFamily: FONTS.v3_display_italic, color: T.cinnamon, fontSize: 31 },
  body: {
    fontFamily: FONTS.v2_body, fontSize: 14, lineHeight: 21,
    color: T.walnut, textAlign: 'center', marginTop: 14,
  },
  receipt: {
    alignSelf: 'stretch', backgroundColor: T.paper, borderRadius: 16, padding: 16, marginTop: 24,
    borderWidth: StyleSheet.hairlineWidth, borderColor: T.rule,
  },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  receiptKey: { fontFamily: FONTS.v2_label, fontSize: 13, color: T.walnut },
  receiptVal: { fontFamily: FONTS.v2_bold, fontSize: 14, color: T.cocoa },

  ctaBar: { paddingHorizontal: 22, paddingBottom: 38, gap: 8 },
  cta: {
    backgroundColor: T.cinnamon, borderRadius: 14, paddingVertical: 16, alignItems: 'center',
  },
  ctaText: { fontFamily: FONTS.v2_bold, fontSize: 16, color: T.paper },
  ctaGhost: { paddingVertical: 12, alignItems: 'center' },
  ctaGhostText: { fontFamily: FONTS.v2_link, fontSize: 14, color: T.walnut },
});
