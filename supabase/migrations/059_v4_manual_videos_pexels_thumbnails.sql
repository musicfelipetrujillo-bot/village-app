-- 059_v4_manual_videos_pexels_thumbnails.sql
-- Replaces loremflickr placeholders with curated Pexels baby/postpartum photos.
-- All images are free to use (Pexels license). Swap with real Mux frames pre-launch:
--   https://image.mux.com/{playback_id}/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop
--
-- URL format: images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop

-- MOM SIDE -------------------------------------------------------------------

-- "When the cry comes out of nowhere" → mother embracing sleeping newborn indoors
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/19550908/pexels-photo-19550908.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/19550908/pexels-photo-19550908.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'When the cry comes out of nowhere';

-- "Lochia: what's normal, what's not" → mother cuddling newborn in hospital
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/35308506/pexels-photo-35308506.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/35308506/pexels-photo-35308506.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'Lochia: what''s normal, what''s not';

-- "One-handed snacks" → mother with infant on sofa
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/7282403/pexels-photo-7282403.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/7282403/pexels-photo-7282403.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'One-handed snacks that actually fill you up';

-- "Sleep when the baby sleeps" → peaceful newborn sleeping soundly
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/16381750/pexels-photo-16381750.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/16381750/pexels-photo-16381750.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'Sleep when the baby sleeps — without the guilt';

-- "The this saved me list — week one" → mother holding newborn by window
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/6849531/pexels-photo-6849531.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/6849531/pexels-photo-6849531.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'The "this saved me" list — week one';

-- BABY SIDE ------------------------------------------------------------------

-- "A good latch in 60 seconds" → tender breastfeeding moment
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/19178588/pexels-photo-19178588.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/19178588/pexels-photo-19178588.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'A good latch in 60 seconds';

-- "Drowsy but awake" → serene newborn swaddled in soft blanket
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/16381745/pexels-photo-16381745.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/16381745/pexels-photo-16381745.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'Drowsy but awake — what it actually means';

-- "Tummy time without the tears" → newborn resting in crib
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/4005601/pexels-photo-4005601.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/4005601/pexels-photo-4005601.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'Tummy time without the tears';

-- "Gas or colic? How to tell" → crying newborn being cradled
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/33065864/pexels-photo-33065864.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/33065864/pexels-photo-33065864.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'Gas or colic? How to tell';

-- "Reflux: normal or call the doctor?" → peaceful newborn girl in pink blanket
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/28529093/pexels-photo-28529093.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/28529093/pexels-photo-28529093.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'Reflux: normal or call the doctor?';

-- "The five-second sleep cue" → sweet baby sleeping in knitted outfit
UPDATE manual_videos SET
  thumbnail_url = 'https://images.pexels.com/photos/30279806/pexels-photo-30279806.jpeg?auto=compress&cs=tinysrgb&w=640&h=360&fit=crop',
  poster_url    = 'https://images.pexels.com/photos/30279806/pexels-photo-30279806.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&fit=crop'
WHERE title = 'The five-second sleep cue';
