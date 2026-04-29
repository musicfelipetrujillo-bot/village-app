// V4 Phase G3 — Brand Perks API (catalog + claims + affiliate click resolution)
import { supabase } from '@/lib/supabase';
import type { AgeTag } from '@api/events';

export type DealType = 'discount_code' | 'affiliate_link' | 'free_sample' | 'partner_offer';
export type RedemptionMethod = 'show_code' | 'tap_link' | 'request_sample';
export type AffiliateNetwork = 'impact' | 'shareasale' | 'cj' | 'direct' | 'none';
export type DealCategory =
  | 'feeding' | 'sleep' | 'gear' | 'apparel' | 'health' | 'learning' | 'services' | 'other';
export type ClaimStatus = 'clicked' | 'confirmed' | 'expired';

/** Row returned by list_perks RPC — trimmed for the browse feed. */
export interface PerkCard {
  id: string;
  brand_name: string;
  brand_logo_url: string | null;
  hero_image_url: string | null;
  title: string;
  short_description: string;
  category: DealCategory;
  deal_type: DealType;
  redemption_method: RedemptionMethod;
  discount_label: string | null;
  affiliate_network: AffiliateNetwork;
  eligibility_age_tags: AgeTag[];
  is_partner: boolean;
  disclosure_required: boolean;
  ends_at: string | null;
  already_claimed: boolean;
}

/** Full row from brand_deals. */
export interface PerkDetail {
  id: string;
  brand_name: string;
  brand_logo_url: string | null;
  hero_image_url: string | null;
  title: string;
  short_description: string;
  long_description: string;
  terms_url: string | null;
  category: DealCategory;
  deal_type: DealType;
  redemption_method: RedemptionMethod;
  discount_code: string | null;
  discount_label: string | null;
  affiliate_network: AffiliateNetwork;
  direct_url: string | null;
  eligibility_age_tags: AgeTag[];
  eligibility_countries: string[];
  is_partner: boolean;
  disclosure_required: boolean;
  starts_at: string | null;
  ends_at: string | null;
  status: 'active' | 'paused' | 'ended';
}

export interface ClaimResult {
  claim_id: string;
  click_url: string | null;
  discount_code: string | null;
  deal_type: DealType;
  redemption_method: RedemptionMethod;
  subid: string;
}

export interface MyClaimRow {
  claim_id: string;
  claimed_at: string;
  status: ClaimStatus;
  webhook_confirmed_at: string | null;
  converted_amount_cents: number | null;
  revealed_code: string | null;
  click_url: string | null;
  deal_id: string;
  brand_name: string;
  title: string;
  deal_type: DealType;
  brand_logo_url: string | null;
  category: DealCategory;
}

export interface ListPerksParams {
  ageTags?: AgeTag[] | null;
  country?: string | null;
  category?: DealCategory | null;
}

export const perksApi = {
  async listPerks(params: ListPerksParams = {}): Promise<PerkCard[]> {
    const { ageTags = null, country = 'US', category = null } = params;
    const { data, error } = await supabase.rpc('list_perks', {
      p_age_tags: ageTags,
      p_country: country,
      p_category: category,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as PerkCard[];
  },

  async getPerk(id: string): Promise<PerkDetail | null> {
    const { data, error } = await supabase
      .from('brand_deals')
      .select(`
        id, brand_name, brand_logo_url, hero_image_url,
        title, short_description, long_description, terms_url, category,
        deal_type, redemption_method, discount_code, discount_label,
        affiliate_network, direct_url,
        eligibility_age_tags, eligibility_countries,
        is_partner, disclosure_required,
        starts_at, ends_at, status
      `)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as PerkDetail | null) ?? null;
  },

  /**
   * Records a click and returns the redemption payload.
   * - `affiliate_link` / `partner_offer` → open `click_url` in browser
   * - `discount_code` → show `discount_code`, optionally open `click_url` (brand site)
   * - `free_sample`  → open `click_url` (brand sample form)
   */
  async claimPerk(dealId: string): Promise<ClaimResult> {
    const { data, error } = await supabase.rpc('claim_perk', { p_deal_id: dealId });
    if (error) throw new Error(error.message);
    // Supabase returns an array for SETOF/TABLE-returning functions
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('claim failed');
    return row as ClaimResult;
  },

  async listMyClaims(): Promise<MyClaimRow[]> {
    const { data, error } = await supabase.rpc('list_my_claims');
    if (error) throw new Error(error.message);
    return (data ?? []) as MyClaimRow[];
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ────────────────────────────────────────────────────────────────────────────
export function ctaLabelFor(deal: Pick<PerkCard | PerkDetail, 'deal_type' | 'redemption_method'>): string {
  switch (deal.redemption_method) {
    case 'show_code':      return 'Reveal code';
    case 'tap_link':       return deal.deal_type === 'partner_offer' ? 'Open partner offer' : 'Open link';
    case 'request_sample': return 'Request sample';
  }
}

export function categoryLabel(c: DealCategory): string {
  switch (c) {
    case 'feeding':  return 'Feeding';
    case 'sleep':    return 'Sleep';
    case 'gear':     return 'Gear';
    case 'apparel':  return 'Apparel';
    case 'health':   return 'Health';
    case 'learning': return 'Learning';
    case 'services': return 'Services';
    case 'other':    return 'Other';
  }
}

/** FTC-facing disclosure copy — used on PerkDetail + PerkClaim. */
export function disclosureTextFor(network: AffiliateNetwork, isPartner: boolean): string | null {
  if (network === 'none' && !isPartner) return null;
  if (network === 'none' && isPartner) {
    return 'Partner offer. Brand terms apply — The Village does not operate this promotion.';
  }
  return 'Affiliate offer. The Village may earn a commission on qualifying purchases at no extra cost to you.';
}

export function claimStatusLabel(s: ClaimStatus): string {
  switch (s) {
    case 'clicked':   return 'Clicked';
    case 'confirmed': return 'Confirmed';
    case 'expired':   return 'Expired';
  }
}
