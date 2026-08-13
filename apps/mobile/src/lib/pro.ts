// villie pro — subscription entitlement + purchase orchestration (Build 14).
//
// Pro is a PAID DIGITAL SUBSCRIPTION, so Apple requires In-App Purchase /
// StoreKit (Guideline 3.1.1) — it ships in a native build, never an OTA.
// Same RevenueCat project + SDK as the Gear Boost consumable (lib/boost.ts);
// setup: docs/BUILD_14_PRO_IAP_RUNBOOK.md.
//
// Decisions (Felipe 2026-07-29): $6.99/mo + $49.99/yr, 7-day free trial on
// both, ALL Manual videos gate behind Pro, 52-week text stays free.
//
// Entitlement sources, in precedence order:
//   1. EXPO_PUBLIC_PRO_ENABLED='1' — dev/simulator override, never set in prod.
//   2. Last-known RevenueCat CustomerInfo (live; updated on configure,
//      purchase, restore, and listener pushes). Unlocks the UI instantly
//      after purchase.
//   3. users.is_pro from the profile store — written by the revenuecat-webhook
//      edge function. This is what the SERVER trusts: the gated RPCs
//      (migration 110) null out playback ids until the webhook lands, so
//      after a purchase we refetch the profile with a short retry.
import { useUserStore } from '../store/user';

export type ProPlan = 'monthly' | 'annual';

/** Display fallbacks only — live localized prices come from the store offering. */
export const PRO = {
  entitlementId: 'pro',
  products: {
    monthly: { productId: 'villie_pro_monthly', priceLabel: '$6.99/mo' },
    annual:  { productId: 'villie_pro_annual',  priceLabel: '$49.99/yr' },
  },
  trialDays: 7,
} as const;

/** Apple's subscription management sheet. The only place a user can cancel
 *  an auto-renewable — we must never imply cancellation happens in-app. */
export const MANAGE_SUBSCRIPTION_URL = 'https://apps.apple.com/account/subscriptions';

/** Off by default. Gates the paywall + purchase entry points so nothing
 *  leaks into OTA bundles that lack the StoreKit SDK. Flip to '1' in the
 *  Build 14 EAS env once ASC products + RevenueCat are configured.
 *  (EXPO_PUBLIC_PRO_SIMULATE='1' is the separate dev-only entitlement
 *  override — the old EXPO_PUBLIC_PRO_ENABLED simulate semantic moved there
 *  so the paywall itself stays testable in dev.) */
export function isProEnabled(): boolean {
  return process.env.EXPO_PUBLIC_PRO_ENABLED === '1';
}

// Last CustomerInfo-derived entitlement state. Module-level (not a store):
// read synchronously by isProUser(), written by the purchase/restore/refresh
// paths below. null = RevenueCat hasn't answered yet this session.
let rcEntitled: boolean | null = null;

export function isProUser(): boolean {
  if (__DEV__ && process.env.EXPO_PUBLIC_PRO_SIMULATE === '1') return true;
  if (rcEntitled !== null) return rcEntitled;
  return useUserStore.getState().profile?.is_pro === true;
}

export class ProUnavailableError extends Error {
  constructor(message = 'villie pro is launching soon.') {
    super(message);
    this.name = 'ProUnavailableError';
  }
}

export class ProCancelledError extends Error {
  constructor() {
    super('Purchase cancelled.');
    this.name = 'ProCancelledError';
  }
}

function readEntitlement(customerInfo: unknown): boolean {
  const info = customerInfo as {
    entitlements?: { active?: Record<string, unknown> };
  } | null;
  return Boolean(info?.entitlements?.active?.[PRO.entitlementId]);
}

// Dynamic import ONLY — react-native-purchases is a native module absent from
// OTA-only builds; a top-level import would crash launch (boost.ts pattern).
async function getPurchases() {
  if (!isProEnabled()) throw new ProUnavailableError();
  try {
    return (await import('react-native-purchases')).default;
  } catch {
    throw new ProUnavailableError();
  }
}

/** Called from App.tsx after auth resolves. Safe no-op when the SDK or flag
 *  is absent. Identifies the RC customer as our Supabase user id — the
 *  revenuecat-webhook and gear-boost-activate both key on that. */
export async function configureProPurchases(supabaseUserId: string): Promise<void> {
  try {
    const Purchases = await getPurchases();
    const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
    if (!apiKey) return;
    const configured = await Purchases.isConfigured();
    if (!configured) Purchases.configure({ apiKey });
    const { customerInfo } = await Purchases.logIn(supabaseUserId);
    rcEntitled = readEntitlement(customerInfo);
    Purchases.addCustomerInfoUpdateListener((info: unknown) => {
      rcEntitled = readEntitlement(info);
    });
  } catch (e) {
    if (!(e instanceof ProUnavailableError)) {
      console.warn('[pro] configure failed', (e as Error).message);
    }
  }
}

