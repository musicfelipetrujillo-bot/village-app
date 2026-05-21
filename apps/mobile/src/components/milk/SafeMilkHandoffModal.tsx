// V2 Milk — Safe Handoff Guide (cash-only MVP, 2026-05-21).
//
// LEGAL SOURCE: Risk & Compliance §3.2 (Informed Consent) + §2.7 (cash-only
// platform posture, mirrored from V4 Gear NN#5/#6). The user must scroll a
// brief safety guide before contacting a milk donor for an arrangement.
//
// This is the cash-only mirror of components/gear/SafeMeetingGuideModal.tsx.
// Milk has an EXTRA safety layer beyond gear because of the biological /
// cold-chain dimension — packaging, freezer state, and contamination matter
// in a way they don't for a stroller.
//
// Recorded acceptance is intended to be persisted via
// recordLegalAcceptance('milk_safe_handoff_v1', ctx). The caller fires
// `milk_safe_handoff_accepted` analytics on confirm.
//
// DO NOT soften the copy or drop sections without attorney review.
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAccepted: () => void | Promise<void>;
  submitting?: boolean;
}

export default function SafeMilkHandoffModal({
  visible, onClose, onAccepted, submitting = false,
}: Props) {
  const t = useT();
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);

  useEffect(() => {
    if (!visible) setHasScrolledToEnd(false);
  }, [visible]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const atEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;
    if (atEnd && !hasScrolledToEnd) setHasScrolledToEnd(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.stepLabel}>{t('milkSafeHandoff.eyebrow')}</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel={t('milkSafeHandoff.closeA11y')}
            accessibilityRole="button"
          >
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          onScroll={handleScroll}
          scrollEventThrottle={64}
        >
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🍼</Text>
          </View>

          <Text style={styles.headline}>{t('milkSafeHandoff.headline')}</Text>
          <Text style={styles.subhead}>{t('milkSafeHandoff.subhead')}</Text>

          <Text style={styles.sectionTitle}>{t('milkSafeHandoff.s1Title')}</Text>
          <Text style={styles.para}>{t('milkSafeHandoff.s1Body')}</Text>

          <Text style={styles.sectionTitle}>{t('milkSafeHandoff.s2Title')}</Text>
          <Text style={styles.para}>{t('milkSafeHandoff.s2Body')}</Text>

          <Text style={styles.sectionTitle}>{t('milkSafeHandoff.s3Title')}</Text>
          <Text style={styles.para}>{t('milkSafeHandoff.s3Body')}</Text>

          <Text style={styles.sectionTitle}>{t('milkSafeHandoff.s4Title')}</Text>
          <Text style={styles.para}>{t('milkSafeHandoff.s4Body')}</Text>

          <Text style={styles.sectionTitle}>{t('milkSafeHandoff.s5Title')}</Text>
          <Text style={styles.para}>{t('milkSafeHandoff.s5Body')}</Text>

          <Text style={styles.sectionTitle}>{t('milkSafeHandoff.s6Title')}</Text>
          <Text style={styles.para}>{t('milkSafeHandoff.s6Body')}</Text>

          <View style={styles.scrollCueBox}>
            <Text style={styles.scrollCue}>{t('milkSafeHandoff.scrollCue')}</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            disabled={!hasScrolledToEnd || submitting}
            onPress={onAccepted}
            style={[styles.cta, (!hasScrolledToEnd || submitting) && styles.ctaDisabled]}
            accessibilityLabel={t('milkSafeHandoff.ctaA11y')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasScrolledToEnd || submitting }}
          >
            {submitting ? (
              <ActivityIndicator color="#FDFBF6" />
            ) : (
              <Text style={styles.ctaLabel}>
                {hasScrolledToEnd ? t('milkSafeHandoff.ctaReady') : t('milkSafeHandoff.ctaScroll')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  stepLabel: { fontSize: 13, color: COLORS.barkSoft, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.4 },
  close: { fontSize: 22, color: COLORS.barkSoft },

  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 40 },

  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(92,107,58,0.12)',
    borderWidth: 2, borderColor: COLORS.sage,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  iconText: { fontSize: 30 },

  headline: { fontSize: 24, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, textAlign: 'center', marginBottom: 8 },
  subhead: { fontSize: 14, color: COLORS.barkSoft, textAlign: 'center', marginBottom: 20, lineHeight: 21, fontFamily: FONTS.body },

  sectionTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 18, marginBottom: 6 },
  para: { fontSize: 14, color: COLORS.bark, lineHeight: 21, fontFamily: FONTS.body },

  scrollCueBox: {
    marginTop: 28, padding: 16, borderRadius: 10,
    backgroundColor: 'rgba(184,92,56,0.08)',
    borderWidth: 1, borderColor: 'rgba(184,92,56,0.25)',
  },
  scrollCue: { fontSize: 13, color: COLORS.cocoDeep, textAlign: 'center', fontFamily: FONTS.body },

  footer: {
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: COLORS.cream,
  },
  cta: {
    backgroundColor: COLORS.sandSoft, paddingVertical: 15, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: COLORS.textLight, opacity: 0.6 },
  ctaLabel: { color: COLORS.bark, fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
});
