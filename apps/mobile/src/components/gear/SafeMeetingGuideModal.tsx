// V4 Phase G6 — Safe Meeting Guide.
//
// LEGAL SOURCE: Risk & Compliance §2.7 non-negotiable #6 —
//   "Mandatory 'how to meet safely' screen before any seller contact info is
//    revealed."
//
// The modal MUST be shown before a buyer can send their first message on a new
// thread. It's a scroll-gated disclosure (CTA locked until `hasScrolledToEnd`)
// followed by a single "I understand" ack. The parent records the result via
// ackGearSafeMeeting() + recordGearLegalAcceptance('gear_safe_meeting_v1').
//
// DO NOT reduce to a single checkbox or soften the copy without attorney review.
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity,
  NativeSyntheticEvent, NativeScrollEvent, ActivityIndicator,
} from 'react-native';
import { COLORS, FONTS } from '@utils/constants';

interface Props {
  visible: boolean;
  onClose: () => void;
  onAccepted: () => void | Promise<void>;
  submitting?: boolean;
}

export default function SafeMeetingGuideModal({
  visible, onClose, onAccepted, submitting = false,
}: Props) {
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
          <Text style={styles.stepLabel}>Before you meet a seller</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close safe meeting guide"
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
            <Text style={styles.iconText}>🛡</Text>
          </View>

          <Text style={styles.headline}>Meeting a stranger from the internet</Text>
          <Text style={styles.subhead}>
            The Village does not verify sellers, items, or transactions. Please read
            this guide before you message. Scroll to the bottom to continue.
          </Text>

          <Text style={styles.sectionTitle}>Meet in public, in daylight</Text>
          <Text style={styles.para}>
            Choose a high-traffic, well-lit public place — a grocery store parking
            lot, a coffee shop, or a police-station &ldquo;safe exchange zone&rdquo; (many
            precincts offer these). Never invite a stranger into your home or go
            alone to a private address.
          </Text>

          <Text style={styles.sectionTitle}>Bring someone with you</Text>
          <Text style={styles.para}>
            If possible, bring a friend, partner, or family member. If you go alone,
            tell someone you trust where you are going and when you expect to be
            back. Share your live location with them during the meeting.
          </Text>

          <Text style={styles.sectionTitle}>Inspect the item in person</Text>
          <Text style={styles.para}>
            Check for cracks, missing parts, working electronics, and a matching
            model number BEFORE any money changes hands. For any item with a
            lifecycle (cribs, high chairs, toys), cross-check the model and date
            code at{' '}
            <Text style={styles.linkInline}>cpsc.gov/Recalls</Text>
            {' '}while you&rsquo;re standing there.
          </Text>

          <Text style={styles.sectionTitle}>Cash or P2P only</Text>
          <Text style={styles.para}>
            The Village does not process payments. Pay in cash, or via a peer
            payment app (Venmo / Zelle / Apple Cash) at the time of pickup. Never
            wire money in advance, and never share bank-account, SSN, or card
            details with a seller.
          </Text>

          <Text style={styles.sectionTitle}>Trust your gut</Text>
          <Text style={styles.para}>
            If a seller pressures you, won&rsquo;t meet in public, changes the story,
            refuses to let you inspect the item, or insists on an unusual payment
            method — walk away. No deal is worth your safety.
          </Text>

          <Text style={styles.sectionTitle}>If something goes wrong</Text>
          <Text style={styles.para}>
            • Leave the meeting immediately and call 911 if you feel unsafe.{'\n'}
            • Tap &ldquo;Report this listing&rdquo; from the listing page — we review flagged
            listings within 24 hours.{'\n'}
            • The Village is a platform, not a party to the transaction. We will
            cooperate with law enforcement on valid requests.
          </Text>

          <View style={styles.scrollCueBox}>
            <Text style={styles.scrollCue}>
              You&rsquo;ve reached the end. Tap &ldquo;I understand&rdquo; to start
              messaging.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            disabled={!hasScrolledToEnd || submitting}
            onPress={onAccepted}
            style={[styles.cta, (!hasScrolledToEnd || submitting) && styles.ctaDisabled]}
            accessibilityLabel="I understand, start messaging"
            accessibilityRole="button"
            accessibilityState={{ disabled: !hasScrolledToEnd || submitting }}
          >
            {submitting ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaLabel}>
                {hasScrolledToEnd ? 'I understand — start messaging' : 'Scroll to the bottom'}
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
  stepLabel: { fontSize: 13, color: COLORS.textMid, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.4 },
  close: { fontSize: 22, color: COLORS.textMid },

  body: { flex: 1 },
  bodyContent: { padding: 20, paddingBottom: 40 },

  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(92,107,58,0.12)',
    borderWidth: 2, borderColor: COLORS.olive,
    alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 16,
  },
  iconText: { fontSize: 30 },

  headline: { fontSize: 24, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, textAlign: 'center', marginBottom: 8 },
  subhead: { fontSize: 14, color: COLORS.textMid, textAlign: 'center', marginBottom: 20, lineHeight: 21, fontFamily: FONTS.body },

  sectionTitle: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginTop: 18, marginBottom: 6 },
  para: { fontSize: 14, color: COLORS.textDark, lineHeight: 21, fontFamily: FONTS.body },
  linkInline: { color: COLORS.rust, fontFamily: FONTS.bodySemiBold },

  scrollCueBox: {
    marginTop: 28, padding: 14, borderRadius: 10,
    backgroundColor: 'rgba(184,92,56,0.08)',
    borderWidth: 1, borderColor: 'rgba(184,92,56,0.25)',
  },
  scrollCue: { fontSize: 13, color: COLORS.rustDark, textAlign: 'center', fontFamily: FONTS.body },

  footer: {
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: COLORS.cream,
  },
  cta: {
    backgroundColor: COLORS.yolkLight, paddingVertical: 15, borderRadius: 999,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: COLORS.textLight, opacity: 0.6 },
  ctaLabel: { color: COLORS.brownDeep, fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },
});
