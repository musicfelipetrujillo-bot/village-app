import React from 'react';
import { Platform, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';
import { useOneSignal } from '@hooks/useOneSignal';
import { useAnalytics } from '@hooks/useAnalytics';
import { initSentry } from '@/lib/sentry';
import { AuthStack } from './AuthStack';
import { AppNavigator } from './AppNavigator';
import AIHelpChatScreen from '@screens/help/AIHelpChatScreen';
import FloatingHelpButton from '@components/shared/FloatingHelpButton';
import InternalAgentsScreen from '@screens/internal/InternalAgentsScreen';
import ClinicalReviewScreen from '@screens/internal/ClinicalReviewScreen';
import EventReviewScreen from '@screens/internal/EventReviewScreen';

// Internal Agents Console is compiled out of production unless the build
// explicitly opts in. Keeps the starter runtime off the public surface per
// RISK_AND_BOUNDARIES.md ("Do not expose runtime decisions to public users").
const INTERNAL_AGENTS_ENABLED =
  process.env.EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED === '1';

// Clinical Review dashboard is gated differently from the Agents console:
// it ships in the prod bundle (the screen + RPCs are public-safe — the
// server-side `is_clinical_reviewer()` SECURITY DEFINER check rejects every
// write/read for non-reviewers) and the launcher pill + route are mounted
// at runtime when the signed-in user has `users.is_clinical_reviewer=TRUE`.
// This lets us grant a reviewer access by flipping the DB column instead
// of cutting a custom build with the Agents env flag.

// Initialize Sentry once at app startup (no-op if DSN not set or not in prod)
initSentry();

const Stack = createNativeStackNavigator();

// Web dev preview: bypass auth so HomeScreen is reachable without Supabase.
// __DEV__ is false in production builds; Platform.OS !== 'web' on native.
const WEB_DEV_BYPASS = __DEV__ && Platform.OS === 'web';

export function RootNavigator() {
  const _session = useAuthStore((s) => s.session);
  const session = WEB_DEV_BYPASS ? true : _session;
  // Subscribe to the reviewer flag so flipping it in DB → re-fetch flows
  // through to mount/unmount the launcher pill + route without a re-login.
  const isReviewer = useUserStore(
    (s) => s.profile?.is_clinical_reviewer === true,
  );
  const isEventReviewer = useUserStore(
    (s) => s.profile?.is_event_reviewer === true,
  );
  // Either build-time opt-in OR a reviewer-flagged user surfaces the
  // dashboard. The InternalAgents screen stays env-gated only.
  const showClinicalReview = INTERNAL_AGENTS_ENABLED || isReviewer;
  // V4 G2 Pass 2 — event-ingest reviewer queue. Distinct DB column from
  // is_clinical_reviewer so the two roles can be granted independently.
  const showEventReview = INTERNAL_AGENTS_ENABLED || isEventReviewer;

  // Register device with OneSignal + link to user — runs once per session
  useOneSignal();

  const { trackScreen } = useAnalytics();

  return (
    <NavigationContainer
      onStateChange={(state) => {
        if (!state) return;
        // Walk to the deepest active route name for screen tracking
        let route: any = state.routes[state.index];
        while (route.state) {
          const nested = route.state;
          route = nested.routes[nested.index ?? 0];
        }
        trackScreen(route.name);
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session ? (
          <>
            <Stack.Screen name="App">
              {() => (
                <View style={{ flex: 1 }}>
                  <AppNavigator />
                  <FloatingHelpButton />
                </View>
              )}
            </Stack.Screen>
            <Stack.Screen
              name="AIHelpChat"
              component={AIHelpChatScreen}
              options={{ presentation: 'modal' }}
            />
            {INTERNAL_AGENTS_ENABLED ? (
              <Stack.Screen
                name="InternalAgents"
                component={InternalAgentsScreen}
                options={{ presentation: 'modal' }}
              />
            ) : null}
            {showClinicalReview ? (
              <Stack.Screen
                name="ClinicalReview"
                component={ClinicalReviewScreen}
                options={{ presentation: 'modal' }}
              />
            ) : null}
            {showEventReview ? (
              <Stack.Screen
                name="EventReview"
                component={EventReviewScreen}
                options={{ presentation: 'modal' }}
              />
            ) : null}
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// DEV tools pill has moved into MeScreen where it can be anchored directly
// below the Edit button without scrolling. See MeScreen.tsx DevPill component.
