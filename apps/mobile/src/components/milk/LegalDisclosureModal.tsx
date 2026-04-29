// LegalDisclosureModal — Milk Connect informed-consent gate.
//
// LEGAL SOURCE: This modal implements the 3-step informed-consent flow mandated
// by Risk & Compliance §3.2 ("Informed Consent Flows — Design Requirements").
// A plain "I agree" checkbox is NOT sufficient — courts give greater weight when
// the user actively engages with the risk disclosure.
//
// Flow:
//   Step 1 — Full-screen risk disclosure. User MUST scroll to the bottom
//            (CTA is disabled until hasScrolledToEnd === true).
//   Step 2 — Three explicit acknowledgment items (each tapped independently),
//            not a single combined checkbox.
//   Step 3 — Persisted acceptance (user_id + document_key + version + timestamp)
//            via recordLegalAcceptance + fires a 'milk_disclosure_accepted'
//            analytics event (server-persisted).
//
// DO NOT soften the copy or reduce the steps without attorney review.
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import { recordLegalAcceptance, type LegalDocKey } from '@api/milk';
import { useAnalytics } from '@hooks/useAnalytics';
import { useUserStore } from '@store/user';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAccepted: () => void;       // called after acceptance is persisted
  documentKey?: LegalDocKey;    // default: milk_purchase_disclaimer_v1
  transactionContext?: Record<string, unknown>; // e.g. { listing_id, oz }
}

type Step = 1 | 2 | 3;

const ACKS: { id: string; text: string }[] = [
  {
    id: 'not_verified',
    text: 'I understand The Village does not test, screen, or guarantee the safety of donor milk.',
  },
  {
    id: 'pediatrician',
    text: 'I have consulted or will consult my pediatrician before using donor milk.',
  },
  {
    id: 'risk_accepted',
    text: 'I accept all risks associated with informal milk sharing.',
  },
];

