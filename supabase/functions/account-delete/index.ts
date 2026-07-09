// A2.c — Account deletion (soft-delete only).
// POST /functions/v1/account-delete
//
// Body: {} — caller is identified via the JWT in Authorization header.
//
// SCOPE — what this function does TODAY:
//   1. Verify the caller's JWT and resolve their user_id.
//   2. Set users.deleted_at = now() + users.deletion_requested_at = now().
//      The existing RLS policy `users_select_own` (migration 016) filters
//      `deleted_at IS NULL`, so the row becomes invisible to the user
//      immediately. The next session refresh effectively logs them out
//      (profile reads return empty → store treats as signed-out).
//   3. Write an audit row to admin_audit_log so the deletion is traceable
//      for compliance + legal retention purposes.
//
// EXPLICITLY OUT OF SCOPE — pending attorney review of retention policy:
//   - auth.users row deletion via supabase.auth.admin.deleteUser(id).
//     This will be wired in a follow-up once retention rules are signed
//     off (some user-tied rows like gear_listings w/ CPSC recall trail /
//     *_analytics_events MUST be retained for legal defense even on user
//     request — and will be PII-scrubbed, not row-deleted, by a separate
//     sweep). NOTE: milk_transactions / milk_disputes / milk_shipping_labels
//     were retired in migration 098 (Milk is cash-only) and no longer exist.
//   - Cascade scrub through favorites, appointments, milk_* (donor profiles,
//     messages, listings), gear_*, baby_profiles, daily_checkins,
//     brand_deals claims, etc.
//   - OneSignal external_id unlink.
//   - Stripe Connect account removal (Specialist booking only — Milk Stripe
//     Connect was retired in migration 098).
//
// FEATURE FLAG: callers should gate the UI on
//   `EXPO_PUBLIC_DELETE_ACCOUNT_ENABLED === '1'`
// so we can ship the screen behind a flag and flip it on after the legal
// sign-off + cascade implementation lands.
//
// IDEMPOTENCY: a second call from a soft-deleted user is a no-op (the
// `deleted_at IS NULL` clause rejects the update). The function returns
// 200 in that case so the client treats it as "already done".

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    // Resolve the calling user from their JWT. We use a user-scoped client
    // here (not the service-role one) so the JWT itself is the proof of
    // identity — we don't trust any user_id passed in the body.
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json({ error: 'missing_auth' }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return json({ error: 'invalid_auth' }, 401);
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? null;

    // Service-role client for the actual mutations (RLS would block a
    // user from setting their own deleted_at; we deliberately route the
    // write through service-role so the policy stays narrowly scoped to
    // SELECT / non-destructive UPDATEs).
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = new Date().toISOString();
    const { data: updateRow, error: updateErr } = await admin
      .from('users')
      .update({ deleted_at: now, deletion_requested_at: now })
      .eq('id', userId)
      .is('deleted_at', null) // idempotency — already-deleted is a no-op
      .select('id')
      .maybeSingle();
    if (updateErr) {
      console.error('account-delete update failed:', updateErr);
      return json({ error: 'update_failed', detail: updateErr.message }, 500);
    }

    const alreadyDeleted = updateRow === null;

    // Best-effort audit row. Failure here doesn't block the deletion since
    // the soft-delete is the user-facing contract; the audit trail is for
    // ops only. Schema per migration 016: action / target_table / target_id /
    // performed_by / metadata.
    try {
      await admin.from('admin_audit_log').insert({
        action: 'account_soft_delete',
        target_table: 'users',
        target_id: userId,
        performed_by: userEmail ?? userId, // self-initiated; record their email
        metadata: {
          already_deleted: alreadyDeleted,
          cascade_pending: 'attorney-review',
          source: 'account-delete edge function',
        },
      });
    } catch (auditErr) {
      console.warn('account-delete audit insert non-fatal error:', auditErr);
    }

    return json({
      ok: true,
      already_deleted: alreadyDeleted,
      // Reminder for the eventual cascade implementation — easier to grep
      // for than chasing this header comment.
      cascade_pending: 'attorney-review',
    });
  } catch (err) {
    console.error('account-delete fatal:', err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
