import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
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
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('forgotPassword.back')}
        >
          <Text style={styles.backText}>{`← ${t('forgotPassword.back')}`}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('forgotPassword.title')}</Text>

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
                <ActivityIndicator color="white" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, padding: 28, paddingTop: 60 },
  back: { marginBottom: 32 },
  backText: { fontSize: 15, color: COLORS.rust, fontFamily: FONTS.bodyMedium },
  title: {
    fontFamily: FONTS.headerItalic,
    fontSize: 34,
    color: COLORS.textDark,
    marginBottom: 24,
    lineHeight: 42,
  },
  sub: { fontSize: 14, color: COLORS.textLight, marginBottom: 24, lineHeight: 22, fontFamily: FONTS.body },
  form: { gap: 16 },
  inputGroup: { gap: 6 },
  label: { fontSize: 13, fontFamily: FONTS.bodyMedium, color: COLORS.textMid },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.textDark,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.08)',
    fontFamily: FONTS.body,
  },
  inputError: { borderColor: COLORS.rust },
  inputHint: { fontSize: 12, color: COLORS.rust, marginTop: 4, fontFamily: FONTS.body },
  btn: {
    backgroundColor: COLORS.rust,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontSize: 16, fontFamily: FONTS.bodySemiBold },

  sentCard: { alignItems: 'center', paddingTop: 40 },
  sentEmoji: { fontSize: 56, marginBottom: 16 },
  sentTitle: {
    fontFamily: FONTS.headerItalic,
    fontSize: 26,
    color: COLORS.textDark,
    marginBottom: 12,
  },
  sentSub: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    fontFamily: FONTS.body,
  },
});
