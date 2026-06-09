// V10 — Villie's Picks API. Editorial weekly product recommendations
// (books, toys, gear). Separate from brand_deals/perks: picks are curated
// product recs (simple affiliate URL + FTC disclosure), not brand-partnership
// deals — so they don't ride the perk redemption / webhook / claim machinery.
import { supabase } from '@/lib/supabase';

export interface VilliePick {
  id: string;
  name: string;
  blurb: string;
  emoji: string | null;
  image_url: string | null;
  affiliate_url: string | null;
  category: string;
  eligibility_age_tags: string[];
  sort_order: number;
}

export const picksApi = {
  async listPicks(limit = 8): Promise<VilliePick[]> {
    const { data, error } = await supabase
      .from('villie_picks')
      .select('id, name, blurb, emoji, image_url, affiliate_url, category, eligibility_age_tags, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .limit(limit);
    if (error) {
      // Fail soft: the table may not be deployed on this env yet (migration
      // 073 pending), or there's no session. An empty list hides the section.
      console.warn('[picks] listPicks', error.message);
      return [];
    }
    return (data ?? []) as VilliePick[];
  },
};
