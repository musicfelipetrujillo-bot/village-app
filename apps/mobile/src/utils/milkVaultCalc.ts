// V6 Milk Vault — pure calculation layer.
//
// Every number the dashboards, Keep-vs-Sell slider, and shipping workflow
// show is derived here from bags + settings. Kept dependency-free and pure
// so the math is trivially testable and identical across screens.
//
// IMPORTANT posture: payout / value figures are ESTIMATES for planning only.
// Nothing here moves money. See the legal copy surfaced in the app.

import type { MilkVaultBag, MilkVaultSettings } from '@api/milkVault';

// Statuses that count as physically still in the freezer.
export const IN_FREEZER_STATUSES = ['stored', 'reserved', 'available'] as const;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function isInFreezer(b: MilkVaultBag): boolean {
  return (IN_FREEZER_STATUSES as readonly string[]).includes(b.status);
}

function sumOz(bags: MilkVaultBag[]): number {
  return round1(bags.reduce((acc, b) => acc + (Number(b.ounces) || 0), 0));
}

/** Round to 1 decimal place, avoiding floating-point fuzz. */
export function round1(n: number): number {
  return Math.round((n + Number.EPSILON) * 10) / 10;
}

/** Round to whole dollars/units. */
export function round0(n: number): number {
  return Math.round(n);
}

// ─────────────────────────────────────────────────────────────────────────
// Core dashboard metrics (both modes)
// ─────────────────────────────────────────────────────────────────────────

export interface VaultCoreStats {
  totalFreezerOz: number;
  totalBags: number;
  averageDailyIntakeOz: number;
  babyCoverageDays: number;
  stashGoalOz: number;
  stashGoalProgress: number;       // 0..1 (can exceed 1)
  oldestMilkDate: string | null;   // ISO of oldest in-freezer bag (by frozen_at)
  weeklyOuncesAdded: number;       // sum ounces logged (created) in last 7 days
  lifetimeMilkLoggedOz: number;    // every bag ever logged
  nextBagsToUse: MilkVaultBag[];   // oldest-first, in-freezer, up to 5
}

