// V6 Milk Vault — AI-style insight card copy.
//
// Deterministic, on-device sentence generation from the computed stats. These
// read like the AI examples in the spec but need no network round-trip, so the
// dashboard always has something warm to say.

import type { MilkVaultSettings } from '@api/milkVault';
import {
  type VaultCoreStats, type VaultMarketplaceStats,
  projectStashGoalDate, daysToReserveTarget,
} from '@utils/milkVaultCalc';

export interface Insight { emoji: string; text: string }

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function shortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function daysAgo(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((now.getTime() - d.getTime()) / MS_PER_DAY);
}

export function personalInsights(
  core: VaultCoreStats,
  settings: MilkVaultSettings,
  now: Date = new Date(),
): Insight[] {
  const out: Insight[] = [];

  if (core.totalFreezerOz > 0) {
    out.push({
      emoji: '🍼',
      text: `You have enough milk saved for approximately ${core.babyCoverageDays} ${core.babyCoverageDays === 1 ? 'day' : 'days'}.`,
    });
  }

  // Progress toward the reserve target.
  const toReserve = daysToReserveTarget(core, settings.desired_reserve_days, now);
  if (toReserve != null && toReserve > 0 && toReserve <= 60) {
    out.push({
      emoji: '📈',
      text: `You're about ${toReserve} ${toReserve === 1 ? 'day' : 'days'} away from your ${settings.desired_reserve_days}-day milk reserve.`,
    });
  } else if (toReserve === 0) {
    out.push({
      emoji: '🎉',
      text: `You've reached your ${settings.desired_reserve_days}-day reserve. Beautiful work.`,
    });
  }

  if (core.weeklyOuncesAdded > 0) {
    out.push({ emoji: '✨', text: `You added ${core.weeklyOuncesAdded} oz this week.` });
  }

  const goalDate = projectStashGoalDate(core, now);
  if (goalDate) {
    out.push({
      emoji: '🎯',
      text: `At your current pace, you'll reach your ${settings.stash_goal_days}-day stash goal by ${shortDate(goalDate.toISOString())}.`,
    });
  }

  const oldAge = daysAgo(core.oldestMilkDate, now);
  if (core.oldestMilkDate && oldAge != null && oldAge >= 30) {
    out.push({
      emoji: '🕰️',
      text: `Your oldest milk is from ${shortDate(core.oldestMilkDate)}. Consider rotating it in soon.`,
    });
  }

  return out;
}

export function marketplaceInsights(
  core: VaultCoreStats,
  mkt: VaultMarketplaceStats,
  settings: MilkVaultSettings,
): Insight[] {
  const out: Insight[] = [];

  if (mkt.availableOz > 0) {
    out.push({
      emoji: '💛',
      text: `You could share ${mkt.availableOz} oz and still keep a ${settings.desired_reserve_days}-day reserve for your baby.`,
    });
    out.push({
      emoji: '💵',
      text: `Your estimated payout is $${mkt.estimatedPayout} at $${settings.price_per_oz.toFixed(2)}/oz.`,
    });
    out.push({
      emoji: '📦',
      text: `If the buyer pays shipping, your payout stays the same — $${mkt.estimatedPayout}.`,
    });
  } else {
    out.push({
      emoji: '🛡️',
      text: `Right now your whole stash is protecting your baby's ${settings.desired_reserve_days}-day reserve. Nothing extra to share yet — and that's perfect.`,
    });
  }

  return out;
}
