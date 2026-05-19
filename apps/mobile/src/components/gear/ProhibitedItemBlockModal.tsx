// V4 Phase G5 — Blocking prohibited-item alert (vision-identify gate).
//
// Rendered by CreateListingScreen when gear-vision-identify identifies one of
// the PROHIBITED_CATEGORIES values on any uploaded photo with confidence
// ≥ THRESHOLD. Per Village_Risk_and_Compliance §2.1 + the Gear Marketplace
// Addendum policy section, these categories are never accepted on Villie
// regardless of how the seller tagged the listing (a user can pick
// category='toy' and still upload a clearly-identifiable breast pump — this
// modal catches that).
//
// Contract:
//   - Only action: Close (no "list anyway" escape hatch — this is a hard gate
//     parallel to CPSCRecallBlockModal).
//   - The rationale shown depends on the matched prohibited_category. Each
//     reason is hardcoded with the safety-source for the prohibition.
//   - i18n keys live under `gearProhibitedBlock.*`.
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import type { ProhibitedCategory } from '@api/gear';

interface Props {
  visible: boolean;
  prohibitedCategory: ProhibitedCategory | null;
  identifiedName: string | null;
  onClose: () => void;
}

export default function ProhibitedItemBlockModal({
  visible, prohibitedCategory, identifiedName, onClose,
}: Props) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  // Per-category short label + long rationale. Keyed for i18n so EN + ES
  // come from the dictionary. Keep this list in lockstep with the
  // ProhibitedCategory union in @api/gear.
  const labelKey = prohibitedCategory ? `gearProhibitedBlock.label_${prohibitedCategory}` : 'gearProhibitedBlock.label_generic';
  const reasonKey = prohibitedCategory ? `gearProhibitedBlock.reason_${prohibitedCategory}` : 'gearProhibitedBlock.reason_generic';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>⚠︎</Text>
          </View>

          <Text style={styles.headline}>{t('gearProhibitedBlock.headline')}</Text>

          <Text style={styles.sub}>
            {identifiedName ? (
              <>
                <Text style={styles.productName}>{identifiedName}</Text>
                {` ${t('gearProhibitedBlock.subWithName')} `}
              </>
            ) : (
              `${t('gearProhibitedBlock.subWithoutName')} `
            )}
            <Text style={styles.productName}>{t(labelKey)}</Text>
            {`. ${t('gearProhibitedBlock.subTrailing')}`}
          </Text>

          <View style={styles.reasonCard}>
            <Text style={styles.reasonLabel}>{t('gearProhibitedBlock.reasonLabel')}</Text>
            <Text style={styles.reasonBody}>{t(reasonKey)}</Text>
          </View>

          <TouchableOpacity
            style={styles.whyBtn}
            onPress={() => setExpanded((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.whyBtnText}>
              {expanded ? t('gearProhibitedBlock.hideDetails') : t('gearProhibitedBlock.whyBlocked')}
            </Text>
          </TouchableOpacity>

          {expanded ? (
            <Text style={styles.whyBody}>{t('gearProhibitedBlock.policyExplainer')}</Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('gearProhibitedBlock.closeA11y')}
          >
            <Text style={styles.closeBtnText}>{t('gearProhibitedBlock.gotIt')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { padding: 24, paddingTop: 72, paddingBottom: 40 },

  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(184,92,56,0.12)',
    borderWidth: 2, borderColor: COLORS.coco,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 20,
  },
  iconText: { fontSize: 34, color: COLORS.cocoDeep, fontFamily: FONTS.bodySemiBold },

  headline: {
    fontSize: 24, fontFamily: FONTS.bodySemiBold, color: COLORS.bark,
    textAlign: 'center', marginBottom: 12,
  },
  sub: {
    fontSize: 15, color: COLORS.barkSoft, lineHeight: 22,
    textAlign: 'center', marginBottom: 20, paddingHorizontal: 4, fontFamily: FONTS.body,
  },
  productName: { fontFamily: FONTS.bodySemiBold, color: COLORS.bark },

  reasonCard: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(184,92,56,0.3)',
    marginBottom: 18,
  },
  reasonLabel: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1,
    color: COLORS.cocoDeep, textTransform: 'uppercase', marginBottom: 6,
  },
  reasonBody: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.bark, lineHeight: 20 },

  whyBtn: { paddingVertical: 10, alignItems: 'center' },
  whyBtnText: { fontSize: 13, color: COLORS.coco, fontFamily: FONTS.bodySemiBold, textDecorationLine: 'underline' },
  whyBody: {
    fontSize: 13, color: COLORS.barkSoft, lineHeight: 20,
    marginBottom: 12, paddingHorizontal: 4, fontFamily: FONTS.body,
  },

  footer: {
    padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: COLORS.cream,
  },
  closeBtn: {
    backgroundColor: '#C07840', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  closeBtnText: { color: '#FDFBF6', fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
});
