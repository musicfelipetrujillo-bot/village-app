import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { authService } from '@/lib/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';
import { useT } from '@/i18n';

const WORDMARK = require('../../../assets/brand/the-village-wordmark.png');

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

// Loose RFC-5321-style check — catches typos without rejecting valid edge cases.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Password strength scoring — additive 0..4 once the 8-char gate is met.
// Score 0 = under 8 chars; 1..4 = increasing strength tiers.
type Strength = { score: 0 | 1 | 2 | 3 | 4; labelKey: string; color: string };

function scorePassword(pw: string): Strength {
  if (pw.length < 8) {
    return { score: 0, labelKey: 'signUp.strengthTooShort', color: COLORS.textLight };
  }
  let s = 1;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  // Cap at 4 segments.
  const score = Math.min(s, 4) as 1 | 2 | 3 | 4;
  const labelKeys = {
    1: 'signUp.strengthWeak',
    2: 'signUp.strengthFair',
    3: 'signUp.strengthStrong',
    4: 'signUp.strengthVeryStrong',
  } as const;
  // Olive-ish progression so colors track brand palette.
  const colors = { 1: '#D87530', 2: '#C4A35A', 3: '#7A8A50', 4: '#5C6B3A' } as const;
  return { score, labelKey: labelKeys[score], color: colors[score] };
}

export default function SignUpScreen({ navigation, route }: Props) {
  const t = useT();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const emailLooksValid = !email || EMAIL_RE.test(email.trim());
  const strength = scorePassword(password);
  const strengthLabel = t(strength.labelKey);

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      Alert.alert(t('signUp.errMissingFields'));
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert(t('signUp.errInvalidEmailTitle'), t('signUp.errInvalidEmailBody'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('signUp.errPasswordShort'));
      return;
    }
    setLoading(true);
    try {
      await authService.signUp(email.trim(), password, fullName.trim());
      navigation.navigate('OnboardingProfile', { language: route.params?.language ?? 'en' });
    } catch (err: any) {
      Alert.alert(t('signUp.errSignUpFailedTitle'), err.message ?? t('signUp.errSignUpFailedFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={WORDMARK}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="The Village"
        />
        <Text style={styles.title}>{t('signUp.title')}</Text>
        <Text style={styles.sub}>{t('signUp.sub')}</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('signUp.fullNameLabel')}</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder={t('signUp.fullNamePlaceholder')}
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="words"
              autoComplete="name"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('signUp.emailLabel')}</Text>
            <TextInput
              style={[styles.input, !emailLooksValid && styles.inputError]}
              value={email}
              onChangeText={setEmail}
              placeholder={t('signUp.emailPlaceholder')}
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('signUp.passwordLabel')}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={t('signUp.passwordPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                accessibilityLabel={t('signUp.passwordA11y')}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t('signUp.hidePasswordA11y') : t('signUp.showPasswordA11y')}
                accessibilityState={{ selected: showPassword }}
              >
                <Text style={styles.passwordToggleText}>{showPassword ? t('signUp.hidePassword') : t('signUp.showPassword')}</Text>
              </TouchableOpacity>
            </View>
            {password.length > 0 && (
              <View
                style={styles.strengthRow}
                accessibilityRole="progressbar"
                accessibilityLabel={t('signUp.strengthA11y', { label: strengthLabel })}
                accessibilityValue={{ min: 0, max: 4, now: strength.score }}
              >
                <View style={styles.strengthBars}>
                  {[1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthSeg,
                        i <= strength.score && { backgroundColor: strength.color },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strength.color }]}>
                  {strengthLabel}
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSignUp}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={loading ? t('signUp.ctaA11yBusy') : t('signUp.ctaA11yCreate')}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnText}>{t('signUp.cta')}</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.legal}>
            {t('signUp.legal')}
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('signUp.haveAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>{t('signUp.signInLink')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 28, paddingTop: 60, flexGrow: 1 },

  wordmark: { width: 200, height: 84, marginBottom: 16, alignSelf: 'flex-start' },

  title: {
    fontFamily: FONTS.headerItalic,
    fontSize: 32,
    color: COLORS.textDark,
    marginBottom: 6,
  },
  sub: { fontSize: 14, color: COLORS.textLight, marginBottom: 32, fontFamily: FONTS.body },

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

  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 64 },
  passwordToggle: {
    position: 'absolute', right: 8, top: 0, bottom: 0,
    justifyContent: 'center', paddingHorizontal: 10,
  },
  passwordToggleText: {
    fontSize: 13, color: COLORS.rust, fontFamily: FONTS.bodySemiBold,
  },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  strengthLabel: { fontSize: 11, fontFamily: FONTS.bodySemiBold, minWidth: 80, textAlign: 'right' },

  btn: {
    backgroundColor: COLORS.yolkLight,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.brownDeep, fontSize: 16, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },

  legal: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: FONTS.body,
  },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14, color: COLORS.textLight, fontFamily: FONTS.body },
  footerLink: { fontSize: 14, color: COLORS.rust, fontFamily: FONTS.bodyMedium },
});
