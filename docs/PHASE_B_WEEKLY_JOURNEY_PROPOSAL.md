# Phase B — Weekly Journey: Schema + Build Proposal

**Status:** DRAFT — pending review before migration ships
**Author:** drafted 2026-04-25 from the user's UI mockup (Screen 2)
**Migration #:** 036 (035 was taken by `realtime_dm_publication.sql`)

## Why this is the next rock

Mockup Screen 2 ("Weekly Journey") shows three content lanes that the existing
`milestone_library` table can't model on its own:

- **Maternal insight** — what's happening with *the mom*, not the baby. Postpartum
  recovery, emotional shifts, sleep, identity, relationships.
- **Village support** — peer/expert/community connection prompts ("This week,
  consider booking a lactation consult" → deeplink into Experts).
- **Weekly checklist** — practical to-dos a postpartum mom can tick off
  (medical appts, household bandwidth, emotional self-care).

Without these, "Weekly Journey" is just a re-skin of the existing milestone
detail screen. With them, it's a real surface tied to the hospital-discharge
GTM (the postpartum 0–12 week window is the primary content target).

## Schema (migration 036)

### `maternal_insights`
```sql
CREATE TABLE maternal_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 104),
  category TEXT NOT NULL CHECK (category IN (
    'recovery', 'emotional', 'sleep', 'feeding', 'relationships', 'identity'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  hero_emoji TEXT,
  -- Risk & Compliance §1.4 — anything that could be read as medical advice
  -- gets flagged here for clinical review before publication.
  is_clinical_flag BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maternal_insights_week ON maternal_insights(week_number);
ALTER TABLE maternal_insights ENABLE ROW LEVEL SECURITY;
-- public read, service write (curated content only)
CREATE POLICY "maternal_insights_select_all" ON maternal_insights FOR SELECT USING (true);
CREATE POLICY "maternal_insights_insert_service" ON maternal_insights
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "maternal_insights_update_service" ON maternal_insights
  FOR UPDATE USING (auth.role() = 'service_role');
```

### `village_supports`
```sql
CREATE TABLE village_supports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 104),
  support_type TEXT NOT NULL CHECK (support_type IN (
    'peer', 'expert', 'community', 'professional'
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  hero_emoji TEXT,
  -- Optional CTA so a card can deeplink into existing app surfaces.
  -- Format: '<tab>:<route>:<param?>' — e.g. 'experts:home:lactation', 'milk:donors',
  -- 'home:DailyCheckin', 'community:room:postpartum'.
  cta_label TEXT,
  cta_target TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_village_supports_week ON village_supports(week_number);
ALTER TABLE village_supports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "village_supports_select_all" ON village_supports FOR SELECT USING (true);
CREATE POLICY "village_supports_insert_service" ON village_supports
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "village_supports_update_service" ON village_supports
  FOR UPDATE USING (auth.role() = 'service_role');
```

### `week_checklists`
```sql
CREATE TABLE week_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number SMALLINT NOT NULL CHECK (week_number BETWEEN 1 AND 104),
  category TEXT NOT NULL CHECK (category IN (
    'medical', 'practical', 'emotional', 'household'
  )),
  item_text TEXT NOT NULL,
  -- Items the clinical team flags as must-do (e.g. 6-week PP visit). Renders with
  -- a stronger visual emphasis on the screen.
  is_essential BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order SMALLINT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_week_checklists_week ON week_checklists(week_number);
ALTER TABLE week_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "week_checklists_select_all" ON week_checklists FOR SELECT USING (true);
CREATE POLICY "week_checklists_insert_service" ON week_checklists
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "week_checklists_update_service" ON week_checklists
  FOR UPDATE USING (auth.role() = 'service_role');
```

### `user_week_checklist_completions` — per-user tick-off ledger
```sql
CREATE TABLE user_week_checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checklist_item_id UUID NOT NULL REFERENCES week_checklists(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, checklist_item_id)
);

ALTER TABLE user_week_checklist_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uwcc_select_own" ON user_week_checklist_completions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uwcc_insert_own" ON user_week_checklist_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uwcc_delete_own" ON user_week_checklist_completions
  FOR DELETE USING (auth.uid() = user_id);
```

### Hydrated RPC — one call returns the full Weekly Journey payload
```sql
CREATE OR REPLACE FUNCTION get_weekly_journey(p_week INT)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'week_number', p_week,
    'maternal_insights', COALESCE(
      (SELECT jsonb_agg(to_jsonb(mi.*) ORDER BY mi.category)
       FROM maternal_insights mi WHERE mi.week_number = p_week), '[]'::jsonb
    ),
    'village_supports', COALESCE(
      (SELECT jsonb_agg(to_jsonb(vs.*) ORDER BY vs.support_type)
       FROM village_supports vs WHERE vs.week_number = p_week), '[]'::jsonb
    ),
    'checklists', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id', wc.id,
        'category', wc.category,
        'item_text', wc.item_text,
        'is_essential', wc.is_essential,
        'sort_order', wc.sort_order,
        'completed', uwcc.id IS NOT NULL
      ) ORDER BY wc.sort_order, wc.id)
       FROM week_checklists wc
       LEFT JOIN user_week_checklist_completions uwcc
         ON uwcc.checklist_item_id = wc.id AND uwcc.user_id = auth.uid()
       WHERE wc.week_number = p_week), '[]'::jsonb
    )
  )
$$;

GRANT EXECUTE ON FUNCTION get_weekly_journey(INT) TO authenticated;
```

## Seed scope — weeks 1–12 (postpartum core)

Per the hospital-discharge GTM memory, the **0–12 week postpartum window** is
the primary journey. Weeks 1–12 get hand-curated seed content; weeks 13–104 can
be filled by AI cron (Sonnet, similar to the milestone_library AI summary
pattern from G7) once the schema is live.

For each of weeks 1–12, seed:
- 3–5 `maternal_insights` rows (one per relevant category — week 1 will hit
  recovery + emotional + sleep; week 6 may add identity + relationships)
- 2–3 `village_supports` rows tied to existing app surfaces
  (Experts/Milk/Community)
- 4–7 `week_checklists` items (with the 6-week PP visit flagged
  `is_essential=true`)

Tone target: clinician-handoff-grade, calm, second-person familiar (tú in ES),
no flippant marketing voice. Same bar as the existing milestone_library seed.

## Risks / open questions

1. **Clinical review** — `is_clinical_flag` is a proxy. Risk & Compliance
   §1.4 may want a stricter pre-publication workflow (medical advisory
   review of every row before service-role insert).
2. **Localization** — the schema stores English-only `body`. We either need
   `body_en` / `body_es` columns or a side table `maternal_insights_i18n`.
   Recommend the side-table approach so future locales don't bloat the row.
3. **Crisis routing** — if a `maternal_insight` body mentions PPD or
   suicidality, it must end with the same crisis-resources block we use in
   `daily-checkin` AI replies. Add a content-style guide.

## Build order once approved

1. Write `036_v4_weekly_journey.sql` with schema + RPC + seed weeks 1–12.
2. Add `weeklyJourneyApi` in `apps/mobile/src/api/weekly-journey.ts`
   (`getWeeklyJourney(week)`, `markChecklistComplete(itemId)`,
   `unmarkChecklistComplete(itemId)`).
3. New `WeeklyJourneyScreen.tsx` at `screens/home/` with:
   - Hero week header (matches new aesthetic)
   - "About you this week" section — cards from `maternal_insights`
   - "Your village" section — `village_supports` cards w/ deeplink CTAs
   - "This week's checklist" section — interactive ticks with optimistic
     write to `user_week_checklist_completions`
4. Add EN+ES i18n keys (~25 keys/locale).
5. Wire route in `HomeNavigator`. Replace the "See your weekly guide →" CTA
   in `HomeScreen` HeroWeekCard to navigate to `WeeklyJourney` instead of
   `MilestoneDetail` (or keep both — Journey for the mom-focused view,
   Detail for the baby-focused view).
6. Typecheck + lint.

## What this doesn't do

- Not a content-management UI — admin populates via Supabase Studio for now.
- Not AI-generated at runtime — content is pre-seeded.
- No notifications tied to checklist items (could come later via the
  existing `user_notifications_feed` infra).
