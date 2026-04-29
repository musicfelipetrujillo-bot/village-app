// Me · Account & security · Change password.
//
// Authenticated password update via supabase.auth.updateUser({ password }).
// Supabase requires the user to have an active session — we don't re-prompt
// for the current password because the session itself is the auth proof
// (the same posture as Supabase's own client). If you want a stronger
// reauthentication step (e.g. for SOC2 step-up), wire it in here before the
// updateUser call. For v1 we keep the surface simple.
//
// Validation:
//   - new password ≥ 8 chars (matches SignUp)
//   - confirm matches
// Errors from Supabase (weak password, session expired, rate-limit) are
// surfaced via Alert; the screen stays open so the user can retry.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { supabase } from '@/lib/supabase';
import { useT } from '@/i18n';
import type { MeStackParamList } from '@/navigation/MeNavigator';

type Nav = NativeStackNavigationProp<MeStackParamList, 'ChangePassword'>;

const MIN_LENGTH = 8;

export default function ChangePasswordScreen() {
  const navigation = useNavigation<Nav>();
  const t = useT();
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const tooShort = pwd.length > 0 && pwd.length < MIN_LENGTH;
  const mismatch = confirm.length > 0 && pwd !== confirm;
  const canSubmit = pwd.length >= MIN_LENGTH && pwd === confirm && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw new Error(error.message);
      Alert.alert(
        t('account.pwUpdatedTitle'),
        t('account.pwUpdatedBody'),
        [{ text: t('account.ok'), onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      Alert.alert(t('account.pwErrorTitle'), err?.message ?? t('account.pwErrorBody'));
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

        <Text style={s.title}>{t('account.pwTitle')}</Text>
        <Text style={s.sub}>{t('account.pwSub')}</Text>

        <View style={s.form}>
          <View style={s.inputGroup}>
            <Text style={s.label}>{t('account.pwNewLabel')}</Text>
            <TextInput
              style={[s.input, tooShort && s.inputError]}
              value={pwd}
              onChangeText={setPwd}
              placeholder={t('account.pwNewPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              accessibilityLabel={t('account.pwNewA11y')}
            />
            {tooShort ? (
              <Text style={s.hint}>{t('account.pwTooShort', { n: MIN_LENGTH })}</Text>
            ) : null}
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>{t('account.pwConfirmLabel')}</Text>
            <TextInput
              style={[s.input, mismatch && s.inputError]}
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t('account.pwConfirmPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              accessibilityLabel={t('account.pwConfirmA11y')}
            />
            {mismatch ? (
              <Text style={s.hint}>{t('account.pwMismatch')}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[s.btn, !canSubmit && s.btnDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={t('account.pwSubmitA11y')}
            accessibilityState={{ disabled: !canSubmit, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={s.btnText}>{t('account.pwSubmit')}</Text>
            )}
          </TouchableOpacity>
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
    marginBottom: 24,
    lineHeight: 22,
  },
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
});
