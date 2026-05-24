// DailyCheckinStrip — the "How are you feeling tonight?" pill.
//
// Extracted from HomeScreen.tsx (was an inline function for years) so the
// v3 preview Home (HomeScreenV3) and the production v9 Home share the
// exact same component. Felipe's call after the v3 rebuild: "loved the
// feeling it had" — meaning the v9 strip's specific recipe was right and
// the v3 port was missing details. Single source of truth from now on.
//
// Recipe (don't drift from this without product call):
//   - Cocoa-tinted floating shadow → reads as a ticket lifted off the page
//   - Dashed cinnamon-tinted border → "this is asking you something"
//   - Opaque cream bg (rgba(254,252,248,0.92))
//   - iOS-26 wet-glass top sheen via GlassHighlight
//   - Pending state: villie-bee.png 52×52 in a 56×56 slot with negative
//     margins so the bee overflows the pill. Breathing scale 1.0 → 1.08
//     on a 2.6s loop (native driver). Cocoa drop shadow on the bee itself
//     so she hovers above the strip — "she's here, waiting."
//   - Answered state: mood emoji in a 24×24 cinnamon disc

import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
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
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={prompt}
    >
      <GlassHighlight radius={12} height={10} />
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
  strip: {
    backgroundColor: 'rgba(254,252,248,0.92)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(176,115,85,0.36)',
    borderStyle: 'dashed',
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    shadowColor: '#6B2E0E',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 4,
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
