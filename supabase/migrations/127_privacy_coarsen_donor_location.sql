-- 127_privacy_coarsen_donor_location.sql
--
-- Coarsen milk donor coordinates from ~1cm to ~1km, permanently, at the type level.
--
-- WHY
-- ---
-- `milk_donor_profiles.lat`/`lng` were DECIMAL(10,7) — seven decimal places,
-- roughly CENTIMETRE resolution — and the row is public-read to every signed-in
-- user (`milk_donor_profiles_select_active`: TO authenticated USING (is_active
-- = TRUE)). Any account could therefore run
--
--     select lat, lng from milk_donor_profiles where is_active
--
-- and get the pinpoint home location of every active donor.
--
-- The affected population is breast-milk donors — new mothers, with infants, who
-- are being asked to meet a stranger in person. Precise home coordinates
-- broadcast to anyone who can create an account is a physical-safety exposure,
-- not just a data-minimisation one.
--
-- The 2026-07-09 privacy audit flagged this as QW-1, its single highest-value
-- finding. At that time it was a real hole with ZERO rows behind it, so nothing
-- was actually exposed. As of 2026-08-14 there are four active donor profiles,
-- three carrying coordinates — so it is now a live exposure, and it gets more
-- expensive with every donor who signs up.
--
-- WHAT THIS DOES
-- --------------
-- Narrows the column TYPE to NUMERIC(5,2). Postgres rounds existing values on
-- the cast, so this both fixes the stored data and makes finer precision
-- literally unrepresentable from here on: no trigger to forget, no application
-- code to keep in step, no way for a future insert to reintroduce the problem.
-- ~2 decimal places ≈ 1.1 km.
--
-- Measured impact on the three real rows before applying: pins move 165 m,
-- 239 m and 419 m. Still unmistakably the right neighbourhood, which is all a
-- "donors near me" map needs.
--
-- WHY NOT keep a precise copy in a service-role-only column?
--   Because nothing needs it. Distance ranking (`search_donors_near`) is a
--   25-mile radius search — 1 km precision is irrelevant to it. The one flow
--   that ever wanted a precise location, post-payment pickup address, was
--   deleted outright by migration 096 when Milk went cash-only. Storing
--   pinpoint coordinates we never use is exactly the breach surface 096
--   removed for address/phone, and this is the same reasoning applied to the
--   last field that still had it. Villie is a connector: it should know roughly
--   how far away someone is, never which house.
--
-- SECURITY BONUS: coordinates were also reachable indirectly. `search_donors_near`
-- returns `distance_miles` from a caller-supplied origin, so an attacker could
-- query from three points and trilaterate a donor's exact home even without
-- reading lat/lng. Snapping the stored value to a ~1 km grid removes the
-- precision that attack depends on.
--
-- NO APPLICATION CHANGE IS REQUIRED, and that is deliberate. The column keeps
-- its name and its `numeric` shape, so every existing read path — the
-- `DONOR_SELECT_COLUMNS` list in api/milk.ts, the nested select in
-- getSavedDonors, and the `search_donors_near` RPC (which declares its output as
-- bare `numeric`) — keeps working untouched and simply receives coarse values.
-- No OTA is needed to make this safe, which matters because an OTA is currently
-- blocked on unrelated seeded-data cleanup.
--
-- NOT CHANGED HERE (deliberate): `neighborhood` is still on the public row. The
-- privacy audit suggested coarsening it too, but it is self-entered display text
-- that the donor chose to publish (MilkConnectHome renders it, DonorSearchList
-- filters on it), and with coordinates now at ~1 km it no longer combines with
-- pinpoint GPS to de-anonymise. Removing it is a product decision about what a
-- donor profile shows, not a security fix — left for the founder to call.

BEGIN;

-- The expression index depends on these columns. Postgres would rebuild it
-- automatically, but doing it explicitly keeps the migration self-describing
-- and avoids relying on that behaviour.
DROP INDEX IF EXISTS public.idx_donor_profiles_location;

ALTER TABLE public.milk_donor_profiles
  ALTER COLUMN lat TYPE NUMERIC(5,2),
  ALTER COLUMN lng TYPE NUMERIC(5,2);

CREATE INDEX idx_donor_profiles_location
  ON public.milk_donor_profiles
  USING gist (ll_to_earth((lat)::double precision, (lng)::double precision));

COMMENT ON COLUMN public.milk_donor_profiles.lat IS
  'Approximate latitude, NUMERIC(5,2) ≈ 1.1 km. Deliberately coarse: this row is '
  'readable by every authenticated user, and donors are new mothers meeting '
  'strangers in person. Do NOT widen the scale — see migration 127.';

COMMENT ON COLUMN public.milk_donor_profiles.lng IS
  'Approximate longitude, NUMERIC(5,2) ≈ 1.1 km. See lat, and migration 127.';

COMMIT;
