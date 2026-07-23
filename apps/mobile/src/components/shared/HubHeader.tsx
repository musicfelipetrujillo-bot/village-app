// HubHeader — the ONE canonical vertical header (Milk Hub spec). Every vertical
// (Milk / Care / Gear / Plans) renders this exact row so they can't drift:
// `‹`  •  lowercase-name  ……………………  [right slot].
// The only per-vertical variables are the name, the status-dot color, the back
// target, and the right-side actions. Sizes/spacing are locked here.
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';

export function HubHeader({
  name,
  dotColor,
  onBack,
  right,
  backAccessibilityLabel = 'Back',
}: {
  name: string;
  dotColor: string;
  onBack: () => void;
  right?: React.ReactNode;
  backAccessibilityLabel?: string;
}) {
  return (
    <View style={s.header}>
      <View style={s.left}>
        <TouchableOpacity
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backAccessibilityLabel}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={s.brandRow}>
          <View style={[s.brandDot, { backgroundColor: dotColor }]} />
          <Text style={s.brand}>{name}</Text>
        </View>
      </View>
      {right ?? <View />}
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backArrow: { fontSize: 30, color: COLORS.v2_walnut, marginTop: -4, fontWeight: '400' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandDot: { width: 8, height: 8, borderRadius: 4 },
  brand: { fontFamily: FONTS.v2_bold, fontSize: 17, color: COLORS.v2_cocoa },
});

export default HubHeader;
