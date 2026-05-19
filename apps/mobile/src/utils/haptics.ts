import * as Haptics from 'expo-haptics';

/** Light tap — primary CTAs, chip selections, row taps. */
export function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Medium impact — confirm actions (RSVP, submit, claim). */
export function confirm() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
}

/** Success notification — completion screens (booking confirm, order confirm). */
export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
