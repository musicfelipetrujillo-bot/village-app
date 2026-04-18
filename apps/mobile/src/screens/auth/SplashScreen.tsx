import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { COLORS } from '@utils/constants';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@store/auth';
import type { AuthStackParamList } from '@/navigation/AuthStack';

type Props = NativeStackScreenProps<AuthStackParamList, 'Splash'>;

export default function SplashScreen({ navigation }: Props) {
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
        <Text style={styles.logo}>
          The <Text style={styles.logoAccent}>Village</Text>
        </Text>
        <Text style={styles.tagline}>your maternal village</Text>
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
  logo: {
    fontFamily: 'serif',
    fontSize: 42,
    color: COLORS.textDark,
    fontWeight: '400',
  },
  logoAccent: {
    color: COLORS.rust,
    fontStyle: 'italic',
  },
  tagline: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
});
