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
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { BackButton } from '@components/shared/BackButton';
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
      style={{ flex: 1, backgroundColor: 'transparent' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <V9PageBackdrop />
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <BackButton color="#E84B79" style={s.back} accessibilityLabel={t('account.back')} />

        {/* v9 editorial masthead — eyebrow + Playfair roman lead + italic
            accent + hairline rule. Replaces the all-italic 32pt header. */}
        <View style={s.eyebrowRow}>
          <View style={s.eyebrowBar} />
          <Text style={s.eyebrow}>{t('account.pwEyebrow')}</Text>
        </View>
        <Text style={s.title}>
          {t('account.pwTitleLead')} <Text style={s.titleItalic}>{t('account.pwTitleEm')}</Text>
        </Text>
        <View style={s.titleRule} />
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
              <ActivityIndicator color={COLORS.paper} />
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
  back: { marginBottom: 18 },
  backText: { fontSize: 15, color: '#E84B79', fontFamily: FONTS.bodySemiBold },
  // v9 editorial masthead
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  eyebrowBar: { width: 22, height: 2, backgroundColor: '#7A4A24', marginRight: 10, borderRadius: 1 },
  eyebrow: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#7A4A24', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: {
    fontFamily: FONTS.headerBold,
    fontSize: 32,
    color: COLORS.bark,
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  titleItalic: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: '#E84B79' },
  titleRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 6, marginBottom: 14, width: 48,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.barkSoft,
    marginBottom: 24,
    lineHeight: 22,
  },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: COLORS.barkSoft },
  input: {
    backgroundColor: COLORS.paper,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.bark,
    borderWidth: 1.5,
    borderColor: 'rgba(150,80,50,0.18)',
  },
  inputError: { borderColor: COLORS.coco },
  hint: { fontSize: 12, color: '#7A4A24', marginTop: 2 },
  // v9 canonical CTA — rect variant
  btn: {
    backgroundColor: '#E84B79',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#E84B79', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#FFFCF6', fontSize: 16, fontFamily: FONTS.bodySemiBold },
});
