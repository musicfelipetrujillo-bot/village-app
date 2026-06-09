// V4 Phase G5 — "CPSC Checked ✓" badge.
// Per Village_GearSwap_ToolStack § Page 10: shows on listings whose CPSC recall
// check returned clear. This is a marketing differentiator vs Facebook
// Marketplace, so it's visible to buyers on card + detail.
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';

interface Props {
  size?: 'sm' | 'md';
  onPress?: () => void;
}

export default function CPSCBadge({ size = 'sm', onPress }: Props) {
  const body = (
    <View style={[styles.badge, size === 'md' && styles.badgeMd]}>
      <Text style={[styles.check, size === 'md' && styles.checkMd]}>✓</Text>
      <Text style={[styles.label, size === 'md' && styles.labelMd]}>CPSC Checked</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="CPSC checked. Tap for details."
      >
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

const GREEN = COLORS.sage ?? '#E98A6A';

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(92,107,58,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(92,107,58,0.4)',
    alignSelf: 'flex-start',
  },
  badgeMd: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  check: { color: GREEN, fontSize: 11, fontFamily: FONTS.bodySemiBold },
  checkMd: { fontSize: 13 },
  label: {
    color: GREEN,
    fontSize: 10,
    fontFamily: FONTS.bodySemiBold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  labelMd: { fontSize: 11 },
});
