// V4 Phase G4 — Gear Marketplace API (browse + create + save)
// Compliance: prohibited categories excluded at the DB enum level.
// CPSC check, AI vision assist, messaging, and payments ship in later phases (G5/G6/G8).
import { supabase } from '@/lib/supabase';
import { getPreferredRadiusKm } from '@store/user';
import type { AgeTag } from '@api/events';

export type GearCategory =
  | 'stroller'
  | 'carrier_wrap'
  | 'high_chair'
  | 'bouncer_swing'
  | 'toy'
  | 'feeding_gear'
  | 'clothing'
  | 'book'
  | 'activity_center'
  | 'nursery_furniture';

export type GearCondition = 'new' | 'like_new' | 'good' | 'fair';
export type GearStatus = 'active' | 'pending' | 'sold' | 'withdrawn' | 'removed';

/** Categories we will NEVER allow in the UI. Enforced at DB level too (CHECK enum). */
export const PROHIBITED_CATEGORIES = [
  'car_seat',
  'breast_pump',
  'sleep_positioner',
  'inclined_sleeper',
  'helmet',
] as const;

/** Subcategory suggestions shown per category. Free-text at DB level. */
export const SUBCATEGORIES_BY_CATEGORY: Record<GearCategory, string[]> = {
  stroller:           ['full-size', 'lightweight', 'travel system', 'double', 'jogging'],
  carrier_wrap:       ['structured', 'wrap', 'ring sling', 'meh dai', 'hip seat'],
  high_chair:         ['full-size', 'convertible', 'booster', 'clip-on'],
  bouncer_swing:      ['bouncer', 'swing', 'rocker'],
  toy:                ['wooden', 'plush', 'puzzle', 'blocks', 'musical', 'ride-on'],
  feeding_gear:       ['bottles', 'plates & bowls', 'utensils', 'bibs', 'storage'],
  clothing:           ['single piece', 'bundle', 'outerwear', 'sleepwear', 'shoes'],
  book:               ['board book', 'cloth book', 'picture book', 'bundle'],
  activity_center:    ['playmat', 'jumper', 'exersaucer', 'gym'],
  nursery_furniture:  ['dresser', 'changing table', 'glider', 'crib', 'bassinet', 'bookshelf'],
};

/** Subcategories that force a year_manufactured value (matches DB CHECKs). */
export function requiresYearManufactured(category: GearCategory, subcategory?: string | null): boolean {
  if (category === 'toy') return true;
  if (category === 'nursery_furniture' && subcategory === 'crib') return true;
  return false;
}

export interface GearCard {
  id: string;
  title: string;
  category: GearCategory;
  subcategory: string | null;
  brand: string | null;
  condition: GearCondition;
  age_tags: AgeTag[];
  price_cents: number;
  is_free: boolean;
  currency: string;
  pickup_city: string;
  distance_km: number | null;
  is_cpsc_checked: boolean;
  cover_image_url: string | null;
  save_count: number;
  created_at: string;
}

export interface GearImage { id: string; url: string; sort: number; }

export type CpscRecallStatus = 'clear' | 'recalled' | 'unknown';

export interface GearListingDetail {
  id: string;
  seller_id: string;
  category: GearCategory;
  subcategory: string | null;
  title: string;
  description: string;
  brand: string | null;
  model: string | null;
  year_manufactured: number | null;
  condition: GearCondition;
  age_tags: AgeTag[];
  price_cents: number;
  is_free: boolean;
  currency: string;
  pickup_city: string;
  pickup_zip: string | null;
  lat: number | null;
  lng: number | null;
  status: GearStatus;
  is_cpsc_checked: boolean;
  cpsc_recall_status: CpscRecallStatus | null;
  cpsc_recall_id: string | null;
  cpsc_recall_url: string | null;
  cpsc_checked_at: string | null;
  upc: string | null;
  // Optional product-catalog image surfaced when the seller scanned a UPC
  // during listing creation. Shown in the detail view as a labeled "Product
  // reference" card alongside the seller's own photos. Migration 064.
  reference_image_url: string | null;
  view_count: number;
  save_count: number;
  created_at: string;
  images: GearImage[];
  is_saved: boolean;
  seller_name: string | null;
  seller_avatar_url: string | null;
}

export interface MyListingRow {
  id: string;
  title: string;
  category: GearCategory;
  status: GearStatus;
  price_cents: number;
  is_free: boolean;
  currency: string;
  view_count: number;
  save_count: number;
  created_at: string;
  cover_image_url: string | null;
}

