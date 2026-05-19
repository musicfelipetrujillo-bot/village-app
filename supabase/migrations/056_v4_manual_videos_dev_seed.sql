-- 056_v4_manual_videos_dev_seed.sql
-- Dev seed for manual_videos so the new short-video Manual surface has
-- content to render after 055 lands. Uses Mux's well-known public demo
-- playback ID for the actual playback (every row plays the same stub
-- video — that's fine for layout / nav / progress / RPC verification),
-- and per-card placeholder thumbnails so the grid doesn't render 12
-- identical cards.
--
-- Placeholders use placehold.co with the brand palette:
--   Mom side  → rust on cream  (B85C38 fg, F5F0E8 bg)
--   Baby side → olive on cream (5C6B3A fg, F5F0E8 bg)
-- Each card's text is the title (URL-encoded) so the dev grid doubles as
-- a content-pass review surface — you can read what each tile is about
-- from the thumbnail at a glance, without tapping in. Pre-launch we swap
-- thumbnail_url + poster_url for the real Mux-generated frames.
--
-- Coverage: at least one row per (audience, category) bucket so every
-- tile renders something rather than the empty state. Care intentionally
-- gets two rows because the symptom-triage angle (gas-vs-colic, reflux-
-- normal-or-call) is exactly what the article-era manual couldn't source
-- — we want to make sure that bucket is meaningfully populated even in
-- dev.
--
-- See https://docs.mux.com/guides/use-test-streams + https://placehold.co.
--
-- has_captions_en is FALSE on every dev row because the schema enforces a
-- bidirectional CHECK between has_captions_* and caption_url_* — and we
-- don't have real VTT files to point at yet. The captions toggle on the
-- player still ships ready-to-wire (per ManualVideoScreen header note);
-- pre-launch we'll flip these to TRUE alongside the real Mux + VTT URLs.
DO $$
DECLARE
  demo_pid     TEXT := 'DS00Spx1CV902MCtPj5WknGlR102V5HFkDe';
  thumb_mom    TEXT := 'https://placehold.co/640x360/F5F0E8/B85C38';
  thumb_baby   TEXT := 'https://placehold.co/640x360/F5F0E8/5C6B3A';
  poster_mom   TEXT := 'https://placehold.co/1280x720/F5F0E8/B85C38';
  poster_baby  TEXT := 'https://placehold.co/1280x720/F5F0E8/5C6B3A';
BEGIN
  INSERT INTO manual_videos (
    audience, category, title, description, duration_seconds,
    mux_playback_id, thumbnail_url, poster_url,
    has_captions_en, week_relevance, sort_order, review_status,
    clinical_advisor_reviewed
  ) VALUES
  -- MOM × 5 ----------------------------------------------------------------
  ('mom', 'feel',    'When the cry comes out of nowhere',
                     'The 2-week mood drop is real. Why it happens and what helps in the moment.',
                     90,  demo_pid,
                     thumb_mom  || '?text=When+the+cry+comes+out+of+nowhere',
                     poster_mom || '?text=When+the+cry+comes+out+of+nowhere',
                     FALSE, 2, 10, 'approved', TRUE),
  ('mom', 'heal',    'Lochia: what''s normal, what''s not',
                     'Color, smell, timing — and the three things that mean call your OB tonight.',
                     105, demo_pid,
                     thumb_mom  || '?text=Lochia%3A+normal+vs+call',
                     poster_mom || '?text=Lochia%3A+normal+vs+call',
                     FALSE, 1, 10, 'approved', TRUE),
  ('mom', 'nourish', 'One-handed snacks that actually fill you up',
                     'Five things to keep on the counter so postpartum-you doesn''t live on cereal.',
                     75,  demo_pid,
                     thumb_mom  || '?text=One-handed+snacks',
                     poster_mom || '?text=One-handed+snacks',
                     FALSE, 3, 10, 'approved', FALSE),
  ('mom', 'rest',    'Sleep when the baby sleeps — without the guilt',
                     'How to actually fall asleep at 11am, and why it counts as recovery, not laziness.',
                     85,  demo_pid,
                     thumb_mom  || '?text=Sleep+when+baby+sleeps',
                     poster_mom || '?text=Sleep+when+baby+sleeps',
                     FALSE, 1, 10, 'approved', FALSE),
  ('mom', 'tips',    'The "this saved me" list — week one',
                     'Six small things real moms swear by in the first seven days at home.',
                     110, demo_pid,
                     thumb_mom  || '?text=Week+one+%E2%80%94+saved+me',
                     poster_mom || '?text=Week+one+%E2%80%94+saved+me',
                     FALSE, 1, 10, 'approved', FALSE),

  -- BABY × 5 ---------------------------------------------------------------
  ('baby', 'feed',   'A good latch in 60 seconds',
                     'Mouth open wide, lips flanged, chin in. What it looks like — and what to do when it doesn''t.',
                     90,  demo_pid,
                     thumb_baby  || '?text=A+good+latch',
                     poster_baby || '?text=A+good+latch',
                     FALSE, 1, 10, 'approved', TRUE),
  ('baby', 'sleep',  'Drowsy but awake — what it actually means',
                     'How to read your baby''s tired cues so you put down a settling baby, not a fighting one.',
                     105, demo_pid,
                     thumb_baby  || '?text=Drowsy+but+awake',
                     poster_baby || '?text=Drowsy+but+awake',
                     FALSE, 2, 10, 'approved', FALSE),
  ('baby', 'grow',   'Tummy time without the tears',
                     'Three positions for week 1 to week 12 — and how long is plenty.',
                     115, demo_pid,
                     thumb_baby  || '?text=Tummy+time',
                     poster_baby || '?text=Tummy+time',
                     FALSE, 4, 10, 'approved', FALSE),
  ('baby', 'care',   'Gas or colic? How to tell',
                     'The 3-3-3 rule, the soothing checklist, and the line where you call the pediatrician.',
                     118, demo_pid,
                     thumb_baby  || '?text=Gas+or+colic%3F',
                     poster_baby || '?text=Gas+or+colic%3F',
                     FALSE, 2, 10, 'approved', TRUE),
  ('baby', 'care',   'Reflux: normal or call the doctor?',
                     'Spit-up vs. vomit, weight gain, arching — what''s expected and what isn''t.',
                     120, demo_pid,
                     thumb_baby  || '?text=Reflux%3A+normal+or+call%3F',
                     poster_baby || '?text=Reflux%3A+normal+or+call%3F',
                     FALSE, 3, 20, 'approved', TRUE),
  ('baby', 'tips',   'The five-second sleep cue',
                     'A small thing every parent figures out by month three — that you can use tonight.',
                     70,  demo_pid,
                     thumb_baby  || '?text=The+5-second+sleep+cue',
                     poster_baby || '?text=The+5-second+sleep+cue',
                     FALSE, 1, 10, 'approved', FALSE);
END $$;
