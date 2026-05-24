// DailyCheckinStrip — the "How are you feeling tonight?" pill.
//
// Extracted from HomeScreen.tsx (was an inline function for years) so the
// v3 preview Home (HomeScreenV3) and the production v9 Home share the
// exact same component. Felipe's call after the v3 rebuild: "loved the
// feeling it had" — meaning the v9 strip's specific recipe was right and
// the v3 port was missing details. Single source of truth from now on.
//
// Recipe (don't drift from this without product call):
//   - PROPER CARD treatment — solid paper bg, hairline rust border, no
//     dashed lines. The dashed-stripe ticket version was an earlier
//     iteration we moved away from in favor of a richer card surface.
//   - Stronger cocoa-tinted floating shadow → reads as a card lifted
//     well above the page, not a thin pill
//   - Soft top-edge highlight gradient for depth → inner page-light feel
//   - iOS-26 wet-glass top sheen via GlassHighlight
//   - Pending state: villie-bee.png 52×52 in a 56×56 slot with negative
//     margins so the bee overflows the card. Breathing scale 1.0 → 1.08
//     on a 2.6s loop (native driver). Cocoa drop shadow on the bee itself
//     so she hovers above the card — "she's here, waiting."
//   - Answered state: mood emoji in a 24×24 cinnamon disc

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { GlassHighlight } from './GlassHighlight';

const VILLIE_BEE = require('../../../assets/brand/villie-bee.png');

export type DailyCheckinState = 'pending' | 'answered';

export interface DailyCheckinStripProps {
  state: DailyCheckinState;
  /** 1-5 mood score from the answered state; renders an emoji in the disc. */
  previewMood?: number;
  onPress: () => void;
}

export function DailyCheckinStrip({ state, previewMood, onPress }: DailyCheckinStripProps) {
  const t = useT();
  const isPending = state === 'pending';
  const eyebrow = t('home.checkinPendingEyebrow');
  const prompt = isPending ? t('home.checkinPrompt') : t('home.checkinAnsweredTitle');

  // Breathing bee — only animates in the pending state.
  const breathScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isPending) {
      breathScale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathScale, { toValue: 1.08, duration: 1300, useNativeDriver: true }),
        Animated.timing(breathScale, { toValue: 1.0,  duration: 1300, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isPending, breathScale]);

  return (
    <TouchableOpacity
      style={styles.strip}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={prompt}
    >
      {/* Inner top-edge warm highlight — gives the card a subtle "lit
          from above" feel before the glass sheen lands on top of it. */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(253,251,246,0.85)', 'rgba(253,251,246,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={styles.innerGlow}
      />
      <GlassHighlight radius={14} height={12} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.prompt} numberOfLines={1}>{prompt}</Text>
      </View>
      {isPending ? (
        <View style={styles.beeSlot}>
          <Animated.Image
            source={VILLIE_BEE}
            resizeMode="contain"
            accessible={false}
            style={[styles.bee, { transform: [{ scale: breathScale }] }]}
          />
        </View>
      ) : (
        <View style={styles.arrow}>
          <Text style={styles.arrowGlyph}>
            {typeof previewMood === 'number'
              ? ['😞', '😕', '🙂', '😊', '🤩'][Math.max(0, Math.min(4, previewMood - 1))]
              : '✓'}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Card surface — solid paper, no dashed lines. v9 card recipe canon:
  // hairline rust border (rgba(150,80,50,0.18)) + cocoa-tinted floating
  // shadow for the "lifted off the page" depth Felipe wants.
  strip: {
    backgroundColor: COLORS.v2_card,                      // #FEFAF6 paper-warm
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,80,50,0.18)',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 14,
    paddingRight: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    // Richer floating shadow — was 0.18/14r/elev 4. Bump to 0.22/18r/
    // elev 6 + tighter contact shadow via the inset glow above.
    shadowColor: '#6B2E0E',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    elevation: 6,
    overflow: 'visible',                                 // bee can overflow
  },
  // Inner top-edge highlight — soft paper gradient fills the upper half,
  // gives the card a subtle "page light hitting it" depth. Sits BEHIND
  // the GlassHighlight wet sheen on top.
  innerGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '60%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  eyebrow: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 9,
    letterSpacing: 2.2,
    color: '#A77349',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  prompt: {
    fontFamily: FONTS.headerBold,
    fontSize: 13,
    lineHeight: 14,
    color: '#3D1F0D',
    letterSpacing: -0.2,
  },
  arrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.v2_cinnamon,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#945A41',
    shadowOpacity: 0.42,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  arrowGlyph: {
    color: '#FEFCF8',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 12,
    fontFamily: FONTS.bodyBold,
  },
  // Bee slot — 56×56 with negative margins so the 52×52 bee overflows
  // the pill on right + top/bottom. v9 rationale: "character not button"
  // — she carries her own presence outside the strip.
  beeSlot: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
    marginVertical: -12,
  },
  bee: {
    width: 52,
    height: 52,
    // Cocoa drop shadow — makes the bee hover above the page like
    // she's standing there, not stuck on it.
    shadowColor: '#6B2E0E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
  },
});
