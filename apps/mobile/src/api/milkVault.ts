import { supabase } from '@/lib/supabase';

// ── Milk Vault: personal freezer-stash tracker (migration 099) ─────────
//
// Two modes share this data layer. Phase 1 surfaces only Personal Stash Mode in the UI;
// Marketplace helpers (pricing/keep-vs-sell/shipping) come in Phase 2 and are gated behind
// EXPO_PUBLIC_MILK_VAULT_MARKETPLACE. Diet/lifestyle tags are NOT stored per-bag — they
// come from the parent profile (see migration 099 header).

export type MilkVaultMode = 'personal_stash' | 'marketplace';

export type MilkBagStatus =
  | 'stored'
  | 'reserved'
  | 'available'
  | 'sold'
  | 'donated'
  | 'used'
  | 'expired';

// Statuses that still count as milk physically in the freezer.
export const IN_FREEZER_STATUSES: MilkBagStatus[] = ['stored', 'reserved', 'available'];

export interface MilkBag {
  id: string;
  user_id: string;
  baby_id: string | null;
  ounces: number;
  pumped_at: string;   // YYYY-MM-DD
  frozen_at: string;   // YYYY-MM-DD
  notes: string | null;
  photo_url: string | null;
  ai_extracted_data: MilkBagExtraction | null;
  status: MilkBagStatus;
  created_at: string;
  updated_at: string;
}

export interface MilkVaultSettings {
  id: string;
  user_id: string;
  baby_id: string | null;
  mode: MilkVaultMode;
  average_daily_intake_oz: number;
  stash_goal_days: number;
  desired_reserve_days: number;
  price_per_oz: number;
  low_price_per_oz: number;
  premium_price_per_oz: number;
  default_fulfillment_method:
    | 'local_pickup' | 'local_dropoff' | 'ship_to_buyer' | 'donate_locally' | 'donate_by_shipping';
  default_shipping_payment_responsibility:
    | 'buyer_pays' | 'seller_pays' | 'split' | 'deduct_from_payout';
  created_at: string;
  updated_at: string;
}

const BAG_COLUMNS =
  'id, user_id, baby_id, ounces, pumped_at, frozen_at, notes, photo_url, ' +
  'ai_extracted_data, status, created_at, updated_at';

const SETTINGS_COLUMNS =
  'id, user_id, baby_id, mode, average_daily_intake_oz, stash_goal_days, ' +
  'desired_reserve_days, price_per_oz, low_price_per_oz, premium_price_per_oz, ' +
  'default_fulfillment_method, default_shipping_payment_responsibility, created_at, updated_at';

// ── Settings ───────────────────────────────────────────────────────────

/** Returns null when the user has never onboarded → caller shows the mode picker. */
export async function getMyVaultSettings(userId: string): Promise<MilkVaultSettings | null> {
  const { data, error } = await supabase
    .from('milk_vault_settings')
    .select(SETTINGS_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as MilkVaultSettings) ?? null;
}

