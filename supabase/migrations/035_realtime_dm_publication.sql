-- Migration 035 — Add direct-message tables to supabase_realtime publication.
--
-- V1 specialist messages, V2 milk_messages, and V4 gear_messages all currently
-- back their chat UIs with 30s polling. Adding them to the realtime publication
-- lets the mobile clients drop the polling interval and react to INSERTs the
-- moment Postgres commits them — same pattern as room_messages did in
-- migration 026.
--
-- Each block is wrapped in `DO $$ ... $$` with a pg_publication_tables guard so
-- the migration is idempotent (ALTER PUBLICATION ... ADD TABLE errors if the
-- table is already in the publication, and there's no IF NOT EXISTS form).

-- V1 specialist DMs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END$$;

-- V2 milk donor↔recipient DMs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'milk_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE milk_messages;
  END IF;
END$$;

-- V4 gear buyer↔seller DMs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'gear_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE gear_messages;
  END IF;
END$$;

-- RLS already gates which rows each subscriber receives; the publication only
-- decides which tables emit changes at all. No new policies needed — the
-- existing select policies on each table already restrict to thread participants.
