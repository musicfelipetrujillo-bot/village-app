// V2 M5 — MilkDisputeOpenScreen
// Recipient or donor opens a dispute on a transaction.
// The backend's AFTER-INSERT trigger flips milk_transactions.status -> 'disputed'.
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { openDispute, type DisputeReasonCode } from '@api/milk';
import { useAnalytics } from '@hooks/useAnalytics';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'MilkDisputeOpen'>;

interface ReasonOption {
  code: DisputeReasonCode;
  labelKey: string;
  helperKey: string;
  roles: ('recipient' | 'donor')[];
}

const REASONS: ReasonOption[] = [
  {
    code: 'never_received',
    labelKey: 'milkDispute.reasonNeverReceivedLabel',
    helperKey: 'milkDispute.reasonNeverReceivedHelper',
    roles: ['recipient'],
  },
  {
    code: 'quality_concern',
    labelKey: 'milkDispute.reasonQualityLabel',
    helperKey: 'milkDispute.reasonQualityHelper',
    roles: ['recipient'],
  },
  {
    code: 'spoiled',
    labelKey: 'milkDispute.reasonSpoiledLabel',
    helperKey: 'milkDispute.reasonSpoiledHelper',
    roles: ['recipient'],
  },
  {
    code: 'wrong_quantity',
    labelKey: 'milkDispute.reasonWrongQtyLabel',
    helperKey: 'milkDispute.reasonWrongQtyHelper',
    roles: ['recipient'],
  },
  {
    code: 'no_show_pickup',
    labelKey: 'milkDispute.reasonNoShowLabel',
    helperKey: 'milkDispute.reasonNoShowHelper',
    roles: ['donor'],
  },
  {
    code: 'other',
    labelKey: 'milkDispute.reasonOtherLabel',
    helperKey: 'milkDispute.reasonOtherHelper',
    roles: ['recipient', 'donor'],
  },
];

const MIN_DESCRIPTION = 20;

