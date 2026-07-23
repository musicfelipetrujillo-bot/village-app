// BackButton — the standard app back control: a clean "‹" chevron (matches the
// Milk Hub header), NOT a "‹ Back" / "← back to X" text link. Felipe 2026-07-12:
// "make all back arrows like the one for milk instead of the one that says back."
//
// Default action = goBack() (falls back to the parent navigator). Pass `onPress`
// for contextual destinations (e.g. "back to Village").
import React from 'react';
import { Text, TouchableOpacity, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '@utils/constants';

export function BackButton({
  onPress,
  color = COLORS.v2_walnut,
  size = 30,
  style,
  accessibilityLabel = 'Back',
}: {
  onPress?: () => void;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const nav = useNavigation<any>();
  const handle = onPress ?? (() => {
    if (nav.canGoBack()) nav.goBack();
    else nav.getParent()?.goBack?.();
  });
  const txt: TextStyle = { fontSize: size, lineHeight: size + 2, color, marginTop: -4, fontWeight: '400' };
  return (
    <TouchableOpacity
      onPress={handle}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={style}
    >
      <Text style={txt}>‹</Text>
    </TouchableOpacity>
  );
}

export default BackButton;
