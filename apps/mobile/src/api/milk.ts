import { supabase } from '@/lib/supabase';
import { getPreferredRadiusMiles } from '@store/user';

export interface MilkDonorProfile {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  lat: number | null;
  lng: number | null;
  bio: string | null;
  price_per_oz: number;
  supply_oz_available: number;
  is_active: boolean;
  is_verified: boolean;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  created_at: string;
  updated_at: string;
}

export interface MilkTrustBadge {
  id: string;
  donor_profile_id: string;
  questionnaire_complete: boolean;
  questionnaire_completed_at: string | null;
  bloodwork_linked: boolean;
  bloodwork_verified_at: string | null;
  diet_disclosed: boolean;
  medications_disclosed: boolean;
  badge_level: 'none' | 'basic' | 'verified' | 'verified_bloodwork';
  ai_safety_score: number | null;
  ai_safety_flags: { severity: string; category: string; description: string }[] | null;
}

export interface QuestionnaireResponse {
  question_key: string;
  question_text: string;
  answer_value: string;
}

export interface MilkListing {
  id: string;
  donor_profile_id: string;
  oz_available: number;
  price_per_oz: number;
  min_order_oz: number;
  pickup_available: boolean;
  shipping_available: boolean;
  shipping_price: number | null;
  notes: string | null;
  status: 'active' | 'paused' | 'sold_out' | 'deleted';
  created_at: string;
}

export interface MilkMedication {
  id?: string;
  donor_profile_id: string;
  medication_name: string;
  dosage: string | null;
  frequency: string | null;
  notes: string | null;
  is_current: boolean;
}

// ── Donor profile ─────────────────────────────────────────────────────

