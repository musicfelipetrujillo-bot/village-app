-- 109_villie_memories.sql
-- Billy's brain (AI-native): small durable facts the assistant learns in
-- conversation ("he only takes pumped-milk bottles", "bath is at 7pm"),
-- written by the remember_fact tool in app-help-chat and read back into
-- every chat request's context so Villie gains insight beyond raw logs.
--
-- Privacy posture: user-owned rows only (RLS own-only, all verbs). The
-- edge function runs under the caller's JWT, so it can only ever read or
-- write HER memories. Prompt-side rule (app-help-chat): never store
-- medical symptoms, crisis content, or other-person PII — practical
-- routine/preference facts only. Facts are capped at 300 chars.

CREATE TABLE IF NOT EXISTS villie_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact TEXT NOT NULL CHECK (char_length(fact) BETWEEN 3 AND 300),
  source TEXT NOT NULL DEFAULT 'chat' CHECK (source IN ('chat')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_villie_memories_user_recent
  ON villie_memories (user_id, created_at DESC);

ALTER TABLE villie_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY villie_memories_own_select ON villie_memories
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY villie_memories_own_insert ON villie_memories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY villie_memories_own_delete ON villie_memories
  FOR DELETE USING (auth.uid() = user_id);

-- Security posture (matches 052/054): no anon access, authenticated + service only.
REVOKE ALL ON villie_memories FROM anon;
GRANT SELECT, INSERT, DELETE ON villie_memories TO authenticated;
GRANT ALL ON villie_memories TO service_role;
