// A2.c — Delete account.
//
// Two-step destructive flow:
//   1. User reads what happens (data scope + 30-day grace + retention notes).
//   2. Types "DELETE" exactly into a confirmation field — industry-standard
//      pattern (GitHub, Stripe, AWS) that prevents fat-finger destruction.
//   3. Tap the rust-colored confirm button → call account-delete edge fn →
//      sign out → land back at SignIn.
//
// Behind the EXPO_PUBLIC_DELETE_ACCOUNT_ENABLED='1' feature flag at the
// MeScreen entry-point — the screen renders fine when navigated directly
// (e.g. by an internal QA build) but the discovery row is gated.
//
// LIMITATIONS to communicate to the user (legal copy):
//   - Today this is a SOFT DELETE (users.deleted_at set). Profile becomes
//     invisible and you'll be signed out. Data in other tables is NOT yet
//     scrubbed — the cascade implementation is pending an attorney review
//     of retention rules (some rows like milk transactions / gear listings
//     w/ recall trail must be retained for legal defense and PII-scrubbed
//     instead of row-deleted). Do not advertise "complete deletion" to
//     users until that cascade ships.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import { accountApi } from '@/api/account';
import { useAuthStore } from '@store/auth';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { MeStackParamList } from '@/navigation/MeNavigator';

type Nav = NativeStackNavigationProp<MeStackParamList, 'DeleteAccount'>;

const CONFIRM_PHRASE = 'DELETE';

export default function DeleteAccountScreen() {
  const navigation = useNavigation<Nav>();
  const t = useT();
  const signOut = useAuthStore((s) => s.signOut);
  const analytics = useAnalytics();

  const [phrase, setPhrase] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const phraseOk = phrase.trim() === CONFIRM_PHRASE;
  const canSubmit = phraseOk && !submitting;

  const handleDelete = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      analytics.trackEvent('account_delete_requested');
      const result = await accountApi.deleteAccount();
      analytics.trackEvent('account_delete_succeeded', {
        already_deleted: result.already_deleted,
      });
      // Sign out unconditionally so the local session/store is cleared.
      // signOut errors are non-fatal at this point — the soft-delete is
      // already committed server-side.
      try {
        await signOut();
      } catch (err) {
        console.warn('signOut after delete failed (non-fatal):', err);
      }
      // Don't show a success alert — the SignIn screen is the destination
      // and a modal popup before that is jarring for an irreversible act.
    } catch (err: any) {
      analytics.trackEvent('account_delete_failed', {
        reason: String(err?.message ?? 'unknown').slice(0, 100),
      });
      Alert.alert(
        t('account.delErrorTitle'),
        err?.message ?? t('account.delErrorBody'),
      );
      setSubmitting(false);
    }
  };

  const handleConfirm = () => {
    Alert.alert(
      t('account.delConfirmTitle'),
      t('account.delConfirmBody'),
      [
        { text: t('account.delConfirmCancel'), style: 'cancel' },
        { text: t('account.delConfirmYes'), style: 'destructive', onPress: handleDelete },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.cream }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={s.back}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('account.back')}
          disabled={submitting}
        >
          <Text style={s.backText}>← {t('account.back')}</Text>
        </TouchableOpacity>

        <Text style={s.title}>{t('account.delTitle')}</Text>
        <Text style={s.sub}>{t('account.delSub')}</Text>

        {/* What happens block */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('account.delWhatHappensTitle')}</Text>
          <Bullet text={t('account.delWhatHappens1')} />
          <Bullet text={t('account.delWhatHappens2')} />
          <Bullet text={t('account.delWhatHappens3')} />
          <Bullet text={t('account.delWhatHappens4')} />
        </View>

        {/* What's retained block — legal copy. CPSIA / tax / dispute audit. */}
        <View style={s.cardMuted}>
          <Text style={s.cardTitle}>{t('account.delRetainedTitle')}</Text>
          <Text style={s.cardBody}>{t('account.delRetainedBody')}</Text>
        </View>

        {/* Confirmation phrase */}
        <View style={s.inputGroup}>
          <Text style={s.label}>
            {t('account.delPhraseLabel', { word: CONFIRM_PHRASE })}
          </Text>
          <TextInput
            style={[s.input, phrase.length > 0 && !phraseOk && s.inputError]}
            value={phrase}
            onChangeText={setPhrase}
            placeholder={CONFIRM_PHRASE}
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!submitting}
            accessibilityLabel={t('account.delPhraseA11y', { word: CONFIRM_PHRASE })}
          />
        </View>

        <TouchableOpacity
          style={[s.dangerBtn, !canSubmit && s.dangerBtnDisabled]}
          onPress={handleConfirm}
          disabled={!canSubmit}
          accessibilityRole="button"
          accessibilityLabel={t('account.delSubmitA11y')}
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
        >
          {submitting ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={s.dangerBtnText}>{t('account.delSubmit')}</Text>
          )}
        </TouchableOpacity>

        <Text style={s.disclaimer}>{t('account.delDisclaimer')}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={s.bullet}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { padding: 28, paddingTop: 60, paddingBottom: 48 },
  back: { marginBottom: 24 },
  backText: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodySemiBold },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 32,
    color: COLORS.textDark,
    fontStyle: 'italic',
    marginBottom: 12,
    lineHeight: 40,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.textMid,
    marginBottom: 24,
    lineHeight: 22,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.rust,
  },
  cardMuted: {
    backgroundColor: 'rgba(196,163,90,0.10)', // gold tint
    borderRadius: 14,
    padding: 18,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  cardTitle: {
    fontFamily: FONTS.bodySemiBold,
    fontSize: 14,
    color: COLORS.textDark,
    marginBottom: 10,
  },
  cardBody: {
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textMid,
    lineHeight: 20,
  },
  bullet: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-start' },
  bulletDot: {
    fontSize: 13,
    color: COLORS.rust,
    marginRight: 8,
    marginTop: 1,
    fontFamily: FONTS.bodySemiBold,
  },
  bulletText: {
    flex: 1,
    fontFamily: FONTS.body,
    fontSize: 13,
    color: COLORS.textDark,
    lineHeight: 20,
  },
  inputGroup: { gap: 6, marginBottom: 16 },
  label: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: COLORS.textDark,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    letterSpacing: 1,
  },
  inputError: { borderColor: COLORS.rust },
  dangerBtn: {
    backgroundColor: COLORS.rust,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  dangerBtnDisabled: { opacity: 0.4 },
  dangerBtnText: { color: COLORS.white, fontSize: 16, fontFamily: FONTS.bodySemiBold },
  disclaimer: {
    fontFamily: FONTS.body,
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 16,
    lineHeight: 18,
    textAlign: 'center',
  },
});
