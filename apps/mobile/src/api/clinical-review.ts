// V4 Phase B — Clinical-advisor review dashboard API.
//
// Wraps the three RPCs added in migration 042. The dashboard is INTERNAL
// ONLY — gated by EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED in RootNavigator and
// further gated server-side by `is_clinical_reviewer()` inside each RPC.
//
// Public RLS already restricts SELECT on the underlying tables to
// `review_status='approved'`, so this module is the only legitimate path
// to read pending content from the mobile client.

import { supabase } from '@/lib/supabase';

export type ReviewableSourceTable =
  | 'maternal_insights'
  | 'village_supports'
  | 'week_checklists';

export interface PendingReviewRow {
  source_table: ReviewableSourceTable;
  row_id: string;
  week_number: number;
  category: string;             // mi.category | vs.support_type | wc.category
  title: string;                // wc rows: same as body_en (item_text)
  body_en: string;
  body_es: string | null;
  hero_emoji: string | null;
  requires_crisis_footer: boolean;
  cta_label: string | null;
  cta_target: string | null;
  is_essential: boolean | null;
  review_status: 'pending' | 'approved' | 'rejected';
  clinical_advisor_reviewed: boolean;
  review_notes: string | null;
  created_at: string;
}

export const clinicalReviewApi = {
  async listPending(): Promise<PendingReviewRow[]> {
    const { data, error } = await supabase.rpc('list_pending_review');
    if (error) throw error;
    return (data ?? []) as PendingReviewRow[];
  },

  async approve(
    table: ReviewableSourceTable,
    id: string,
    notes?: string,
  ): Promise<void> {
    const { error } = await supabase.rpc('approve_content_row', {
      p_table: table,
      p_id: id,
      p_notes: notes ?? null,
    });
    if (error) throw error;
  },

  async reject(
    table: ReviewableSourceTable,
    id: string,
    notes: string,
  ): Promise<void> {
    const { error } = await supabase.rpc('reject_content_row', {
      p_table: table,
      p_id: id,
      p_notes: notes,
    });
    if (error) throw error;
  },
};

// ─── render helpers ──────────────────────────────────────────────────────
export function sourceTableLabel(t: ReviewableSourceTable): string {
  switch (t) {
    case 'maternal_insights': return 'Insight';
    case 'village_supports':  return 'Support';
    case 'week_checklists':   return 'Checklist';
  }
}

// Heuristic source classifier. Migration 036's seeded rows land with
// review_notes that start with "Seed content"; AI-cron-filled rows use a
// different prefix ("Backfilled by …"). Reviewers don't strictly need this
// — just a UI hint. Falls back to "Unknown" when notes are null.
export function rowSource(row: PendingReviewRow): 'seed' | 'ai' | 'unknown' {
  if (!row.review_notes) return 'unknown';
  const n = row.review_notes.toLowerCase();
  if (n.startsWith('seed')) return 'seed';
  if (n.includes('backfill') || n.includes('ai') || n.includes('generated')) return 'ai';
  return 'unknown';
}
