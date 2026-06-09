// Gear "Boost listing" — paid promotion purchase orchestration (Gear only).
//
// Boost is a PAID IN-APP DIGITAL SERVICE, so Apple requires it go through
// In-App Purchase / StoreKit (Guideline 3.1.1) — NOT Stripe, and NOT an OTA.
// It ships in a native build (Build 14). This module keeps the purchase flow
// in one place behind a feature flag so the rest of the app stays clean and
// the entry points stay invisible until the native SDK + IAP product are live.
//
// Build 14 wiring + App Store Connect / RevenueCat setup: docs/V4_GEAR_BOOST_RUNBOOK.md
import { activateGearBoost, type ActivateGearBoostResult } from '@api/gear';

/** Boost product config. Price label is a display fallback — the live, localized
 *  price comes from the store at purchase time. duration_days mirrors the
 *  product id and the DB default in migration 074. */
export const GEAR_BOOST = {
  productId: 'gear_boost_7d',
  durationDays: 7,
  priceLabel: '$2.99',
} as const;

/** Off by default. Gates every boost entry point so nothing leaks into the
 *  current OTA build (which has no StoreKit SDK). Flip to '1' in the Build 14
 *  EAS env once the IAP product + RevenueCat are configured. */
export function isGearBoostEnabled(): boolean {
  return process.env.EXPO_PUBLIC_GEAR_BOOST_ENABLED === '1';
}

export class BoostUnavailableError extends Error {
  constructor(message = 'Boost is launching soon.') {
    super(message);
    this.name = 'BoostUnavailableError';
  }
}

export class BoostCancelledError extends Error {
  constructor() {
    super('Purchase cancelled.');
    this.name = 'BoostCancelledError';
  }
}

/**
 * Purchase a boost via the store, then activate it server-side.
 *
 * Build 14 implementation (do the native import *inside* this function — never
 * at module scope; react-native-purchases is a native module absent from
 * OTA-only builds and a top-level import would crash launch):
 *
 *   const Purchases = (await import('react-native-purchases')).default;
 *   const offerings = await Purchases.getOfferings();
 *   const pkg = offerings.current?.availablePackages.find(p => p.product.identifier === GEAR_BOOST.productId);
 *   if (!pkg) throw new BoostUnavailableError();
 *   let result;
 *   try { result = await Purchases.purchasePackage(pkg); }
 *   catch (e) { if (e.userCancelled) throw new BoostCancelledError(); throw e; }
 *   const txnId = result.transaction?.transactionIdentifier;
 *   return activateGearBoost({ listing_id: listingId, platform_transaction_id: txnId, product_id: GEAR_BOOST.productId });
 *
 * Until then this throws so the UI shows a "launching soon" state. Callers
 * should catch BoostUnavailableError / BoostCancelledError distinctly.
 */
export async function purchaseGearBoost(_listingId: string): Promise<ActivateGearBoostResult> {
  throw new BoostUnavailableError();
}