export function LegalDisclosureModal({
  visible,
  onClose,
  onAccepted,
  documentKey = 'milk_purchase_disclaimer_v1',
  transactionContext,
}: Props) {
  const profile = useUserStore((s) => s.profile);
  const { trackEvent } = useAnalytics();

  const [step, setStep] = useState<Step>(1);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shownOnce, setShownOnce] = useState(false);

  // Fire 'shown' analytics the first time the modal becomes visible
  React.useEffect(() => {
    if (visible && !shownOnce) {
      trackEvent('milk_disclosure_shown', {
        document_key: documentKey,
        ...(transactionContext as Record<string, string | number | boolean>),
      });
      setShownOnce(true);
    }
    if (!visible) {
      // reset for next open
      setStep(1);
      setHasScrolledToEnd(false);
      setAcks({});
      setError(null);
      setShownOnce(false);
    }
  }, [visible, shownOnce, trackEvent, documentKey, transactionContext]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const atEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;
    if (atEnd && !hasScrolledToEnd) setHasScrolledToEnd(true);
  };

  const allAcksChecked = ACKS.every((a) => acks[a.id]);
  const toggleAck = (id: string) => setAcks((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleAccept = async () => {
    if (!profile?.id || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await recordLegalAcceptance(profile.id, documentKey, transactionContext);
      trackEvent('milk_disclosure_accepted', {
        document_key: documentKey,
        ...(transactionContext as Record<string, string | number | boolean>),
      });
      setStep(3);
      setTimeout(() => {
        onAccepted();
      }, 400);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save acceptance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.stepLabel}>Step {step} of 3</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close disclosure" accessibilityRole="button">
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
        </View>

        {step === 1 && (
          <>
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              onScroll={handleScroll}
              scrollEventThrottle={64}
            >
              <Text style={styles.headline}>Before you continue</Text>
              <Text style={styles.subhead}>
                Please read this safety information carefully. Scroll to the bottom to continue.
              </Text>

              <Text style={styles.sectionTitle}>FDA guidance on donor milk</Text>
              <Text style={styles.para}>
                The U.S. Food and Drug Administration recommends against feeding a baby breast
                milk acquired directly from individuals or through the Internet. The FDA advises
                that breast milk obtained this way may pose risks, including exposure to
                infectious diseases (such as HIV, hepatitis B and C, and CMV), chemical
                contaminants, or prescription and illegal drugs.
              </Text>

              <Text style={styles.sectionTitle}>The Village is a platform, not a milk bank</Text>
              <Text style={styles.para}>
                The Village does not test, pasteurize, screen, store, ship, or otherwise handle
                any breast milk. We connect willing donors and recipients who choose to share
                milk informally. We do not verify a donor's health status, medications, diet,
                storage practices, or milk quality.
              </Text>

              <Text style={styles.sectionTitle}>Your responsibilities</Text>
              <Text style={styles.para}>
                • Consult your pediatrician before feeding your baby donor milk.{'\n'}
                • Follow CDC storage and handling guidelines for human milk.{'\n'}
                • Consider home pasteurization (e.g., the Holder method: 62.5°C for 30 min).{'\n'}
                • Review the donor's disclosed health information, medications, and diet.{'\n'}
                • Ask questions directly of the donor before any exchange.
              </Text>

              <Text style={styles.sectionTitle}>Trust Badges reflect disclosure, not verification</Text>
              <Text style={styles.para}>
                Badges (Basic / Verified / Verified + Bloodwork) indicate only that the donor has
                submitted the stated documentation. They are not a certification of safety,
                health, or suitability by The Village or any medical professional.
              </Text>

              <Text style={styles.sectionTitle}>Emergencies</Text>
              <Text style={styles.para}>
                If your baby shows signs of illness after consuming donor milk, stop feeding
                immediately and contact your pediatrician or call 911. The Village is not a
                medical or emergency service.
              </Text>

              <View style={styles.scrollCueBox}>
                <Text style={styles.scrollCue}>
                  You have reached the end of the disclosure. Tap "I've read this" to continue.
                </Text>
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity
                disabled={!hasScrolledToEnd}
                onPress={() => setStep(2)}
                style={[styles.cta, !hasScrolledToEnd && styles.ctaDisabled]}
                accessibilityLabel="I've read this"
                accessibilityRole="button"
                accessibilityState={{ disabled: !hasScrolledToEnd }}
              >
                <Text style={styles.ctaLabel}>
                  {hasScrolledToEnd ? "I've read this" : 'Scroll to the bottom'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
              <Text style={styles.headline}>Please confirm each statement</Text>
              <Text style={styles.subhead}>
                Tap each item individually. We record your acknowledgment for safety and legal purposes.
              </Text>
              {ACKS.map((ack) => (
                <TouchableOpacity
                  key={ack.id}
                  style={[styles.ackRow, acks[ack.id] && styles.ackRowActive]}
                  onPress={() => toggleAck(ack.id)}
                  accessibilityLabel={ack.text}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: !!acks[ack.id] }}
                >
                  <View style={[styles.checkbox, acks[ack.id] && styles.checkboxChecked]}>
                    {acks[ack.id] && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.ackText}>{ack.text}</Text>
                </TouchableOpacity>
              ))}
              {error && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.back}>
                <Text style={styles.backLabel}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!allAcksChecked || submitting}
                onPress={handleAccept}
                style={[styles.cta, styles.ctaFlex, (!allAcksChecked || submitting) && styles.ctaDisabled]}
                accessibilityLabel="Accept and continue"
                accessibilityRole="button"
                accessibilityState={{ disabled: !allAcksChecked || submitting }}
              >
                {submitting
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.ctaLabel}>Accept and continue</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <View style={styles.successWrap}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Acknowledgment recorded</Text>
            <Text style={styles.successBody}>You can proceed.</Text>
          </View>
        )}
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
  stepLabel: { fontSize: 13, color: COLORS.textMid, fontFamily: FONTS.bodyMedium, letterSpacing: 0.5 },
  close: { fontSize: 22, color: COLORS.textMid },
  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 40 },
  headline: { fontSize: 26, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 8 },
  subhead: { fontSize: 15, color: COLORS.textMid, marginBottom: 24, lineHeight: 22 },
  sectionTitle: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 20, marginBottom: 6 },
  para: { fontSize: 14, color: COLORS.textDark, lineHeight: 21 },
  scrollCueBox: {
    marginTop: 32, padding: 16, borderRadius: 10,
    backgroundColor: 'rgba(184,92,56,0.08)', borderWidth: 1, borderColor: 'rgba(184,92,56,0.25)',
  },
  scrollCue: { fontSize: 13, color: COLORS.rustDark, textAlign: 'center' },
  ackRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, marginBottom: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: COLORS.cardBg,
  },
  ackRowActive: { borderColor: COLORS.olive, backgroundColor: 'rgba(92,107,58,0.06)' },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.textLight,
    marginRight: 12, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.olive, borderColor: COLORS.olive },
  checkmark: { color: COLORS.white, fontSize: 16, fontFamily: FONTS.bodySemiBold },
  ackText: { flex: 1, fontSize: 14, color: COLORS.textDark, lineHeight: 21 },
  error: { color: '#B3261E', fontSize: 13, marginTop: 8 },
  footer: {
    flexDirection: 'row', gap: 10,
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', backgroundColor: COLORS.cream,
  },
  cta: {
    backgroundColor: COLORS.yolkLight, paddingVertical: 16, paddingHorizontal: 24,
    borderRadius: 999, alignItems: 'center', justifyContent: 'center', flex: 1,
  },
  ctaFlex: { flex: 1 },
  ctaDisabled: { backgroundColor: COLORS.textLight, opacity: 0.7 },
  ctaLabel: { color: COLORS.brownDeep, fontSize: 16, fontFamily: FONTS.bodySemiBold },
  back: {
    paddingVertical: 16, paddingHorizontal: 20, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.textLight, alignItems: 'center', justifyContent: 'center',
  },
  backLabel: { color: COLORS.textMid, fontSize: 15, fontFamily: FONTS.bodyMedium },
  successWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40,
  },
  successIcon: {
    fontSize: 52, color: COLORS.white, backgroundColor: COLORS.olive,
    width: 96, height: 96, borderRadius: 48, textAlign: 'center', lineHeight: 96,
    marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 6 },
  successBody: { fontSize: 15, color: COLORS.textMid, textAlign: 'center' },
});
