// V9PageBackdrop — the canonical paper-leaning page wash used across
// every villie surface (Home, Manual, Me, Auth, Inbox, Village, depth
// screens). Paper-white middle with a soft pink wash at the top and
// bottom, so editorial cards land cleanly without merging into the bg.
//
// Drop it in as the FIRST child of a screen's root <View>. Renders
// absolutely positioned and pointer-events:none so it never intercepts
// taps. Subsequent screen content paints over it via normal stacking.
//
//   <View style={{ flex: 1 }}>
//     <V9PageBackdrop />
//     <ScrollView>…</ScrollView>
//   </View>
//
// Set `glassHighlight` to render the iOS-26 wet-glass sheen at the very
// top of the screen — useful for screens with full-bleed paper masthead
// where the page IS the card.
import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// 7-stop U-shape: subtle warm tint top → paper-white middle → subtle warm
// tint bottom. Edges desaturated 2026-05-16 because the previous saturated
// pink (#FDF1EB / #F5DFD3) was fighting cards on the top + bottom of every
// screen — cards couldn't pop against a colored bg. White middle extended
// from 30%–62% to 25%–75% so most of every page is true paper, and the
// edge fade is much softer (5 OKLCH-units of warm tint instead of 20).
const V9_PAGE_COLORS = [
  '#FCF7F2', '#FCFAF6', '#FDFBF6',
  '#FDFBF6', '#FCFAF6', '#FBF5EF', '#FAF1EA',
] as const;
const V9_PAGE_LOCATIONS = [0, 0.12, 0.25, 0.75, 0.88, 0.95, 1] as const;

type Props = {
  /** Render the iOS-26 wet-glass top sheen + hairline. Default false. */
  glassHighlight?: boolean;
  /** Optional style override (rarely needed). */
  style?: ViewStyle | ViewStyle[];
};

export function V9PageBackdrop({ glassHighlight = false, style }: Props) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient
        colors={V9_PAGE_COLORS as unknown as readonly [string, string, ...string[]]}
        locations={V9_PAGE_LOCATIONS as unknown as readonly [number, number, ...number[]]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {glassHighlight ? (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
            start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 18,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: StyleSheet.hairlineWidth,
              backgroundColor: 'rgba(255,255,255,0.7)',
            }}
          />
        </>
      ) : null}
    </View>
  );
}

export default V9PageBackdrop;
