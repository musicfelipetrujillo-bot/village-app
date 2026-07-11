// V6 Milk Vault — data layer.
//
// Namespaced `milk_vault_*` tables (migration 098). Distinct from the V2
// Milk Connect donor marketplace. Supabase-direct CRUD under RLS; the only
// edge function is the AI bag scanner.
//
// Diet / lifestyle tags are NOT stored per-bag — `getMyLifestyleTags()`
// reads the mom's existing donor diet flags so listings can display them
// without ever re-asking.

import { supabase } from '@/lib/supabase';
import { getMyDonorProfile, getDietFlags, type DietFlagKey } from '@api/milk';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export type VaultMode = 'personal_stash' | 'marketplace';

export type BagStatus =
  | 'stored' | 'reserved' | 'available' | 'sold' | 'donated' | 'used' | 'expired';

export type FulfillmentMethod =
  | 'local_pickup' | 'local_dropoff' | 'ship_to_buyer' | 'donate_locally' | 'donate_by_shipping';

export type ShippingResponsibility =
  | 'buyer_pays' | 'seller_pays' | 'split' | 'deduct_from_payout';

export type VaultTransactionType = 'sold' | 'donated' | 'used' | 'expired';

export interface MilkVaultBag {
  id: string;
  user_id: string;
  baby_profile_id: string | null;
  ounces: number;
  pumped_at: string;   // ISO timestamptz
  frozen_at: string;   // ISO timestamptz
  notes: string | null;
  photo_url: string | null;
  ai_extracted_data: Record<string, unknown> | null;
  status: BagStatus;
  created_at: string;
  updated_at: string;
}

export interface MilkVaultSettings {
  id: string;
  user_id: string;
  baby_profile_id: string | null;
  mode: VaultMode;
  onboarded_at: string | null;
  average_daily_intake_oz: number;
  stash_goal_days: number;
  desired_reserve_days: number;
  price_per_oz: number;
  low_price_per_oz: number;
  premium_price_per_oz: number;
  default_fulfillment_method: FulfillmentMethod;
  default_shipping_payment_responsibility: ShippingResponsibility;
  created_at: string;
  updated_at: string;
}

export interface MilkVaultTransaction {
  id: string;
  user_id: string;
  baby_profile_id: string | null;
  bag_id: string | null;
  transaction_type: VaultTransactionType;
  ounces: number;
  price_per_oz: number | null;
  total_amount: number | null;
  notes: string | null;
  created_at: string;
}

