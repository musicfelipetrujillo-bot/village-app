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
  // Permission denied / location call failed — fall back to Miami in prod too.
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
