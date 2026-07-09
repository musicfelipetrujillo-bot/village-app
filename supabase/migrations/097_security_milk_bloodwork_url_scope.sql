-- 097_security_milk_bloodwork_url_scope.sql
--
-- Fixes a special-category (health data) exposure surfaced by the data-privacy
-- minimization pass (docs/audits/privacy-minimization-2026-07-09.md, gap #4) and
-- confirmed live 2026-07-09.
--
-- FINDING: `milk_trust_badges` has a `bloodwork_report_url` column (a link to a
-- donor's blood-test report). Its SELECT policy `milk_trust_badges_select` is
-- `qual = true` for the `authenticated` role, and — like milk_donor_profiles before
-- migration 095 — the role holds a TABLE-wide SELECT grant. So EVERY signed-in user
-- can read EVERY donor's bloodwork_report_url. That is special-category health data
-- (PHI-adjacent) exposed to all authenticated users. Confirmed: has_column_privilege(
-- 'authenticated', ..., 'bloodwork_report_url', 'SELECT') = true.
--
-- Currently 0 rows carry a URL and the storage bucket isn't created yet (unwired
-- scaffolding), so this is a zero-exposure, pre-launch fix — landed before the
-- bloodwork-upload feature is wired and real report links arrive.
--
-- FIX (same shape as 095): drop the table-wide SELECT and re-grant SELECT on every
-- column EXCEPT bloodwork_report_url. The public/authenticated trust badge should
-- expose bloodwork_LINKED (bool) + bloodwork_VERIFIED_AT, never the raw report URL.
-- The URL stays readable only by service_role (and the owner-management path, to be
-- built as an owner-scoped RPC when the upload feature is actually wired).
--
-- COMPANION: api/milk.ts getTrustBadge() switches select('*') -> TRUST_BADGE_SELECT_COLUMNS
-- (omits bloodwork_report_url); select('*') would 403 after this REVOKE. Ship together.

begin;

revoke select on public.milk_trust_badges from authenticated;
grant select (
  id, donor_profile_id, questionnaire_complete, questionnaire_completed_at,
  bloodwork_linked, bloodwork_verified_at, diet_disclosed, medications_disclosed,
  badge_level, ai_safety_score, ai_safety_flags, ai_last_evaluated_at,
  created_at, updated_at, ai_trust_narrative, ai_trust_narrative_cached_at
) on public.milk_trust_badges to authenticated;

revoke select on public.milk_trust_badges from anon;
grant select (
  id, donor_profile_id, questionnaire_complete, questionnaire_completed_at,
  bloodwork_linked, bloodwork_verified_at, diet_disclosed, medications_disclosed,
  badge_level, ai_safety_score, ai_safety_flags, ai_last_evaluated_at,
  created_at, updated_at, ai_trust_narrative, ai_trust_narrative_cached_at
) on public.milk_trust_badges to anon;

commit;

-- ── Verification (run after apply) ──
-- select
--   has_column_privilege('authenticated','public.milk_trust_badges','bloodwork_report_url','SELECT') as auth_bloodwork_url,
--   has_column_privilege('authenticated','public.milk_trust_badges','badge_level','SELECT')          as auth_badge_ok;
-- Expected: auth_bloodwork_url = FALSE, auth_badge_ok = TRUE.
