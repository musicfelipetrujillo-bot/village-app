// V4 — Gear Marketplace + Home Dashboard types

export type GearCategory =
  | 'stroller'
  | 'sleep'
  | 'monitor'
  | 'swing'
  | 'clothing'
  | 'feeding'
  | 'toy'
  | 'other';

export type GearCondition = 'like_new' | 'good' | 'fair' | 'for_parts';
export type GearListingStatus = 'active' | 'pending_sale' | 'sold' | 'removed';
export type GearTransactionStatus =
  | 'pending'
  | 'paid'
  | 'shipped'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'cancelled';

export interface GearListing {
  id: string;
  seller_id: string;
  category: GearCategory;
  title: string;
  description: string;
  brand: string | null;
  model: string | null;
  condition: GearCondition;
  asking_price_cents: number;
  is_negotiable: boolean;
  is_free: boolean;
  pickup_city: string;
  pickup_state: string;
  shipping_available: boolean;
  shipping_cost_cents: number | null;
  status: GearListingStatus;
  ai_gear_tip: string | null;
  cpsc_checked: boolean;
  distance_miles?: number;
  photos?: GearPhoto[];
  created_at: string;
}

export interface GearPhoto {
  id: string;
  listing_id: string;
  storage_path: string;
  public_url: string;
  sort_order: number;
  is_cover: boolean;
}

export interface BabyProfile {
  id: string;
  user_id: string;
  baby_name: string | null;
  date_of_birth: string;
  due_date: string | null;
  gender: 'female' | 'male' | 'nonbinary' | 'unknown' | null;
  birth_weight_grams: number | null;
  is_premature: boolean;
  corrected_age_offset_days: number;
  feeding_method: 'breastfed' | 'formula' | 'combo' | 'pumped' | null;
  current_week_number: number; // generated column
}

export interface MilestoneLibraryEntry {
  id: string;
  week_number: number;
  category: 'motor' | 'social' | 'communication' | 'sleep' | 'feeding' | 'sensory' | 'cognitive';
  title: string;
  description: string;
  hero_emoji: string | null;
  sleep_hours_min: number | null;
  sleep_hours_max: number | null;
  feed_interval_hours_min: number | null;
  feed_interval_hours_max: number | null;
  ai_summary_cache: string | null;
}

export interface BrandDeal {
  id: string;
  partner_name: string;
  partner_logo_url: string | null;
  emoji: string | null;
  headline: string;
  description: string;
  deal_type: 'percent_off' | 'fixed_off' | 'free_item' | 'bogo' | 'first_order';
  discount_percent: number | null;
  discount_cents: number | null;
  promo_code: string | null;
  deeplink_url: string | null;
  expires_at: string;
  is_active: boolean;
  claimed?: boolean;
}
