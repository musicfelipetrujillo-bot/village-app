import React from 'react';
import { TouchableOpacity, Text, View } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
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

export function RootNavigator() {
  const session = useAuthStore((s) => s.session);
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
                  {(INTERNAL_AGENTS_ENABLED || showClinicalReview || showEventReview) ? (
                    <DevToolsLauncher
                      enableAgents={INTERNAL_AGENTS_ENABLED}
                      enableClinicalReview={showClinicalReview}
                      enableEventReview={showEventReview}
                    />
                  ) : null}
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

// Consolidated dev-tools launcher. Replaces the prior trio of stacked AGT/CLN/EVT
// pills which crowded the top-right of every screen and read as visual noise
// during UI analysis. Now: a single small "DEV" badge that expands to show
// only the role-gated tools the current user has access to. Tap "DEV" once to
// open, tap again (or tap any role) to close.
//
// All three role-gated screens (InternalAgents / ClinicalReview / EventReview)
// remain isolated behind their own server-side checks — the consolidation is
// purely a UI grouping; nothing about the access boundary changes.
function DevToolsLauncher({
  enableAgents,
  enableClinicalReview,
  enableEventReview,
}: {
  enableAgents: boolean;
  enableClinicalReview: boolean;
  enableEventReview: boolean;
}) {
  const navigation = useNavigation<any>();
  const [open, setOpen] = React.useState(false);

  const go = (route: string) => {
    setOpen(false);
    navigation.navigate(route);
  };

  return (
    <View
      style={{
        position: 'absolute',
        top: 52,
        // Offset clears the notification bell in the right rail of header
        // surfaces (HomeScreen + Inbox); 72px lands DEV pill in the dead zone
        // between the bell and the right edge.
        right: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
      pointerEvents="box-none"
    >
      {open ? (
        <>
          {enableAgents ? (
            <DevPill label="AGT" bg="#1C1008" fg="#E6D8C4" onPress={() => go('InternalAgents')} a11y="Open internal agents console" />
          ) : null}
          {enableClinicalReview ? (
            <DevPill label="CLN" bg="#5C6B3A" fg="#FDFAF5" onPress={() => go('ClinicalReview')} a11y="Open clinical-advisor review dashboard" />
          ) : null}
          {enableEventReview ? (
            <DevPill label="EVT" bg="#C4A35A" fg="#1C1008" onPress={() => go('EventReview')} a11y="Open event-ingest review dashboard" />
          ) : null}
        </>
      ) : null}
      <DevPill
        label={open ? '×' : 'DEV'}
        bg="#2C1A0E"
        fg="#FDFAF5"
        onPress={() => setOpen((v) => !v)}
        a11y={open ? 'Close dev tools menu' : 'Open dev tools menu'}
      />
    </View>
  );
}

function DevPill({
  label, bg, fg, onPress, a11y,
}: { label: string; bg: string; fg: string; onPress: () => void; a11y: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={{
        backgroundColor: bg,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        opacity: 0.85,
      }}
    >
      <Text style={{ color: fg, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
