// ScreenHeader — the ONE header for every screen. Deliberately minimal so the
// whole app reads as one surface (founder 2026-08-16):
//   [‹]  title  ……………  [right slot]     ← a single tight row, nothing more
// No eyebrow, no dot, no second line — "less words is better." One title style,
// one size, everywhere. This is also the ONLY place header type is defined, so
// the 3-role type scale (title / body / meta) can't drift screen to screen.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';

export function ScreenHeader({
  title,
  onBack,
  right,
  titleColor,
  backColor,
  style,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
  titleColor?: string;
  backColor?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[s.row, style]}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Text style={[s.back, backColor ? { color: backColor } : null]}>‹</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={[s.title, titleColor ? { color: titleColor } : null]} numberOfLines={1}>
        {title}
      </Text>
      <View style={s.spacer} />
      {right ?? null}
    </View>
  );
}

const s = StyleSheet.create({
  // Snug to the top (screens already add the safe-area inset above this).
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 12 },
  back: { fontSize: 28, color: COLORS.v2_cocoa, marginTop: -2, fontWeight: '400' },
  // The single title style — light Bricolage, one size for the entire app.
  title: { fontFamily: FONTS.v2_display_regular, fontSize: 24, color: COLORS.v2_cocoa, letterSpacing: -0.3, flexShrink: 1 },
  spacer: { flex: 1 },
});

export default ScreenHeader;
