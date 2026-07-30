-- 112_unpublish_buzz_smoke_test.sql
-- Data fix (not schema). Un-publishes the internal Buzz smoke-test issue
-- "SMOKE TEST — delete me (crash repro)" (id 678ef93f…, issue_date 2020-01-01),
-- which was left in status='published' after verifying the approve flow.
--
-- Why it matters: `list_trending_archive()` returns every published issue, and
-- that RPC powers the user-facing BuzzArchiveScreen (Manual → Buzz archive).
-- So the test issue was visible to real users. `get_trending_issue(null)` was
-- unaffected — its 2020 issue_date kept it out of the "current issue" slot, so
-- Home and TheBuzzScreen always showed the real issue.
--
-- 'archived' (not DELETE) is deliberate: non-destructive, keeps the crash-repro
-- record, and is trivially reversible. Its 2 child trending_items are left as-is
-- — they are only reachable through their parent issue.
--
-- Idempotent + id-scoped: a no-op where the row doesn't exist (fresh/local
-- resets) or where it has already been archived.
UPDATE public.trending_issues
   SET status = 'archived'
 WHERE id = '678ef93f-c883-40be-b92b-c43eef790466'
   AND status = 'published';
