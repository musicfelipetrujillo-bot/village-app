// V4 Phase G6 — Gear Marketplace Addendum informed-consent gate.
//
// LEGAL SOURCE: Risk & Compliance §3.1 — the Gear Marketplace Addendum is a
// REQUIRED attorney-reviewed document distinct from the general TOS. Key
// clauses (no recalled products, seller representations, platform-not-seller,
// safe-meeting advisory) need informed acceptance per §3.2's design pattern.
//
// Flow mirrors the Milk LegalDisclosureModal:
//   Step 1 — Full-screen Gear Addendum text (scroll-gated).
//   Step 2 — Three explicit ack items tapped individually.
//   Step 3 — Acceptance persisted server-side + continuation.
//
// Called ONCE before a buyer's first message — then cached in
// gear_legal_acceptances so the user doesn't see it again for the same version.
// DO NOT soften this copy without attorney review.
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import {
  recordGearLegalAcceptance,
  logGearEvent,
  type GearLegalDocKey,
} from '@api/gear';
import { useUserStore } from '@store/user';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAccepted: () => void;
  documentKey?: GearLegalDocKey;
  transactionContext?: Record<string, unknown>;
}

type Step = 1 | 2 | 3;

const ACKS: { id: string; text: string }[] = [
  {
    id: 'not_a_seller',
    text: 'I understand Villie is a platform — not the seller. Villie does not inspect, test, store, ship, or guarantee any item listed.',
  },
  {
    id: 'no_recalls',
    text: 'I understand it is my responsibility to check cpsc.gov/Recalls before buying used baby gear, and that I must not list any item under active CPSC recall.',
  },
  {
    id: 'own_risk',
    text: 'I accept all risks of the transaction — product safety, condition, payment, and in-person meeting — between me and the other party.',
  },
];

