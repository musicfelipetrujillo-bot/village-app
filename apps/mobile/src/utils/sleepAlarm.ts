// V5 Playbook tracker — wake-window alarm (best-effort local notification).
//
// When a nap starts we schedule a gentle "wake window reached" notification so
// mom doesn't let baby oversleep past the age-appropriate window. Everything is
// wrapped in try/catch + AsyncStorage so a scheduling failure (permission
// denied, SDK quirk) never blocks the in-app live timer, which is the real UX.
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WAKE_NOTIF_KEY = 'villie.tracker.wakeNotifId';

// Set once: show the alert even when the app is foregrounded.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }) as any,
  });
} catch { /* handler best-effort */ }

// Age-appropriate awake window (minutes) — a gentle ceiling, not medical advice.
export function wakeWindowMinutes(week: number): number {
  if (week <= 1) return 60;
  if (week <= 6) return 75;
  if (week <= 12) return 90;
  if (week <= 25) return 120;
  return 150;
}

export async function ensureNotifPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const req = await Notifications.requestPermissionsAsync();
    return req.granted;
  } catch {
    return false;
  }
}

// Schedule the wake alarm `minutesFromNow * 60 - alreadyElapsedSec` out. Cancels
// any prior one first. Stores the id so we can cancel on stop.
export async function scheduleWakeAlarm(secondsUntil: number, babyName: string): Promise<void> {
  try {
    await cancelWakeAlarm();
    if (secondsUntil <= 0) return;
    const ok = await ensureNotifPermission();
    if (!ok) return;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `${babyName || 'Baby'} has been asleep a while`,
        body: 'You\'ve hit the wake window — a gentle nudge in case you want to wake for the next feed.',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(secondsUntil), repeats: false } as any,
    });
    await AsyncStorage.setItem(WAKE_NOTIF_KEY, id);
  } catch { /* best-effort */ }
}

export async function cancelWakeAlarm(): Promise<void> {
  try {
    const id = await AsyncStorage.getItem(WAKE_NOTIF_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(WAKE_NOTIF_KEY);
    }
  } catch { /* best-effort */ }
}
