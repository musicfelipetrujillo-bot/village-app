-- 121_mom_tips_seed_fourth_trimester.sql
-- Mom Tips content — weeks 0 through 12, the complete fourth trimester.
-- 7 tips per week x 13 weeks = 91 rows. Remaining weeks 13-52 land in a
-- follow-up seed; the schema and both read RPCs (migration 120) already carry
-- the full 0-52 range, so nothing needs changing when they arrive.
--
-- WHY THIS WINDOW FIRST: hospital-discharge is the GTM, so weeks 0-12 are the
-- ones a mom actually meets. They are also the hardest to write — the tips have
-- to be genuinely useful at 3am without ever drifting into clinical advice.
--
-- ⚠️ EVERY ROW IS review_status='draft' ON PURPOSE. The read RPCs return only
-- 'approved', so none of this reaches a mom until the clinical reviewer passes
-- it. Do NOT bulk-approve to "see it working" — seeding unreviewed guidance on
-- feeding, sleep and recovery in front of postpartum women is the exact risk
-- the clinical-advisor gate exists for.
--
-- COPY RULES used throughout: practical and wellness-tier only. No diagnosis,
-- no dosing, no numeric thresholds that compete with "call your provider", and
-- nothing that implies a baby is behind. Red-flag symptoms live in the Manual
-- and the Quick Reference hub, never here.

