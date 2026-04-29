// V4 — Manual completion ledger (migration 049).
// The Manual's "today's reading" 4-row checklist drives completion state
// off these RPCs. Item keys are the hardcoded '01'..'04' that live in
// ManualHomeScreen for now; when manual_articles ships, callers will pass
// the article id instead and the same ledger continues to work.
import { supabase } from '@/lib/supabase';

export async function getManualProgress(week: number): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('get_manual_progress', {
    p_week_number: week,
  });
  if (error) throw error;
  // RPC always returns TEXT[] (never NULL) — splat into a Set for O(1) lookups.
  return new Set<string>(Array.isArray(data) ? (data as string[]) : []);
}

export async function markManualItemComplete(
  week: number,
  itemKey: string,
): Promise<void> {
  const { error } = await supabase.rpc('mark_manual_item_complete', {
    p_week_number: week,
    p_item_key: itemKey,
  });
  if (error) throw error;
}
