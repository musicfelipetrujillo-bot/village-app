// momTips — the "mom tips" surface in Mama's Corner (migration 120/121/122).
//
// One tip per day, addressed to the week of HER baby's life. No streaks, no
// per-user state, no "you missed yesterday" — the day of the year picks the
// row, so a mom who opens this twice a week never falls behind at anything.
// Same restraint as Reset & Recharge.
//
// ⚠️ The RPCs return ONLY rows the clinical reviewer has approved. Until that
// pass happens the tables are seeded but every row is 'draft', so these calls
// legitimately return nothing. An empty result is NOT an error — the screen
// renders a calm empty state rather than a failure.
import { supabase } from '../lib/supabase';

export type MomTipCategory = 'you' | 'feed' | 'sleep' | 'care' | 'play';

export interface MomTip {
  week_number: number;
  day_index: number;
  category: MomTipCategory;
  title: string;
  body: string;
}

export const CATEGORY_LABEL: Record<MomTipCategory, { en: string; es: string }> = {
  you: { en: 'For you', es: 'Para ti' },
  feed: { en: 'Feeding', es: 'Alimentación' },
  sleep: { en: 'Sleep', es: 'Sueño' },
  care: { en: 'Care', es: 'Cuidado' },
  play: { en: 'Play', es: 'Juego' },
};

/**
 * Today's tip for a given baby-week. Returns null when nothing is approved yet.
 *
 * Falls back to 'en' when her locale has no row. The seed is English-only and
 * the RPC matches locale exactly, so a Spanish mom was getting a permanently
 * empty screen — not "awaiting review", just nothing, forever. An English tip
 * she can read beats a blank screen; when the ES pass lands this stops firing
 * on its own.
 */
export async function getTipForToday(week: number, locale = 'en'): Promise<MomTip | null> {
  const row = await fetchTipForToday(week, locale);
  if (row || locale === 'en') return row;
  return fetchTipForToday(week, 'en');
}

async function fetchTipForToday(week: number, locale: string): Promise<MomTip | null> {
  const { data, error } = await supabase.rpc('get_mom_tip_for_today', {
    p_week: clampWeek(week),
    p_locale: locale,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as MomTip) ?? null;
}

/** All seven tips for a baby-week, ordered by day. Empty until review passes. */
export async function listTipsForWeek(week: number, locale = 'en'): Promise<MomTip[]> {
  const rows = await fetchTipsForWeek(week, locale);
  if (rows.length || locale === 'en') return rows;
  return fetchTipsForWeek(week, 'en');
}

async function fetchTipsForWeek(week: number, locale: string): Promise<MomTip[]> {
  const { data, error } = await supabase.rpc('list_mom_tips_for_week', {
    p_week: clampWeek(week),
    p_locale: locale,
  });
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({ ...r, week_number: clampWeek(week) })) as MomTip[];
}

// ─── clinical review (migration 123) ──────────────────────────────────────
// The 371 seeded tips all land 'draft' and the read RPCs only return
// 'approved', so until a reviewer works through them the screen is empty by
// design. These are the reviewer's side of that gate — every one is
// server-gated on `is_clinical_reviewer()`.

export interface MomTipForReview extends MomTip {
  id: string;
  locale: string;
  review_status: 'draft' | 'in_review' | 'approved' | 'rejected';
  review_notes: string | null;
  reviewed_at: string | null;
}

export interface MomTipReviewSummary {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
  /** Lowest week still holding an unreviewed row — where to resume. */
  next_week: number | null;
}

export async function listTipsForReview(week: number): Promise<MomTipForReview[]> {
  const { data, error } = await supabase.rpc('list_mom_tips_for_review', { p_week: clampWeek(week) });
  if (error) throw error;
  return (data ?? []) as MomTipForReview[];
}

export async function getReviewSummary(): Promise<MomTipReviewSummary | null> {
  const { data, error } = await supabase.rpc('mom_tips_review_summary');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as MomTipReviewSummary) ?? null;
}

/** Approves the seven tips of one week. Returns how many rows moved. */
export async function approveTipsWeek(week: number, notes?: string): Promise<number> {
  const { data, error } = await supabase.rpc('approve_mom_tips_week', {
    p_week: clampWeek(week),
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

/**
 * The content spans weeks 0-52. A baby past a year keeps getting week-52 tips
 * rather than an empty screen — the last week is written to still land for a
 * mom whose baby is older, so this degrades into something reasonable instead
 * of a gap. A missing/negative week reads as week 0.
 */
function clampWeek(week: number): number {
  if (!Number.isFinite(week)) return 0;
  return Math.max(0, Math.min(52, Math.round(week)));
}
