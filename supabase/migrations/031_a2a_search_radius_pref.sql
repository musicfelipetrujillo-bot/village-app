-- A2.a — User-configurable search radius preference.
--
-- Adds a single column to public.users so every nearby-search RPC can fall
-- back to the user's preferred radius instead of the hardcoded per-vertical
-- defaults (10mi specialists, 25mi milk, 50km events, 50km gear).
--
-- The column is in MILES — mobile converts to km at the boundary for the two
-- RPCs that accept km (list_events_near, list_gear_near). 25 is the MVP
-- default because it's what the milk filter drawer has exposed since M2 and
-- maps to "a reasonable drive in a Miami-sized metro". Range 1–100 matches
-- the UX spec's P0 slider bounds.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS search_radius_miles INT NOT NULL
  DEFAULT 25
  CHECK (search_radius_miles BETWEEN 1 AND 100);

COMMENT ON COLUMN public.users.search_radius_miles IS
  'User-preferred search radius in miles for nearby-search surfaces (specialists, donors, events, gear). 1..100, default 25. Events/Gear RPCs consume km — mobile converts at the boundary.';