export async function getMyDonorProfile(userId: string): Promise<MilkDonorProfile | null> {
  const { data, error } = await supabase
    .from('milk_donor_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createDonorProfile(payload: {
  user_id: string;
  display_name: string;
  city?: string;
  state?: string;
  zip_code?: string;
  bio?: string;
}): Promise<MilkDonorProfile> {
  const { data, error } = await supabase
    .from('milk_donor_profiles')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateDonorProfile(
  profileId: string,
  updates: Partial<MilkDonorProfile>
): Promise<MilkDonorProfile> {
  const { data, error } = await supabase
    .from('milk_donor_profiles')
    .update(updates)
    .eq('id', profileId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Trust badge ────────────────────────────────────────────────────────

export async function getTrustBadge(donorProfileId: string): Promise<MilkTrustBadge | null> {
  const { data, error } = await supabase
    .from('milk_trust_badges')
    .select('*')
    .eq('donor_profile_id', donorProfileId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Questionnaire ──────────────────────────────────────────────────────

export async function upsertQuestionnaireResponses(
  donorProfileId: string,
  responses: QuestionnaireResponse[]
): Promise<void> {
  const rows = responses.map((r) => ({ donor_profile_id: donorProfileId, ...r }));
  const { error } = await supabase
    .from('milk_questionnaire_responses')
    .upsert(rows, { onConflict: 'donor_profile_id,question_key' });
  if (error) throw error;
}

export async function getQuestionnaireResponses(
  donorProfileId: string
): Promise<QuestionnaireResponse[]> {
  const { data, error } = await supabase
    .from('milk_questionnaire_responses')
    .select('question_key, question_text, answer_value')
    .eq('donor_profile_id', donorProfileId);
  if (error) throw error;
  return data ?? [];
}

// ── Diet flags ────────────────────────────────────────────────────────

export const DIET_FLAG_KEYS = ['dairy_free', 'organic', 'gluten_free', 'vegan', 'nut_free'] as const;
export type DietFlagKey = typeof DIET_FLAG_KEYS[number];

export async function upsertDietFlags(
  donorProfileId: string,
  activeFlags: DietFlagKey[]
): Promise<void> {
  const rows = DIET_FLAG_KEYS.map((flag_key) => ({
    donor_profile_id: donorProfileId,
    flag_key,
    is_active: activeFlags.includes(flag_key),
  }));
  const { error } = await supabase
    .from('milk_donor_diet_flags')
    .upsert(rows, { onConflict: 'donor_profile_id,flag_key' });
  if (error) throw error;
}

export async function getDietFlags(donorProfileId: string): Promise<DietFlagKey[]> {
  const { data, error } = await supabase
    .from('milk_donor_diet_flags')
    .select('flag_key')
    .eq('donor_profile_id', donorProfileId)
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []).map((d: { flag_key: string }) => d.flag_key as DietFlagKey);
}

// ── Medications ───────────────────────────────────────────────────────

export async function getMedications(donorProfileId: string): Promise<MilkMedication[]> {
  const { data, error } = await supabase
    .from('milk_donor_medications')
    .select('*')
    .eq('donor_profile_id', donorProfileId)
    .eq('is_current', true);
  if (error) throw error;
  return data ?? [];
}

export async function addMedication(
  med: Omit<MilkMedication, 'id'>
): Promise<MilkMedication> {
  const { data, error } = await supabase
    .from('milk_donor_medications')
    .insert(med)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeMedication(medicationId: string): Promise<void> {
  const { error } = await supabase
    .from('milk_donor_medications')
    .update({ is_current: false })
    .eq('id', medicationId);
  if (error) throw error;
}

// ── Listings ──────────────────────────────────────────────────────────

export async function createListing(payload: {
  donor_profile_id: string;
  oz_available: number;
  price_per_oz: number;
  min_order_oz: number;
  pickup_available: boolean;
  shipping_available: boolean;
  shipping_price?: number;
  notes?: string;
}): Promise<MilkListing> {
  const { data, error } = await supabase
    .from('milk_listings')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getMyListings(donorProfileId: string): Promise<MilkListing[]> {
  const { data, error } = await supabase
    .from('milk_listings')
    .select('*')
    .eq('donor_profile_id', donorProfileId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// ── Saved donors ──────────────────────────────────────────────────────

export async function saveDonor(userId: string, donorProfileId: string): Promise<void> {
  const { error } = await supabase
    .from('milk_saved_donors')
    .insert({ user_id: userId, donor_profile_id: donorProfileId });
  if (error && error.code !== '23505') throw error; // ignore duplicate
}

export async function unsaveDonor(userId: string, donorProfileId: string): Promise<void> {
  const { error } = await supabase
    .from('milk_saved_donors')
    .delete()
    .eq('user_id', userId)
    .eq('donor_profile_id', donorProfileId);
  if (error) throw error;
}

// ── M2: Donor search + public profile ────────────────────────────────

export interface DonorSearchResult {
  id: string;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  lat: number | null;
  lng: number | null;
  price_per_oz: number;
  supply_oz_available: number;
  is_verified: boolean;
  badge_level: 'none' | 'basic' | 'verified' | 'verified_bloodwork';
  ai_safety_score: number | null;
  rating_avg: number;
  review_count: number;
  distance_miles: number;
}

export interface SearchFilters {
  radius_miles?: number;
  filter_badge?: string | null;
  max_price?: number | null;
}

export async function searchDonorsNear(
  lat: number,
  lng: number,
  filters: SearchFilters = {}
): Promise<DonorSearchResult[]> {
  const { data, error } = await supabase.rpc('search_donors_near', {
    user_lat: lat,
    user_lng: lng,
    radius_miles: filters.radius_miles ?? getPreferredRadiusMiles(),
    filter_badge: filters.filter_badge ?? null,
    max_price: filters.max_price ?? null,
  });
  if (error) throw error;
  return data ?? [];
}

export interface DonorPublicProfile extends MilkDonorProfile {
  rating_avg: number;
  review_count: number;
  badge_level?: 'none' | 'basic' | 'verified' | 'verified_bloodwork';
}

export async function getDonorProfile(donorProfileId: string): Promise<DonorPublicProfile | null> {
  const { data, error } = await supabase
    .from('milk_donor_profiles')
    .select('*, milk_trust_badges(badge_level, questionnaire_complete, bloodwork_linked, diet_disclosed, medications_disclosed, ai_safety_score, ai_trust_narrative)')
    .eq('id', donorProfileId)
    .eq('is_active', true)
    .single();
  if (error) throw error;
  return data;
}

export interface MilkReview {
  id: string;
  donor_profile_id: string;
  reviewer_user_id: string;
  rating: number;
  body: string | null;
  created_at: string;
}

export async function getDonorReviews(donorProfileId: string): Promise<MilkReview[]> {
  const { data, error } = await supabase
    .from('milk_reviews')
    .select('*')
    .eq('donor_profile_id', donorProfileId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return data ?? [];
}

export async function getDonorActiveListing(donorProfileId: string): Promise<MilkListing | null> {
  const { data, error } = await supabase
    .from('milk_listings')
    .select('*')
    .eq('donor_profile_id', donorProfileId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSavedDonors(userId: string): Promise<DonorSearchResult[]> {
  const { data, error } = await supabase
    .from('milk_saved_donors')
    .select(`
      donor_profile_id,
      milk_donor_profiles (
        id, display_name, avatar_url, city, state, lat, lng,
        price_per_oz, supply_oz_available, is_verified, rating_avg, review_count,
        milk_trust_badges (badge_level)
      )
    `)
    .eq('user_id', userId);
  if (error) throw error;

  return ((data ?? []) as any[]).map((row) => {
    const p = Array.isArray(row.milk_donor_profiles) ? row.milk_donor_profiles[0] : row.milk_donor_profiles;
    if (!p) return null;
    return {
      id: p.id,
      user_id: '',
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      neighborhood: null,
      city: p.city,
      state: p.state,
      lat: p.lat,
      lng: p.lng,
      price_per_oz: p.price_per_oz,
      supply_oz_available: p.supply_oz_available,
      is_verified: p.is_verified,
      badge_level: (p.milk_trust_badges?.[0]?.badge_level ?? 'none') as DonorSearchResult['badge_level'],
      ai_safety_score: null,
      rating_avg: p.rating_avg ?? 0,
      review_count: p.review_count ?? 0,
      distance_miles: 0,
    };
  }).filter(Boolean) as DonorSearchResult[];
}

export async function isSaved(userId: string, donorProfileId: string): Promise<boolean> {
  const { data } = await supabase
    .from('milk_saved_donors')
    .select('user_id')
    .eq('user_id', userId)
    .eq('donor_profile_id', donorProfileId)
    .maybeSingle();
  return !!data;
}

// ── AI Edge Function helpers ───────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

const EDGE = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1`;

export async function callSafetyScreener(donorProfileId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-safety-screener`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ donor_profile_id: donorProfileId }),
  });
  if (!res.ok) throw new Error('Safety screener failed');
  return res.json();
}

export async function callQuestionnaireCoach(
  questionKey: string,
  questionText: string,
  answerValue: string
): Promise<{ why_it_matters: string; acknowledgement: string; concern: string | null }> {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-questionnaire-coach`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question_key: questionKey, question_text: questionText, answer_value: answerValue }),
  });
  if (!res.ok) throw new Error('Coach call failed');
  return res.json();
}

export async function getStripeConnectUrl(donorProfileId: string): Promise<{ url: string; account_id: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-stripe-connect`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ donor_profile_id: donorProfileId }),
  });
  if (!res.ok) throw new Error('Stripe Connect failed');
  return res.json();
}

export async function callTrustNarrative(
  donorProfileId: string,
  recipientPreferences?: string
): Promise<{ narrative: string; cached: boolean }> {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-trust-narrative`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ donor_profile_id: donorProfileId, recipient_preferences: recipientPreferences }),
  });
  if (!res.ok) throw new Error('Trust narrative failed');
  return res.json();
}

export async function callDonorQA(
  donorProfileId: string,
  question: string
): Promise<{ answer: string }> {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-donor-qa`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ donor_profile_id: donorProfileId, question }),
  });
  if (!res.ok) throw new Error('Donor Q&A failed');
  return res.json();
}

