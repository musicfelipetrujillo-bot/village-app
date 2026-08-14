-- 125_baby_log_note_linkage.sql
-- Link AI-parsed log rows back to the jot they came from.
--
-- playbook-parse-note inserts rows with source='note' but no reference to the
-- note, so a mis-heard jot ("she fed at 3") produces orphan rows the mom can
-- neither trace nor undo as a group. ON DELETE SET NULL, deliberately: deleting
-- the jot must never cascade away real logs she wants to keep.
--
-- Rows written before this migration keep note_id = NULL and simply don't offer
-- the group-undo affordance. No backfill is possible or needed.
--
-- ⚠️ RECOVERED FILE (2026-08-14). This was applied to production with no .sql
-- committed anywhere, which hard-fails `supabase db push` for every other
-- session. Restored verbatim from
-- `supabase_migrations.schema_migrations.statements`, which keeps the exact
-- submitted text including comments — never re-author from pg_get_functiondef
-- or a schema diff, both of which lose the reasoning.

ALTER TABLE baby_sleep_logs
  ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES baby_log_notes(id) ON DELETE SET NULL;

ALTER TABLE baby_feed_logs
  ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES baby_log_notes(id) ON DELETE SET NULL;

ALTER TABLE baby_diaper_logs
  ADD COLUMN IF NOT EXISTS note_id UUID REFERENCES baby_log_notes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_baby_sleep_note  ON baby_sleep_logs(note_id)  WHERE note_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_baby_feed_note   ON baby_feed_logs(note_id)   WHERE note_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_baby_diaper_note ON baby_diaper_logs(note_id) WHERE note_id IS NOT NULL;
