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
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
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
      style={{ flex: 1, backgroundColor: 'transparent' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <V9PageBackdrop />
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          style={s.back}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('account.back')}
        >
          <Text style={s.backText}>← {t('account.back')}</Text>
        </TouchableOpacity>

        {/* v9 editorial masthead */}
        <View style={s.eyebrowRow}>
          <View style={s.eyebrowBar} />
          <Text style={s.eyebrow}>{t('account.emEyebrow')}</Text>
        </View>
        <Text style={s.title}>
          {t('account.emTitleLead')} <Text style={s.titleItalic}>{t('account.emTitleEm')}</Text>
        </Text>
        <View style={s.titleRule} />
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
              <ActivityIndicator color={COLORS.paper} />
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
  backText: { fontSize: 15, color: '#D96C88', fontFamily: FONTS.bodySemiBold },
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
  titleItalic: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: '#D96C88' },
  titleRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 6, marginBottom: 14, width: 48,
  },
  sub: {
    fontFamily: FONTS.body,
    fontSize: 14,
    color: COLORS.barkSoft,
    marginBottom: 20,
    lineHeight: 22,
  },
  currentRow: {
    backgroundColor: COLORS.paper,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(150,80,50,0.18)',
  },
  currentLabel: {
    fontSize: 11,
    fontFamily: FONTS.bodySemiBold,
    color: COLORS.textLight,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  currentEmail: { fontSize: 15, color: COLORS.bark, fontFamily: FONTS.body },
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
    backgroundColor: '#D96C88',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#D96C88', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24, shadowRadius: 10, elevation: 3,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: { color: '#FFFCF6', fontSize: 16, fontFamily: FONTS.bodySemiBold },
  disclaimer: {
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 18,
    marginTop: 4,
  },
});
