-- 134_security_specialists_drop_permissive_select.sql
-- SECURITY (high) — make the specialist admin-approval boundary actually enforce.
--
-- THE HOLE — a rename that silently voided a security control.
--   002_v1_rls_policies.sql:22 created:
--       CREATE POLICY "specialists_select_all" ON specialists FOR SELECT USING (true);
--   013_v1_admin_approval.sql:49 intended to replace it, and dropped:
--       DROP POLICY IF EXISTS "Specialists are publicly readable" ON specialists;
--   ...which is a DIFFERENT NAME. `IF EXISTS` swallowed the miss, the migration succeeded, and
--   `specialists_select_all` survived. RLS permissive policies are OR'd, so the new
--   "Approved specialists are publicly readable" (013:51-54, admin_approved = TRUE) never
--   constrained anything — USING(true) always won.
--
--   015_v1_rls_audit.sql:3 records "specialists_select_now enforces admin_approved (set in
--   013)". It never did. That comment is why this went unnoticed for ~120 migrations.
--
-- IMPACT — `specialists_select_all` has no TO clause, so it applies to every role including
--   anon. The table carries phone, address_line1, lat/lng, npi_number, stripe_account_id,
--   telehealth_link (001:26-61) and admin_rejection_reason (013:9). With only the publishable
--   anon key (shipped in the mobile bundle and on the marketing site), anyone could run:
--
--     GET /rest/v1/specialists?admin_approved=eq.false
--         &select=full_name,phone,address_line1,stripe_account_id,admin_rejection_reason
--
--   ...reading PENDING and REJECTED practitioners — including the internal free-text reason a
--   clinician was turned down, and their Stripe Connect account id.
--
-- THE FIX — drop the stale policy. 013 already created the correct replacement, so no new
--   policy is needed here; this migration only removes what 013 meant to remove.
--
--   Resulting policy set on `specialists`:
--     "Approved specialists are publicly readable"  SELECT  TO authenticated  admin_approved = TRUE   (013)
--     "Service role has full access to specialists" ALL     TO service_role   USING (TRUE)            (013)
--     "specialists_insert_service"                  INSERT  auth.role() = 'service_role'              (002)
--     "specialists_update_service"                  UPDATE  auth.role() = 'service_role'              (002)
--
-- BLAST RADIUS — verified before writing, not assumed:
--   * anon loses SELECT entirely. Checked: the marketing site (village-website/) never reads
--     the specialists table; its specialist onboarding goes through the
--     `get_specialist_invite_by_token` SECURITY DEFINER RPC, which is unaffected.
--   * Of the 8 edge functions touching `specialists`, 7 use the service-role client and
--     bypass RLS. The 8th, `create-payment-intent`, runs under the caller's JWT — it keeps
--     `authenticated` SELECT on approved specialists, which is exactly the row it needs to
--     price a booking.
--   * Mobile browses specialists only while signed in (`specialists_near` + the directory
--     screens), so `TO authenticated` matches real usage.
--   * Unapproved specialists disappearing from anon reads IS the intended behaviour — that is
--     the control 013 was written to add.

begin;

drop policy if exists "specialists_select_all" on public.specialists;

commit;

-- ── Verification (run after apply) ──
-- Expect exactly the four policies listed above, and no USING(true) SELECT among them:
--   select policyname, cmd, roles, qual
--   from pg_policies
--   where schemaname = 'public' and tablename = 'specialists'
--   order by policyname;
--
-- End-to-end (anon key, expect 0 rows — previously returned pending + rejected rows):
--   GET /rest/v1/specialists?admin_approved=eq.false&select=full_name,admin_rejection_reason