/** Called from the mode picker on first open. Creates the settings row. */
export async function createVaultSettings(input: {
  user_id: string;
  baby_id?: string | null;
  mode: MilkVaultMode;
}): Promise<MilkVaultSettings> {
  const { data, error } = await supabase
    .from('milk_vault_settings')
    .insert({ user_id: input.user_id, baby_id: input.baby_id ?? null, mode: input.mode })
    .select(SETTINGS_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as MilkVaultSettings;
}

export async function updateVaultSettings(
  settingsId: string,
  updates: Partial<Omit<MilkVaultSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<MilkVaultSettings> {
  const { data, error } = await supabase
    .from('milk_vault_settings')
    .update(updates)
    .eq('id', settingsId)
    .select(SETTINGS_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as MilkVaultSettings;
}

// ── Bags (manual add + scanner) ────────────────────────────────────────

export async function getMyBags(userId: string): Promise<MilkBag[]> {
  const { data, error } = await supabase
    .from('milk_bags')
    .select(BAG_COLUMNS)
    .eq('user_id', userId)
    .order('frozen_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MilkBag[];
}

export interface AddBagInput {
  user_id: string;
  baby_id?: string | null;
  ounces: number;
  pumped_at: string;          // YYYY-MM-DD
  frozen_at?: string | null;  // defaults to pumped_at when blank
  notes?: string | null;
  photo_url?: string | null;
  ai_extracted_data?: MilkBagExtraction | null;
}

export async function addBag(input: AddBagInput): Promise<MilkBag> {
  const row = {
    user_id: input.user_id,
    baby_id: input.baby_id ?? null,
    ounces: input.ounces,
    pumped_at: input.pumped_at,
    // Default logic: an empty frozen date means "frozen the day it was pumped".
    frozen_at: input.frozen_at?.trim() ? input.frozen_at : input.pumped_at,
    notes: input.notes?.trim() || null,
    photo_url: input.photo_url ?? null,
    ai_extracted_data: input.ai_extracted_data ?? null,
    status: 'stored' as MilkBagStatus,
  };
  const { data, error } = await supabase
    .from('milk_bags')
    .insert(row)
    .select(BAG_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as MilkBag;
}

export async function updateBag(
  bagId: string,
  updates: Partial<Pick<MilkBag, 'ounces' | 'pumped_at' | 'frozen_at' | 'notes' | 'status'>>,
): Promise<MilkBag> {
  const { data, error } = await supabase
    .from('milk_bags')
    .update(updates)
    .eq('id', bagId)
    .select(BAG_COLUMNS)
    .single();
  if (error) throw error;
  return data as unknown as MilkBag;
}

export async function deleteBag(bagId: string): Promise<void> {
  const { error } = await supabase.from('milk_bags').delete().eq('id', bagId);
  if (error) throw error;
}

// ── AI bag scanner (STUB — Phase 1) ────────────────────────────────────
// Wire-complete UI, mocked extraction until the milk-bag-scan vision edge function
// (mirrors gear-vision-identify) is built + deployed. Gated so flipping to the real
// call is a one-line change.

export interface MilkBagExtraction {
  ounces: number | null;
  pumped_at: string | null;   // YYYY-MM-DD
  frozen_at: string | null;   // YYYY-MM-DD
  notes: string | null;
  confidence: number;         // 0..1
}

const SCANNER_LIVE = process.env.EXPO_PUBLIC_MILK_VAULT_SCANNER === '1';

export async function scanMilkBag(input: {
  image_base64: string;
  image_media_type: 'image/jpeg' | 'image/png' | 'image/webp';
}): Promise<MilkBagExtraction> {
  if (!SCANNER_LIVE) {
    // Stub: return an empty extraction so the confirmation screen opens with blank,
    // fully-editable fields. No fabricated data.
    return { ounces: null, pumped_at: null, frozen_at: null, notes: null, confidence: 0 };
  }
  const { data, error } = await supabase.functions.invoke('milk-bag-scan', { body: input });
  if (error) throw new Error(error.message);
  return data as MilkBagExtraction;
}

// ─────────────────────────────────────────────────────────────────────────
// PERSONAL STASH — pure calculation helpers (no I/O, unit-testable)
// ─────────────────────────────────────────────────────────────────────────

function daysBetween(fromISO: string, toISO: string): number {
  const ms = Date.parse(toISO) - Date.parse(fromISO);
  return ms / 86_400_000;
}

function addDaysISO(baseISO: string, days: number): string {
  const d = new Date(Date.parse(baseISO) + days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export interface StashMetrics {
  totalFreezerOz: number;
  totalBags: number;
  babyCoverageDays: number;
  stashGoalOunces: number;
  stashGoalProgress: number;   // 0..1 (clamped)
  oldestMilkDate: string | null; // YYYY-MM-DD
  weeklyOuncesAdded: number;
  lifetimeMilkLogged: number;
  averageDailyIntakeOz: number;
  nextBagsToUse: MilkBag[];    // oldest-first, up to 3
}

/** All Personal Stash dashboard numbers. `nowISO` = today's date (YYYY-MM-DD). */
export function computeStashMetrics(
  bags: MilkBag[],
  settings: Pick<MilkVaultSettings, 'average_daily_intake_oz' | 'stash_goal_days'>,
  nowISO: string,
): StashMetrics {
  const intake = settings.average_daily_intake_oz > 0 ? settings.average_daily_intake_oz : 24;
  const inFreezer = bags.filter((b) => IN_FREEZER_STATUSES.includes(b.status));

  const totalFreezerOz = round1(sum(inFreezer.map((b) => b.ounces)));
  const totalBags = inFreezer.length;
  const babyCoverageDays = totalFreezerOz / intake;

  const stashGoalOunces = round1(settings.stash_goal_days * intake);
  const stashGoalProgress = stashGoalOunces > 0
    ? Math.min(totalFreezerOz / stashGoalOunces, 1)
    : 0;

  const frozenDates = inFreezer.map((b) => b.frozen_at).sort();
  const oldestMilkDate = frozenDates.length ? frozenDates[0] : null;

  const weeklyOuncesAdded = round1(
    sum(inFreezer.filter((b) => daysBetween(b.frozen_at, nowISO) <= 7 && daysBetween(b.frozen_at, nowISO) >= 0)
      .map((b) => b.ounces)),
  );

  const lifetimeMilkLogged = round1(sum(bags.map((b) => b.ounces)));

  const nextBagsToUse = [...inFreezer]
    .sort((a, b) => (a.frozen_at < b.frozen_at ? -1 : a.frozen_at > b.frozen_at ? 1 : 0))
    .slice(0, 3);

  return {
    totalFreezerOz,
    totalBags,
    babyCoverageDays,
    stashGoalOunces,
    stashGoalProgress,
    oldestMilkDate,
    weeklyOuncesAdded,
    lifetimeMilkLogged,
    averageDailyIntakeOz: intake,
    nextBagsToUse,
  };
}

// AI insight cards. Returns structured specs; the screen renders each via i18n so the
// copy stays translatable. `kind` selects the string; values are pre-rounded primitives.
export type StashInsightKind =
  | 'coverage'          // enough milk for ~N days
  | 'weekly_added'      // added N oz this week
  | 'goal_pace'         // at this pace you'll hit your goal by DATE
  | 'reserve_proximity' // you're N days from your goal-day reserve
  | 'oldest_rotate';    // oldest milk is from DATE, rotate soon

export interface StashInsight {
  kind: StashInsightKind;
  days?: number;
  oz?: number;
  goalDays?: number;
  dateISO?: string;
}

/** Chooses which insight lines to show, in priority order (screen shows the top few). */
export function selectStashInsights(
  metrics: StashMetrics,
  settings: Pick<MilkVaultSettings, 'stash_goal_days'>,
  nowISO: string,
): StashInsight[] {
  const out: StashInsight[] = [];

  if (metrics.totalFreezerOz > 0) {
    out.push({ kind: 'coverage', days: Math.round(metrics.babyCoverageDays) });
  }

  if (metrics.weeklyOuncesAdded > 0) {
    out.push({ kind: 'weekly_added', oz: Math.round(metrics.weeklyOuncesAdded) });
  }

  // Pace toward the stash goal, driven by the last 7 days' rate.
  const dailyPace = metrics.weeklyOuncesAdded / 7;
  const remainingOz = metrics.stashGoalOunces - metrics.totalFreezerOz;
  if (dailyPace > 0 && remainingOz > 0) {
    const daysToGoal = Math.ceil(remainingOz / dailyPace);
    if (daysToGoal <= 7) {
      out.push({ kind: 'reserve_proximity', days: daysToGoal, goalDays: settings.stash_goal_days });
    } else {
      out.push({ kind: 'goal_pace', goalDays: settings.stash_goal_days, dateISO: addDaysISO(nowISO, daysToGoal) });
    }
  }

  // Nudge to rotate milk older than 14 days.
  if (metrics.oldestMilkDate && daysBetween(metrics.oldestMilkDate, nowISO) >= 14) {
    out.push({ kind: 'oldest_rotate', dateISO: metrics.oldestMilkDate });
  }

  return out;
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
