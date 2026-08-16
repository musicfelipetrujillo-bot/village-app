import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// ─── Canonical type families — 3-font ceiling (founder, 2026-08-15) ───
// Bricolage = display ("loud bits"), Hanken = body/UI, Caveat = the
// handwritten accent. Every FONTS token in constants.ts routes to one of
// these three. The older families (Playfair, Plus Jakarta, JetBrains Mono,
// Fraunces, Caprasimo) were rerouted away and are no longer loaded — this
// keeps the whole app to three families and trims bundle weight.
// See docs/V10_GENZ_REBRAND.md.
import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
} from '@expo-google-fonts/hanken-grotesk';
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore } from '@store/auth';
import { usePreAuthLanguage } from '@store/preAuthLanguage';
import { supabase } from '@/lib/supabase';
import { configureProPurchases } from '@/lib/pro';
import { ErrorBoundary } from '@components/shared/ErrorBoundary';
import { seedWebDevStores } from '@/lib/webDevSeed';
import { configureGoogleSignIn, OAUTH_PROVIDERS_ENABLED } from '@/lib/oauth';

// ─── Required EXPO_PUBLIC env var validation ─────────────────────────
// Fail loud at boot if the build is missing any var the app can't run
// without. We've been bitten twice by silent fallbacks (an undefined
// Supabase URL becoming `undefined.supabase.co`, and an empty Sentry
// DSN producing zero error reports for two weeks). Sentry/OneSignal/
// OAuth env vars are NOT required at boot — they degrade gracefully —
// so they're not on the strict list.
(function validateRequiredEnv() {
  const required = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_API_BASE_URL',
    'EXPO_PUBLIC_APP_ENV',
  ] as const;
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length === 0) return;
  const msg = `villie: missing required env vars: ${missing.join(', ')}. Check apps/mobile/.env or your EAS profile.`;
  if (__DEV__) {
    // Surface in the Metro logs + the dev redbox. Don't throw in
    // production builds — better a degraded app than a white-screen
    // crash with no diagnostic.
    console.error(msg);
    throw new Error(msg);
  } else {
    // Production: warn loudly to logs + Sentry breadcrumb so the
    // incident is at least traceable. The app still attempts to boot.
    console.warn(msg);
  }
})();

// Seed mock data immediately so HomeScreen has data before first render.
seedWebDevStores();

// Configure Google Sign-In SDK once at module load. No-op when the OAuth
// provider feature flag is off OR when the web client ID env var is unset
// (defensive — the helper handles both cases internally). Apple has no
// equivalent configure step.
if (OAUTH_PROVIDERS_ENABLED) {
  configureGoogleSignIn();
}

// Keep splash up while we hydrate fonts — prevents the editorial Playfair
// from flashing as system serif during the swap.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const setSession = useAuthStore((s) => s.setSession);
  const hydrateLang = usePreAuthLanguage((s) => s.hydrate);

  const [fontsLoaded] = useFonts({
    // Three families, whole app — Bricolage (display) · Hanken (body/UI) · Caveat (accent)
    BricolageGrotesque_400Regular,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    Caveat_600SemiBold,
  });

  useEffect(() => {
    // Restore the language picked in a previous session before any auth
    // screen renders. Best-effort — if it fails the screens stay English.
    hydrateLang();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      // villie pro (Build 14): identify the RevenueCat customer as our
      // Supabase user id, so the revenuecat-webhook (and gear-boost-activate)
      // can key entitlements on it. No-op without the native SDK / flag.
      if (data.session?.user?.id) void configureProPurchases(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user?.id) void configureProPurchases(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [setSession, hydrateLang]);

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ErrorBoundary>
          <RootNavigator />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
