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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    confirm();
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('login.errMissingFields'));
      return;
    }
    setLoading(true);
    try {
      await authService.signIn(email.trim(), password);
      // RootNavigator detects session and switches to App automatically
    } catch (err: any) {
      Alert.alert(t('login.errSignInFailedTitle'), err.message ?? t('login.errSignInFailedFallback'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* v3 atmosphere — WarmGlowBackdrop (paper U-shape + bees) so the
          first surface after Splash speaks Home's brand voice. */}
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
            salmon italic accent + 48px hairline rule. */}
        <View style={styles.masthead}>
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowBar} />
            <Text style={styles.eyebrow}>{t('login.mastheadEyebrow')}</Text>
          </View>
          <Text style={styles.title}>
            {t('login.titleLead')} <Text style={styles.titleItalic}>{t('login.titleEm')}</Text>
          </Text>
          <View style={styles.titleRule} />
        </View>
        <Text style={styles.sub}>{t('login.sub')}</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('login.emailLabel')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('login.passwordLabel')}</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder={t('login.passwordPlaceholder')}
                placeholderTextColor={COLORS.textLight}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                accessibilityLabel={t('login.passwordA11y')}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? t('login.hidePasswordA11y') : t('login.showPasswordA11y')}
                accessibilityState={{ selected: showPassword }}
              >
                <Text style={styles.passwordToggleText}>{showPassword ? t('login.hidePassword') : t('login.showPassword')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            accessibilityRole="link"
            accessibilityLabel={t('login.forgotLinkA11y')}
          >
            <Text style={styles.forgotLink}>{t('login.forgotLink')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={loading ? t('login.ctaA11yBusy') : t('login.ctaA11ySignIn')}
            accessibilityState={{ disabled: loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFCF6" />
            ) : (
              <Text style={styles.btnText}>{t('login.cta')}</Text>
            )}
          </TouchableOpacity>

          {/* OAuth providers (Google + Apple). Returns null when the feature
              flag EXPO_PUBLIC_OAUTH_PROVIDERS_ENABLED is off, so this is a
              no-op until the dashboard prerequisites are set up — see
              docs/AUTH_PROVIDER_SETUP.md. */}
          <OAuthButtons variant="sign_in" />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('login.noAccount')}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp', {})}>
            <Text style={styles.footerLink}>{t('login.signUpLink')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── v2 brand (villie · May 2026) ──────────────────────────────────────
// Page v2_cream, title Playfair roman 700 cocoa (no italic — "less italic,
// more presence"), body Plus Jakarta walnut, inputs on v2_card, password
// toggle + forgot + footer link in cinnamon (inline link affordance), CTA
// cinnamon (the one spark per screen).
const styles = StyleSheet.create({
  // bg removed — v9 LinearGradient backdrop renders behind. `transparent`
  // lets the gradient bleed through the ScrollView.
  container: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 28, paddingTop: 60, flexGrow: 1 },

  // Stacked logo content is 1028×647 (≈1.59:1) after cream strip + tight
  // crop. 150×95 keeps the auth header tight while preserving aspect.
  wordmark: { width: 150, height: 105, marginBottom: 12, marginLeft: -4, alignSelf: 'flex-start' },

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

  forgotLink: {
    fontSize: 13,
    color: COLORS.v2_cinnamon,
    fontFamily: FONTS.v2_link,
    textAlign: 'right',
    marginTop: -4,
  },

  // v9 canonical CTA — action-deep (WCAG AA 5.56:1 on paper text;
  // cinnamon #E84B79 fails AA at normal text size).
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

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14, color: COLORS.v2_walnut, fontFamily: FONTS.v2_body },
  footerLink: { fontSize: 14, color: COLORS.v2_cinnamon, fontFamily: FONTS.v2_link, marginLeft: 4 },
});
