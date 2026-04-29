import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts as usePlayfair,
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_700Bold,
} from '@expo-google-fonts/playfair-display';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { RootNavigator } from '@/navigation/RootNavigator';
import { useAuthStore } from '@store/auth';
import { usePreAuthLanguage } from '@store/preAuthLanguage';
import { supabase } from '@/lib/supabase';
import { ErrorBoundary } from '@components/shared/ErrorBoundary';

// Keep splash up while we hydrate fonts — prevents the editorial Playfair
// from flashing as system serif during the swap.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const setSession = useAuthStore((s) => s.setSession);
  const hydrateLang = usePreAuthLanguage((s) => s.hydrate);

  const [fontsLoaded] = usePlayfair({
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
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
