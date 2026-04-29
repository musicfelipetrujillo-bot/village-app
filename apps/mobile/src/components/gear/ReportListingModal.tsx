// V4 Phase G6 — Report listing modal.
//
// LEGAL SOURCE: Risk & Compliance §2.7 non-negotiable #7 —
//   "In-app 'Report this listing' available on every listing; 24hr human review
//    of flagged items."
//
// A reporter picks a reason chip, writes a 10+ char description, and submits.
// The submission lands in gear_listing_reports with status='open' and is NOT
// visible to the seller — the seller should not know they've been reported
// until moderation acts. A future moderator dashboard reads from this table.
import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { COLORS, FONTS } from '@utils/constants';
import {
  submitGearReport,
  gearReportReasonLabel,
  logGearEvent,
  type GearReportReason,
} from '@api/gear';

interface Props {
  visible: boolean;
  listingId: string;
  listingTitle: string;
  onClose: () => void;
  onSubmitted: () => void;
}

const REASONS: GearReportReason[] = [
  'recalled_item',
  'prohibited_category',
  'counterfeit_or_fake',
  'damaged_or_unsafe',
  'misleading_description',
  'price_or_scam',
  'harassment_or_abuse',
  'other',
];

const MIN_DESCRIPTION = 10;
const MAX_DESCRIPTION = 2000;

export default function ReportListingModal({
  visible, listingId, listingTitle, onClose, onSubmitted,
}: Props) {
  const [reason, setReason] = useState<GearReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setReason(null);
    setDescription('');
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const canSubmit =
    !!reason &&
    description.trim().length >= MIN_DESCRIPTION &&
    !submitting;

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true); setError(null);
    try {
      await submitGearReport({
        listing_id: listingId,
        reason_code: reason,
        description,
      });
      logGearEvent('gear_listing_reported', {
        listing_id: listingId,
        reason_code: reason,
      }).catch(() => {});
      Alert.alert(
        'Thanks — we got it',
        'A Village moderator will review this listing within 24 hours. You will not be notified of the outcome, but we may take the listing down without warning the seller.',
      );
      reset();
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit report');
    } finally {
      setSubmitting(false);
    }
  };

  const remaining = MAX_DESCRIPTION - description.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={submitting} accessibilityRole="button">
            <Text style={styles.close}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Report this listing</Text>
          <View style={{ width: 56 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.listingTitle} numberOfLines={2}>{listingTitle}</Text>
          <Text style={styles.intro}>
            Help us keep The Village safe. A moderator reviews every report within
            24 hours. The seller will not be told who reported them.
          </Text>

          <Text style={styles.sectionLabel}>What&apos;s wrong?</Text>
          <View style={styles.chipRow}>
            {REASONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, reason === r && styles.chipActive]}
                onPress={() => setReason(r)}
                accessibilityRole="radio"
                accessibilityState={{ selected: reason === r }}
              >
                <Text style={[styles.chipText, reason === r && styles.chipTextActive]}>
                  {gearReportReasonLabel(r)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Tell us more</Text>
          <Text style={styles.hint}>
            What did you see? Include any detail that helps our moderator
            (product model, photos, message history).
          </Text>
          <TextInput
            style={styles.textarea}
            placeholder="At least 10 characters"
            placeholderTextColor={COLORS.textLight}
            multiline
            value={description}
            onChangeText={setDescription}
            maxLength={MAX_DESCRIPTION}
            textAlignVertical="top"
          />
          <Text style={[styles.counter, remaining < 50 && { color: COLORS.rustDark }]}>
            {remaining} characters left
          </Text>

          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            disabled={!canSubmit}
            onPress={submit}
            style={[styles.cta, !canSubmit && styles.ctaDisabled]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
          >
            {submitting
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.ctaLabel}>Submit report</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFF',
  },
  close: { fontSize: 15, color: COLORS.textMid, fontFamily: FONTS.bodySemiBold },
  title: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep },

  body: { padding: 20, paddingBottom: 40 },
  listingTitle: { fontSize: 15, color: COLORS.brownDeep, fontFamily: FONTS.bodySemiBold, marginBottom: 8 },
  intro: { fontSize: 13, color: COLORS.textMid, lineHeight: 19, marginBottom: 20, fontFamily: FONTS.body },

  sectionLabel: {
    fontSize: 12, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep,
    letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8,
  },
  hint: { fontSize: 12, color: COLORS.textLight, marginBottom: 8, lineHeight: 17, fontFamily: FONTS.body },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#FFF',
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)',
  },
  chipActive: { backgroundColor: 'rgba(184,92,56,0.1)', borderColor: COLORS.rust },
  chipText: { fontSize: 13, color: COLORS.textMid, fontFamily: FONTS.bodyMedium },
  chipTextActive: { color: COLORS.rustDark, fontFamily: FONTS.bodySemiBold },

  textarea: {
    minHeight: 120, backgroundColor: '#FFF',
    borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: COLORS.brownDeep, lineHeight: 21, fontFamily: FONTS.body,
  },
  counter: { fontSize: 11, color: COLORS.textLight, textAlign: 'right', marginTop: 6, fontFamily: FONTS.body },

  error: { color: '#B3261E', fontSize: 13, marginTop: 12, fontFamily: FONTS.body },

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
