// V4 G2 — Event review API.
//
// Mirrors the clinical-review API pattern (apps/mobile/src/api/clinical-review.ts)
// but for the AI-screened ingest pipeline (Pass 2 of self-sustaining events).
// Internal-only: gated by `users.is_event_reviewer = TRUE` server-side via
// the SECURITY DEFINER `is_event_reviewer()` helper. Non-reviewers calling
// these RPCs get an empty list / `42501 not authorized` error.
//
// All three RPCs live in migration 046.

import { supabase } from '@/lib/supabase';

export interface PendingEventRow {
  id: string;
  title: string;
  description: string;
  type: 'local' | 'webinar';
  starts_at: string;
  ends_at: string;
  city: string | null;
  venue_name: string | null;
  stream_url: string | null;
  host_name: string;
  is_partner: boolean;
  is_third_party: boolean;
  age_tags: string[];
  suggested_age_tags: string[] | null;
  ingestion_confidence: number | null;
  ingestion_notes: string | null;
  source_feed_id: string | null;
  source_partner_name: string | null;
  created_at: string;
}

export const eventReviewApi = {
  async listPending(): Promise<PendingEventRow[]> {
    const { data, error } = await supabase.rpc('list_pending_events');
    if (error) throw error;
    return (data ?? []) as PendingEventRow[];
  },

  async approve(
    id: string,
    opts?: { notes?: string; ageTags?: string[] },
  ): Promise<void> {
    const { error } = await supabase.rpc('approve_event', {
      p_id: id,
      p_notes: opts?.notes ?? null,
      p_age_tags: opts?.ageTags ?? null,
    });
    if (error) throw error;
  },

  async reject(id: string, notes: string): Promise<void> {
    const { error } = await supabase.rpc('reject_event', {
      p_id: id,
      p_notes: notes,
    });
    if (error) throw error;
  },
};

// ─── render helpers ──────────────────────────────────────────────────────
export function confidenceLabel(c: number | null): string {
  if (c === null) return 'unscreened';
  if (c >= 0.85) return 'high';
  if (c >= 0.55) return 'medium';
  return 'low';
}

export function confidencePercent(c: number | null): string {
  return c === null ? '—' : `${Math.round(c * 100)}%`;
}
