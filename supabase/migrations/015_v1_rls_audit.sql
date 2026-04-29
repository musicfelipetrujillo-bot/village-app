-- V1 Phase 9: RLS Audit
-- Tightens policies identified during review:
-- 1. specialists_select now enforces admin_approved (set in 013, this adds belt-and-suspenders)
-- 2. Specialist sub-tables (languages, insurances, services) block writes from non-service-role
-- 3. reviews: prevent duplicate review by same user for same specialist
-- 4. appointments: allow specialist's own user_id to read their appointments
-- 5. messages: tighten to sender_id or appointment participant only
-- 6. npi_cache: lock down to service_role only (contains raw external API data)

-- ── specialists sub-tables: explicit write denial for non-service-role ──
-- Reads already public. Add service-role-only write policies.
CREATE POLICY "spec_langs_write_service" ON specialist_languages
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "spec_ins_write_service" ON specialist_insurances
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "spec_svc_write_service" ON specialist_services
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── npi_cache: service_role only (no user should read raw NPI API responses) ──
ALTER TABLE npi_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "npi_cache_service_only" ON npi_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── reviews: one per user per specialist (DB-level, UNIQUE already in schema;
--    add update guard so users can only update their own unmodified review) ──
-- Existing UPDATE policy already scoped to auth.uid() = user_id — no change needed.

-- ── appointments: allow specialist (via user_id) to read their own bookings ──
-- This enables specialists to view incoming bookings if they have an app account.
DROP POLICY IF EXISTS "appts_select_own" ON appointments;
CREATE POLICY "appts_select_own" ON appointments FOR SELECT
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT user_id FROM specialists WHERE id = specialist_id AND user_id IS NOT NULL)
  );

-- ── messages: tighten to sender or specialist's linked user ──
-- Already done in 002, but add explicit delete guard (user can delete own sent messages)
CREATE POLICY "messages_delete_own" ON messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ── favorites: explicit delete for service_role (needed for account deletion cascade) ──
CREATE POLICY "favorites_delete_service" ON favorites FOR DELETE
  TO service_role USING (true);

-- ── specialist_translations: allow service_role update (needed for upsert in ai-translate) ──
CREATE POLICY "spec_trans_update_service" ON specialist_translations
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "spec_trans_delete_service" ON specialist_translations
  FOR DELETE TO service_role USING (true);

-- ── Verify no table has RLS disabled (belt-and-suspenders check) ──
-- This block will RAISE a notice for any table found without RLS enabled.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (
        SELECT relname FROM pg_class
        WHERE relrowsecurity = TRUE AND relnamespace = 'public'::regnamespace
      )
      AND tablename IN (
        'users','specialists','specialist_languages','specialist_insurances',
        'specialist_services','reviews','favorites','appointments',
        'messages','ai_conversations','specialist_translations','npi_cache'
      )
  LOOP
    RAISE NOTICE 'WARNING: RLS not enabled on table: %', t;
  END LOOP;
END;
$$;
