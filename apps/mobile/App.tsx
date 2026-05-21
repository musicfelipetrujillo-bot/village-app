import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as usePlayfair,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_600SemiBold_Italic,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
} from '@expo-google-fonts/playfair-display';
// ─── Brand Kit v2 (villie · May 2026) ─── canonical type families
// Inter has been retired (was the v1 body family) — every FONTS.body* token
// in constants.ts now resolves to Plus Jakarta Sans. Removing the Inter
// import + font load saves ~80KB of bundle weight.
import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore } from '@store/auth';
import { usePreAuthLanguage } from '@store/preAuthLanguage';
import { supabase } from '@/lib/supabase';
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

  const [fontsLoaded] = usePlayfair({
    // Playfair Display — display family
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_600SemiBold_Italic,    // v2 flourish weight (italic per-screen)
    PlayfairDisplay_700Bold,               // v2 roman default
    PlayfairDisplay_800ExtraBold,          // v2 big numbers (week count, stats)
    // Caprasimo — wordmark inline fallback only
    Caprasimo_400Regular,
    // Plus Jakarta Sans — v2 body / labels / buttons / links
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    // JetBrains Mono — v2 eyebrows / metadata / dates
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    // Restore the language picked in a previous session before any auth
    // screen renders. Best-effort — if it fails the screens stay English.
    hydrateLang();
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
