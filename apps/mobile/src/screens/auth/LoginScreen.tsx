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

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
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
        <Text style={styles.title}>{t('login.title')}</Text>
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
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.btnText}>{t('login.cta')}</Text>
            )}
          </TouchableOpacity>
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

  passwordRow: { position: 'relative' },
  passwordInput: { paddingRight: 64 },
  passwordToggle: {
    position: 'absolute', right: 8, top: 0, bottom: 0,
    justifyContent: 'center', paddingHorizontal: 10,
  },
  passwordToggleText: {
    fontSize: 13, color: COLORS.rust, fontFamily: FONTS.bodySemiBold,
  },

  forgotLink: {
    fontSize: 13,
    color: COLORS.rust,
    fontFamily: FONTS.bodyMedium,
    textAlign: 'right',
    marginTop: -4,
  },

  btn: {
    backgroundColor: COLORS.yolkLight,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: COLORS.brownDeep, fontSize: 16, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 32 },
  footerText: { fontSize: 14, color: COLORS.textLight, fontFamily: FONTS.body },
  footerLink: { fontSize: 14, color: COLORS.rust, fontFamily: FONTS.bodyMedium },
});
