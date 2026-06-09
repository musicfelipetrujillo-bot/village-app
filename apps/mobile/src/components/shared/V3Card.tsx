// V3Card — canonical v3 brand kit card surface.
//
// Wraps any content with the unified immersive recipe Felipe approved
// across HomeScreenV3 / ManualScrollV3 / VillageHomeScreenV3:
//
//   - Solid paper bg (#FFFCF6 v2_card)
//   - Hairline rust border (rgba(150,80,50,0.18))
//   - Cocoa-tinted floating shadow (#43260F, lifts off page)
//   - Top warm-paper highlight gradient (subtle "light from above")
//   - iOS-26 wet-glass top sheen via GlassHighlight
//   - Optional bottom inner shadow for added weight
//
// Used to migrate existing card styles across the app to v3 without
// hand-rolling the recipe in every file. Drop-in replacement for any
// `<View style={{ ...cardStyle }}>` pattern:
//
//   <V3Card>
//     <Text>Whatever card content</Text>
//   </V3Card>
//
// Optional props:
//   - `tinted={hex}` — colored card surface (e.g. sage banner) instead of paper
//   - `pressable={fn}` — wraps in TouchableOpacity, fires fn on press
//   - `style` — additional layout (margin, width, padding overrides)
//   - `contentStyle` — applied to the inner content View
//   - `noSheen` — disable the GlassHighlight (rare; for non-card surfaces)
//   - `deepShadow` — heavier shadow (use for hero/full-bleed cards)

import React from 'react';
import {
  View, StyleSheet, TouchableOpacity,
  StyleProp, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '@utils/constants';
import { GlassHighlight } from './GlassHighlight';

const RADIUS = 14;

export interface V3CardProps {
  children: React.ReactNode;
  /** Colored card bg instead of paper. Pass a hex (e.g. sage for week banner). */
  tinted?: string;
  /** Wrap in TouchableOpacity; press handler. */
  pressable?: () => void;
  /** Apply heavier shadow (offset 0/14, radius 26) for hero / full-bleed cards. */
  deepShadow?: boolean;
  /** Skip the wet-glass sheen (rare — non-card surfaces or already-busy art). */
  noSheen?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

export function V3Card({
  children, tinted, pressable, deepShadow = false, noSheen = false,
  style, contentStyle,
}: V3CardProps) {
  const Wrapper: any = pressable ? TouchableOpacity : View;
  const wrapperProps = pressable
    ? { onPress: pressable, activeOpacity: 0.9 }
    : {};

  const bg = tinted ?? COLORS.v2_card;

  return (
    <Wrapper
      {...wrapperProps}
      style={[
        styles.base,
        deepShadow ? styles.shadowDeep : styles.shadow,
        { backgroundColor: bg },
        style,
      ]}
    >
      {/* Inner top-edge warm highlight — "light from above" */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(253,251,246,0.55)', 'rgba(253,251,246,0)']}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={styles.innerGlow}
      />
      {/* iOS-26 wet-glass sheen — paints over the inner glow */}
      {!noSheen ? <GlassHighlight radius={RADIUS} height={12} /> : null}
      {/* Actual content */}
      <View style={contentStyle}>{children}</View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,80,50,0.18)',
    overflow: 'hidden',
  },
  shadow: {
    shadowColor: '#43260F',
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 22,                          // matches Phase C sweep
    elevation: 5,
  },
  shadowDeep: {
    shadowColor: '#43260F',
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 14 },
    shadowRadius: 24,
    elevation: 8,
  },
  innerGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '55%',
    borderTopLeftRadius: RADIUS,
    borderTopRightRadius: RADIUS,
  },
});

export default V3Card;
