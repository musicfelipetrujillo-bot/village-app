import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';

/**
 * Legal/safety footnote for Milk Vault surfaces. The app does not verify donor
 * eligibility, milk safety, storage/shipping compliance, or guarantee sale price;
 * estimates are planning-only. Kept sober per the V10 voice rule (no playful tone
 * on legal/safety copy).
 */
export default function MilkVaultDisclaimer() {
  const t = useT();
  return (
    <View style={styles.wrap} accessibilityRole="summary">
      <Text style={styles.text}>{t('milkVault.legalDisclaimer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(122,74,36,0.14)',
  },
  text: {
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.v2_amber,
    fontFamily: FONTS.v2_body,
  },
});
