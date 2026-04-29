-- V4 Phase B — village_supports CTA fixups.
--
-- Why this exists:
--   1. 036 + 037 seeded `experts:home:<slug>` cta_targets that were broken in
--      two ways:
--        (a) screen name was `home` but the real ExpertsNavigator route is
--            `ExpertsHome` — every tap hit a non-existent screen and silently
--            no-op'd.
--        (b) the third segment used marketing slugs (`obgyn`, `pediatrics`,
--            `lactation`, `ppd_therapy`, `pelvic_floor`, `doula_postpartum`)
--            that don't match the SpecialtyType enum the screen filters on
--            (`ob_gyn`, `pediatrician`, `lactation_consultant`,
--            `ppd_therapist`, `pelvic_floor_pt`, `doula`).
--      This migration rewrites all 13 affected rows to the canonical form.
--   2. `community:room:*` cta_targets land on a tab that's intentionally
--      hidden (`feedback_connect_tab_hidden`; V3 C4 pre-launch gates not met
--      — see CLAUDE.md). Promising "drop into a postpartum room thread" while
--      the rooms feature doesn't ship is bait-and-switch. Null out cta_label
--      and cta_target on those 8 rows so the support card renders as
--      informational text only. Title/body copy stays — a follow-up content
--      pass can soften phrasing if it still reads like a feature promise.
--
-- Pair with the WeeklyJourneyScreen `dispatchCta` cleanup (passes the third
-- segment as `{ specialty: <slug> }` for the experts tab) and the
-- ExpertsHomeScreen route-params reader added in the same change set.

BEGIN;

-- (1) experts:* — re-point to the real screen and map slug → SpecialtyType.
UPDATE village_supports SET cta_target = 'experts:ExpertsHome:doula'                WHERE cta_target = 'experts:home:doula_postpartum';
UPDATE village_supports SET cta_target = 'experts:ExpertsHome:lactation_consultant' WHERE cta_target = 'experts:home:lactation';
UPDATE village_supports SET cta_target = 'experts:ExpertsHome:ob_gyn'               WHERE cta_target = 'experts:home:obgyn';
UPDATE village_supports SET cta_target = 'experts:ExpertsHome:pediatrician'         WHERE cta_target = 'experts:home:pediatrics';
UPDATE village_supports SET cta_target = 'experts:ExpertsHome:pelvic_floor_pt'      WHERE cta_target = 'experts:home:pelvic_floor';
UPDATE village_supports SET cta_target = 'experts:ExpertsHome:ppd_therapist'        WHERE cta_target = 'experts:home:ppd_therapy';

-- (2) community:* — drop CTA entirely; card renders as text-only support.
UPDATE village_supports
SET cta_label = NULL, cta_target = NULL
WHERE cta_target LIKE 'community:%';

-- village_supports_i18n only carries the localized cta_label (no cta_target —
-- that's parent-canonical). Null out the ES button copy on rows whose parent
-- just lost its CTA, otherwise the screen would render a Spanish button with
-- no destination.
UPDATE village_supports_i18n vsi
SET cta_label = NULL
FROM village_supports vs
WHERE vsi.support_id = vs.id
  AND vs.cta_target IS NULL
  AND vsi.cta_label IS NOT NULL;

COMMIT;
