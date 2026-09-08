-- Tier 1 · standing invariants that apply to the whole schema
--
-- The tests above each guard one past incident. These guard the RULES, so a
-- NEW table or function that breaks one is caught on the pull request that adds
-- it rather than in the next audit.
--
-- Each allowlist below is the accepted-exceptions register from CLAUDE.md,
-- expressed as code. Adding a row to an allowlist is then a visible, reviewable
-- decision in a diff — which is precisely what was missing when three
-- service-role-only tables sat flagged for months as "probably deliberate" and
-- a reviewer had to re-derive that each was intentional.

create extension if not exists pgtap;

begin;
select plan(6);

-- ── 1. RLS on every table ──────────────────────────────────────────────────
-- Architecture rule 3: "RLS on every table — never rely on application-level
-- auth checks alone." spatial_ref_sys is PostGIS-owned; migration 089 tried to
-- enable RLS on it and failed with "must be owner of table". Genuinely
-- unfixable from our role, and it holds no user data.
select is_empty(
  $q$ select c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and not c.relrowsecurity
         and c.relname not in ('spatial_ref_sys') $q$,
  'every table in public has row-level security enabled'
);

-- ── 2. what anonymous callers may execute ──────────────────────────────────
-- A SECURITY DEFINER function runs as its owner, so one reachable by anon is a
-- hole punched straight through RLS. Three are deliberate:
--
--   get_specialist_invite_by_token   an invited practitioner is anonymous until
--                                    she signs up; exact-token match only, and
--                                    only while unused / unrevoked / unexpired
--   get_manual_video_share_meta      renders link previews for public shares
--   manual_videos_locked_for_caller  returns a boolean feature-flag state and
--                                    no data at all
--
-- st_estimatedextent is PostGIS-owned (3 overloads); extension functions cannot
-- be ALTERed, documented in migration 052.
select is_empty(
  $q$ select p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and p.prosecdef
         and has_function_privilege('anon', p.oid, 'EXECUTE')
         and p.proname not in (
           'get_specialist_invite_by_token',
           'get_manual_video_share_meta',
           'manual_videos_locked_for_caller',
           'st_estimatedextent'
         ) $q$,
  'no undocumented SECURITY DEFINER function is executable by anon'
);

-- ── 3. the PUBLIC-grant trap ───────────────────────────────────────────────
-- This repo has been bitten from both directions: migration 052 revoked FROM
-- PUBLIC when the grants were role-specific (no-op), and migration 130 revoked
-- FROM anon when the grant was to PUBLIC (also a no-op, fixed by 131). An ACL
-- entry with an empty grantee IS PUBLIC, and every role inherits it — so a
-- SECURITY DEFINER function carrying one is executable by anon no matter what
-- per-role revokes were issued.
select is_empty(
  $q$ select p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        cross join lateral aclexplode(p.proacl) a
       where n.nspname = 'public'
         and p.prosecdef
         and a.grantee = 0
         and p.proname not in ('st_estimatedextent') $q$,
  'no SECURITY DEFINER function in public carries a PUBLIC execute grant'
);

-- ── 4. donor location precision ────────────────────────────────────────────
-- Migration 127 narrowed lat/lng from DECIMAL(10,7) (~1cm) to NUMERIC(5,2)
-- (~1.1km) at the TYPE level, so Postgres rounds on the cast and finer
-- precision is unrepresentable — no trigger to forget, no client to keep in
-- step. Asserting the type is therefore stronger than asserting any value.
-- Only the numbers are compared: information_schema.sql_identifier carries no
-- determinable collation, so including the column NAME in the compared set
-- fails with "could not determine which collation to use". The ORDER BY still
-- pins which row is which.
select results_eq(
  $q$ select numeric_precision::int, numeric_scale::int
        from information_schema.columns
       where table_name = 'milk_donor_profiles'
         and column_name in ('lat', 'lng')
       order by column_name $q$,
  $q$ values (5, 2), (5, 2) $q$,
  'donor coordinates are stored at ~1.1km precision, enforced by column type'
);

-- ── 5. donor PII that was dropped stays dropped ────────────────────────────
-- Migration 096 removed the pickup address and phone from the donor row. A
-- future "just add it back for convenience" is exactly the regression this
-- catches.
select is_empty(
  $q$ select column_name from information_schema.columns
       where table_name = 'milk_donor_profiles'
         and column_name in ('address_line1', 'address_line2', 'phone') $q$,
  'milk_donor_profiles carries no street address or phone number'
);

-- ── 6. the privilege flags stay off the writable allowlist ─────────────────
-- Complements test 001: that one asserts today's three flags are unwritable,
-- this one asserts the allowlist itself has not grown to include ANY column
-- matching the privilege-flag naming convention.
select is_empty(
  $q$ select column_name
        from information_schema.column_privileges
       where table_name = 'users'
         and grantee = 'authenticated'
         and privilege_type = 'UPDATE'
         and (column_name like 'is\_%' or column_name in ('email', 'id', 'deleted_at')) $q$,
  'no privilege flag or identity column is in the writable column allowlist'
);

select * from finish();
rollback;
