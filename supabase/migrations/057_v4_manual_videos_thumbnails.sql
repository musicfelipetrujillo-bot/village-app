-- 057_v4_manual_videos_thumbnails.sql
-- Replaces placehold.co flat-color dev thumbnails with real stock photos
-- from Picsum (picsum.photos) so the video grid renders like a real content
-- surface before Mux-generated frames are available.
--
-- Each seed string is deterministic → same image on every request.
-- All images are 640×360 (16:9) for thumbnails and 1280×720 for posters.
-- Swap these with real Mux thumbnail URLs pre-launch:
--   https://image.mux.com/{playback_id}/thumbnail.jpg?width=640&height=360
--
-- Grouped by title for easy auditing.

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/postpartum-cry/640/360',
  poster_url    = 'https://picsum.photos/seed/postpartum-cry/1280/720'
WHERE title = 'When the cry comes out of nowhere';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/postpartum-heal/640/360',
  poster_url    = 'https://picsum.photos/seed/postpartum-heal/1280/720'
WHERE title = 'Lochia: what''s normal, what''s not';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/postpartum-snacks/640/360',
  poster_url    = 'https://picsum.photos/seed/postpartum-snacks/1280/720'
WHERE title = 'One-handed snacks that actually fill you up';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/postpartum-sleep/640/360',
  poster_url    = 'https://picsum.photos/seed/postpartum-sleep/1280/720'
WHERE title = 'Sleep when the baby sleeps — without the guilt';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/postpartum-week1/640/360',
  poster_url    = 'https://picsum.photos/seed/postpartum-week1/1280/720'
WHERE title = 'The "this saved me" list — week one';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/baby-latch/640/360',
  poster_url    = 'https://picsum.photos/seed/baby-latch/1280/720'
WHERE title = 'A good latch in 60 seconds';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/baby-drowsy/640/360',
  poster_url    = 'https://picsum.photos/seed/baby-drowsy/1280/720'
WHERE title = 'Drowsy but awake — what it actually means';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/baby-tummy/640/360',
  poster_url    = 'https://picsum.photos/seed/baby-tummy/1280/720'
WHERE title = 'Tummy time without the tears';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/baby-colic/640/360',
  poster_url    = 'https://picsum.photos/seed/baby-colic/1280/720'
WHERE title = 'Gas or colic? How to tell';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/baby-reflux/640/360',
  poster_url    = 'https://picsum.photos/seed/baby-reflux/1280/720'
WHERE title = 'Reflux: normal or call the doctor?';

UPDATE manual_videos SET
  thumbnail_url = 'https://picsum.photos/seed/baby-sleepcue/640/360',
  poster_url    = 'https://picsum.photos/seed/baby-sleepcue/1280/720'
WHERE title = 'The five-second sleep cue';
