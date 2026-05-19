import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';
import { authService } from '@/lib/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';
import { useT } from '@/i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

// Loose RFC-5321-style check — same regex as SignUp.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const emailLooksValid = !email || EMAIL_RE.test(email.trim());

  const handleReset = async () => {
    if (!email.trim()) { Alert.alert(t('forgotPassword.errMissingEmail')); return; }
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert(t('signUp.errInvalidEmailTitle'), t('signUp.errInvalidEmailBody'));
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      Alert.alert(t('forgotPassword.errFailedTitle'), err.message ?? t('forgotPassword.errFailedFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <V9PageBackdrop />
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('forgotPassword.back')}
        >
          <Text style={styles.backText}>{`← ${t('forgotPassword.back')}`}</Text>
        </TouchableOpacity>

        {/* v9 editorial masthead */}
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowBar} />
          <Text style={styles.eyebrow}>{t('forgotPassword.eyebrow')}</Text>
        </View>
        <Text style={styles.title}>
          {t('forgotPassword.titleLead')} <Text style={styles.titleEm}>{t('forgotPassword.titleEm')}</Text>
        </Text>
        <View style={styles.titleRule} />

        {sent ? (
          <View style={styles.sentCard}>
            <Text style={styles.sentEmoji}>📬</Text>
            <Text style={styles.sentTitle}>{t('forgotPassword.successTitle')}</Text>
            <Text style={styles.sentSub}>
              {t('forgotPassword.successBody')}
            </Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => navigation.navigate('Login')}
              accessibilityRole="button"
              accessibilityLabel={t('forgotPassword.back')}
            >
              <Text style={styles.btnText}>{t('forgotPassword.back')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <Text style={styles.sub}>
              {t('forgotPassword.sub')}
            </Text>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('forgotPassword.emailLabel')}</Text>
              <TextInput
                style={[styles.input, !emailLooksValid && styles.inputError]}
                value={email}
                onChangeText={setEmail}
                placeholder={t('forgotPassword.emailPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                accessibilityLabel={t('signUp.emailA11y')}
              />
              {!emailLooksValid && (
                <Text style={styles.inputHint}>{t('signUp.emailHintInvalid')}</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleReset}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={loading ? t('forgotPassword.ctaBusy') : t('forgotPassword.cta')}
              accessibilityState={{ disabled: loading, busy: loading }}
            >
              {loading ? (
                <ActivityIndicator color="#FDFBF6" />
              ) : (
                <Text style={styles.btnText}>{t('forgotPassword.cta')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── v2 brand (villie · May 2026) ──────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', padding: 28, paddingTop: 60 },
  back: { marginBottom: 18 },
  backText: { fontSize: 13, color: '#C07840', fontFamily: FONTS.v2_link },
  // v9 editorial masthead
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  eyebrowBar: { width: 22, height: 2, backgroundColor: '#A77349', marginRight: 10, borderRadius: 1 },
  eyebrow: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#A77349', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: {
    fontFamily: FONTS.v2_display,
    fontSize: 32,
    color: COLORS.v2_cocoa,
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 38,
  },
  titleEm: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: '#C07840' },
  titleRule: {
    height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,13,0.18)',
    marginTop: 8, marginBottom: 18, width: 48,
  },
  sub: { fontSize: 14, color: COLORS.v2_walnut, marginBottom: 24, lineHeight: 22, fontFamily: FONTS.v2_body },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 12, fontFamily: FONTS.v2_label, color: COLORS.v2_amber, letterSpacing: 0.8, textTransform: 'uppercase' },
  input: {
    backgroundColor: COLORS.v2_card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.v2_cocoa,
    borderWidth: 1,
    borderColor: 'rgba(61,31,14,0.12)',
    fontFamily: FONTS.v2_body,
  },
  inputError: { borderColor: '#B22A2A', borderWidth: 1.5 },
  inputHint: { fontSize: 12, color: '#8B2A2A', marginTop: 4, fontFamily: FONTS.v2_body },
  // Primary CTA — cinnamon (the one spark)
  // v9 canonical CTA — action-deep
  btn: {
    backgroundColor: '#C07840',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#945A41',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 3,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.v2_card, fontSize: 15, fontFamily: FONTS.v2_link, letterSpacing: 0.3 },

  // Success state — v9 card lift so "check your inbox" reads as a confirmed
  // moment rather than floating text. Same recipe as DonorCard / GearCard.
  sentCard: {
    alignItems: 'center',
    backgroundColor: COLORS.paper,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 28,
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(150,80,50,0.18)',
    shadowColor: '#6B2E0E',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 3,
  },
  sentEmoji: { fontSize: 56, marginBottom: 16 },
  sentTitle: {
    fontFamily: FONTS.v2_display,
    fontSize: 26,
    color: COLORS.v2_cocoa,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  sentSub: {
    fontSize: 14,
    color: COLORS.v2_walnut,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: FONTS.v2_body,
  },
});
