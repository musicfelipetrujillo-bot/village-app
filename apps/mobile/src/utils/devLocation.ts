// Dev-mode location helper.
//
// The iOS Simulator reports its default GPS as Cupertino, CA — which fights
// the Miami-launching market for every map and "near me" search in the app.
// In production on a real device, real GPS is correct. So in __DEV__ we
// override device coords with Miami unless the dev explicitly opts back into
// device GPS via EXPO_PUBLIC_USE_DEVICE_LOCATION=1 (handy when QA-ing a
// non-Miami market).
//
// All call sites that previously did:
//   const { status } = await Location.requestForegroundPermissionsAsync();
//   if (status === 'granted') { const loc = await Location.getCurrentPositionAsync(); ... }
// should funnel through `getEffectiveCoords()` instead.

// Miami is the canonical launch market — used as both the dev override and
// the production permission-denied fallback. Coords match the longstanding
// MIAMI_LAT/LNG constants embedded across map screens.
import * as Location from 'expo-location';

import { getZipCoords } from '@store/user';

export const MIAMI_COORDS = { lat: 25.7617, lng: -80.1918 };

const USE_DEVICE_LOCATION = process.env.EXPO_PUBLIC_USE_DEVICE_LOCATION === '1';

/**
 * Returns the lat/lng we should treat as the user's location. In __DEV__,
 * this is Miami unless `EXPO_PUBLIC_USE_DEVICE_LOCATION=1` is set, so the
 * Simulator's Cupertino default doesn't pollute every map. In production,
 * the device coords are returned as-is.
 *
 * Pass the result of `Location.getCurrentPositionAsync()` (or null if
 * permission was denied / the call failed) and we'll do the right thing.
 */
export function getEffectiveCoords(
  deviceCoords: { latitude: number; longitude: number } | null,
): { lat: number; lng: number } {
  if (__DEV__ && !USE_DEVICE_LOCATION) {
    return MIAMI_COORDS;
  }
  if (deviceCoords) {
    return { lat: deviceCoords.latitude, lng: deviceCoords.longitude };
  }
  // Permission denied / location call failed. Prefer the mother's OWN stated
  // ZIP over the launch-market default — we already collect `users.zip_code`
  // at onboarding, and returning downtown-Miami coords to a mother in Hialeah
  // (or anywhere outside Miami) quietly gave her the wrong "near me" results
  // across Care, Milk, Gear and Villie Plans. Resolved once per session by
  // useUserStore.resolveZipCoords(); null until then, or when she left the
  // ZIP blank, in which case the launch market is still the best guess.
  const zip = getZipCoords();
  if (zip) return { lat: zip.lat, lng: zip.lng };
  return MIAMI_COORDS;
}

/**
 * Convenience wrapper for screens that want to mark whether the returned
 * coords represent a real user fix (so the map can render the blue "you are
 * here" dot) vs. a fallback. In dev-override mode the dot is hidden so the
 * Miami-ified view doesn't look like the user is actually in Miami.
 */
export function getEffectiveCoordsWithSource(
  deviceCoords: { latitude: number; longitude: number } | null,
): { lat: number; lng: number; isRealFix: boolean } {
  const coords = getEffectiveCoords(deviceCoords);
  const isRealFix =
    deviceCoords != null &&
    !(__DEV__ && !USE_DEVICE_LOCATION);
  return { ...coords, isRealFix };
}

/**
 * How long we'll wait for the OS to produce a position fix before giving up
 * and using the fallback chain (the mother's ZIP, else the launch market).
 *
 * Six seconds because the failure this bounds is not "the call never returns"
 * — it eventually does. On a cold start `getCurrentPositionAsync` took 20-30s
 * to answer, and for that entire window the donor map sat there stating
 * "0 nearby" with an empty map while three donors were in fact a few miles
 * away. A confident wrong answer is worse than a slow one: a mother reads it,
 * believes it, and leaves. Every caller already has a perfectly good fallback
 * that resolves instantly, so waiting longer than a few seconds buys accuracy
 * nobody is still on the screen to see.
 */
const POSITION_TIMEOUT_MS = 6000;

/**
 * Ask the OS where we are, without ever hanging the caller.
 *
 * Returns device coords, or `null` when permission was refused, the fix timed
 * out, or the call failed — the three cases every caller already collapses
 * into "use the fallback". Never throws, never blocks longer than
 * POSITION_TIMEOUT_MS.
 *
 * Feed the result straight into `getEffectiveCoords` /
 * `getEffectiveCoordsWithSource`.
 *
 * Note the dev shortcut: in __DEV__ without EXPO_PUBLIC_USE_DEVICE_LOCATION,
 * `getEffectiveCoords` discards the device fix and returns Miami anyway, so
 * asking the OS at all is pure latency. We skip it.
 */
export async function getDeviceCoordsSafely(): Promise<
  { latitude: number; longitude: number } | null
> {
  if (__DEV__ && !USE_DEVICE_LOCATION) return null;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), POSITION_TIMEOUT_MS);
      }),
    ]).finally(() => { if (timer) clearTimeout(timer); });

    return position ? position.coords : null;
  } catch {
    // Permission dialog dismissed, location services off, hardware error —
    // all the same answer to the caller.
    return null;
  }
}

/**
 * The passive variant, for screens that decorate rather than gate: a city
 * label, a chat's location context, a "near you" rail.
 *
 * Differs from `getDeviceCoordsSafely` in two ways. It only *checks* an
 * existing permission grant instead of prompting — these callers must never
 * raise a system dialog on their own — and it prefers the OS's last known
 * position, which returns instantly when there is one.
 *
 * The live-fix fallback is bounded for the same reason as above: the callers
 * that used it passed no accuracy option at all, which means
 * `Location.Accuracy.High` — the slowest mode there is — for a value they use
 * to print a city name.
 */
export async function getDeviceCoordsFast(): Promise<
  { latitude: number; longitude: number } | null
> {
  if (__DEV__ && !USE_DEVICE_LOCATION) return null;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown) return lastKnown.coords;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), POSITION_TIMEOUT_MS);
      }),
    ]).finally(() => { if (timer) clearTimeout(timer); });

    return position ? position.coords : null;
  } catch {
    return null;
  }
}
