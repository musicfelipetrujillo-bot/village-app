// ScreenHeader — the ONE modest-editorial header for every destination screen.
// Design canon (founder call 2026-08-16): calm, not a loud masthead.
//   [‹ back]  ……………  [right slot]      ← optional top row
//   OPTIONAL UPPERCASE EYEBROW            ← small mono, muted
//   Title in light Bricolage (400)        ← modest size, one quiet anchor
// Sizes/spacing are locked here so no screen drifts. This deliberately
// replaces the two older competing looks: the 28px bold "your day" masthead
// and the tiny "your village" eyebrow-only header.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';

export function ScreenHeader({
  title,
  eyebrow,
  onBack,
  right,
  titleColor,
  backColor,
  style,
}: {
  title: string;
  eyebrow?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  titleColor?: string;
  backColor?: string;
  style?: ViewStyle;
}) {
  const hasTopRow = !!onBack || !!right;
  return (
    <View style={[s.wrap, style]}>
      {hasTopRow ? (
        <View style={s.topRow}>
          {onBack ? (
            <TouchableOpacity
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            >
              <Text style={[s.back, backColor ? { color: backColor } : null]}>‹</Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          {right ?? <View />}
        </View>
      ) : null}
      {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
      <Text style={[s.title, titleColor ? { color: titleColor } : null]}>{title}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  // One consistent top rhythm so no screen "starts too far up" or too low.
  wrap: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  back: { fontSize: 30, color: COLORS.v2_cocoa, marginTop: -4, fontWeight: '400' },
  eyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2,
    textTransform: 'uppercase', color: COLORS.v2_walnut, marginBottom: 5,
  },
  // Modest editorial title — light Bricolage (400), one calm anchor per screen.
  title: { fontFamily: FONTS.v2_display_regular, fontSize: 26, color: COLORS.v2_cocoa, letterSpacing: -0.3 },
});

export default ScreenHeader;
