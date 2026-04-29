// Me · Account & security · Change email.
//
// supabase.auth.updateUser({ email }) — by default Supabase sends a
// confirmation link to BOTH the old and new email; the change only takes
// effect after the user clicks the link in the new inbox. This is the
// secure-by-default posture and we don't bypass it.
//
// We do not eagerly mirror the new email into public.users — that row's
// email column is synced from auth.users by the existing trigger after the
// confirmation lands, so we simply tell the user what to expect and exit.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@store/auth';
import { useT } from '@/i18n';
import type { MeStackParamList } from '@/navigation/MeNavigator';

type Nav = NativeStackNavigationProp<MeStackParamList, 'ChangeEmail'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmailScreen() {
  const navigation = useNavigation<Nav>();
  const t = useT();
  const currentEmail = useAuthStore((st) => st.user?.email ?? '');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const trimmed = email.trim().toLowerCase();
  const looksValid = EMAIL_RE.test(trimmed);
  const sameAsCurrent = trimmed.length > 0 && trimmed === currentEmail.toLowerCase();
  const canSubmit = looksValid && !sameAsCurrent && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw new Error(error.message);
      Alert.alert(
        t('account.emConfirmTitle'),
        t('account.emConfirmBody', {
          email: trimmed,
          current: currentEmail || t('account.emCurrentFallback'),
        }),
        [{ text: t('account.ok'), onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert(t('account.emErrorTitle'), err?.message ?? t('account.emErrorBody'));
    } finally {
      setLoading(false);
    }
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
        >
          <Text style={s.backText}>← {t('account.back')}</Text>
        </TouchableOpacity>

        <Text style={s.title}>{t('account.emTitle')}</Text>
        <Text style={s.sub}>{t('account.emSub')}</Text>

        {currentEmail ? (
          <View style={s.currentRow}>
            <Text style={s.currentLabel}>{t('account.emCurrentLabel')}</Text>
            <Text style={s.currentEmail} numberOfLines={1}>{currentEmail}</Text>
          </View>
        ) : null}

        <View style={s.form}>
          <View style={s.inputGroup}>
            <Text style={s.label}>{t('account.emNewLabel')}</Text>
            <TextInput
              style={[
                s.input,
                trimmed.length > 0 && !looksValid && s.inputError,
                sameAsCurrent && s.inputError,
              ]}
              value={email}
              onChangeText={setEmail}
              placeholder={t('account.emNewPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              accessibilityLabel={t('account.emNewA11y')}
            />
            {trimmed.length > 0 && !looksValid ? (
              <Text style={s.hint}>{t('account.emInvalid')}</Text>
            ) : null}
            {sameAsCurrent ? (
              <Text style={s.hint}>{t('account.emSameAsCurrent')}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[s.btn, !canSubmit && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t('account.emSubmitA11y')}
            accessibilityState={{ disabled: !canSubmit, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={s.btnText}>{t('account.emSubmit')}</Text>
            )}
          </TouchableOpacity>

          <Text style={s.disclaimer}>{t('account.emDisclaimer')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 20,
    lineHeight: 22,
  },
  currentRow: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  currentLabel: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.textLight,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  currentEmail: { fontSize: 15, color: COLORS.textDark, fontFamily: FONTS.body },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.textMid },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  inputError: { borderColor: COLORS.rust },
  hint: { fontSize: 12, color: COLORS.rustDark, marginTop: 2 },
  btn: {
    backgroundColor: COLORS.rust,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.white, fontSize: 16, fontFamily: FONTS.bodySemiBold },
  disclaimer: {
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 18,
    marginTop: 4,
  },
});