// ── M3: AI matching + purchase + orders ───────────────────────────────

export interface MatchPreferences {
  lat: number;
  lng: number;
  need_oz: number;
  max_price_per_oz: number;
  diet_flags: DietFlagKey[];
  fulfillment: 'pickup' | 'shipping';
  pregnancy_stage: string;
  radius_miles?: number;
}

export interface DonorMatch {
  donor_profile_id: string;
  rank: number;
  fit_score: number;
  reason: string;
  donor: DonorSearchResult;
}

export async function callMatchDonors(prefs: MatchPreferences): Promise<{ matches: DonorMatch[] }> {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-match-donors`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error('Match donors failed');
  return res.json();
}

export interface PurchaseIntentInput {
  donor_profile_id: string;
  listing_id: string;
  oz: number;
  fulfillment_method: 'pickup' | 'shipping';
  recipient_address?: { line: string; city: string; state: string; zip: string };
  recipient_notes?: string;
}

export interface PurchaseIntentResult {
  transaction_id: string;
  payment_intent_id: string;
  client_secret: string;
  donor_stripe_account_id: string;
  total_cents: number;
  subtotal_cents: number;
  shipping_cents: number;
  platform_fee_cents: number;
}

export async function createPurchaseIntent(input: PurchaseIntentInput): Promise<PurchaseIntentResult> {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-purchase-intent`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Purchase intent failed');
  return json;
}

