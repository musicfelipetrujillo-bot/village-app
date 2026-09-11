import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@store/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';
import { useT } from '@/i18n';

// The roo — two kangaroo ears forming the "v" (the right ear folds over).
// It is villie's initial and the animal that carries its baby, which is the
// whole idea in one mark.
//
// Drawn as vector rather than loaded as a PNG so it inherits the palette
// token instead of baking a colour into a raster. The retired asset this
// replaced (`assets/brand/villie-wordmark-v2.png`) was the brown "villie"
// logotype with a bee over the first i — that mark and the bee metaphor were
// both dropped, but the splash kept serving it, so it was the first thing a
// new mother saw. Same geometry as the native splash asset
// (`assets/splash-roo.png`) and the app icon.
const ROO_LEFT  = 'M100 158 C80 130 60 94 54 60 C50 40 62 30 76 42 C90 66 101 118 108 152 Z';
const ROO_RIGHT = 'M100 158 C114 132 128 102 134 78 C137 64 146 58 151 68 C156 80 151 96 136 96 C129 96 124 90 122 82 C115 100 105 128 94 152 Z';

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
        <View accessible accessibilityLabel="villie" accessibilityRole="image">
          <Svg width={104} height={104} viewBox="54 24 102 140">
            <Path d={ROO_LEFT} fill={COLORS.v2_cinnamon} />
            <Path d={ROO_RIGHT} fill={COLORS.v2_cinnamon} />
          </Svg>
        </View>
        <Text style={styles.wordmark}>villie</Text>
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
  // Typeset rather than a raster lockup: the roo sits above the word, and the
  // word is set in the app's own display face so it can never drift from the
  // rest of the UI the way a baked PNG did.
  wordmark: {
    fontFamily: FONTS.v2_wordmark,
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -1.4,
    color: COLORS.v2_cocoa,
    marginTop: 10,
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
