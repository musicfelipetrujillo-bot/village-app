// Registers device with OneSignal and links to Supabase user_id (external_id).
// Call once from RootNavigator after session is confirmed.
// OneSignal SDK (react-native-onesignal) must be listed in app.json plugins.
// Uses v5 API (OneSignal.initialize, OneSignal.login, OneSignal.Notifications.*, OneSignal.User.*).
//
// Tag sync (post-A2.b): pushes profile + notif_prefs onto the device record
// so future segmented campaigns (e.g. "Spanish-speaking 2nd-trimester users
// who haven't opted out of articles") can be set up from the OneSignal
// dashboard without writing new edge functions. Tags are strings — booleans
// are serialized as 'true'/'false'.

import { useEffect } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useAuthStore } from '@store/auth';
import { useUserStore } from '@store/user';

const ONESIGNAL_APP_ID = process.env.EXPO_PUBLIC_ONESIGNAL_APP_ID ?? '';
// OneSignal requires a custom dev/prod build — native module is not present in Expo Go.
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export function useOneSignal() {
  const user = useAuthStore((s) => s.user);
  const profile = useUserStore((s) => s.profile);

  useEffect(() => {
    if (!ONESIGNAL_APP_ID || IS_EXPO_GO) return;

    // Lazy-require so the native TurboModule is never looked up in Expo Go.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OneSignal } = require('react-native-onesignal');

    OneSignal.initialize(ONESIGNAL_APP_ID);
    OneSignal.Notifications.requestPermission(true);

    const handler = (event: { notification: { additionalData?: Record<string, string> } }) => {
      console.log('[OneSignal] Notification opened:', event.notification.additionalData);
    };
    OneSignal.Notifications.addEventListener('click', handler);
    return () => OneSignal.Notifications.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (!user?.id || !ONESIGNAL_APP_ID || IS_EXPO_GO) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OneSignal } = require('react-native-onesignal');
    OneSignal.login(user.id);
    OneSignal.User.addTag('user_id', user.id);
  }, [user?.id]);

  // Re-sync tags whenever the profile object changes (after fetchProfile,
  // after a settings write, etc.). Cheap to call repeatedly — OneSignal
  // dedupes server-side. We never PII-leak through tags: stage/language are
  // already present in OneSignal external_id metadata, and notif_prefs are
  // user-set switches, not derived behavior.
  useEffect(() => {
    if (!user?.id || !profile || !ONESIGNAL_APP_ID || IS_EXPO_GO) return;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OneSignal } = require('react-native-onesignal');

    const np = profile.notif_prefs;
    const tags: Record<string, string> = {
      // Profile-derived dimensions for marketing segmentation.
      pregnancy_stage: profile.pregnancy_stage ?? '',
      preferred_language: profile.preferred_language ?? 'en',

      // Notif prefs — name them `pref_*` so they're easy to filter on
      // (e.g. `pref_promotions = "true"`).
      pref_events:      String(np.events),
      pref_groups:      String(np.groups),
      pref_specialists: String(np.specialists),
      pref_milk_hub:    String(np.milk_hub),
      pref_articles:    String(np.articles),
      pref_ai:          String(np.ai),
      pref_promotions:  String(np.promotions),

      // Quiet hours surface as flags only — full window logic lives
      // server-side in supabase/functions/_shared/quiet-hours.ts.
      quiet_hours_enabled: String(np.quiet_hours.enabled),
    };

    // OneSignal v5 supports `addTags(object)` — single round-trip.
    OneSignal.User.addTags(tags);
  }, [user?.id, profile]);
}