export async function confirmPurchase(transactionId: string): Promise<{
  status: string;
  transaction_id: string;
  donor_notified: boolean;
  recipient_notified: boolean;
  already?: boolean;
}> {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-purchase-confirmed`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ transaction_id: transactionId }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Confirm failed');
  return json;
}

export interface MyOrderRow {
  id: string;
  donor_profile_id: string;
  donor_display_name: string;
  donor_avatar_url: string | null;
  oz_purchased: number;
  total_charged_cents: number;
  fulfillment_method: 'pickup' | 'shipping';
  status: 'pending' | 'paid' | 'fulfilled' | 'disputed' | 'refunded' | 'cancelled';
  address_revealed_at: string | null;
  created_at: string;
}

export async function listMyOrders(userId: string): Promise<MyOrderRow[]> {
  const { data, error } = await supabase.rpc('list_my_orders', { p_user_id: userId });
  if (error) throw error;
  return data ?? [];
}

export interface DonorPickupAddress {
  donor_address_line: string | null;
  donor_city: string | null;
  donor_state: string | null;
  donor_zip: string | null;
  donor_phone: string | null;
  donor_display_name: string;
}

export async function getTransactionAddress(transactionId: string): Promise<DonorPickupAddress | null> {
  const { data, error } = await supabase.rpc('get_transaction_pickup_address', {
    p_transaction_id: transactionId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}

// ── M4: Messaging + reviews ───────────────────────────────────────────

export interface MilkThreadRow {
  thread_id: string;
  donor_profile_id: string;
  recipient_user_id: string;
  other_display_name: string;
  other_avatar_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_donor_side: boolean;
}

export async function listMyMilkThreads(userId: string): Promise<MilkThreadRow[]> {
  const { data, error } = await supabase.rpc('list_my_milk_threads', { p_user_id: userId });
  if (error) throw error;
  return data ?? [];
}

export interface MilkMessageRow {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  sent_at: string;
}

export async function getThreadMessages(threadId: string, limit = 50): Promise<MilkMessageRow[]> {
  const { data, error } = await supabase
    .from('milk_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('sent_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse(); // chronological for chat UI
}

export async function sendMilkMessage(threadId: string, senderId: string, body: string): Promise<MilkMessageRow> {
  const { data, error } = await supabase
    .from('milk_messages')
    .insert({ thread_id: threadId, sender_id: senderId, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markThreadRead(threadId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_thread_read', { p_thread_id: threadId });
  if (error) throw error;
}

/**
 * Subscribe to NEW messages on a milk thread via Supabase Realtime.
 * Filter narrows server-push payload to the specific thread; RLS already
 * restricts each subscriber to threads they participate in (see migration 005).
 * Returns an unsubscribe function.
 */
export function subscribeToMilkThread(
  threadId: string,
  onNew: (row: MilkMessageRow) => void,
): () => void {
  const channel = supabase
    .channel(`milk_messages:${threadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'milk_messages',
        filter: `thread_id=eq.${threadId}`,
      },
      (payload) => onNew(payload.new as MilkMessageRow),
    )
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function getOrCreateThread(
  donorProfileId: string,
  recipientUserId: string,
  listingId?: string,
): Promise<{ id: string }> {
  // Try fetch first
  const { data: existing } = await supabase
    .from('milk_message_threads')
    .select('id')
    .eq('donor_profile_id', donorProfileId)
    .eq('recipient_user_id', recipientUserId)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('milk_message_threads')
    .insert({
      donor_profile_id: donorProfileId,
      recipient_user_id: recipientUserId,
      listing_id: listingId,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data;
}

// ── Reviews ───────────────────────────────────────────────────────────

export interface ReviewableOrder {
  transaction_id: string;
  donor_profile_id: string;
  donor_display_name: string;
  donor_avatar_url: string | null;
  oz_purchased: number;
  created_at: string;
}

export async function listReviewableOrders(userId: string): Promise<ReviewableOrder[]> {
  const { data, error } = await supabase.rpc('list_reviewable_orders', { p_user_id: userId });
  if (error) throw error;
  return data ?? [];
}

export async function submitMilkReview(input: {
  transaction_id: string;
  donor_profile_id: string;
  reviewer_user_id: string;
  rating: number;
  body?: string;
}): Promise<MilkReview> {
  const { data, error } = await supabase
    .from('milk_reviews')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── M5: Disputes ──────────────────────────────────────────────────────

export type DisputeReasonCode =
  | 'never_received'
  | 'quality_concern'
  | 'wrong_quantity'
  | 'spoiled'
  | 'no_show_pickup'
  | 'other';

export interface MilkDispute {
  id: string;
  transaction_id: string;
  opened_by_user_id: string;
  opened_by_role: 'recipient' | 'donor';
  reason_code: DisputeReasonCode;
  description: string;
  evidence_urls: string[] | null;
  status: 'open' | 'investigating' | 'resolved_recipient' | 'resolved_donor' | 'withdrawn';
  resolution_notes: string | null;
  resolved_at: string | null;
  refund_amount_cents: number | null;
  created_at: string;
  updated_at: string;
}

export async function openDispute(input: {
  transaction_id: string;
  reason_code: DisputeReasonCode;
  description: string;
  evidence_urls?: string[];
}): Promise<{ dispute: MilkDispute; already: boolean }> {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-dispute-open`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Open dispute failed');
  return json;
}

export async function getDisputeForTransaction(transactionId: string): Promise<MilkDispute | null> {
  const { data, error } = await supabase.rpc('get_dispute_for_transaction', {
    p_transaction_id: transactionId,
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) ?? null;
}

// ── M5: Shipping (Shippo) ────────────────────────────────────────────

export interface MilkShippingLabel {
  id: string;
  transaction_id: string;
  shippo_transaction_id: string;
  carrier: string | null;
  service_level: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  label_url: string | null;
  rate_cents: number | null;
  insurance_cents: number | null;
  status: 'created' | 'in_transit' | 'delivered' | 'exception' | 'cancelled';
  created_at: string;
}

export interface ShippoAddress {
  name: string;
  street1: string;
  city: string;
  state: string;
  zip: string;
  country: string; // 'US'
  phone?: string;
  email?: string;
}

export interface ShippoParcel {
  length: string;            // inches, as numeric string per Shippo
  width: string;
  height: string;
  distance_unit: 'in';
  weight: string;            // total weight in oz
  mass_unit: 'oz';
}

export async function buyShippoLabel(input: {
  transaction_id: string;
  from_address: ShippoAddress;
  to_address: ShippoAddress;
  parcel: ShippoParcel;
  service_token?: string;
}): Promise<{ label: MilkShippingLabel; already: boolean }> {
  const token = await getAccessToken();
  const res = await fetch(`${EDGE}/milk-shippo-label`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Buy shipping label failed');
  return json;
}

export async function getShippingLabel(transactionId: string): Promise<MilkShippingLabel | null> {
  const { data, error } = await supabase
    .from('milk_shipping_labels')
    .select('*')
    .eq('transaction_id', transactionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── M5: Legal acceptances (audit trail) ──────────────────────────────

export type LegalDocKey =
  | 'milk_purchase_disclaimer_v1'
  | 'donor_agreement_v1'
  | 'shipping_disclosure_v1'
  // 2026-05-21 — cash-only handoff guide (mirror of gear safe-meeting).
  // Captured per-recipient on first donor-message tap, scope: pickup safety
  // + cold-chain + cash/P2P-only + not-a-party-to-the-transaction.
  | 'milk_safe_handoff_v1';

export const LEGAL_DOC_VERSION: Record<LegalDocKey, string> = {
  milk_purchase_disclaimer_v1: '1.0.0',
  donor_agreement_v1: '1.0.0',
  shipping_disclosure_v1: '1.0.0',
  milk_safe_handoff_v1: '1.0.0',
};

export async function hasAcceptedLegal(userId: string, key: LegalDocKey): Promise<boolean> {
  const { data } = await supabase
    .from('milk_legal_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('document_key', key)
    .eq('document_version', LEGAL_DOC_VERSION[key])
    .maybeSingle();
  return !!data;
}

export async function recordLegalAcceptance(
  userId: string,
  key: LegalDocKey,
  context?: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('milk_legal_acceptances')
    .insert({
      user_id: userId,
      document_key: key,
      document_version: LEGAL_DOC_VERSION[key],
      context: context ?? null,
    });
  // 23505 = unique violation — already accepted this version, treat as success
  if (error && (error as { code?: string }).code !== '23505') throw error;
}
