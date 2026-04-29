import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMilkStore } from '@store/milk';
import { getStripeConnectUrl, updateDonorProfile } from '@api/milk';
import { COLORS, FONTS } from '@utils/constants';
import { useT } from '@/i18n';
import type { MilkStackParamList } from '@/navigation/MilkNavigator';

type Props = NativeStackScreenProps<MilkStackParamList, 'StripeOnboarding'>;

export default function StripeOnboardingScreen({ route, navigation }: Props) {
  const { donorProfileId } = route.params;
  const { donorProfile, setDonorProfile } = useMilkStore();
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOnboardingUrl();
  }, []);

  const loadOnboardingUrl = async () => {
    try {
      const { url: onboardingUrl } = await getStripeConnectUrl(donorProfileId);
      setUrl(onboardingUrl);
    } catch (err) {
      console.error('Stripe Connect URL error:', err);
      Alert.alert(
        t('stripeOnboarding.errorTitle'),
        t('stripeOnboarding.errorBody'),
        [{ text: t('stripeOnboarding.ok'), onPress: () => navigation.goBack() }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleNavigationChange = async (navState: WebViewNavigation) => {
    const { url: navUrl } = navState;
    if (!navUrl) return;

    // Deep link return from Stripe Express
    if (navUrl.includes('thevillage://milk/stripe-return') || navUrl.includes('stripe-return')) {
      await handleOnboardingComplete();
    } else if (navUrl.includes('thevillage://milk/stripe-refresh') || navUrl.includes('stripe-refresh')) {
      // Re-fetch onboarding URL (Stripe links expire)
      setLoading(true);
      setUrl(null);
      loadOnboardingUrl();
    }
  };

  const handleOnboardingComplete = async () => {
    try {
      // Mark onboarding complete + activate profile
      const updated = await updateDonorProfile(donorProfileId, {
        stripe_onboarding_complete: true,
        is_active: true,
      });
      setDonorProfile(updated);
      navigation.replace('OnboardingComplete');
    } catch (err) {
      console.error('Stripe onboarding complete error:', err);
      navigation.replace('MilkHome');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.rust} size="large" />
        <Text style={styles.loadingText}>{t('stripeOnboarding.loading')}</Text>
      </View>
    );
  }

  if (!url) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('stripeOnboarding.headerTitle')}</Text>
        <Text style={styles.headerSub}>{t('stripeOnboarding.headerSub')}</Text>
      </View>
      <WebView
        source={{ uri: url }}
        onNavigationStateChange={handleNavigationChange}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.webviewLoader}>
            <ActivityIndicator color={COLORS.rust} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F0E8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F0E8', gap: 16 },
  loadingText: { fontSize: 15, color: '#9A8070', fontFamily: FONTS.bodyMedium },
  header: {
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E8E0D5',
  },
  headerTitle: { fontSize: 18, fontFamily: FONTS.bodySemiBold, color: '#2C1810', marginBottom: 4 },
  headerSub: { fontSize: 12, color: '#9A8070', lineHeight: 17, fontFamily: FONTS.body },
  webviewLoader: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
});
