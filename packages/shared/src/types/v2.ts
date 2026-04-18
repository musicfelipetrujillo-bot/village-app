// V2 — Milk Connect types

export type BadgeLevel = 'none' | 'basic' | 'verified' | 'verified_bloodwork';
export type MilkListingStatus = 'active' | 'paused' | 'sold_out' | 'deleted';
export type MilkTransactionStatus =
  | 'pending'
  | 'paid'
  | 'fulfilled'
  | 'disputed'
  | 'refunded'
  | 'cancelled';
export type FulfillmentMethod = 'pickup' | 'shipping';

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
  distance_miles?: number;
  trust_badge?: MilkTrustBadge;
  diet_flags?: string[];
}

export interface MilkTrustBadge {
  id: string;
  donor_profile_id: string;
  questionnaire_complete: boolean;
  bloodwork_linked: boolean;
  diet_disclosed: boolean;
  medications_disclosed: boolean;
  badge_level: BadgeLevel;
  ai_safety_score: number | null;
  ai_safety_flags: AISafetyFlag[] | null;
}

export interface AISafetyFlag {
  severity: 'block' | 'warn' | 'note';
  message: string;
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
  status: MilkListingStatus;
  created_at: string;
}

export interface MilkTransaction {
  id: string;
  listing_id: string;
  donor_profile_id: string;
  recipient_user_id: string;
  oz_purchased: number;
  price_per_oz: number;
  subtotal_cents: number;
  platform_fee_cents: number;
  total_charged_cents: number;
  donor_payout_cents: number;
  stripe_payment_intent: string;
  fulfillment_method: FulfillmentMethod;
  status: MilkTransactionStatus;
  created_at: string;
}
