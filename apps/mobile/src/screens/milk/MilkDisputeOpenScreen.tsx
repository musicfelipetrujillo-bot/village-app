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
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
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
      <V9PageBackdrop />
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
            ? <ActivityIndicator color={COLORS.paper} />
            : <Text style={styles.ctaLabel}>{t('milkDispute.submitBtn')}</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  scroll: { padding: 20, paddingBottom: 40 },
  back: { paddingVertical: 8, marginBottom: 8 },
  backLabel: { color: '#C07840', fontSize: 15, fontFamily: FONTS.bodyMedium },
  title: { fontSize: 28, fontFamily: FONTS.headerBold, color: COLORS.bark, marginBottom: 8, letterSpacing: -0.4, lineHeight: 34 },
  sub: { fontSize: 15, color: COLORS.barkSoft, lineHeight: 22, marginBottom: 24 },
  section: { fontSize: 16, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 10, marginTop: 12 },
  // v9 card lift — rust hairline + soft cocoa drop. Same recipe for radio cards.
  option: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: 16, marginBottom: 10, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)', backgroundColor: COLORS.paper,
    shadowColor: '#6B2E0E', shadowOpacity: 0.14, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 2,
  },
  optionActive: { borderColor: '#C07840', backgroundColor: 'rgba(192,120,64,0.06)', shadowOpacity: 0.22 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: COLORS.textLight,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2,
  },
  radioActive: { borderColor: '#C07840' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#C07840' },
  optionLabel: { fontSize: 15, fontFamily: FONTS.bodyMedium, color: COLORS.bark },
  optionHelper: { fontSize: 13, color: COLORS.barkSoft, marginTop: 2, lineHeight: 18 },
  textarea: {
    backgroundColor: COLORS.paper, borderRadius: 12, padding: 16,
    minHeight: 120, fontSize: 15, color: COLORS.bark,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#6B2E0E', shadowOpacity: 0.12, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, elevation: 1,
  },
  counter: { fontSize: 12, color: COLORS.textLight, marginTop: 6, textAlign: 'right' },
  noteBox: {
    marginTop: 24, padding: 16, borderRadius: 10,
    backgroundColor: 'rgba(196,163,90,0.12)', borderWidth: 1, borderColor: 'rgba(196,163,90,0.4)',
  },
  noteTitle: { fontSize: 14, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, marginBottom: 6 },
  noteBody: { fontSize: 13, color: COLORS.barkSoft, lineHeight: 19 },
  footer: {
    padding: 16, paddingBottom: 28,
    borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', backgroundColor: COLORS.cream,
  },
  // v9 canonical CTA — rect variant
  cta: {
    backgroundColor: '#C07840', paddingVertical: 16, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#945A41', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  ctaDisabled: { backgroundColor: COLORS.textLight, opacity: 0.45 },
  ctaLabel: { color: '#FDFBF6', fontSize: 16, fontFamily: FONTS.bodySemiBold },
});