export default function MilkDisputeOpenScreen({ navigation, route }: Props) {
  const { transactionId, role, donorDisplayName } = route.params;
  const { trackEvent } = useAnalytics();
  const t = useT();

  const availableReasons = useMemo(
    () => REASONS.filter((r) => r.roles.includes(role)),
    [role],
  );

  const [reasonCode, setReasonCode] = useState<DisputeReasonCode | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reasonCode) {
      Alert.alert(t('milkDispute.selectReasonTitle'), t('milkDispute.selectReasonBody'));
      return;
    }
    if (description.trim().length < MIN_DESCRIPTION) {
      Alert.alert(
        t('milkDispute.moreDetailTitle'),
        t('milkDispute.moreDetailBody', { min: MIN_DESCRIPTION }),
      );
      return;
    }
    setSubmitting(true);
    try {
      const { dispute, already } = await openDispute({
        transaction_id: transactionId,
        reason_code: reasonCode,
        description: description.trim(),
      });
      trackEvent('milk_dispute_opened', {
        transaction_id: transactionId,
        reason_code: reasonCode,
      });
      Alert.alert(
        already ? t('milkDispute.alreadyReportedTitle') : t('milkDispute.thanksTitle'),
        already
          ? t('milkDispute.alreadyReportedBody')
          : t('milkDispute.thanksBody'),
        [{ text: t('milkDispute.ok'), onPress: () => navigation.goBack() }],
      );
      if (__DEV__) console.log('[dispute]', dispute);
    } catch (err) {
      Alert.alert(
        t('milkDispute.submitFailedTitle'),
        err instanceof Error ? err.message : t('milkDispute.submitFailedBody'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const counterparty = role === 'recipient'
    ? donorDisplayName ?? t('milkDispute.counterpartyDonor')
    : t('milkDispute.counterpartyRecipient');

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.back}
          accessibilityLabel={t('milkDispute.back')}
          accessibilityRole="button"
        >
          <Text style={styles.backLabel}>{t('milkDispute.backLabel')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('milkDispute.title')}</Text>
        <Text style={styles.sub}>
          {t(role === 'recipient' ? 'milkDispute.subRecipient' : 'milkDispute.subDonor', { name: counterparty })}
        </Text>

        <Text style={styles.section}>{t('milkDispute.sectionWhat')}</Text>
        {availableReasons.map((r) => {
          const label = t(r.labelKey);
          return (
            <TouchableOpacity
              key={r.code}
              style={[styles.option, reasonCode === r.code && styles.optionActive]}
              onPress={() => setReasonCode(r.code)}
              accessibilityLabel={label}
              accessibilityRole="radio"
              accessibilityState={{ selected: reasonCode === r.code }}
            >
              <View style={[styles.radio, reasonCode === r.code && styles.radioActive]}>
                {reasonCode === r.code && <View style={styles.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionLabel}>{label}</Text>
                <Text style={styles.optionHelper}>{t(r.helperKey)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <Text style={styles.section}>{t('milkDispute.sectionMore')}</Text>
        <TextInput
          style={styles.textarea}
          value={description}
          onChangeText={setDescription}
          placeholder={t('milkDispute.textareaPlaceholder')}
          placeholderTextColor={COLORS.textLight}
          multiline
          textAlignVertical="top"
          accessibilityLabel={t('milkDispute.textareaA11y')}
        />
        <Text style={styles.counter}>
          {t('milkDispute.counter', { n: description.trim().length, min: MIN_DESCRIPTION })}
        </Text>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>{t('milkDispute.noteTitle')}</Text>
          <Text style={styles.noteBody}>{t('milkDispute.noteBody')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          disabled={submitting || !reasonCode || description.trim().length < MIN_DESCRIPTION}
          onPress={handleSubmit}
          style={[
            styles.cta,
            (submitting || !reasonCode || description.trim().length < MIN_DESCRIPTION) && styles.ctaDisabled,
          ]}
          accessibilityLabel={t('milkDispute.submitBtnA11y')}
          accessibilityRole="button"
          accessibilityState={{
            disabled: submitting || !reasonCode || description.trim().length < MIN_DESCRIPTION,
          }}
        >
          {submitting
            ? <ActivityIndicator color={COLORS.white} />
            : <Text style={styles.ctaLabel}>{t('milkDispute.submitBtn')}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { padding: 20, paddingBottom: 40 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backLabel: { color: COLORS.rust, fontSize: 15, fontFamily: FONTS.bodyMedium },
  title: { fontSize: 28, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 8 },
  sub: { fontSize: 15, color: COLORS.textMid, lineHeight: 22, marginBottom: 24 },
  section: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 10, marginTop: 12 },
  option: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 14, marginBottom: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.1)', backgroundColor: COLORS.cardBg,
  },
  optionActive: { borderColor: COLORS.rust, backgroundColor: 'rgba(184,92,56,0.05)' },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.textLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2,
  },
  radioActive: { borderColor: COLORS.rust },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.rust },
  optionLabel: { fontSize: 15, fontFamily: FONTS.bodyMedium, color: COLORS.brownDeep },
  optionHelper: { fontSize: 13, color: COLORS.textMid, marginTop: 2, lineHeight: 18 },
  textarea: {
    backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 14,
    minHeight: 120, fontSize: 15, color: COLORS.textDark,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  counter: { fontSize: 12, color: COLORS.textLight, marginTop: 6, textAlign: 'right' },
  noteBox: {
    marginTop: 24, padding: 14, borderRadius: 10,
    backgroundColor: 'rgba(196,163,90,0.12)', borderWidth: 1, borderColor: 'rgba(196,163,90,0.4)',
  },
  noteTitle: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.brownDeep, marginBottom: 6 },
  noteBody: { fontSize: 13, color: COLORS.textMid, lineHeight: 19 },
  footer: {
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', backgroundColor: COLORS.cream,
  },
  cta: {
    backgroundColor: COLORS.rust, paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  ctaDisabled: { backgroundColor: COLORS.textLight, opacity: 0.7 },
  ctaLabel: { color: COLORS.white, fontSize: 16, fontFamily: FONTS.bodySemiBold },
});
