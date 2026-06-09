import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@store/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';
import { useT } from '@/i18n';

// Wordmark — "villie" logotype with bee mark.
// v9 kit canon — villie-wordmark-v2.png is the canonical wordmark per
// `memory/project_brand_kit_v2.md`. Splash previously used the OG (different
// SHA); switched 2026-05-16 so the first-pixel-on-the-app is on-brand.
const WORDMARK = require('../../../assets/brand/villie-wordmark-v2.png');

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
  const t = useT();
  const fadeAnim = new Animated.Value(0);
  const setSession = useAuthStore((s) => s.setSession);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      setTimeout(() => {
        if (session) {
          // Authenticated — RootNavigator will switch to App
        } else {
          navigation.replace('Onboarding');
        }
      }, 1600);
    };

    checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      {/* v9 page wash — paper U-shape, the brand's first beat is paper-soft */}
      <LinearGradient
        colors={[
          '#FDF1EB', '#FDF8F4', '#FCFCFB',
          '#FCFCFB', '#FCF6EF', '#F9E9DD', '#F5DFD3',
        ]}
        locations={[0, 0.12, 0.30, 0.62, 0.76, 0.90, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Image
          source={WORDMARK}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="villie"
        />
        <Text style={styles.tagline}>{t('splash.tagline')}</Text>
      </Animated.View>
    </View>
  );
}

// ─── Brand Kit v2 (villie · May 2026) ──────────────────────────────────────
// First v2 screen. Tagline switches from Inter Medium tracked-caps to
// JetBrains Mono 500 amber — the canonical eyebrow/metadata treatment per
// the brand kit. Background uses v2_cream `#FCF7EF` (the actual canonical
// cream, slightly more saturated than v1 `#F5EFE6`). Wordmark asset stays
// — the existing hi-res PNG IS the canonical wordmark.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    // bg removed — v9 LinearGradient backdrop renders behind.
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stacked logo content is 1028×647 (≈1.59:1) after cream strip + tight
  // crop. 240×168 reads as a confident Splash hero without overwhelming
  // the tagline below.
  wordmark: {
    width: 240,
    height: 168,
    marginBottom: 0,
  },
  // v2 eyebrow: JetBrains Mono 500, amber, tracking ~0.26em (≈2.6px at 10px).
  tagline: {
    fontSize: 10,
    color: COLORS.v2_amber,
    marginTop: 12,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    fontFamily: FONTS.v2_mono,
  },
});
