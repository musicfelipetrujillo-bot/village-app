-- 124 — count-only sibling for the clinical-review queue badge.
--
-- WHY: MeScreen renders a small "N items waiting for review" badge on the
-- Clinical Review row, and refreshed it on every focus by calling
-- `list_pending_review()` — then used nothing but `rows.length`.
--
-- That RPC currently returns 508 rows / ~460 kB (every pending insight,
-- support and checklist row, with full EN + ES bodies). The fetch fires the
-- instant the Clinical Review modal is dismissed, because dismissing it gives
-- focus back to Me. Downloading and parsing half a megabyte of text on the
-- back gesture is a measurable part of why closing that screen felt laggy.
--
-- This is the same query shape and the SAME reviewer gate, but it returns a
-- single integer. Callers that need the rows keep using `list_pending_review`.
--
-- The trending_items branch mirrors the JOIN in `list_pending_review` exactly
-- (JOIN trending_issues, not LEFT JOIN) so the badge can never disagree with
-- the number of cards the dashboard actually renders.

CREATE OR REPLACE FUNCTION public.count_pending_review()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
  WITH allowed AS (
    SELECT is_clinical_reviewer() AS ok
  )
  SELECT (
      (SELECT count(*) FROM maternal_insights mi
        WHERE (SELECT ok FROM allowed)
          AND mi.clinical_advisor_reviewed = FALSE)
    + (SELECT count(*) FROM village_supports vs
        WHERE (SELECT ok FROM allowed)
          AND vs.clinical_advisor_reviewed = FALSE)
    + (SELECT count(*) FROM week_checklists wc
        WHERE (SELECT ok FROM allowed)
          AND wc.clinical_advisor_reviewed = FALSE)
    + (SELECT count(*) FROM trending_items ti
        JOIN trending_issues tis ON tis.id = ti.issue_id
        WHERE (SELECT ok FROM allowed)
          AND ti.status = 'in_review'
          AND ti.is_medical_claim = TRUE)
  )::INTEGER;
$function$;

-- Grants follow the migration 054 pattern: Supabase issues *explicit* default
-- grants to anon/authenticated/service_role, so REVOKE FROM PUBLIC alone is a
-- no-op — anon has to be revoked by name.
REVOKE ALL ON FUNCTION public.count_pending_review() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_pending_review() FROM anon;
GRANT EXECUTE ON FUNCTION public.count_pending_review() TO authenticated, service_role;

COMMENT ON FUNCTION public.count_pending_review() IS
  'Count-only sibling of list_pending_review(). Same is_clinical_reviewer() gate. Use for the Me-tab badge so a focus event does not pull the full ~460 kB review payload.';
