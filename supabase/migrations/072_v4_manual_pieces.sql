-- 072_v4_manual_pieces.sql
--
-- Phase 4.5 — Manual piece stream content table.
--
-- Backs the article / illustration / checklist pieces rendered inline
-- on ManualScrollV3 (Phase 4.2). Video pieces continue to come from
-- manual_videos (migration 055) since they have Mux-specific metadata
-- (playback_id, captions, watch progress) that doesn't fit the generic
-- piece shape — the mobile screen merges the two sources at render
-- time, with video pieces always first per the handoff cadence.
--
-- LIFECYCLE: ships empty. ManualScrollV3 falls back to the
-- hand-authored PIECES_BY_CHAPTER constant when this table returns
-- no rows for the (audience, category) bucket. As clinical-advisor
-- authors land real content, INSERT migrations populate buckets and
-- the fallback gracefully gets superseded — bucket-by-bucket rollout
-- without a flag day.
--
-- AUDIENCE/CATEGORY pairs mirror manual_videos exactly (10 valid
-- combos, same CHECK enforcement). This keeps the per-chapter URL
-- shape (audience=baby&category=sleep) consistent across the video
-- + non-video paths.

-- ────────────────────────────────────────────────────────────────────
-- manual_pieces
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manual_pieces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Audience + category — same 10-pair allowlist as manual_videos
  -- (migration 055). Adding new pairs requires updating the migration
  -- 055 CHECK alongside; mismatched pairs return empty lists.
  audience    TEXT NOT NULL CHECK (audience IN ('mom', 'baby')),
  category    TEXT NOT NULL CHECK (
    (audience = 'baby' AND category IN ('feed','sleep','grow','care','tips')) OR
    (audience = 'mom'  AND category IN ('feel','heal','nourish','rest','tips'))
  ),

  -- Piece kind discriminated union. Mirrors the Piece type in
  -- apps/mobile/src/screens/manual/ManualScrollV3.tsx — keep both in
  -- lockstep. 'video' is NOT a member: videos live in manual_videos
  -- because they need Mux metadata + watch tracking.
  kind        TEXT NOT NULL CHECK (kind IN ('article', 'illustration', 'checklist')),

  -- Eyebrow num shown as "02 · READ" etc. Two-char zero-padded so the
  -- mobile screen doesn't need a format pass. Free-text rather than an
  -- integer to allow future numbering schemes (e.g. "2a", "2b" for
  -- variants per audience).
  num         TEXT NOT NULL CHECK (length(num) BETWEEN 1 AND 4),

  -- Common fields across all three kinds.
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 200),

  -- kind='article' fields
  dur         TEXT,           -- e.g. "4 min read" — free text per design canon
  excerpt     TEXT,           -- the body shown inline; long-form lands in the overlay

  -- kind='illustration' fields
  caption     TEXT,           -- amber footnote shown below the 5-row chart

  -- kind='checklist' fields. Storing as TEXT[] keeps the seed migration
  -- compact and avoids a separate manual_piece_steps join — each piece
  -- caps at ~6 steps and is rarely edited.
  steps       TEXT[],

  -- Sort within the (audience, category) bucket. Convention: stride 10
  -- (10, 20, 30, …) so new pieces slot in without renumbering.
  sort_order  INTEGER NOT NULL DEFAULT 10,

  -- Author + edit ledger. created_by NULL for migration-seeded rows;
  -- non-NULL for any future clinical-advisor authoring tool.
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Per-kind required-field guards. Defense-in-depth — the RPC could
  -- also enforce these, but the DB-level CHECK means an INSERT that
  -- forgets a field fails loudly instead of rendering blank.
  CONSTRAINT manual_pieces_article_excerpt_required
    CHECK ((kind <> 'article') OR (excerpt IS NOT NULL AND dur IS NOT NULL)),
  CONSTRAINT manual_pieces_illustration_caption_required
    CHECK ((kind <> 'illustration') OR (caption IS NOT NULL)),
  CONSTRAINT manual_pieces_checklist_steps_required
    CHECK ((kind <> 'checklist') OR (array_length(steps, 1) BETWEEN 2 AND 8))
);

-- Per-bucket browse index. The RPC always filters on (audience,
-- category) + sorts by sort_order, so this covers it.
CREATE INDEX IF NOT EXISTS manual_pieces_bucket_idx
  ON public.manual_pieces (audience, category, sort_order);

-- updated_at maintenance trigger (matches the pattern used across
-- gear_listings, milestone_library, etc).
CREATE OR REPLACE FUNCTION public.manual_pieces_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS manual_pieces_updated_at ON public.manual_pieces;
CREATE TRIGGER manual_pieces_updated_at
  BEFORE UPDATE ON public.manual_pieces
  FOR EACH ROW EXECUTE FUNCTION public.manual_pieces_set_updated_at();

-- ────────────────────────────────────────────────────────────────────
-- RLS — everyone authenticated can read. Writes are admin-only
-- (service-role via authoring tools; no client-facing write path).
-- ────────────────────────────────────────────────────────────────────
ALTER TABLE public.manual_pieces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS manual_pieces_select_all ON public.manual_pieces;
CREATE POLICY manual_pieces_select_all
  ON public.manual_pieces
  FOR SELECT
  TO authenticated
  USING (true);

-- ────────────────────────────────────────────────────────────────────
-- RPC: list_manual_pieces — returns the per-bucket stream in sort_order.
-- ────────────────────────────────────────────────────────────────────
-- The mobile screen calls this on every chapter switch; empty results
-- trigger the hand-authored PIECES_BY_CHAPTER fallback path in
-- ManualScrollV3.tsx. p_locale is reserved for the future
-- manual_pieces_i18n join (matches the manual_videos pattern); the
-- current single-language path ignores it.
CREATE OR REPLACE FUNCTION public.list_manual_pieces(
  p_audience TEXT,
  p_category TEXT,
  p_locale   TEXT DEFAULT 'en'
)
RETURNS TABLE (
  id          UUID,
  kind        TEXT,
  num         TEXT,
  title       TEXT,
  dur         TEXT,
  excerpt     TEXT,
  caption     TEXT,
  steps       TEXT[],
  sort_order  INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, kind, num, title, dur, excerpt, caption, steps, sort_order
  FROM   public.manual_pieces
  WHERE  audience = p_audience
    AND  category = p_category
  ORDER  BY sort_order ASC, created_at ASC;
$$;

REVOKE ALL ON FUNCTION public.list_manual_pieces(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_manual_pieces(TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE  public.manual_pieces                  IS 'V4 Phase 4.5 — article/illustration/checklist content for ManualScrollV3 piece stream. Video pieces live in manual_videos.';
COMMENT ON FUNCTION public.list_manual_pieces(TEXT,TEXT,TEXT) IS 'Per-bucket browse RPC for ManualScrollV3. Empty result → mobile falls back to hand-authored PIECES_BY_CHAPTER.';
