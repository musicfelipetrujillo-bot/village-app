import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { WarmGlowBackdrop } from '@components/shared/WarmGlowBackdrop';
import { confirm } from '@utils/haptics';
import { authService } from '@/lib/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';
import { useT } from '@/i18n';
import OAuthButtons from '@components/auth/OAuthButtons';

const WORDMARK = require('../../../assets/brand/villie-wordmark-v2.png');

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
  // Warm progression using brand tokens: alert → sand → sage → sageDeep.
  const colors = {
    1: COLORS.statusAlert,
    2: COLORS.sand,
    3: COLORS.sage,
    4: COLORS.sageDeep,
  } as const;
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
    confirm();
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
      const result = await authService.signUp(email.trim(), password, fullName.trim());
      // If Supabase has email-confirmation required (default for hosted
      // projects), signUp returns `{user, session: null}` — the account
      // is created but no session is issued until the user clicks the
      // verification link. Navigating to OnboardingProfile in that case
      // is a trap: that screen needs `user` from useAuthStore which is
      // derived from session, and every action there silently no-ops.
      // Surface the confirmation requirement explicitly instead.
      if (!result?.session) {
        Alert.alert(
          t('signUp.confirmRequiredTitle'),
          t('signUp.confirmRequiredBody', { email: email.trim() }),
        );
        return;
      }
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
      {/* v3 atmosphere — WarmGlowBackdrop replaces the paper U-shape so the
          first auth surface shares Home's bee-and-paper voice. */}
      <WarmGlowBackdrop />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={WORDMARK}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="villie"
        />

        {/* v3 editorial masthead — eyebrow + Plus Jakarta display title with
            salmon italic accent + 48px hairline rule. Mirrors HomeScreenV3 /
            VillageHomeScreenV3 / InboxHomeScreen. */}
        <View style={styles.masthead}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBar} />
            <Text style={styles.eyebrow}>{t('signUp.mastheadEyebrow')}</Text>
          </View>
          <Text style={styles.title}>
            {t('signUp.titleLead')} <Text style={styles.titleItalic}>{t('signUp.titleEm')}</Text>
          </Text>
          <View style={styles.titleRule} />
        </View>
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
              <ActivityIndicator color="#FFFCF6" />
            ) : (
              <Text style={styles.btnText}>{t('signUp.cta')}</Text>
            )}
          </TouchableOpacity>

          {/* OAuth providers (Google + Apple). Returns null when the feature
              flag EXPO_PUBLIC_OAUTH_PROVIDERS_ENABLED is off, so this is a
              no-op until the dashboard prerequisites are set up — see
              docs/AUTH_PROVIDER_SETUP.md. */}
          <OAuthButtons variant="sign_up" />

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

// ─── v2 brand (villie · May 2026) ──────────────────────────────────────
// Mirrors LoginScreen's v2 styling — Plus Jakarta body, JetBrains Mono
// uppercase labels, cinnamon password/footer links, cinnamon CTA. The
// inputError border uses persimmon-ish red for clarity (not cinnamon —
// errors need a distinct signal).
const styles = StyleSheet.create({
  // bg removed — v9 LinearGradient backdrop renders behind.
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 28, paddingTop: 60, flexGrow: 1 },

  wordmark: { width: 150, height: 95, marginBottom: 12, marginLeft: -4, alignSelf: 'flex-start' },

  // v3 editorial masthead
  masthead: { marginBottom: 14 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  eyebrowBar: { width: 16, height: 1.5, backgroundColor: COLORS.v2_walnut, marginRight: 8 },
  eyebrow: {
    fontFamily: FONTS.v2_mono, fontSize: 11, letterSpacing: 2.6,
    textTransform: 'uppercase', fontWeight: '500', color: COLORS.v2_walnut,
  },
  title: {
    fontFamily: FONTS.v3_display,
    fontSize: 36,
    color: COLORS.v2_cocoa,
    letterSpacing: -1.2,
    lineHeight: 38,
    marginBottom: 0,
  },
  titleItalic: { fontFamily: FONTS.v3_display_italic, color: COLORS.v2_salmon },
  titleRule: {
    height: StyleSheet.hairlineWidth,
    width: 48,
    backgroundColor: 'rgba(61,31,14,0.18)',
    marginTop: 14,
  },
  sub: { fontSize: 14, color: COLORS.v2_walnut, marginTop: 14, marginBottom: 26, fontFamily: FONTS.v2_body, lineHeight: 20 },

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
  // Error border — persimmon-tone red (distinct from cinnamon action color)
  inputError: { borderColor: '#B22A2A', borderWidth: 1.5 },
  inputHint: { fontSize: 12, color: '#8B2A2A', marginTop: 4, fontFamily: FONTS.v2_body },

  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 64 },
  passwordToggle: {
    position: 'absolute', right: 8, top: 0, bottom: 0,
    justifyContent: 'center', paddingHorizontal: 10,
  },
  passwordToggleText: {
    fontSize: 12, color: COLORS.v2_cinnamon, fontFamily: FONTS.v2_link,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(61,31,14,0.10)',
  },
  strengthLabel: { fontSize: 10, fontFamily: FONTS.v2_mono, color: COLORS.v2_amber, letterSpacing: 0.6, minWidth: 80, textAlign: 'right', textTransform: 'uppercase' },

  // Primary CTA — cinnamon (the one spark)
  // v9 canonical CTA — action-deep (WCAG AA on paper text)
  btn: {
    backgroundColor: '#E84B79',
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#E84B79',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 3,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.v2_card, fontSize: 15, fontFamily: FONTS.v2_link, letterSpacing: 0.3 },

  legal: {
    fontSize: 11,
    color: COLORS.v2_walnut,
    opacity: 0.75,
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: FONTS.v2_body,
  },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body },
  footerLink: { fontSize: 14, color: COLORS.v2_cinnamon, fontFamily: FONTS.v2_link, marginLeft: 4 },
});
