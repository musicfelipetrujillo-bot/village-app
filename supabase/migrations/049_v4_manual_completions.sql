-- 049_v4_manual_completions.sql
-- Stub completion tracking for the Manual's "today's reading" 4-item list.
-- The list is currently hardcoded in ManualHomeScreen (item keys 01..04
-- routing to WeeklyJourney for the current week). This migration adds a
-- per-user completion ledger so the open-circle / filled-check indicators
-- and the "X/N watched" progress strip reflect real state instead of
-- always rendering 0/4.
--
-- When manual_articles ships in a future phase, the (item_key) column will
-- migrate to (article_id) — keeping `item_key` as TEXT today decouples the
-- ledger from the not-yet-existing FK target.

CREATE TABLE IF NOT EXISTS manual_completions (
  user_id      UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number  INT     NOT NULL CHECK (week_number BETWEEN 1 AND 52),
  item_key     TEXT    NOT NULL CHECK (length(item_key) BETWEEN 1 AND 32),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_number, item_key)
);

CREATE INDEX IF NOT EXISTS idx_manual_completions_user_week
  ON manual_completions(user_id, week_number);

ALTER TABLE manual_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY manual_completions_select_own
  ON manual_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY manual_completions_insert_own
  ON manual_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY manual_completions_delete_own
  ON manual_completions FOR DELETE
  USING (auth.uid() = user_id);

-- Mark a manual reading item complete. Idempotent (ON CONFLICT DO NOTHING).
CREATE OR REPLACE FUNCTION mark_manual_item_complete(
  p_week_number INT,
  p_item_key    TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO manual_completions (user_id, week_number, item_key)
  VALUES (auth.uid(), p_week_number, p_item_key)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_manual_item_complete(INT, TEXT) TO authenticated;

-- Return completed item_keys for a given week as a TEXT[]. Empty array when
-- no items completed yet — never NULL — so the client can splat it directly
-- into a Set without null-guarding.
CREATE OR REPLACE FUNCTION get_manual_progress(p_week_number INT)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(item_key ORDER BY completed_at), ARRAY[]::TEXT[])
  FROM manual_completions
  WHERE user_id = auth.uid()
    AND week_number = p_week_number;
$$;

GRANT EXECUTE ON FUNCTION get_manual_progress(INT) TO authenticated;