export interface MilkVaultListing {
  id: string;
  user_id: string;
  baby_profile_id: string | null;
  ounces: number;
  price_per_oz: number;
  fulfillment_method: FulfillmentMethod;
  shipping_payment_responsibility: ShippingResponsibility | null;
  shipping_supply_cost: number;
  estimated_carrier_cost: number;
  milk_subtotal: number;
  buyer_total: number;
  seller_payout: number;
  status: 'draft' | 'active' | 'matched' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface ShippingSupplyItem {
  key: string;
  label: string;
  checked: boolean;
}

export interface MilkVaultShippingKit {
  id: string;
  listing_id: string;
  user_id: string;
  supply_items: ShippingSupplyItem[];
  supply_cost: number;
  carrier: string | null;
  service_level: string | null;
  origin_zip: string | null;
  destination_zip: string | null;
  tracking_number: string | null;
  label_url: string | null;
  status: 'planned' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// Add-bag input — deliberately minimal (spec: ounces / pumped / frozen / notes).
export interface AddBagInput {
  ounces: number;
  pumped_at: string;            // ISO
  frozen_at?: string | null;    // defaults to pumped_at when blank
  notes?: string | null;
  photo_url?: string | null;
  ai_extracted_data?: Record<string, unknown> | null;
  baby_profile_id?: string | null;
}

export interface ScanResult {
  ounces: number | null;
  pumped_date: string | null;   // ISO YYYY-MM-DD
  frozen_date: string | null;   // ISO YYYY-MM-DD
  notes: string | null;
  confidence: number;
  reasoning: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

/** Default shipping-supply checklist for a shipped listing (spec §Shipping). */
export const DEFAULT_SHIPPING_SUPPLIES: ShippingSupplyItem[] = [
  { key: 'insulated_box', label: 'Insulated shipping box', checked: false },
  { key: 'cold_packs', label: 'Cold packs or dry ice (per carrier rules)', checked: false },
  { key: 'liner', label: 'Liner or thermal insulation', checked: false },
  { key: 'absorbent', label: 'Absorbent material', checked: false },
  { key: 'zip_bags', label: 'Zip bags', checked: false },
  { key: 'shipping_label', label: 'Shipping label', checked: false },
  { key: 'perishable_label', label: 'Perishable / fragile label', checked: false },
  { key: 'tracking', label: 'Tracking number', checked: false },
];

export const FULFILLMENT_LABELS: Record<FulfillmentMethod, string> = {
  local_pickup: 'Local pickup',
  local_dropoff: 'Local dropoff',
  ship_to_buyer: 'Ship to buyer',
  donate_locally: 'Donate locally',
  donate_by_shipping: 'Donate by shipping',
};

export const SHIPPING_RESPONSIBILITY_LABELS: Record<ShippingResponsibility, string> = {
  buyer_pays: 'Buyer pays shipping + supplies',
  seller_pays: 'Seller pays shipping + supplies',
  split: 'Split shipping cost',
  deduct_from_payout: 'Deduct from seller payout',
};

/** Which fulfillment methods trigger the shipping workflow. */
export function isShippingMethod(m: FulfillmentMethod): boolean {
  return m === 'ship_to_buyer' || m === 'donate_by_shipping';
}

// ─────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────

async function requireUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Not signed in');
  return user.id;
}

/** Fetch the vault settings row, or null if the user has never opened the vault. */
export async function getSettings(): Promise<MilkVaultSettings | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('milk_vault_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as MilkVaultSettings) ?? null;
}

/**
 * Ensure a settings row exists (created lazily on first vault open). Does NOT
 * set `onboarded_at` — that happens when the user picks a mode, which is how
 * the client knows to show the mode picker.
 */
export async function ensureSettings(babyProfileId?: string | null): Promise<MilkVaultSettings> {
  const existing = await getSettings();
  if (existing) return existing;
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('milk_vault_settings')
    .insert({ user_id: userId, baby_profile_id: babyProfileId ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data as MilkVaultSettings;
}

export async function updateSettings(
  patch: Partial<Omit<MilkVaultSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'>>,
): Promise<MilkVaultSettings> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('milk_vault_settings')
    .update(patch)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as MilkVaultSettings;
}

/** Pick a mode on first open (or switch later). Stamps onboarded_at. */
export async function chooseMode(mode: VaultMode): Promise<MilkVaultSettings> {
  await ensureSettings();
  return updateSettings({ mode, onboarded_at: new Date().toISOString() });
}

// ─────────────────────────────────────────────────────────────────────────
// Bags
// ─────────────────────────────────────────────────────────────────────────

export async function listBags(): Promise<MilkVaultBag[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('milk_vault_bags')
    .select('*')
    .eq('user_id', userId)
    .order('frozen_at', { ascending: true });
  if (error) throw error;
  return (data as MilkVaultBag[]) ?? [];
}

export async function addBag(input: AddBagInput): Promise<MilkVaultBag> {
  const userId = await requireUserId();
  // Spec default: blank frozen date falls back to the pumped date.
  const frozen_at = input.frozen_at && input.frozen_at.trim() ? input.frozen_at : input.pumped_at;
  const { data, error } = await supabase
    .from('milk_vault_bags')
    .insert({
      user_id: userId,
      baby_profile_id: input.baby_profile_id ?? null,
      ounces: input.ounces,
      pumped_at: input.pumped_at,
      frozen_at,
      notes: input.notes ?? null,
      photo_url: input.photo_url ?? null,
      ai_extracted_data: input.ai_extracted_data ?? null,
      status: 'stored',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MilkVaultBag;
}

export async function updateBag(
  id: string,
  patch: Partial<Pick<MilkVaultBag, 'ounces' | 'pumped_at' | 'frozen_at' | 'notes' | 'status'>>,
): Promise<MilkVaultBag> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('milk_vault_bags')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data as MilkVaultBag;
}

export async function deleteBag(id: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('milk_vault_bags')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

/**
 * Mark a bag as consumed by the baby / sold / donated / expired, and (for
 * anything that leaves the freezer) record a ledger transaction so lifetime
 * totals stay accurate.
 */
export async function recordBagOutcome(
  bag: MilkVaultBag,
  type: VaultTransactionType,
  opts: { pricePerOz?: number | null; notes?: string | null } = {},
): Promise<void> {
  const userId = await requireUserId();
  const pricePerOz = type === 'sold' ? (opts.pricePerOz ?? null) : null;
  const total = pricePerOz != null ? Math.round(pricePerOz * bag.ounces * 100) / 100 : null;

  const { error: txErr } = await supabase.from('milk_vault_transactions').insert({
    user_id: userId,
    baby_profile_id: bag.baby_profile_id,
    bag_id: bag.id,
    transaction_type: type,
    ounces: bag.ounces,
    price_per_oz: pricePerOz,
    total_amount: total,
    notes: opts.notes ?? null,
  });
  if (txErr) throw txErr;

  await updateBag(bag.id, { status: type });
}

// ─────────────────────────────────────────────────────────────────────────
// Transactions (ledger)
// ─────────────────────────────────────────────────────────────────────────

export async function listTransactions(): Promise<MilkVaultTransaction[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('milk_vault_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as MilkVaultTransaction[]) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────
// Listings (marketplace mode)
// ─────────────────────────────────────────────────────────────────────────

export interface CreateListingInput {
  ounces: number;
  price_per_oz: number;
  fulfillment_method: FulfillmentMethod;
  shipping_payment_responsibility?: ShippingResponsibility | null;
  shipping_supply_cost?: number;
  estimated_carrier_cost?: number;
  milk_subtotal: number;
  buyer_total: number;
  seller_payout: number;
  baby_profile_id?: string | null;
  status?: MilkVaultListing['status'];
}

export async function listListings(): Promise<MilkVaultListing[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('milk_vault_listings')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as MilkVaultListing[]) ?? [];
}

export async function createListing(input: CreateListingInput): Promise<MilkVaultListing> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('milk_vault_listings')
    .insert({
      user_id: userId,
      baby_profile_id: input.baby_profile_id ?? null,
      ounces: input.ounces,
      price_per_oz: input.price_per_oz,
      fulfillment_method: input.fulfillment_method,
      shipping_payment_responsibility: input.shipping_payment_responsibility ?? null,
      shipping_supply_cost: input.shipping_supply_cost ?? 0,
      estimated_carrier_cost: input.estimated_carrier_cost ?? 0,
      milk_subtotal: input.milk_subtotal,
      buyer_total: input.buyer_total,
      seller_payout: input.seller_payout,
      status: input.status ?? 'draft',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as MilkVaultListing;
}

export async function updateListingStatus(
  id: string,
  status: MilkVaultListing['status'],
): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from('milk_vault_listings')
    .update({ status })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────
// Shipping kits
// ─────────────────────────────────────────────────────────────────────────

export interface UpsertShippingKitInput {
  listing_id: string;
  supply_items: ShippingSupplyItem[];
  supply_cost: number;
  carrier?: string | null;
  service_level?: string | null;
  origin_zip?: string | null;
  destination_zip?: string | null;
}

export async function upsertShippingKit(input: UpsertShippingKitInput): Promise<MilkVaultShippingKit> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('milk_vault_shipping_kits')
    .upsert(
      {
        listing_id: input.listing_id,
        user_id: userId,
        supply_items: input.supply_items,
        supply_cost: input.supply_cost,
        carrier: input.carrier ?? null,
        service_level: input.service_level ?? null,
        origin_zip: input.origin_zip ?? null,
        destination_zip: input.destination_zip ?? null,
      },
      { onConflict: 'listing_id' },
    )
    .select('*')
    .single();
  if (error) throw error;
  return data as MilkVaultShippingKit;
}

// ─────────────────────────────────────────────────────────────────────────
// AI bag scanner
// ─────────────────────────────────────────────────────────────────────────

export async function scanBagPhoto(args: {
  image_base64: string;
  image_media_type?: 'image/jpeg' | 'image/png' | 'image/webp';
}): Promise<ScanResult> {
  const { data, error } = await supabase.functions.invoke('milk-vault-scan', {
    body: { image_base64: args.image_base64, image_media_type: args.image_media_type ?? 'image/jpeg' },
  });
  if (error) throw error;
  return (data ?? {
    ounces: null, pumped_date: null, frozen_date: null, notes: null, confidence: 0, reasoning: '',
  }) as ScanResult;
}

// ─────────────────────────────────────────────────────────────────────────
// Lifestyle / diet tags — reused from the mom's existing donor profile.
// Never re-asked in the vault. Empty array when she has no donor profile.
// ─────────────────────────────────────────────────────────────────────────

const DIET_FLAG_LABELS: Record<DietFlagKey, string> = {
  dairy_free: 'Dairy-free',
  organic: 'Organic',
  gluten_free: 'Gluten-free',
  vegan: 'Vegan',
  nut_free: 'Nut-free',
};

export interface LifestyleTag {
  key: string;
  label: string;
}

export async function getMyLifestyleTags(): Promise<LifestyleTag[]> {
  try {
    const userId = await requireUserId();
    const profile = await getMyDonorProfile(userId);
    if (!profile) return [];
    const flags = await getDietFlags(profile.id);
    return flags.map((k) => ({ key: k, label: DIET_FLAG_LABELS[k] ?? k }));
  } catch {
    // Non-fatal — lifestyle tags are decorative context, never a blocker.
    return [];
  }
}
