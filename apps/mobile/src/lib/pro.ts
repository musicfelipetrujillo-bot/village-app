// Villie Pro entitlement — placeholder until the V5 5.3 paywall + RevenueCat
// entitlement land. Everyone is free for now, so Pro-gated content (e.g.
// future Manual weeks) stays locked + teased.
//
// TODO(5.3): wire to the RevenueCat "pro" entitlement (same SDK the Gear Boost
// IAP introduces in Build 14) and/or a users.is_pro flag. Flip the env flag to
// '1' to simulate a Pro user in dev.
export function isProUser(): boolean {
  return process.env.EXPO_PUBLIC_PRO_ENABLED === '1';
}