export default function GearLegalDisclosureModal({
  visible, onClose, onAccepted,
  documentKey = 'gear_marketplace_addendum_v1',
  transactionContext,
}: Props) {
  const profile = useUserStore((s) => s.profile);

  const [step, setStep] = useState<Step>(1);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [acks, setAcks] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shownOnce, setShownOnce] = useState(false);

  useEffect(() => {
    if (visible && !shownOnce) {
      logGearEvent('gear_legal_addendum_shown', {
        document_key: documentKey,
        ...(transactionContext ?? {}),
      }).catch(() => {});
      setShownOnce(true);
    }
    if (!visible) {
      setStep(1);
      setHasScrolledToEnd(false);
      setAcks({});
      setError(null);
      setShownOnce(false);
    }
  }, [visible, shownOnce, documentKey, transactionContext]);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const atEnd = layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;
    if (atEnd && !hasScrolledToEnd) setHasScrolledToEnd(true);
  };

  const allAcks = ACKS.every((a) => acks[a.id]);
  const toggleAck = (id: string) => setAcks((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleAccept = async () => {
    if (!profile?.id || submitting) return;
    setSubmitting(true); setError(null);
    try {
      await recordGearLegalAcceptance(profile.id, documentKey, transactionContext);
      logGearEvent('gear_legal_addendum_accepted', {
        document_key: documentKey,
        ...(transactionContext ?? {}),
      }).catch(() => {});
      setStep(3);
      setTimeout(onAccepted, 400);
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
              <Text style={styles.headline}>Gear Marketplace Addendum</Text>
              <Text style={styles.subhead}>
                Please read this before your first message to a seller. Scroll to
                the bottom to continue.
              </Text>

              <Text style={styles.sectionTitle}>Villie is a platform, not a seller</Text>
              <Text style={styles.para}>
                Villie provides software that connects buyers and sellers of
                secondhand baby gear. Villie is not the seller, does not take
                possession of any item, does not inspect listings, and does not
                test for safety, authenticity, age, or working condition.
                Transactions are strictly between the buyer and the seller.
              </Text>

              <Text style={styles.sectionTitle}>No warranties</Text>
              <Text style={styles.para}>
                All items are listed &ldquo;as-is.&rdquo; Villie makes NO
                warranty, express or implied, including but not limited to
                warranties of merchantability, fitness for a particular purpose,
                safety, non-infringement, or accuracy of any listing information.
              </Text>

              <Text style={styles.sectionTitle}>Seller representations</Text>
              <Text style={styles.para}>
                Sellers are solely responsible for the accuracy of their listings,
                the legality of the sale, and compliance with the villie
                Prohibited Items Policy. Sellers represent that they own the item,
                that it is not under any CPSC recall, and that the item meets any
                applicable federal safety standards (including CPSIA and the
                CPSC crib rule for items dated within those regulations).
              </Text>

              <Text style={styles.sectionTitle}>Prohibited items</Text>
              <Text style={styles.para}>
                The following categories may NOT be listed on Villie under any
                condition: car seats, breast pumps, sleep positioners, inclined
                sleepers, and bike/sport helmets. This policy is enforced at the
                listing form and is non-negotiable for buyer safety.
              </Text>

              <Text style={styles.sectionTitle}>No payment processing</Text>
              <Text style={styles.para}>
                Villie does not process payments for gear transactions at this
                time. Buyers and sellers arrange cash or peer-to-peer payment
                (Venmo, Zelle, Apple Cash) directly between themselves. The
                Village is not responsible for any payment dispute, chargeback,
                loss, or fraud.
              </Text>

              <Text style={styles.sectionTitle}>In-person meetings</Text>
              <Text style={styles.para}>
                Meetings occur at the buyer and seller&apos;s own risk. You are
                encouraged to meet in a public place, during daylight, and to
                follow Villie&apos;s Safe Meeting Guide. Villie is not
                responsible for anything that occurs during or after the meeting.
              </Text>

              <Text style={styles.sectionTitle}>Reporting + takedown</Text>
              <Text style={styles.para}>
                Tap &ldquo;Report this listing&rdquo; to flag any listing that
                appears recalled, fake, unsafe, or fraudulent. Villie reviews
                flagged listings within 24 hours and may remove listings, suspend
                accounts, or cooperate with law enforcement at our sole discretion.
              </Text>

              <Text style={styles.sectionTitle}>Indemnification</Text>
              <Text style={styles.para}>
                You agree to indemnify and hold Villie harmless from any
                claim, demand, or damages arising from your use of the Gear
                Marketplace, your interactions with other users, or your violation
                of this Addendum.
              </Text>

              <Text style={styles.sectionTitle}>Governing law</Text>
              <Text style={styles.para}>
                This Addendum is governed by the laws of the State of Florida. Any
                dispute will be resolved in the state or federal courts of
                Miami-Dade County, Florida.
              </Text>

              <View style={styles.scrollCueBox}>
                <Text style={styles.scrollCue}>
                  You&apos;ve reached the end. Tap &ldquo;I&apos;ve read this&rdquo;
                  to continue.
                </Text>
              </View>
            </ScrollView>
            <View style={styles.footer}>
              <TouchableOpacity
                disabled={!hasScrolledToEnd}
                onPress={() => setStep(2)}
                style={[styles.cta, !hasScrolledToEnd && styles.ctaDisabled]}
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
                Tap each item individually. We record your acknowledgment for
                safety and legal purposes.
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
            <View style={styles.footerRow}>
              <TouchableOpacity onPress={() => setStep(1)} style={styles.back}>
                <Text style={styles.backLabel}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={!allAcks || submitting}
                onPress={handleAccept}
                style={[styles.cta, styles.ctaFlex, (!allAcks || submitting) && styles.ctaDisabled]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !allAcks || submitting }}
              >
                {submitting
                  ? <ActivityIndicator color="#FDFBF6" />
                  : <Text style={styles.ctaLabel}>Accept and continue</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === 3 && (
          <View style={styles.successWrap}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successTitle}>Acknowledgment recorded</Text>
            <Text style={styles.successBody}>You can now message this seller.</Text>
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
  stepLabel: { fontSize: 13, color: COLORS.barkSoft, fontFamily: FONTS.bodyMedium, letterSpacing: 0.5 },
  close: { fontSize: 22, color: COLORS.barkSoft },

  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 40 },

  headline: { fontSize: 24, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 8 },
  subhead: { fontSize: 14, color: COLORS.barkSoft, marginBottom: 24, lineHeight: 21, fontFamily: FONTS.body },
  sectionTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginTop: 20, marginBottom: 6 },
  para: { fontSize: 14, color: COLORS.bark, lineHeight: 21, fontFamily: FONTS.body },

  scrollCueBox: {
    marginTop: 32, padding: 16, borderRadius: 10,
    backgroundColor: 'rgba(184,92,56,0.08)',
    borderWidth: 1, borderColor: 'rgba(184,92,56,0.25)',
  },
  scrollCue: { fontSize: 13, color: COLORS.cocoDeep, textAlign: 'center', fontFamily: FONTS.body },

  ackRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, marginBottom: 12, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(150,80,50,0.18)',
    backgroundColor: COLORS.paper,
  },
  ackRowActive: { borderColor: COLORS.sage, backgroundColor: 'rgba(92,107,58,0.06)' },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: COLORS.textLight,
    marginRight: 12, alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: COLORS.sage, borderColor: COLORS.sage },
  checkmark: { color: '#FDFBF6', fontSize: 16, fontFamily: FONTS.bodySemiBold },
  ackText: { flex: 1, fontSize: 14, color: COLORS.bark, lineHeight: 21, fontFamily: FONTS.body },
  error: { color: '#B3261E', fontSize: 13, marginTop: 8, fontFamily: FONTS.body },

  footer: {
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: COLORS.cream,
  },
  footerRow: {
    flexDirection: 'row', gap: 10,
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: COLORS.cream,
  },
  cta: {
    backgroundColor: COLORS.sandSoft, paddingVertical: 15, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaFlex: { flex: 1 },
  ctaDisabled: { backgroundColor: COLORS.textLight, opacity: 0.6 },
  ctaLabel: { color: COLORS.bark, fontSize: 15, fontFamily: FONTS.bodySemiBold },

  back: {
    paddingVertical: 15, paddingHorizontal: 20, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.textLight,
    alignItems: 'center', justifyContent: 'center',
  },
  backLabel: { color: COLORS.barkSoft, fontSize: 15, fontFamily: FONTS.bodySemiBold },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  successIcon: {
    fontSize: 52, color: '#FDFBF6', backgroundColor: COLORS.sage,
    width: 96, height: 96, borderRadius: 48, textAlign: 'center', lineHeight: 96,
    marginBottom: 20,
  },
  successTitle: { fontSize: 22, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 6 },
  successBody: { fontSize: 14, color: COLORS.barkSoft, textAlign: 'center', fontFamily: FONTS.body },
});
