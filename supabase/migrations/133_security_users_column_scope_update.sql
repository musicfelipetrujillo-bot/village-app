-- 133_security_users_column_scope_update.sql
-- SECURITY (critical) — stop users from granting themselves privileges on their own row.
--
-- THE HOLE
--   `users_update_own` (migration 002:18) is  FOR UPDATE USING (auth.uid() = id)  — it scopes
--   WHICH ROW a caller may update, but nothing scopes WHICH COLUMNS. Supabase issues a
--   table-wide `GRANT UPDATE ON ALL TABLES IN SCHEMA public TO authenticated` by default, so
--   every column on `users` is writable by its owner. Three privilege flags live on that row:
--     * is_clinical_reviewer  (043_v4_phase_b_reviewer_flag.sql:20)
--     * is_event_reviewer     (046_v4_g2_event_review_pipeline.sql:35)
--     * is_pro                (110_villie_pro_entitlement.sql:20)
--
--   So any signed-in user could:
--     PATCH /rest/v1/users?id=eq.<own-id>
--     {"is_clinical_reviewer":true,"is_event_reviewer":true,"is_pro":true}
--
--   ...and thereby (a) pass `is_clinical_reviewer()` (043:39-49), which gates
--   `list_pending_review` / `approve_content_row` / `reject_content_row` (042:298-300) —
--   i.e. PUBLISH ARBITRARY UNREVIEWED AI HEALTH CONTENT to every mother in the app;
--   (b) pass `is_event_reviewer()` (046:42-48) and control the public events feed;
--   (c) hand themselves a free villie Pro subscription, bypassing RevenueCat entirely and
--   defeating the otherwise-solid server-side gate in 110 (`manual_videos_locked_for_caller`).
--
--   Note (c) in particular: migration 110's entitlement gate is correct — playback ids are
--   nulled in SQL and RLS hides locked rows. But the flag it reads was self-writable, so the
--   gate was bypassed one level up. Fixing the flag is what makes 110 actually hold.
--
-- THE FIX — same shape as 095_security_milk_donor_pii_column_revoke.sql, but for UPDATE.
--   Per 095's hard-won lesson: a column-level `REVOKE UPDATE (col)` is a NO-OP while the role
--   still holds a TABLE-wide UPDATE grant — you cannot subtract one column from a table grant.
--   The correct move is to drop the table-wide UPDATE and re-grant UPDATE on an explicit
--   allowlist of user-editable columns.
--
-- ALLOWLIST DERIVATION — every column the mobile client actually writes today, verified by
-- reading each call site (nothing here is speculative):
--   full_name, pregnancy_stage, zip_code, insurance_provider
--                                    apps/mobile/src/screens/me/EditProfileScreen.tsx:233-239
--   avatar_url                       apps/mobile/src/screens/me/EditProfileScreen.tsx:188-189
--   preferred_language               apps/mobile/src/screens/me/MeScreen.tsx:459-460
--   notif_prefs                      apps/mobile/src/screens/me/NotificationPreferencesScreen.tsx:107-108,129-130
--   search_radius_miles              apps/mobile/src/screens/me/RadiusPreferenceScreen.tsx:48-49
--   due_date, phone                  apps/mobile/src/lib/auth.ts:36-52 (authService.updateProfile)
--   anonymous_mode_default           069_v3_c3_anonymous_mode.sql:36 — user-owned preference,
--                                    included so the pending V3 C3 anonymous-mode UI is not
--                                    blocked by this migration when it lands.
--
-- DELIBERATELY EXCLUDED (privilege, identity, or server-owned lifecycle):
--   is_clinical_reviewer, is_event_reviewer, is_pro  -- privilege escalation (the whole point)
--   id, email                                        -- identity; email is synced FROM auth.users
--                                                       by trigger after confirmation
--   deleted_at, deletion_requested_at                -- written by the `account-delete` edge
--                                                       function under service_role (016:68-69)
--   created_at, updated_at                           -- server-owned timestamps
--
-- BLAST RADIUS: none expected. service_role is untouched (it keeps its own grants, so
-- account-delete, the RevenueCat webhook, and pro-entitlement-reconcile all keep working).
-- Only `authenticated` and `anon` are narrowed.
--
-- MAINTENANCE: UPDATE is now an explicit column allowlist. Any NEW user-editable column added
-- to `users` later MUST be added to the grant below, or client writes to it will 403.

begin;

-- authenticated: table-wide UPDATE -> column-scoped UPDATE.
revoke update on public.users from authenticated;
grant update (
  full_name,
  phone,
  avatar_url,
  pregnancy_stage,
  due_date,
  preferred_language,
  insurance_provider,
  zip_code,
  search_radius_miles,
  notif_prefs,
  anonymous_mode_default
) on public.users to authenticated;

-- anon holds no UPDATE policy on users (so it sees no rows to update), but it does hold the
-- default table grant. Mirror the revoke rather than leaving a dangling privilege — defence in
-- depth if an anon-visible policy is ever added by mistake.
revoke update on public.users from anon;

-- Belt-and-braces on the policy itself. Postgres already reuses the USING expression as the
-- WITH CHECK when none is given, so the pre-existing policy did NOT permit reassigning a row
-- to another user's id — the hole was purely the column scope above. Stating WITH CHECK
-- explicitly makes that guarantee visible to the next reader instead of implicit.
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

commit;

-- ── Verification (run after apply) ──
-- Expect: t, t, f, f, f
-- select
--   has_column_privilege('authenticated','public.users','full_name','UPDATE')            as can_name,
--   has_column_privilege('authenticated','public.users','notif_prefs','UPDATE')          as can_prefs,
--   has_column_privilege('authenticated','public.users','is_pro','UPDATE')               as can_pro,
--   has_column_privilege('authenticated','public.users','is_clinical_reviewer','UPDATE') as can_reviewer,
--   has_column_privilege('authenticated','public.users','email','UPDATE')                as can_email;
--
-- End-to-end (as a signed-in user, expect: profile edit 204, privilege grab 403):
--   PATCH /rest/v1/users?id=eq.<self>  {"full_name":"ok"}
--   PATCH /rest/v1/users?id=eq.<self>  {"is_pro":true}