export interface SavedListingRow {
  id: string;
  title: string;
  category: GearCategory;
  price_cents: number;
  is_free: boolean;
  currency: string;
  pickup_city: string;
  cover_image_url: string | null;
  saved_at: string;
  status: GearStatus;
}

export interface ListGearParams {
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  category?: GearCategory | null;
  ageTags?: AgeTag[] | null;
  maxPriceCents?: number | null;
  includeFree?: boolean;
}

export interface CreateListingInput {
  category: GearCategory;
  subcategory?: string | null;
  title: string;
  description: string;
  brand?: string | null;
  model?: string | null;
  year_manufactured?: number | null;
  condition: GearCondition;
  age_tags: AgeTag[];
  price_cents: number;
  is_free: boolean;
  pickup_city: string;
  pickup_zip?: string | null;
  lat: number;
  lng: number;
  image_urls: string[];  // upload to Supabase Storage first, pass resulting URLs
  // Optional. Stock/catalog image URL from the UPC lookup (Go-UPC or
  // UPCitemdb returns this in the `image_url` field). Surfaced in the
  // detail view as a "Product reference" card alongside the seller's
  // photos so the user gets a polished product hero while their own
  // photos remain the actual condition signal. Migration 064.
  reference_image_url?: string | null;
}

export const gearApi = {
  async listGear(params: ListGearParams = {}): Promise<GearCard[]> {
    const {
      lat = null, lng = null, radiusKm,
      category = null, ageTags = null,
      maxPriceCents = null, includeFree = true,
    } = params;
    const effectiveRadiusKm = radiusKm ?? getPreferredRadiusKm();
    const { data, error } = await supabase.rpc('list_gear_near', {
      p_lat: lat, p_lng: lng, p_radius_km: effectiveRadiusKm,
      p_category: category, p_age_tags: ageTags,
      p_max_price_cents: maxPriceCents, p_include_free: includeFree,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as GearCard[];
  },

  async getListing(id: string): Promise<GearListingDetail | null> {
    const { data, error } = await supabase.rpc('get_gear_listing', { p_id: id });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return row as GearListingDetail;
  },

  /** Creates the listing row and its image rows. */
  async createListing(input: CreateListingInput): Promise<{ id: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');

    // Build the location WKT; supabase-js can't send PostGIS types directly,
    // so we rely on the geography column accepting a PostGIS-readable hex via
    // ST_Point cast done inside a DB default. Simplest path: use RPC insert via
    // standard client, but since we need PostGIS point, we go through a small
    // helper INSERT ... SELECT. PostgREST supports passing `location=POINT(lng lat)`
    // but the safest cross-version approach is a parameterized RPC. For MVP we
    // insert via a direct SQL call, sending lng/lat to a thin RPC.
    const { data, error } = await supabase.rpc('create_gear_listing', {
      p_category: input.category,
      p_subcategory: input.subcategory ?? null,
      p_title: input.title,
      p_description: input.description,
      p_brand: input.brand ?? null,
      p_model: input.model ?? null,
      p_year_manufactured: input.year_manufactured ?? null,
      p_condition: input.condition,
      p_age_tags: input.age_tags,
      p_price_cents: input.is_free ? 0 : input.price_cents,
      p_is_free: input.is_free,
      p_pickup_city: input.pickup_city,
      p_pickup_zip: input.pickup_zip ?? null,
      p_lat: input.lat,
      p_lng: input.lng,
      p_reference_image_url: input.reference_image_url ?? null,
    });
    if (error) throw new Error(error.message);
    const newId = Array.isArray(data) ? data[0]?.id : data?.id ?? data;
    if (!newId) throw new Error('listing creation failed');

    // Image rows — the RPC doesn't take images to keep the surface small.
    if (input.image_urls.length > 0) {
      const rows = input.image_urls.map((url, idx) => ({
        listing_id: newId, image_url: url, sort_order: idx,
      }));
      const { error: imgErr } = await supabase.from('gear_listing_images').insert(rows);
      if (imgErr) throw new Error(imgErr.message);
    }
    return { id: newId };
  },

  async updateStatus(id: string, status: GearStatus): Promise<void> {
    const { error } = await supabase
      .from('gear_listings')
      .update({ status })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async saveListing(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { error } = await supabase
      .from('gear_saved_listings')
      .upsert({ user_id: user.id, listing_id: id }, { onConflict: 'user_id,listing_id' });
    if (error) throw new Error(error.message);
  },

  async unsaveListing(id: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not signed in');
    const { error } = await supabase
      .from('gear_saved_listings')
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', id);
    if (error) throw new Error(error.message);
  },

  async listMyListings(): Promise<MyListingRow[]> {
    const { data, error } = await supabase.rpc('list_my_gear_listings');
    if (error) throw new Error(error.message);
    return (data ?? []) as MyListingRow[];
  },

  async listMySaved(): Promise<SavedListingRow[]> {
    const { data, error } = await supabase.rpc('list_my_saved_gear');
    if (error) throw new Error(error.message);
    return (data ?? []) as SavedListingRow[];
  },

  // ── G5: CPSC + UPC + Vision ───────────────────────────────────────────────
  /**
   * Scan a UPC via the Edge Function waterfall (Go-UPC → UPCitemdb).
   * Returns `{ found: false }` when no API keys are configured or nothing matches —
   * callers should treat that as "drop to manual entry".
   */
  async upcLookup(upc: string): Promise<UpcLookupResult> {
    const clean = upc.replace(/\D/g, '');
    if (!clean) throw new Error('Invalid UPC');
    const { data, error } = await supabase.functions.invoke('gear-upc-lookup', {
      body: { upc: clean },
    });
    if (error) throw new Error(error.message);
    return (data ?? { found: false }) as UpcLookupResult;
  },

  /**
   * Identify a product from an image. Pass either `image_base64` (preferred,
   * no round-trip upload) or `image_url` (if already uploaded to Storage).
   */
  async visionIdentify(input: VisionIdentifyInput): Promise<VisionIdentifyResult> {
    const { data, error } = await supabase.functions.invoke('gear-vision-identify', {
      body: input,
    });
    if (error) throw new Error(error.message);
    return data as VisionIdentifyResult;
  },

  /**
   * Cross-check a product against the CPSC recall database.
   * If `listing_id` is provided AND the user is signed in, the verdict is
   * persisted server-side via mark_listing_cpsc (RLS-scoped to owner).
   */
  async cpscCheck(input: CpscCheckInput): Promise<CpscCheckResult> {
    const { data, error } = await supabase.functions.invoke('gear-cpsc-check', {
      body: input,
    });
    if (error) throw new Error(error.message);
    return data as CpscCheckResult;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// G5 shared types
// ─────────────────────────────────────────────────────────────────────────────
export interface UpcLookupResult {
  found: boolean;
  source?: 'go-upc' | 'upcitemdb';
  name?: string;
  brand?: string;
  msrp_cents?: number;
  image_url?: string;
  category_hint?: string;
  reason?: string;            // e.g. 'no_api_keys' when the Edge Fn has no keys configured
}

export interface VisionIdentifyInput {
  image_base64?: string;
  image_media_type?: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
  image_url?: string;
}

// Prohibited categories — items we never accept on the marketplace. Mirrors
// the PROHIBITED_CATEGORIES list in supabase/functions/gear-vision-identify
// and the policy section of the Gear Marketplace Addendum. The vision model
// returns one of these keys when it identifies a prohibited item; the client
// uses the key to render the right rationale in ProhibitedItemBlockModal and
// to hard-block the listing submission.
export type ProhibitedCategory =
  | 'car_seat'
  | 'breast_pump'
  | 'sleep_positioner'
  | 'inclined_sleeper'
  | 'helmet';

export interface VisionIdentifyResult {
  name: string;
  brand: string | null;
  category_hint: GearCategory | null;
  subcategory_hint: string | null;
  condition_hint: GearCondition | null;
  confidence: number;
  prohibited_category: ProhibitedCategory | null;
  reasoning: string;
}

export interface CpscCheckInput {
  product_name: string;
  brand?: string | null;
  upc?: string | null;
  listing_id?: string | null;
}

export interface CpscRecallSummary {
  recall_number: string;
  title: string;
  hazard: string | null;
  remedy: string | null;
  recall_date: string | null;
  url: string | null;
}

export interface CpscCheckResult {
  status: CpscRecallStatus;
  recall?: CpscRecallSummary;
  error?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────────────────────
export function categoryLabel(c: GearCategory): string {
  switch (c) {
    case 'stroller':          return 'Stroller';
    case 'carrier_wrap':      return 'Carrier / wrap';
    case 'high_chair':        return 'High chair';
    case 'bouncer_swing':     return 'Bouncer / swing';
    case 'toy':               return 'Toy';
    case 'feeding_gear':      return 'Feeding gear';
    case 'clothing':          return 'Clothing';
    case 'book':              return 'Book';
    case 'activity_center':   return 'Activity center';
    case 'nursery_furniture': return 'Nursery furniture';
  }
}

export function conditionLabel(c: GearCondition): string {
  switch (c) {
    case 'new':       return 'New';
    case 'like_new':  return 'Like new';
    case 'good':      return 'Good';
    case 'fair':      return 'Fair';
  }
}

export function formatPrice(price_cents: number, is_free: boolean, currency = 'USD'): string {
  if (is_free) return 'Free';
  const dollars = price_cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency', currency, maximumFractionDigits: dollars % 1 === 0 ? 0 : 2,
  }).format(dollars);
}

// ─────────────────────────────────────────────────────────────────────────────
// G6 — Messaging, reporting, legal disclosure, safe-meeting gate
// Spec: Risk & Compliance §2.7 #6 (Safe Meeting Guide) + #7 (Report listing)
//       + §3.1 (Gear Marketplace Addendum audit trail).
// ─────────────────────────────────────────────────────────────────────────────

export interface GearThreadBootstrap {
  thread_id: string;
  listing_id: string;
  seller_user_id: string;
  buyer_user_id: string;
  safe_meeting_ack_at: string | null;
}

export interface GearThreadRow {
  thread_id: string;
  listing_id: string;
  listing_title: string;
  listing_cover_url: string | null;
  listing_status: GearStatus;
  other_user_id: string;
  other_display_name: string;
  other_avatar_url: string | null;
  is_seller_side: boolean;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface GearMessageRow {
  id: string;
  thread_id: string;
  // Nullable when message_type='system' (auto-withdraw or moderator-issued
  // takedown templates per migration 063 + V4_GEAR_TAKEDOWN_SOP §7).
  sender_id: string | null;
  body: string;
  is_read: boolean;
  sent_at: string;
  // 'user' for buyer/seller messages, 'system' for Villie-issued notices
  // (auto-withdraw confirmation, moderator takedown templates A/B/C).
  // Defaults to 'user' via DB default for backward compat with rows
  // inserted before migration 063 landed.
  message_type: 'user' | 'system';
}

export type GearReportReason =
  | 'recalled_item'
  | 'prohibited_category'
  | 'counterfeit_or_fake'
  | 'damaged_or_unsafe'
  | 'misleading_description'
  | 'price_or_scam'
  | 'harassment_or_abuse'
  | 'other';

export interface GearReportInput {
  listing_id: string;
  reason_code: GearReportReason;
  description: string;
}

export function gearReportReasonLabel(r: GearReportReason): string {
  switch (r) {
    case 'recalled_item':          return 'I think this is recalled';
    case 'prohibited_category':    return 'Prohibited item (car seat, pump, etc.)';
    case 'counterfeit_or_fake':    return 'Counterfeit or fake';
    case 'damaged_or_unsafe':      return 'Damaged or unsafe';
    case 'misleading_description': return 'Misleading description or photos';
    case 'price_or_scam':          return 'Price or scam concern';
    case 'harassment_or_abuse':    return 'Harassment or abusive behavior';
    case 'other':                  return 'Something else';
  }
}

export type GearLegalDocKey =
  | 'gear_marketplace_addendum_v1'
  | 'gear_safe_meeting_v1';

export const GEAR_LEGAL_DOC_VERSION: Record<GearLegalDocKey, string> = {
  gear_marketplace_addendum_v1: '1.0.0',
  gear_safe_meeting_v1: '1.0.0',
};

// ── Threads + messages ──────────────────────────────────────────────────────

/** Returns an existing (listing, buyer) thread or creates one. */
export async function getOrCreateGearThread(listingId: string): Promise<GearThreadBootstrap> {
  const { data, error } = await supabase.rpc('get_or_create_gear_thread', { p_listing_id: listingId });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Could not open thread');
  return row as GearThreadBootstrap;
}

export async function listMyGearThreads(): Promise<GearThreadRow[]> {
  const { data, error } = await supabase.rpc('list_my_gear_threads');
  if (error) throw new Error(error.message);
  return (data ?? []) as GearThreadRow[];
}

export async function getGearThreadMessages(threadId: string, limit = 50): Promise<GearMessageRow[]> {
  const { data, error } = await supabase
    .from('gear_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as GearMessageRow[]).reverse(); // chronological for chat UI
}

export async function sendGearMessage(
  threadId: string, senderId: string, body: string,
): Promise<GearMessageRow> {
  const { data, error } = await supabase
    .from('gear_messages')
    .insert({ thread_id: threadId, sender_id: senderId, body })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as GearMessageRow;
}

export async function markGearThreadRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_gear_thread_read', { p_thread_id: threadId });
  if (error) throw new Error(error.message);
}

/**
 * Subscribe to NEW messages on a gear thread via Supabase Realtime.
 * Filter narrows server-push payload to the specific thread; RLS restricts
 * each subscriber to thread participants (see migration 024 policies).
 * Returns an unsubscribe function.
 */
export function subscribeToGearThread(
  threadId: string,
  onNew: (row: GearMessageRow) => void,
): () => void {
  const channel = supabase
    .channel(`gear_messages:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'gear_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => onNew(payload.new as GearMessageRow),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

/** Stamps safe_meeting_ack_at on a thread (buyer-only). */
export async function ackGearSafeMeeting(threadId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ack_gear_safe_meeting', { p_thread_id: threadId });
  if (error) throw new Error(error.message);
  return data as string;
}

// ── Reports ─────────────────────────────────────────────────────────────────

export async function submitGearReport(input: GearReportInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const body = input.description.trim();
  if (body.length < 10) throw new Error('Description must be at least 10 characters');
  const { error } = await supabase.from('gear_listing_reports').insert({
    listing_id: input.listing_id,
    reporter_user_id: user.id,
    reason_code: input.reason_code,
    description: body,
  });
  if (error) throw new Error(error.message);
}

// ── Legal acceptances ──────────────────────────────────────────────────────

export async function hasAcceptedGearLegal(userId: string, key: GearLegalDocKey): Promise<boolean> {
  const { data, error } = await supabase
    .from('gear_legal_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('document_key', key)
    .eq('document_version', GEAR_LEGAL_DOC_VERSION[key])
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function recordGearLegalAcceptance(
  userId: string,
  key: GearLegalDocKey,
  context?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('gear_legal_acceptances')
    .upsert({
      user_id: userId,
      document_key: key,
      document_version: GEAR_LEGAL_DOC_VERSION[key],
      context: context ?? null,
    }, { onConflict: 'user_id,document_key,document_version' });
  if (error) throw new Error(error.message);
}

// ── Price suggestion (gear-price-suggest edge function) ───────────────────
//
// Returns a non-blocking price hint for CreateListingScreen. The function
// uses heuristic-only suggestions until the eBay Developer credentials
// land (waiting on app approval as of 2026-05-15); then it auto-promotes
// to real eBay comp data without any client change. Source flips from
// `'heuristic'` → `'ebay'` and `sample_count` starts appearing.
//
// UX intent: amber pill below the price field after category + condition
// are picked. "Similar items go for $20–$35 → use $25?" with a
// tap-to-fill action. Never auto-fills, never blocks submit. Errors
// surface as `null` — caller hides the hint entirely.

export type PriceSuggestion = {
  suggested_low: number;
  suggested_mid: number;
  suggested_high: number;
  currency: 'USD';
  source: 'ebay' | 'heuristic';
  confidence: 'low' | 'med' | 'high';
  notes: string;
  sample_count?: number;
};

export async function suggestGearPrice(input: {
  category: GearCategory;
  condition: GearCondition;
  brand?: string | null;
  model?: string | null;
  year_manufactured?: number | null;
}): Promise<PriceSuggestion | null> {
  try {
    const { data, error } = await supabase.functions.invoke('gear-price-suggest', {
      body: {
        category: input.category,
        condition: input.condition,
        brand: input.brand ?? undefined,
        model: input.model ?? undefined,
        year_manufactured: input.year_manufactured ?? undefined,
      },
    });
    if (error) {
      console.warn('suggestGearPrice failed', error.message);
      return null;
    }
    if (!data || typeof data !== 'object') return null;
    return data as PriceSuggestion;
  } catch (e) {
    console.warn('suggestGearPrice exception', e);
    return null;
  }
}

// ── Analytics (server-persisted for compliance events) ─────────────────────

export async function logGearEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // anonymous events are dropped — matches milk pattern
  await supabase.from('gear_analytics_events').insert({
    user_id: user.id,
    event_name: eventName,
    properties: properties ?? null,
  });
}