export function computeCoreStats(
  bags: MilkVaultBag[],
  settings: MilkVaultSettings,
  now: Date = new Date(),
): VaultCoreStats {
  const inFreezer = bags.filter(isInFreezer);
  const totalFreezerOz = sumOz(inFreezer);
  const totalBags = inFreezer.length;

  const intake = Number(settings.average_daily_intake_oz) || 0;
  const babyCoverageDays = intake > 0 ? Math.floor(totalFreezerOz / intake) : 0;

  const stashGoalOz = round1((settings.stash_goal_days || 0) * intake);
  const stashGoalProgress = stashGoalOz > 0 ? totalFreezerOz / stashGoalOz : 0;

  // Oldest milk = smallest frozen_at among in-freezer bags.
  let oldestMilkDate: string | null = null;
  for (const b of inFreezer) {
    if (!oldestMilkDate || b.frozen_at < oldestMilkDate) oldestMilkDate = b.frozen_at;
  }

  const weekAgo = new Date(now.getTime() - 7 * MS_PER_DAY);
  const weeklyOuncesAdded = round1(
    bags
      .filter((b) => new Date(b.created_at) >= weekAgo)
      .reduce((acc, b) => acc + (Number(b.ounces) || 0), 0),
  );

  const lifetimeMilkLoggedOz = sumOz(bags);

  const nextBagsToUse = [...inFreezer]
    .sort((a, b) => a.frozen_at.localeCompare(b.frozen_at))
    .slice(0, 5);

  return {
    totalFreezerOz,
    totalBags,
    averageDailyIntakeOz: intake,
    babyCoverageDays,
    stashGoalOz,
    stashGoalProgress,
    oldestMilkDate,
    weeklyOuncesAdded,
    lifetimeMilkLoggedOz,
    nextBagsToUse,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Marketplace metrics (marketplace mode only)
// ─────────────────────────────────────────────────────────────────────────

export interface VaultMarketplaceStats {
  reservedOz: number;          // desired_reserve_days * intake, capped at total
  availableOz: number;         // max(total - reserved, 0)
  estimatedPayout: number;     // availableOz * price_per_oz
  estimatedLowValue: number;   // availableOz * low_price_per_oz
  estimatedPremiumValue: number; // availableOz * premium_price_per_oz
}

export function computeMarketplaceStats(
  core: VaultCoreStats,
  settings: MilkVaultSettings,
): VaultMarketplaceStats {
  const intake = Number(settings.average_daily_intake_oz) || 0;
  const rawReserved = round1((settings.desired_reserve_days || 0) * intake);
  // Never claim to reserve more than we actually have in the freezer.
  const reservedOz = Math.min(rawReserved, core.totalFreezerOz);
  const availableOz = round1(Math.max(core.totalFreezerOz - reservedOz, 0));

  return {
    reservedOz,
    availableOz,
    estimatedPayout: round0(availableOz * (Number(settings.price_per_oz) || 0)),
    estimatedLowValue: round0(availableOz * (Number(settings.low_price_per_oz) || 0)),
    estimatedPremiumValue: round0(availableOz * (Number(settings.premium_price_per_oz) || 0)),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Keep-vs-Sell slider
// ─────────────────────────────────────────────────────────────────────────

export interface KeepSellInputs {
  totalOz: number;
  averageDailyIntakeOz: number;
  desiredReserveDays: number;
  pricePerOz: number;
  keepOz: number; // slider position (0..totalOz)
}

export interface KeepSellResult {
  keepOz: number;
  availableOz: number;
  babyCoveredDays: number;      // days the KEPT milk covers
  estimatedPayout: number;      // availableOz * pricePerOz
  desiredReserveOz: number;     // reference line
  belowReserve: boolean;        // keepOz < desiredReserveOz
  reserveShortfallDays: number; // how many days short of the desired reserve
}

export function computeKeepSell(input: KeepSellInputs): KeepSellResult {
  const intake = input.averageDailyIntakeOz || 0;
  const keepOz = clamp(input.keepOz, 0, input.totalOz);
  const availableOz = round1(input.totalOz - keepOz);
  const babyCoveredDays = intake > 0 ? Math.floor(keepOz / intake) : 0;
  const desiredReserveOz = round1(input.desiredReserveDays * intake);
  const belowReserve = keepOz < desiredReserveOz;
  const reserveShortfallDays =
    intake > 0 ? Math.max(0, Math.ceil((desiredReserveOz - keepOz) / intake)) : 0;

  return {
    keepOz: round1(keepOz),
    availableOz,
    babyCoveredDays,
    estimatedPayout: round0(availableOz * (input.pricePerOz || 0)),
    desiredReserveOz,
    belowReserve,
    reserveShortfallDays,
  };
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ─────────────────────────────────────────────────────────────────────────
// Shipping / marketplace money split
// ─────────────────────────────────────────────────────────────────────────

export type ShippingResponsibility =
  | 'buyer_pays'
  | 'seller_pays'
  | 'split'
  | 'deduct_from_payout';

export interface ShippingCostInputs {
  availableOz: number;
  pricePerOz: number;
  supplyCost: number;
  carrierCost: number;
  responsibility: ShippingResponsibility;
}

export interface ShippingSplitResult {
  milkSubtotal: number;
  shippingCost: number; // supply + carrier
  buyerTotal: number;
  sellerPayout: number;
}

/**
 * Encodes the exact split rules from the spec:
 *   buyer_pays / deduct_from_payout → buyer covers shipping, seller keeps subtotal
 *   seller_pays                     → buyer pays subtotal, seller eats shipping
 *   split                           → shipping shared 50/50
 */
export function computeShippingSplit(input: ShippingCostInputs): ShippingSplitResult {
  const milkSubtotal = round0(input.availableOz * (input.pricePerOz || 0));
  const shippingCost = round0((input.supplyCost || 0) + (input.carrierCost || 0));

  let buyerTotal: number;
  let sellerPayout: number;

  switch (input.responsibility) {
    case 'seller_pays':
      buyerTotal = milkSubtotal;
      sellerPayout = milkSubtotal - shippingCost;
      break;
    case 'split':
      buyerTotal = milkSubtotal + shippingCost / 2;
      sellerPayout = milkSubtotal - shippingCost / 2;
      break;
    case 'buyer_pays':
    case 'deduct_from_payout':
    default:
      // Both of these: buyer is billed shipping on top, seller keeps subtotal.
      buyerTotal = milkSubtotal + shippingCost;
      sellerPayout = milkSubtotal;
      break;
  }

  return {
    milkSubtotal,
    shippingCost,
    buyerTotal: round0(buyerTotal),
    sellerPayout: round0(sellerPayout),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Stash-goal ETA — "at your current pace you'll reach your goal by <date>"
// ─────────────────────────────────────────────────────────────────────────

/**
 * Projects the date the stash goal is reached using the last-7-day pace.
 * Returns null when already at/over goal, or when there's no recent pace to
 * extrapolate from.
 */
export function projectStashGoalDate(
  core: VaultCoreStats,
  now: Date = new Date(),
): Date | null {
  if (core.stashGoalOz <= 0) return null;
  if (core.totalFreezerOz >= core.stashGoalOz) return null;
  const perDay = core.weeklyOuncesAdded / 7;
  if (perDay <= 0) return null;
  const remaining = core.stashGoalOz - core.totalFreezerOz;
  const days = Math.ceil(remaining / perDay);
  if (days > 3650) return null; // pace too slow to be a meaningful ETA
  return new Date(now.getTime() + days * MS_PER_DAY);
}

/**
 * Days until the baby-coverage reserve target (e.g. "3 days away from your
 * 30-day reserve"). Positive = that many days of building left; 0 = reached.
 */
export function daysToReserveTarget(
  core: VaultCoreStats,
  reserveDays: number,
  now: Date = new Date(),
): number | null {
  const targetOz = reserveDays * core.averageDailyIntakeOz;
  if (targetOz <= 0) return null;
  if (core.totalFreezerOz >= targetOz) return 0;
  const perDay = core.weeklyOuncesAdded / 7;
  if (perDay <= 0) return null;
  return Math.ceil((targetOz - core.totalFreezerOz) / perDay);
}

// ─────────────────────────────────────────────────────────────────────────
// Lifetime rollups from the transaction ledger
// ─────────────────────────────────────────────────────────────────────────

export interface VaultLifetimeRollup {
  soldOz: number;
  donatedOz: number;
  usedOz: number;
  lifetimeEarnings: number;
}

export function computeLifetimeRollup(
  txns: { transaction_type: string; ounces: number; total_amount: number | null }[],
): VaultLifetimeRollup {
  let soldOz = 0, donatedOz = 0, usedOz = 0, lifetimeEarnings = 0;
  for (const t of txns) {
    const oz = Number(t.ounces) || 0;
    if (t.transaction_type === 'sold') {
      soldOz += oz;
      lifetimeEarnings += Number(t.total_amount) || 0;
    } else if (t.transaction_type === 'donated') {
      donatedOz += oz;
    } else if (t.transaction_type === 'used') {
      usedOz += oz;
    }
  }
  return {
    soldOz: round1(soldOz),
    donatedOz: round1(donatedOz),
    usedOz: round1(usedOz),
    lifetimeEarnings: round0(lifetimeEarnings),
  };
}