INSERT INTO public.mom_tips (week_number, day_index, category, title, body, locale, review_status)
SELECT v.week_number, v.day_index, v.category, v.title, v.body, 'en', 'draft'
FROM (VALUES
  (0, 0, 'you', 'Fed is the floor', 'Your only jobs this week are keeping the baby fed and keeping yourself upright. Everything else can wait.'),
  (0, 1, 'care', 'One diaper, one hand', 'Set the fresh diaper under the dirty one before you unfasten. One motion, no scrambling.'),
  (0, 2, 'sleep', 'Nights are not broken', 'Newborns wake every 2–3 hours because their stomachs are tiny. Nothing has gone wrong.'),
  (0, 3, 'feed', 'Watch the baby, not the clock', 'Rooting, hands to mouth, stirring — those come before crying. Crying is a late signal.'),
  (0, 4, 'you', 'Say the number out loud', 'Tell one person how you''re actually doing today. Not the polite version.'),
  (0, 5, 'care', 'Warm the wipes', 'Hold a wipe in your fist for a few seconds. Fewer startled screams at 3am.'),
  (0, 6, 'play', 'Your face is the toy', 'Eight to twelve inches away is exactly where she can see. That''s feeding distance — no props needed.'),
  (1, 0, 'you', 'Sit down to feed', 'Standing and swaying while you feed burns energy you don''t have. Sit, back supported, every time.'),
  (1, 1, 'feed', 'Count the diapers, not the ounces', 'Wet and dirty diapers tell you more about intake than anything you can measure.'),
  (1, 2, 'sleep', 'Sleep when you can, not when told', '''Sleep when the baby sleeps'' fails if that''s your only shower window. Take the rest where it actually fits.'),
  (1, 3, 'care', 'Cut nails while she sleeps', 'Deep sleep, not drowsy. Her hands stay still and you stop dreading it.'),
  (1, 4, 'you', 'Put the snacks where you sit', 'Whatever chair you feed in — stock it. One-handed food, a full water bottle, a charger.'),
  (1, 5, 'play', 'Talk through the boring parts', 'Narrate the diaper change, the kettle, the laundry. Language starts long before words do.'),
  (1, 6, 'care', 'Two hats, one bag', 'Keep a spare hat and a spare onesie permanently in the bag. You will need both sooner than you think.'),
  (2, 0, 'you', 'Visitors bring, not just hold', 'Anyone who wants baby time can arrive with food or leave with laundry. That''s a fair trade.'),
  (2, 1, 'sleep', 'Dark is a signal', 'Keep night feeds dim and quiet. Day and night mean nothing to her yet — you''re teaching the difference.'),
  (2, 2, 'feed', 'Burp on the shoulder', 'Higher up than feels natural, chin past your shoulder, firm pats. Gravity does the work.'),
  (2, 3, 'care', 'The bath can wait', 'Sponge baths are enough until the cord stump goes. Fewer full baths, less screaming, same clean baby.'),
  (2, 4, 'you', 'You are allowed to not love it', 'Loving your baby and not loving this stage are two different things. Both can be true.'),
  (2, 5, 'play', 'Tummy time counts at one minute', 'On your chest counts. Three short bursts beat one long fight.'),
  (2, 6, 'care', 'Change before the feed, not after', 'She''s more likely to fall asleep after eating. Don''t wake her up to undress her.'),
  (3, 0, 'feed', 'Cluster feeding is not failure', 'Evenings can turn into one long feed. That''s normal, it''s temporary, and it isn''t about your supply.'),
  (3, 1, 'you', 'Go outside for ten minutes', 'Not for exercise. For the light and the reminder that the world still exists.'),
  (3, 2, 'sleep', 'Swaddle arms down', 'Snug across the arms, loose around the hips. The startle reflex is what keeps waking her.'),
  (3, 3, 'care', 'Keep the receipt drawer', 'One drawer, every receipt and tag. Half the newborn gear will go back.'),
  (3, 4, 'play', 'She is studying you', 'Long, unblinking staring isn''t hunger or gas. She''s memorising your face.'),
  (3, 5, 'you', 'Lower one standard on purpose', 'Pick something — the floors, the inbox, the thank-you notes — and consciously let it go.'),
  (3, 6, 'feed', 'Feed on the softer side first', 'Start where you feel fuller. It evens out and it''s more comfortable.'),
  (4, 0, 'sleep', 'The 4-week fussies are real', 'Evening crying often peaks around now. It''s a phase with an end, not a sign you''re doing it wrong.'),
  (4, 1, 'you', 'Book the six-week check now', 'Call today for an appointment you''ll want in two weeks. Future you won''t have the bandwidth.'),
  (4, 2, 'care', 'Trim the bag', 'You''ve now used the same six things for a month. Take the rest out.'),
  (4, 3, 'feed', 'A pump is a tool, not a verdict', 'Pumping, nursing, formula, all three — none of it grades you.'),
  (4, 4, 'play', 'Black and white still wins', 'High-contrast shapes hold her attention longest. Colour comes later.'),
  (4, 5, 'you', 'Text back tomorrow', 'Unanswered messages are not a debt. Anyone who matters will understand.'),
  (4, 6, 'care', 'Take a picture of the tag', 'Photograph the label on anything that fits well. Sizing across brands is chaos.'),
  (5, 0, 'you', 'Shower like it counts', 'Not a rinse. Hot water, ten minutes, door closed, baby safe in the crib. It resets more than it should.'),
  (5, 1, 'sleep', 'Move the last feed later', 'Nudging the final feed toward your bedtime can buy you one longer first stretch.'),
  (5, 2, 'feed', 'Wind before the switch', 'Burp between sides. Air swallowed early makes the second side miserable.'),
  (5, 3, 'care', 'One bag, packed at night', 'Restock the bag before bed, not on the way out. Mornings are not the time.'),
  (5, 4, 'play', 'Follow her gaze', 'Whatever she''s staring at, name it. That''s the whole game right now.'),
  (5, 5, 'you', 'Ask for a specific thing', '''Help'' is hard to answer. ''Can you take her from seven to eight'' is easy to say yes to.'),
  (5, 6, 'care', 'Check the straps monthly', 'Car seat straps sit at or below the shoulders for now, and snug enough that you can''t pinch webbing.'),
  (6, 0, 'you', 'This is the six-week wall', 'Many moms hit their lowest point right about now. It is common, it passes, and it''s worth saying out loud to someone.'),
  (6, 1, 'sleep', 'Watch the wake window', 'Around now she can usually manage 60–90 minutes awake. Overtired is harder to settle than under-tired.'),
  (6, 2, 'feed', 'A growth spurt looks like hunger', 'Sudden constant feeding for a couple of days usually means growth, not a supply problem.'),
  (6, 3, 'care', 'Nails again', 'They grow faster than you expect. Little scratches on her face are nails, not a rash.'),
  (6, 4, 'play', 'First smiles are real', 'Around six weeks the social smile arrives. It''s for you, and it''s worth waiting for.'),
  (6, 5, 'you', 'Say the hard sentence', 'If you''re not okay, tell your provider at the six-week visit. ''I''m struggling'' is a complete sentence.'),
  (6, 6, 'care', 'Photograph the routine', 'Snap the feed and nap times on a good day. It becomes the handoff sheet for whoever helps.'),
  (7, 0, 'sleep', 'Same three things, same order', 'Bath, book, bed — or any three. The order is what she learns, not the clock.'),
  (7, 1, 'you', 'Put one thing on the calendar', 'Something for you, this month, with a date on it. A haircut counts.'),
  (7, 2, 'feed', 'Feeds get faster', 'An efficient baby can drain a side in ten minutes. Shorter isn''t worse.'),
  (7, 3, 'care', 'Bag the outgrown clothes tonight', 'If it didn''t fit this week, it won''t next week. Bag it and get the drawer back.'),
  (7, 4, 'play', 'Bicycle legs', 'Slow leg cycling on the change table helps wind and makes her laugh sooner than you''d think.'),
  (7, 5, 'you', 'Eat a real breakfast', 'You are running a metabolic marathon. Toast at 11am is not fuel.'),
  (7, 6, 'care', 'Two spare muslins, always', 'One for you, one for the bag. They solve more problems than anything else you own.'),
  (8, 0, 'you', 'Two months in, take stock', 'Look back at week one. You know things now that you didn''t. That''s the growth nobody photographs.'),
  (8, 1, 'sleep', 'Drowsy but awake, sometimes', 'Try putting her down half asleep once a day. If it fails, feed her to sleep — no guilt.'),
  (8, 2, 'feed', 'Hands are the new signal', 'Fists to mouth is early hunger. You can catch her before the cry.'),
  (8, 3, 'care', 'Vaccination day plan', 'Book it for a day with nothing after it. Plan an easy evening and extra cuddles.'),
  (8, 4, 'play', 'Mirror time', 'Babies love faces, including their own. A mirror buys you five minutes.'),
  (8, 5, 'you', 'Set the phone down at feeds', 'Sometimes. Not always. Just often enough to actually be there for one of them.'),
  (8, 6, 'care', 'Rotate the head', 'Alternate which end of the crib she starts at so she doesn''t always turn the same way.'),
  (9, 0, 'sleep', 'Naps get shorter before longer', 'A run of 30-minute naps is a phase, not a permanent setting.'),
  (9, 1, 'you', 'One friend, one honest text', 'Pick the person who won''t flinch and tell them the true version of your week.'),
  (9, 2, 'feed', 'Feed before the outing', 'Leaving on a full stomach buys you a calmer hour out.'),
  (9, 3, 'care', 'Wash the toys you forgot', 'Everything now goes in her mouth. The play mat and the muslin count.'),
  (9, 4, 'play', 'Rattle to the side', 'Shake it out of her line of sight and let her find it. She''s learning that sound has a location.'),
  (9, 5, 'you', 'Move your body once', 'A walk around the block. Not a workout — just proof your body is yours.'),
  (9, 6, 'care', 'Sunscreen is not for now', 'Under six months, shade and cover instead. Skip the lotion.'),
  (10, 0, 'you', 'Split the night on purpose', 'If there are two of you, divide the night into shifts rather than both waking. Four unbroken hours beats eight broken ones.'),
  (10, 1, 'sleep', 'White noise, all night', 'If you use it, leave it on the whole sleep. Turning it off mid-nap is what wakes her.'),
  (10, 2, 'feed', 'Bottles need a rhythm too', 'Hold her more upright and pause halfway. Fast bottles cause most of the gas.'),
  (10, 3, 'care', 'Nail the exit', 'Keys, bag, phone by the door the night before. The exit is the hardest part of any outing.'),
  (10, 4, 'play', 'She grabs on purpose now', 'What she reaches for is what she likes. Hand it over, let her run the session.'),
  (10, 5, 'you', 'Say no to one thing', 'You are allowed to decline the visit, the trip, the favour. No explanation required.'),
  (10, 6, 'care', 'Cut a nap short for daylight', 'If the afternoon is beautiful, wake her. Sunlight helps both your rhythms.'),
  (11, 0, 'sleep', 'The last nap matters most', 'A late-evening catnap steals from the night. Cap the final one.'),
  (11, 1, 'you', 'Batch the admin', 'Fifteen minutes, once a week, for the appointments and forms. Not scattered through every day.'),
  (11, 2, 'feed', 'Track only what you need', 'If logging every feed is stressing you out, log nothing for a day. Nothing bad happens.'),
  (11, 3, 'care', 'Photograph her against something', 'Same chair, same blanket, once a month. The scale of the change only shows in comparison.'),
  (11, 4, 'play', 'Peekaboo lands soon', 'She''s starting to grasp that you still exist behind your hands. That''s a real cognitive leap.'),
  (11, 5, 'you', 'Reclaim one small ritual', 'The coffee before anyone''s awake, the podcast, the good soap. Something that was yours before.'),
  (11, 6, 'care', 'Check the crib height', 'Once she pushes up, the mattress needs to drop. Do it before she does it.'),
  (12, 0, 'you', 'The fourth trimester ends here', 'Twelve weeks. Some moms feel a shift now, others feel exactly the same, and both are completely normal.'),
  (12, 1, 'sleep', 'Longer stretches, not through the night', 'Six hours counts as sleeping through at this age. Adjust the target, not the baby.'),
  (12, 2, 'feed', 'She may get distracted', 'More alert means more looking around mid-feed. A quiet, dim room brings her back.'),
  (12, 3, 'care', 'Pack away the newborn clothes', 'Keep two things you love. Pass on the rest — the drawer space is worth more than the sentiment.'),
  (12, 4, 'play', 'Reaching turns into holding', 'Give her something light and easy to grip and let her fail at it. That''s the practice.'),
  (12, 5, 'you', 'Book your own appointment', 'Not hers. Yours. Dentist, GP, therapist, whatever you''ve postponed since before she arrived.'),
  (12, 6, 'care', 'Note three things that got easier', 'They are easy to miss because they happened slowly. Write them down.')
) AS v(week_number, day_index, category, title, body)
ON CONFLICT (week_number, day_index, locale) DO NOTHING;