/** Live, storefront-localized pricing. Every price the paywall renders must
 *  come from StoreKit — the `$6.99 / $49.99` constants above are US-only and
 *  would be a lie in every other storefront (and Apple reviews for it). */
export type ProPricing = {
  monthly: { price: string };
  /** `perMonth` is the annual price ÷ 12 in the storefront currency — the
   *  "$4.17/mo" comparison line. Null when Intl can't format the currency. */
  annual: { price: string; perMonth: string | null };
  /** Whole-percent saving of annual vs 12× monthly. Null when it isn't a
   *  saving (misconfigured products) so the badge stays off rather than
   *  advertising "save -3%". */
  savingsPercent: number | null;
  /** False only when StoreKit says this Apple ID has already used the intro
   *  offer. Unknown answers stay true — the trial copy is the default and a
   *  returning subscriber is the exception. */
  trialEligible: boolean;
};

// react-native-purchases INTRO_ELIGIBILITY_STATUS: 0 unknown, 1 ineligible,
// 2 eligible, 3 no-intro-offer-exists.
const INTRO_INELIGIBLE = 1;
const INTRO_ELIGIBLE = 2;

function formatCurrency(amount: number, currencyCode: string): string | null {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
    }).format(amount);
  } catch {
    return null; // Hermes without full-ICU, or an unknown currency code.
  }
}

/** Reads the `current` offering. Returns null (not throws) whenever pricing
 *  can't be resolved — callers fall back to the PRO constants, which is the
 *  pre-existing behaviour, so a store hiccup never blanks the paywall. */
export async function fetchProPricing(): Promise<ProPricing | null> {
  try {
    const Purchases = await getPurchases();
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];
    const productOf = (id: string) =>
      packages.find(
        (p: { product: { identifier: string } }) => p.product.identifier === id,
      )?.product as
        | { priceString: string; price: number; currencyCode: string }
        | undefined;

    const monthly = productOf(PRO.products.monthly.productId);
    const annual = productOf(PRO.products.annual.productId);
    // Both plans or neither: a half-configured offering can't be priced
    // honestly, and purchasePro() would fail on the missing one anyway.
    if (!monthly || !annual) return null;

    const savings = 1 - annual.price / (monthly.price * 12);

    let trialEligible = true;
    try {
      const ids = [PRO.products.monthly.productId, PRO.products.annual.productId];
      const eligibility = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
      const statuses = ids.map((id) => eligibility?.[id]?.status);
      // Apple scopes intro eligibility to the subscription GROUP, so the two
      // products always agree — but read both and let an explicit "eligible"
      // win, so one stale/unknown entry can't suppress the trial copy.
      trialEligible =
        statuses.some((s) => s === INTRO_ELIGIBLE) ||
        !statuses.some((s) => s === INTRO_INELIGIBLE);
    } catch {
      // Eligibility is best-effort; keep the default trial copy.
    }

    return {
      monthly: { price: monthly.priceString },
      annual: {
        price: annual.priceString,
        perMonth: formatCurrency(annual.price / 12, annual.currencyCode),
      },
      savingsPercent: Number.isFinite(savings) && savings > 0
        ? Math.round(savings * 100)
        : null,
      trialEligible,
    };
  } catch {
    return null;
  }
}

/** After a grant, the server unlocks via the RevenueCat webhook. Poll the
 *  profile a few times so gated RPC content (video playback ids) appears
 *  without a manual refresh; UI entitlement is already live via rcEntitled. */
async function refetchProfileUntilPro(attempts = 4, delayMs = 2000): Promise<void> {
  const { fetchProfile } = useUserStore.getState();
  for (let i = 0; i < attempts; i++) {
    await new Promise((r) => setTimeout(r, delayMs));
    try {
      await fetchProfile();
      if (useUserStore.getState().profile?.is_pro) return;
    } catch { /* transient — keep polling */ }
  }
}

/** Purchase a Pro plan. Resolves true when the entitlement is active.
 *  Throws ProCancelledError on user cancel, ProUnavailableError when the
 *  SDK/offering isn't available (callers show "launching soon"). */
export async function purchasePro(plan: ProPlan): Promise<boolean> {
  const Purchases = await getPurchases();
  const offerings = await Purchases.getOfferings();
  const pkg = offerings.current?.availablePackages.find(
    (p: { product: { identifier: string } }) =>
      p.product.identifier === PRO.products[plan].productId,
  );
  if (!pkg) throw new ProUnavailableError();
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    rcEntitled = readEntitlement(customerInfo);
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) throw new ProCancelledError();
    throw e;
  }
  if (rcEntitled) void refetchProfileUntilPro();
  return rcEntitled === true;
}

/** App Store "Restore purchases" (required by Apple on every paywall). */
export async function restorePro(): Promise<boolean> {
  const Purchases = await getPurchases();
  const customerInfo = await Purchases.restorePurchases();
  rcEntitled = readEntitlement(customerInfo);
  if (rcEntitled) void refetchProfileUntilPro();
  return rcEntitled === true;
}
