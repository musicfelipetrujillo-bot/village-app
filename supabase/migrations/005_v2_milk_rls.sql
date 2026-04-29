-- V2 Milk Connect — RLS policies

-- ── milk_donor_profiles ────────────────────────────────────
-- Active donors visible to all authenticated users
CREATE POLICY "milk_donor_profiles_select_active" ON milk_donor_profiles
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

-- Donor can always see their own profile (even if inactive)
CREATE POLICY "milk_donor_profiles_select_own" ON milk_donor_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Donor can insert their own profile
CREATE POLICY "milk_donor_profiles_insert_own" ON milk_donor_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Donor can update their own profile
CREATE POLICY "milk_donor_profiles_update_own" ON milk_donor_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "milk_donor_profiles_service" ON milk_donor_profiles
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── milk_trust_badges ──────────────────────────────────────
-- Readable by all (badge level is public info)
CREATE POLICY "milk_trust_badges_select" ON milk_trust_badges
  FOR SELECT TO authenticated USING (TRUE);

-- Only service_role writes (badge level computed server-side)
CREATE POLICY "milk_trust_badges_service" ON milk_trust_badges
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── milk_questionnaire_responses ──────────────────────────
-- Donor reads/writes own responses
CREATE POLICY "milk_questionnaire_select_own" ON milk_questionnaire_responses
  FOR SELECT TO authenticated
  USING (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "milk_questionnaire_insert_own" ON milk_questionnaire_responses
  FOR INSERT TO authenticated
  WITH CHECK (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "milk_questionnaire_service" ON milk_questionnaire_responses
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── milk_donor_diet_flags ─────────────────────────────────
-- Public read (diet info shown on profile)
CREATE POLICY "milk_diet_flags_select" ON milk_donor_diet_flags
  FOR SELECT TO authenticated USING (TRUE);

-- Donor writes own
CREATE POLICY "milk_diet_flags_write_own" ON milk_donor_diet_flags
  FOR ALL TO authenticated
  USING (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ));

-- ── milk_donor_medications ────────────────────────────────
-- Donor reads own; public gets redacted view via profile screen (not direct select)
CREATE POLICY "milk_medications_own" ON milk_donor_medications
  FOR ALL TO authenticated
  USING (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "milk_medications_service" ON milk_donor_medications
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── milk_listings ─────────────────────────────────────────
-- Active listings readable by all
CREATE POLICY "milk_listings_select_active" ON milk_listings
  FOR SELECT TO authenticated
  USING (status = 'active');

-- Donor sees own listings regardless of status
CREATE POLICY "milk_listings_select_own" ON milk_listings
  FOR SELECT TO authenticated
  USING (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ));

-- Donor inserts/updates own listings
CREATE POLICY "milk_listings_write_own" ON milk_listings
  FOR ALL TO authenticated
  USING (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "milk_listings_service" ON milk_listings
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── milk_transactions ─────────────────────────────────────
-- Donor sees transactions for their listings
CREATE POLICY "milk_transactions_select_donor" ON milk_transactions
  FOR SELECT TO authenticated
  USING (donor_profile_id IN (
    SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid()
  ));

-- Recipient sees their own transactions
CREATE POLICY "milk_transactions_select_recipient" ON milk_transactions
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "milk_transactions_service" ON milk_transactions
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── milk_message_threads ──────────────────────────────────
CREATE POLICY "milk_threads_select" ON milk_message_threads
  FOR SELECT TO authenticated
  USING (
    recipient_user_id = auth.uid() OR
    donor_profile_id IN (SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "milk_threads_insert" ON milk_message_threads
  FOR INSERT TO authenticated
  WITH CHECK (recipient_user_id = auth.uid());

CREATE POLICY "milk_threads_service" ON milk_message_threads
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── milk_messages ─────────────────────────────────────────
CREATE POLICY "milk_messages_select" ON milk_messages
  FOR SELECT TO authenticated
  USING (thread_id IN (
    SELECT id FROM milk_message_threads
    WHERE recipient_user_id = auth.uid()
      OR donor_profile_id IN (SELECT id FROM milk_donor_profiles WHERE user_id = auth.uid())
  ));

CREATE POLICY "milk_messages_insert" ON milk_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "milk_messages_service" ON milk_messages
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── milk_reviews ──────────────────────────────────────────
CREATE POLICY "milk_reviews_select" ON milk_reviews
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "milk_reviews_insert" ON milk_reviews
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_user_id = auth.uid());

CREATE POLICY "milk_reviews_service" ON milk_reviews
  FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- ── milk_saved_donors ─────────────────────────────────────
CREATE POLICY "milk_saved_select_own" ON milk_saved_donors
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "milk_saved_write_own" ON milk_saved_donors
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
