// V1 Auth · OAuth provider buttons (Google + Apple).
//
// Renders the "Continue with Google" + "Continue with Apple" buttons below
// the email/password form on LoginScreen and SignUpScreen. Returns null when
// the feature flag is off (EXPO_PUBLIC_OAUTH_PROVIDERS_ENABLED !== '1') so
// the component is a no-op until dashboard setup is complete.
//
// Apple's button is iOS-only (it uses Apple's native AuthenticationServices
// framework via expo-apple-authentication). On Android we render Google
// alone. Per Apple guideline 4.8 we MUST ship Apple alongside Google on iOS,
// so the iOS variant always renders both.
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useT } from '@/i18n';
import { COLORS, FONTS } from '@utils/constants';
import {
  OAUTH_PROVIDERS_ENABLED,
  signInWithGoogle,
  signInWithApple,
  isAppleSignInAvailable,
} from '@/lib/oauth';

interface Props {
  /** Label tweak so SignUpScreen says "Sign up" and LoginScreen says "Continue". */
  variant: 'sign_in' | 'sign_up';
  /** Called on success. Parent screen typically navigates / refreshes session. */
  onSuccess?: () => void;
}

export default function OAuthButtons({ variant, onSuccess }: Props) {
  const t = useT();
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState<boolean | null>(null);

  // Probe Apple availability once on mount. On iOS this is essentially always
  // true on iOS 13+; on Android it's always false (we don't render the button).
  React.useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  if (!OAUTH_PROVIDERS_ENABLED) return null;

  const labelGoogle = variant === 'sign_in' ? t('oauth.googleSignIn') : t('oauth.googleSignUp');
  const labelApple = variant === 'sign_in' ? t('oauth.appleSignIn') : t('oauth.appleSignUp');
  const dividerText = t('oauth.divider');

  const handleGoogle = async () => {
    if (busy) return;
    setBusy('google');
    try {
      const result = await signInWithGoogle();
      if (result.ok) {
        onSuccess?.();
      } else if (!result.cancelled) {
        Alert.alert(t('oauth.errTitle'), result.error ?? t('oauth.errGenericGoogle'));
      }
    } finally {
      setBusy(null);
    }
  };

  const handleApple = async () => {
    if (busy) return;
    setBusy('apple');
    try {
      const result = await signInWithApple();
      if (result.ok) {
        onSuccess?.();
      } else if (!result.cancelled) {
        Alert.alert(t('oauth.errTitle'), result.error ?? t('oauth.errGenericApple'));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{dividerText}</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Apple Sign In — iOS only, uses Apple's native button styling per
          their HIG requirement. */}
      {Platform.OS === 'ios' && appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            variant === 'sign_in'
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
          }
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={14}
          style={styles.appleButton}
          onPress={handleApple}
        />
      ) : null}

      {/* Google — cream-on-cream surface with the multi-color "G" mark in copy.
          We use a regular TouchableOpacity instead of GoogleSigninButton because
          Google's stock button is heavy + clashes with the brand. Our subtle
          version is still compliant: the "G" mark in the label is enough
          recognition for Google's brand-guideline review. */}
      <TouchableOpacity
        style={[styles.googleButton, busy === 'google' && styles.buttonDisabled]}
        onPress={handleGoogle}
        disabled={!!busy}
        accessibilityRole="button"
        accessibilityLabel={labelGoogle}
        accessibilityState={{ busy: busy === 'google' }}
      >
        {busy === 'google' ? (
          <ActivityIndicator color={COLORS.coco} />
        ) : (
          <>
            <View style={styles.googleMark}><Text style={styles.googleMarkText}>G</Text></View>
            <Text style={styles.googleLabel}>{labelGoogle}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Apple loading overlay — the native Apple button doesn't expose a
          disabled state, so we show a discreet spinner row underneath while
          the call is in flight. */}
      {busy === 'apple' ? (
        <View style={styles.appleBusyRow}>
          <ActivityIndicator color={COLORS.coco} size="small" />
          <Text style={styles.appleBusyText}>{t('oauth.busy')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: 20, gap: 12 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(122,74,40,0.25)' },
  dividerText: {
    fontSize: 11, fontFamily: FONTS.bodySemiBold, letterSpacing: 1.4,
    color: '#A77349', textTransform: 'uppercase',
  },

  appleButton: { width: '100%', height: 50 },
  appleBusyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 6,
  },
  appleBusyText: { fontSize: 12, color: COLORS.barkSoft, fontFamily: FONTS.body },

  googleButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#FEFAF6', borderRadius: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: 'rgba(150,80,50,0.20)',
    shadowColor: '#6B2E0E', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10, shadowRadius: 8, elevation: 2,
  },
  buttonDisabled: { opacity: 0.6 },
  googleMark: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
  },
  googleMarkText: { fontSize: 13, fontFamily: FONTS.bodySemiBold, color: '#4285F4' },
  googleLabel: { fontSize: 15, fontFamily: FONTS.bodySemiBold, color: COLORS.bark, letterSpacing: 0.2 },
});
