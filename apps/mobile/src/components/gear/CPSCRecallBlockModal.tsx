// V4 Phase G5 — Blocking CPSC recall alert.
//
// Rendered by CreateListingScreen when gear-cpsc-check returns
// { status: 'recalled' }. Per Village_GearSwap_ToolStack § Page 10 the flow is:
//   "Block the listing. Show a full-screen alert: '[Product name] is under an
//    active CPSC recall and cannot be listed. This protects you and other
//    families.' Offer a 'Why?' modal with CPSC link."
//
// Contract:
//   - Only action: Close (no "list anyway" escape hatch — this is a hard gate).
//   - CPSC link opens externally so the user can read the official notice.
//   - Props are shaped to the CpscCheckResult.recall payload.
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking,
} from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import type { CpscRecallSummary } from '@api/gear';

interface Props {
  visible: boolean;
  productName: string;
  recall: CpscRecallSummary | null;
  onClose: () => void;
}

export default function CPSCRecallBlockModal({ visible, productName, recall, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);

  const openCpsc = () => {
    if (recall?.url) {
      Linking.openURL(recall.url).catch(() => {});
    } else {
      Linking.openURL('https://cpsc.gov/Recalls').catch(() => {});
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>⚠︎</Text>
          </View>

          <Text style={styles.headline}>{`Can't list this item`}</Text>

          <Text style={styles.sub}>
            <Text style={styles.productName}>{productName || 'This product'}</Text>
            {` is under an active CPSC recall and can't be sold on Villie. This protects your family and the buyer.`}
          </Text>

          {recall?.title ? (
            <View style={styles.recallCard}>
              <Text style={styles.recallLabel}>Recall</Text>
              <Text style={styles.recallTitle}>{recall.title}</Text>
              {recall.recall_date ? (
                <Text style={styles.recallMeta}>Recalled {recall.recall_date}</Text>
              ) : null}
              {recall.hazard ? (
                <>
                  <Text style={styles.sectionLabel}>Hazard</Text>
                  <Text style={styles.body}>{recall.hazard}</Text>
                </>
              ) : null}
              {recall.remedy ? (
                <>
                  <Text style={styles.sectionLabel}>Remedy</Text>
                  <Text style={styles.body}>{recall.remedy}</Text>
                </>
              ) : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.whyBtn}
            onPress={() => setExpanded((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.whyBtnText}>{expanded ? 'Hide details' : 'Why is this blocked?'}</Text>
          </TouchableOpacity>

          {expanded ? (
            <Text style={styles.whyBody}>
              Federal law (CPSIA §19) makes it unlawful to resell or distribute any product that
              has been recalled by the Consumer Product Safety Commission. Villie checks
              every listing against the CPSC recall database at submission and nightly.
              {'\n\n'}
              If you believe this is a mistake — for example the recall was resolved or the model
              matches only loosely — you can read the official notice and contact us.
            </Text>
          ) : null}

          <TouchableOpacity
            style={styles.linkBtn}
            onPress={openCpsc}
            accessibilityRole="link"
          >
            <Text style={styles.linkBtnText}>Open the CPSC notice →</Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close recall alert"
          >
            <Text style={styles.closeBtnText}>Got it</Text>
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

  recallCard: {
    backgroundColor: COLORS.paper, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(184,92,56,0.3)',
    marginBottom: 18,
  },
  recallLabel: {
    fontSize: 10, fontFamily: FONTS.bodySemiBold, letterSpacing: 1,
    color: COLORS.cocoDeep, textTransform: 'uppercase', marginBottom: 6,
  },
  recallTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, lineHeight: 21 },
  recallMeta: { fontSize: 12, color: COLORS.textLight, marginTop: 4, fontFamily: FONTS.body },
  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.6,
    color: COLORS.textLight, textTransform: 'uppercase',
    marginTop: 12, marginBottom: 4,
  },
  body: { fontSize: 13, color: COLORS.barkSoft, lineHeight: 19, fontFamily: FONTS.body },

  whyBtn: { paddingVertical: 10, alignItems: 'center' },
  whyBtnText: { fontSize: 13, color: COLORS.coco, fontFamily: FONTS.bodySemiBold, textDecorationLine: 'underline' },
  whyBody: {
    fontSize: 13, color: COLORS.barkSoft, lineHeight: 20,
    marginBottom: 12, paddingHorizontal: 4, fontFamily: FONTS.body,
  },

  linkBtn: { paddingVertical: 10, alignItems: 'center', marginTop: 6 },
  linkBtnText: { fontSize: 13, color: COLORS.coco, fontFamily: FONTS.bodySemiBold },

  footer: {
    padding: 16, paddingBottom: 32,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: COLORS.cream,
  },
  closeBtn: {
    backgroundColor: '#D96C88', borderRadius: 14,
    paddingVertical: 15, alignItems: 'center',
  },
  closeBtnText: { color: '#FFFCF6', fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
});
