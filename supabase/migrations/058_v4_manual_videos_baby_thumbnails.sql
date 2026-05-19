-- 058_v4_manual_videos_baby_thumbnails.sql
-- Replaces picsum placeholder thumbnails with topic-relevant baby/newborn
-- photos via loremflickr.com (keyword-tagged Flickr photos, free for dev use).
-- The `lock` param is deterministic — same image every request for a given seed.
-- Swap with real Mux thumbnail URLs pre-launch:
--   https://image.mux.com/{playback_id}/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop

-- MOM SIDE -------------------------------------------------------------------

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/mother,newborn,baby?lock=11',
  poster_url    = 'https://loremflickr.com/1280/720/mother,newborn,baby?lock=11'
WHERE title = 'When the cry comes out of nowhere';

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/mother,baby,hospital?lock=22',
  poster_url    = 'https://loremflickr.com/1280/720/mother,baby,hospital?lock=22'
WHERE title = 'Lochia: what''s normal, what''s not';

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/mother,infant,home?lock=33',
  poster_url    = 'https://loremflickr.com/1280/720/mother,infant,home?lock=33'
WHERE title = 'One-handed snacks that actually fill you up';

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/baby,sleeping,newborn?lock=44',
  poster_url    = 'https://loremflickr.com/1280/720/baby,sleeping,newborn?lock=44'
WHERE title = 'Sleep when the baby sleeps — without the guilt';

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/newborn,mother,home?lock=55',
  poster_url    = 'https://loremflickr.com/1280/720/newborn,mother,home?lock=55'
WHERE title = 'The "this saved me" list — week one';

-- BABY SIDE ------------------------------------------------------------------

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/breastfeeding,baby?lock=66',
  poster_url    = 'https://loremflickr.com/1280/720/breastfeeding,baby?lock=66'
WHERE title = 'A good latch in 60 seconds';

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/baby,sleeping,infant?lock=77',
  poster_url    = 'https://loremflickr.com/1280/720/baby,sleeping,infant?lock=77'
WHERE title = 'Drowsy but awake — what it actually means';

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/baby,tummy,newborn?lock=88',
  poster_url    = 'https://loremflickr.com/1280/720/baby,tummy,newborn?lock=88'
WHERE title = 'Tummy time without the tears';

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/baby,crying,infant?lock=99',
  poster_url    = 'https://loremflickr.com/1280/720/baby,crying,infant?lock=99'
WHERE title = 'Gas or colic? How to tell';

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/baby,infant,newborn?lock=110',
  poster_url    = 'https://loremflickr.com/1280/720/baby,infant,newborn?lock=110'
WHERE title = 'Reflux: normal or call the doctor?';

UPDATE manual_videos SET
  thumbnail_url = 'https://loremflickr.com/640/360/newborn,sleeping,baby?lock=121',
  poster_url    = 'https://loremflickr.com/1280/720/newborn,sleeping,baby?lock=121'
WHERE title = 'The five-second sleep cue';
