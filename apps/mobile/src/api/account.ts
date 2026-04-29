// A2.c — Account API. Currently only delete; future: data export.
//
// `deleteAccount` calls the `account-delete` edge function which sets
// users.deleted_at + deletion_requested_at. The cascade through milk_*,
// gear_*, baby_profiles etc. is gated on attorney sign-off and lives as
// a TODO in the edge function — this client just exposes the intent.

import { supabase } from '@/lib/supabase';

export interface DeleteAccountResult {
  ok: true;
  already_deleted: boolean;
  cascade_pending: 'attorney-review';
}

export const accountApi = {
  /**
   * Soft-delete the calling user's account. After success the caller MUST
   * sign out — `users.deleted_at` is now set, the RLS policy filters the
   * row out, and any subsequent profile read returns empty.
   */
  async deleteAccount(): Promise<DeleteAccountResult> {
    const { data, error } = await supabase.functions.invoke<DeleteAccountResult>(
      'account-delete',
      { body: {} },
    );
    if (error) throw new Error(error.message ?? 'account_delete_failed');
    if (!data) throw new Error('account_delete_no_response');
    return data;
  },
};
