import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';

// Wordmark — soft serif "The Village" with the small coral heart accent.
// Replaces the prior text-rendered approximation; the image is the
// canonical brand mark and ships rasterized so font-loading races can't
// flash the wrong typography on cold launch.
const WORDMARK = require('../../../assets/brand/the-village-wordmark.png');
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS, FONTS } from '@utils/constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@store/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';
import { useT } from '@/i18n';

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
      <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
        <Image
          source={WORDMARK}
          style={styles.wordmark}
          resizeMode="contain"
          accessibilityLabel="The Village"
        />
        <Text style={styles.tagline}>{t('splash.tagline')}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    width: 280,
    height: 118,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontFamily: FONTS.bodyMedium,
  },
});
