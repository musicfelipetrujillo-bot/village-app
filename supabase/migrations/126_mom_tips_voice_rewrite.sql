-- 126_mom_tips_voice_rewrite.sql
--
-- Rewrites all 371 English mom tips in the register the founder actually
-- wanted (2026-08-14): "like your friend or relative giving tips and advice",
-- not the Manual.
--
-- WHAT WAS WRONG: the 120-122 seed wrote REASSURANCE — "cluster feeding is not
-- failure, that's normal, it isn't about your supply." True, kind, and exactly
-- what a book says. Her examples of the thing she wanted were different in
-- kind: "get swaddles with zippers not velcro so you don't wake up the baby",
-- "buy a flat string for the pacifier so it doesn't bother him when he turns."
-- Buy THIS specific thing, because THIS specific annoying moment is coming.
-- That's what an older sister tells you and what a book never will.
--
-- THE SHAPE (settled over two rounds of calibration):
--   · title = the instruction, short, plain. Never an editorial headline.
--   · body  = ONLY the why or the how. It must NOT restate the title — that
--     redundancy was the first draft's main sin.
--   · ~15-30 words of body. Enough to explain, short enough to read
--     one-handed at 3am with a baby on you.
--
-- SAFETY POSTURE — this changes shape, and the change matters:
-- product hacks are not clinical claims, so the medical-language screen that
-- fit the old copy mostly stops applying. But folk advice is precisely where
-- dangerous tips hide: crib bumpers, sleep positioners, loose blankets, honey
-- under one year, cereal in a bottle, infant walkers, microwaved milk. Nothing
-- below contradicts safe-sleep or infant-feeding guidance, and several tips
-- steer AWAY from those (flat-freezing milk, no microwave, mattress height,
-- car-seat strap height). Re-screen on THAT basis, not for medical words.
--
-- ⚠️ REVIEW STATE IS DELIBERATELY UNTOUCHED. Every row is still 'draft' as of
-- this migration (verified: 371/371), so there is no approval to invalidate.
-- If that ever stops being true, a text rewrite MUST also reset the row to
-- draft and clear reviewed_by/reviewed_at — an approval attaches to specific
-- words, not to a row id.

-- ── weeks 0-9 · the newborn stretch ─────────────────────────────────────────
UPDATE mom_tips t SET title = v.title, body = v.body, category = v.category, updated_at = now()
FROM (VALUES
  (0,0,'care',$$Zipper swaddles, not velcro$$,$$The velcro rips loud every time you open it, and at 3am that's what wakes him back up.$$),
  (0,1,'care',$$Layer the crib: pad, sheet, pad, sheet$$,$$At 3am you peel off the top two and there's a clean bed underneath. No wrestling a fitted sheet in the dark.$$),
  (0,2,'care',$$Diapers in every room you sit in$$,$$Wipes and a spare onesie too. You won't walk to the nursery at 4am, and you shouldn't have to.$$),
  (0,3,'care',$$The folds on a onesie are an escape hatch$$,$$Roll it down over his shoulders instead of pulling it over his head. Blowouts stay out of his hair.$$),
  (0,4,'you',$$Set up before you sit down$$,$$Water and something to eat within reach. Once he latches you're there half an hour.$$),
  (0,5,'feed',$$Make the night bottles before bed$$,$$Measuring scoops half-asleep is how you lose count and start over.$$),
  (0,6,'sleep',$$White noise on its own machine$$,$$If it's your phone you pick it up to turn it off, and then you're awake too. A dedicated one runs about $20.$$),

  (1,0,'care',$$Flat pacifier straps, not beaded$$,$$The beads press into his cheek when he turns his head and he spits it out.$$),
  (1,1,'care',$$Buy the second pacifier$$,$$Keep it in the car. The one he actually takes is the one you'll lose.$$),
  (1,2,'you',$$Get in one photo this week$$,$$Hand someone your phone. You'll have hundreds of him and none of the two of you.$$),
  (1,3,'care',$$Side-snap shirts until the stump falls off$$,$$Nothing goes over his head, and you're not touching the cord to dress him.$$),
  (1,4,'you',$$Save the after-hours number today$$,$$Your pediatrician's, in your contacts. Not something to hunt for at 2am, one-handed.$$),
  (1,5,'feed',$$Burp cloth on both shoulders$$,$$He turns his head at the exact moment it matters.$$),
  (1,6,'you',$$Pack a shirt for yourself$$,$$In the diaper bag, next to his. You'll need changing more often than you'd think.$$),

  (2,0,'care',$$Cut his nails while he's feeding$$,$$His hands go still and he doesn't notice. Awake and grabbing is how you nick a fingertip.$$),
  (2,1,'you',$$Give visitors a job$$,$$Food, or the dishes. Most people genuinely want to help and are waiting to be told how.$$),
  (2,2,'sleep',$$Swaddle before he's frantic$$,$$Once he's really crying the arms won't go in. You're aiming for the yawn, not the scream.$$),
  (2,3,'feed',$$Watch for hands to the mouth, not crying$$,$$Rooting and fists near the face come first. Feed then and the latch is calmer for both of you.$$),
  (2,4,'care',$$Two changing stations, not one$$,$$One where you sleep, one where you spend the day. Crossing the house for every change gets old by Tuesday.$$),
  (2,5,'you',$$A water bottle everywhere you sit$$,$$Feeding makes you thirsty in a way nobody warns you about. Fill three in the morning and scatter them.$$),
  (2,6,'play',$$Hold him about a foot from your face$$,$$That's as far as he can focus right now. Closer than feels natural is exactly right.$$),

  (3,0,'feed',$$Set up for the evening cluster$$,$$Around dinner he'll feed on and off for hours. Queue something to watch and park the snacks instead of fighting it.$$),
  (3,1,'care',$$Warm the wipe in your hand first$$,$$Two seconds is enough. A cold wipe on a warm bottom is a guaranteed scream, and you don't need a warmer.$$),
  (3,2,'sleep',$$Put him down awake once a day$$,$$Once, not every time. It's practice for later and it costs you nothing now.$$),
  (3,3,'you',$$Say yes when someone offers to hold him$$,$$Shower, eat something hot, lie down. You don't have to earn the twenty minutes.$$),
  (3,4,'care',$$One more layer than you're wearing$$,$$One, not three. Overheating is the more common mistake, and he doesn't need a hat indoors.$$),
  (3,5,'feed',$$Burping isn't a fixed number of minutes$$,$$Some come up in ten seconds and some don't need it. If he's settled, stop working at it.$$),
  (3,6,'play',$$Narrate whatever you're doing$$,$$The diaper change, the kettle, the walk to the door. Easiest language work there is and it costs nothing.$$),

  (4,0,'care',$$Take the month photo in the same spot$$,$$Same chair, same light, every month. The line-up at twelve months is the whole point.$$),
  (4,1,'you',$$Book your postpartum visit now$$,$$The slots fill weeks out. Put it in the calendar today even if the appointment is a month away.$$),
  (4,2,'sleep',$$Make the room properly dark$$,$$A cheap blackout panel beats nice curtains. Naps get easier the moment the room stops telling him it's noon.$$),
  (4,3,'feed',$$Keep one bottle in the rotation$$,$$If a bottle will ever be part of your life, don't wait until you need it. Once every few days is enough to keep him willing.$$),
  (4,4,'care',$$Buy the next size up before you need it$$,$$He'll jump a size with no warning. Having the next one in the drawer beats a midnight order.$$),
  (4,5,'you',$$Leave the house once this week$$,$$Around the block counts. The first outing is the hard one and it's easier every time after.$$),
  (4,6,'play',$$Black and white cards beat toys right now$$,$$High contrast is what he can actually see. A $6 card set will hold him longer than anything that lights up.$$),

  (5,0,'sleep',$$Same three things before every sleep$$,$$Dim, swaddle, white noise. What they are matters less than that they never change order.$$),
  (5,1,'feed',$$Hair tie on the wrist you started on$$,$$Faster than unlocking an app. Move it across when you switch sides.$$),
  (5,2,'care',$$A thin barrier layer at every night change$$,$$Five seconds now is easier than treating a raw bottom for three days.$$),
  (5,3,'you',$$Hand off the hard hour$$,$$If someone else is home, late afternoon is theirs. It's the worst stretch of the day and it shouldn't always be yours.$$),
  (5,4,'play',$$Tummy time on your chest counts$$,$$The floor is a fight this early. Lie back and put him on your chest — same muscles, none of the screaming.$$),
  (5,5,'care',$$Check the car seat straps every few weeks$$,$$They should sit at or just below his shoulders and move up as he grows. It drifts without you noticing.$$),
  (5,6,'you',$$Keep a running list in your notes app$$,$$You think of three questions at 2am and none at the appointment. One list fixes that.$$),

  (6,0,'feed',$$The six-week stretch of constant feeding$$,$$A few days of wanting to eat nonstop, then it passes. Don't rebuild your whole routine around it.$$),
  (6,1,'play',$$Smile back every single time$$,$$The first real ones land around now. Answering them is what makes him do it again.$$),
  (6,2,'sleep',$$If bedtime is a fight, try earlier$$,$$Overtired babies fight harder. Thirty minutes sooner usually works better than thirty minutes later.$$),
  (6,3,'care',$$Spare outfit in the car, not just the bag$$,$$The bag is the thing you forget. The car is always there.$$),
  (6,4,'you',$$Same walk, same time, every day$$,$$Pick a loop. It's the cheapest thing that reliably helps both of you.$$),
  (6,5,'play',$$Ceiling fans are free entertainment$$,$$You'll buy toys he ignores. He'll watch a fan for ten minutes straight.$$),
  (6,6,'feed',$$A second set of pump parts$$,$$Washing between every session is what makes people quit pumping. A spare set buys you a whole extra round.$$),

  (7,0,'sleep',$$Stop swaddling when he starts fighting it$$,$$Breaking an arm out or rolling toward his side is the signal. It's not a battle to win.$$),
  (7,1,'you',$$Answer the messages in one batch$$,$$Everyone wants a photo. One round at the same time each day keeps your phone from running the day.$$),
  (7,2,'feed',$$Hold the bottle level, not tipped up$$,$$Slower flow means less gulping and less spit-up. Look up "paced feeding" if you want the whole method.$$),
  (7,3,'care',$$Buy more muslins than you think$$,$$Burp cloth, sun shade, wipe-up, privacy. They're the one thing you'll never regret having ten of.$$),
  (7,4,'play',$$Put him where he can watch you work$$,$$A bouncer in the kitchen doorway buys twenty minutes, and you're more interesting than any toy.$$),
  (7,5,'you',$$Two outfits you feel human in$$,$$Not maternity, not pre-pregnancy. Two things that fit the body you have now, on repeat.$$),
  (7,6,'care',$$Twice a week in the bath is plenty$$,$$He isn't getting dirty and his skin dries out fast. A wipe-down covers the rest.$$),

  (8,0,'you',$$Clear the evening after the shots$$,$$He may be sleepy and clingy afterwards. Nothing planned and an early bedtime and you're both fine.$$),
  (8,1,'sleep',$$Drop the crib mattress before he pushes up$$,$$The week he starts pressing up on his arms. It's a five-minute job you'll otherwise do in a panic.$$),
  (8,2,'feed',$$Freeze the milk flat$$,$$Bags laid flat stack like files and thaw in minutes. Standing them up costs you a whole shelf.$$),
  (8,3,'play',$$Tape something above the changing table$$,$$Anything to look at turns the worst three minutes of the day into the easiest.$$),
  (8,4,'care',$$Night leaks mean size up at night$$,$$Go one size bigger for overnight only and keep the smaller ones for daytime.$$),
  (8,5,'you',$$Put one thing on the calendar for you$$,$$A haircut, a coffee, anything with a time attached. Vague plans don't survive a newborn.$$),
  (8,6,'sleep',$$Watch the clock, not just him$$,$$An hour or so awake is plenty right now. Down before the yawn beats down after the meltdown.$$),

  (9,0,'feed',$$Warm bottles in a mug of hot water$$,$$Faster than a warmer and nothing to clean. Never the microwave — it heats in pockets you can't feel.$$),
  (9,1,'care',$$Use the fold-over cuffs, skip the mitts$$,$$Every sleeper has them built in. Scratch mitts are gone by the second week.$$),
  (9,2,'you',$$Ask for the specific thing$$,$$"Come at four and hold him while I nap" works. "Let me know if you need anything" never does.$$),
  (9,3,'sleep',$$Don't make every nap a crib nap$$,$$One in the carrier or the pram keeps you sane and keeps him able to sleep somewhere that isn't home.$$),
  (9,4,'play',$$Prop a mirror during tummy time$$,$$He'll watch the baby in the mirror far longer than he'll watch a toy, and he'll hold his head up doing it.$$),
  (9,5,'feed',$$If he refuses the bottle, leave the room$$,$$He can smell you. Someone else offers it while you're out of sight and that alone fixes it half the time.$$),
  (9,6,'care',$$Practice the carrier clips on a teddy$$,$$A car park with a screaming baby is a bad place to learn where the buckles are.$$)
) AS v(wk, day, category, title, body)
WHERE t.locale = 'en' AND t.week_number = v.wk AND t.day_index = v.day;

-- ── weeks 10-19 · finding a rhythm, then the four-month reshuffle ───────────
UPDATE mom_tips t SET title = v.title, body = v.body, category = v.category, updated_at = now()
FROM (VALUES
  (10,0,'sleep',$$Give it ten minutes before you go in$$,$$A sleep cycle is about forty minutes. A hand on his chest for ten can buy you a second one.$$),
  (10,1,'care',$$Own three crib sheets$$,$$One on the mattress, one in the drawer, one in the wash. Two isn't enough the first night it happens twice.$$),
  (10,2,'feed',$$Bottle nipples wear out$$,$$If feeds suddenly take twice as long, check the nipple before you blame him. They clog and collapse with use.$$),
  (10,3,'you',$$Say the 3am thought out loud$$,$$Text a friend, tell your partner. It shrinks the moment it leaves your head, and it grows if it doesn't.$$),
  (10,4,'play',$$Give him something he can actually hold$$,$$He'll start reaching on purpose about now. A light ring or rattle turns that into practice.$$),
  (10,5,'care',$$Restock the bag when you get home$$,$$Not when you're leaving. Leaving is when you're already late and someone is crying.$$),
  (10,6,'sleep',$$Keep the crib in your room for now$$,$$The guidance is at least six months. It's also a lot less walking at 3am.$$),

  (11,0,'you',$$Order the groceries, don't go$$,$$The delivery fee is the cheapest childcare you will ever buy.$$),
  (11,1,'feed',$$Date the milk, don't day it$$,$$"Tuesday" means nothing three weeks later. Date and time, on the bag, permanent marker.$$),
  (11,2,'care',$$Check his toes when nothing else works$$,$$A loose hair can wrap around a toe or finger and really hurt. Easy to miss, easy to fix — call if you can't get it off.$$),
  (11,3,'sleep',$$Try a dream feed for one week$$,$$Top him up before you go to bed and see if the first stretch lengthens. A week is enough to know whether it works for him.$$),
  (11,4,'play',$$Hang something where his hands land$$,$$Missing it fifty times is the point. Batting at it is how the aiming gets built.$$),
  (11,5,'you',$$Eat one meal sitting down$$,$$Standing at the counter with a baby on you isn't eating. One meal a day at an actual table.$$),
  (11,6,'care',$$Take the newborn insert out on weight$$,$$Check the car seat manual for the number rather than guessing by how he looks in it.$$),

  (12,0,'sleep',$$Start the routine before he's tired$$,$$Twenty minutes of dim and quiet ahead of it. Beginning once he's crying means you're soothing, not settling.$$),
  (12,1,'feed',$$Build the freezer stash slowly$$,$$One extra pump a day, starting now. Panicking two weeks before you go back doesn't work.$$),
  (12,2,'you',$$Look at childcare now, even if it's far off$$,$$Waitlists are the whole game. Visiting three places at three months beats scrambling at eight.$$),
  (12,3,'care',$$Shade and sleeves before sunscreen$$,$$Under six months the advice is cover up and stay out of it. A wide brim does most of the work.$$),
  (12,4,'play',$$His hands are the toy this month$$,$$Twenty minutes of chewing his own fist is development, not hunger. Let him get on with it.$$),
  (12,5,'sleep',$$Drop the swaddle one arm at a time$$,$$A few nights with one arm out, then the other. Cold turkey is a rough week for everybody.$$),
  (12,6,'you',$$Keep ten minutes that are yours$$,$$A book, a walk without the pram, a coffee outside. Small and daily beats big and never.$$),

  (13,0,'care',$$Drool starts long before teeth$$,$$Bibs from now on. It saves you three outfit changes a day and the rash that comes with them.$$),
  (13,1,'sleep',$$Nothing in the crib but him$$,$$No bumpers, no pillows, no blankets, no positioners. The empty crib is the safe one.$$),
  (13,2,'feed',$$Feed him somewhere boring$$,$$The world got interesting and he'll unlatch at every sound. A dim quiet room halves the time it takes.$$),
  (13,3,'play',$$Peekaboo starts working now$$,$$He's figuring out you still exist behind your hands. It's also ten free minutes.$$),
  (13,4,'you',$$Book your own appointments in one sitting$$,$$Dentist, eyes, whatever you've put off. Do the booking while you're already thinking about it.$$),
  (13,5,'care',$$A laundry basket in the room he changes in$$,$$Clothes come off where they get dirty. Without a basket there, the floor becomes the basket.$$),
  (13,6,'sleep',$$Treat 5am as night, not morning$$,$$Lights off, no chat, back down. Getting up starts the day, and he will book that in fast.$$),

  (14,0,'sleep',$$The four-month reshuffle is real$$,$$Sleep goes lighter and more broken for a few weeks. It's development, not something you broke — hold the routine.$$),
  (14,1,'feed',$$Solids won't fix sleep$$,$$It's the most common advice you'll be given and it doesn't hold up. Wait for the signs instead.$$),
  (14,2,'care',$$Pat the drool off through the day$$,$$The rash under his chin is usually drool sitting there. Drying it beats treating it.$$),
  (14,3,'play',$$Floor time beats seat time$$,$$Bouncers and swings hold him in one shape. Ten minutes on a mat does more than an hour in a chair.$$),
  (14,4,'you',$$Your hair will come out in handfuls$$,$$Around three or four months, and then it stops. It's normal, and a drain catcher saves your plumbing.$$),
  (14,5,'care',$$Get the sleep sack in the next size$$,$$Once the swaddle is gone it keeps the warmth without anything loose in the crib.$$),
  (14,6,'sleep',$$Same wake-up time, even after a bad night$$,$$A fixed morning does more for the rest of the day than a fixed bedtime.$$),

  (15,0,'play',$$Everything goes in the mouth now$$,$$Glasses, hair, your dinner. Move the hot drink before you sit down, not after.$$),
  (15,1,'feed',$$Sitting steady is the sign, not age$$,$$Solids are close when he holds his head up and sits with support. Nearer six months than four.$$),
  (15,2,'care',$$Move the breakables down a shelf now$$,$$He isn't crawling yet, which is exactly why this is the easy week to do it.$$),
  (15,3,'you',$$Split the night into shifts$$,$$One of you until 2am, the other after. Four unbroken hours each beats eight broken ones.$$),
  (15,4,'sleep',$$Protect the middle nap$$,$$Plan errands around it. The others can happen in the pram; that one is worth being home for.$$),
  (15,5,'play',$$Read the same book every night$$,$$Repetition is the part he likes. You'll be sick of it long before he is.$$),
  (15,6,'care',$$Wash the toys once a week$$,$$All of it is going in his mouth now. Hot soapy water or the top rack, one day a week, done.$$),

  (16,0,'feed',$$Get the high chair out early$$,$$Let him sit in it at your meals for a couple of weeks first. Familiar chair makes the first spoon easier.$$),
  (16,1,'sleep',$$Six months is the room-sharing guidance$$,$$If you're counting the days, that's the number. After that, when to move him is your call.$$),
  (16,2,'you',$$Say no to one thing this week$$,$$A visit, a dinner, a christening. You can decline without a reason, and it gets easier with practice.$$),
  (16,3,'care',$$Two inches of water in the big bath$$,$$Add a plastic cup. It's twenty minutes of entertainment that costs nothing.$$),
  (16,4,'play',$$Two toys out, not twenty$$,$$He plays longer with fewer things. Box the rest and swap every couple of weeks — it reads as new.$$),
  (16,5,'feed',$$Give his hands something during feeds$$,$$A muslin or a small toy. It heads off the pinching and scratching that starts about now.$$),
  (16,6,'care',$$Coat off before the car seat$$,$$A puffy coat under the straps leaves them too loose to work. Buckle him in, then put the coat over the top.$$),

  (17,0,'sleep',$$Once he rolls, let him land how he likes$$,$$Still put him down on his back. When he can roll both ways himself you don't have to flip him all night.$$),
  (17,1,'play',$$Let him bang things together$$,$$Two blocks, a wooden spoon, a pot. Noise he causes himself is the entire lesson.$$),
  (17,2,'you',$$Let someone else do bedtime weekly$$,$$It goes badly the first time and fine by the third. You both need him settle-able by someone who isn't you.$$),
  (17,3,'feed',$$First foods want iron in them$$,$$It's the one thing the six-month guidance is firm about. Your pediatrician will point you at the right ones.$$),
  (17,4,'care',$$Only buy the hat with a strap$$,$$Any other hat is a hat you lose in the first week.$$),
  (17,5,'sleep',$$Cap the late-afternoon nap$$,$$A long one after four buys you a fight at bedtime. Wake him and take the grumpy twenty minutes.$$),
  (17,6,'you',$$Take the video, not just the photo$$,$$Fifteen seconds of him babbling will be worth more later than another hundred stills.$$),

  (18,0,'feed',$$Strip him to the diaper for first foods$$,$$It goes everywhere. A bare baby and a wipe-down beats two outfits a day.$$),
  (18,1,'care',$$Put something under the high chair$$,$$A cheap shower curtain works. Otherwise the floor becomes a job three times a day.$$),
  (18,2,'play',$$He drops things to watch them fall$$,$$That's cause and effect, not naughtiness. Tie a couple of toys to the chair and save your back.$$),
  (18,3,'sleep',$$Take the routine with you when you travel$$,$$Same order, same white noise, same sack. The room can change; the sequence shouldn't.$$),
  (18,4,'you',$$Cook one thing double and freeze half$$,$$Whatever you'd actually eat. Weeknights stop being a decision you have to make tired.$$),
  (18,5,'feed',$$Offer water in an open cup$$,$$Small sips with meals from around six months. An open cup or a straw teaches him more than a spouted one.$$),
  (18,6,'care',$$Cold beats gels for teething$$,$$A cold wet flannel or a chilled teether does more than most things sold for it. Ask before using any medicine or gel.$$),

  (19,0,'play',$$Hand him something soft to feed himself$$,$$A strip of banana is a whole activity. Slow and messy, but the grabbing and chewing are the point.$$),
  (19,1,'sleep',$$Don't go in at the first noise$$,$$Babies grumble between cycles and resettle. A minute of listening saves you waking him properly.$$),
  (19,2,'you',$$Update the emergency contacts$$,$$Anyone who might collect him, at the pediatrician and anywhere he's left. Do it before you need it.$$),
  (19,3,'feed',$$Allergens early and regularly, not avoided$$,$$Current guidance is one at a time, at home, and kept in the rotation. Your pediatrician will tell you how for him.$$),
  (19,4,'care',$$Clip the teether to the pram$$,$$Everything he holds ends up on the pavement. A clip costs two dollars and saves the walk back.$$),
  (19,5,'play',$$Name it as you hand it over$$,$$Cup. Spoon. Dog. Same word, same object, every time — that's how the first ones stick.$$),
  (19,6,'care',$$Keep a second bag in the car permanently$$,$$Diapers, wipes, a change of clothes, a snack for you. Not the bag you carry — one that never comes inside.$$)
) AS v(wk, day, category, title, body)
WHERE t.locale = 'en' AND t.week_number = v.wk AND t.day_index = v.day;

-- ── weeks 20-29 · solids, sitting, and the week he starts moving ────────────
UPDATE mom_tips t SET title = v.title, body = v.body, category = v.category, updated_at = now()
FROM (VALUES
  (20,0,'feed',$$Two spoons: one for you, one for him$$,$$He waves his while you use yours. It's slower and it's the only way he learns to do it himself.$$),
  (20,1,'sleep',$$The nap moves, it doesn't vanish$$,$$Three becomes two somewhere in here. Follow his tired signs for a week before you rewrite the schedule.$$),
  (20,2,'care',$$Babyproof from the floor, on your knees$$,$$Cables, table corners, the dog bowl. You see an entirely different room from down there.$$),
  (20,3,'you',$$Write the invisible jobs down$$,$$Somewhere your partner can see them. Anything unwritten stays yours by default, and nobody decided that on purpose.$$),
  (20,4,'play',$$Containers and lids beat real toys$$,$$Taking things out and putting them back is the game for months. Tupperware costs nothing.$$),
  (20,5,'feed',$$Gagging is loud, choking is silent$$,$$Gagging is him sorting it out himself and it looks alarming. Learn the difference before you start solids — a first-aid class is worth the evening.$$),
  (20,6,'care',$$Nothing round and firm, ever$$,$$Whole grapes, cherry tomatoes, nuts. Quarter it lengthways or leave it out — that shape is the dangerous one.$$),

  (21,0,'sleep',$$Change one thing, then wait four nights$$,$$If you're fixing sleep, three changes at once tells you nothing about which one worked.$$),
  (21,1,'play',$$Sit him on the floor, not the sofa$$,$$He topples sideways without warning for a few weeks. Floor, cushion behind, done.$$),
  (21,2,'you',$$Go to bed when he does, once a week$$,$$Not to catch up on the house. Actually to bed. One night changes the whole week.$$),
  (21,3,'feed',$$Freeze purée in ice cube trays$$,$$One tray is a week of lunches and nothing gets wasted defrosting too much.$$),
  (21,4,'care',$$Same day every week for nails$$,$$The scratches on his own face are the reminder. A fixed day beats trying to remember.$$),
  (21,5,'sleep',$$Leave the white noise on all night$$,$$Turning it off once he's asleep is why the pipes wake him. It's a masker, not a lullaby.$$),
  (21,6,'you',$$Write down one line about this week$$,$$In your phone. You won't remember which week he found his feet, and you will want to.$$),

  (22,0,'feed',$$Take his portion out before you season$$,$$He eats what you're eating, unsalted. Less cooking for you and he learns your food, not baby food.$$),
  (22,1,'care',$$Cover the outlets before he moves$$,$$He goes from still to across the room in a fortnight. Now it's a calm job; then it's a scramble.$$),
  (22,2,'play',$$He wants whatever you're using$$,$$A dead remote, an empty box, a real spoon. That it's yours is the appeal — being a toy isn't.$$),
  (22,3,'sleep',$$A tooth is a few bad nights, not a new normal$$,$$Get through them however you need to. Just don't build a permanent habit to solve one week.$$),
  (22,4,'you',$$Join the waitlist even if you're unsure$$,$$You can always give the place up. You can't jump the queue because you changed your mind in March.$$),
  (22,5,'feed',$$A refused food isn't a verdict$$,$$It takes a lot of exposures before something is familiar. Keep offering it without turning it into an event.$$),
  (22,6,'care',$$Spoon and bib live in the car bag$$,$$The one day you're out over lunch is the day you'll need both.$$),

  (23,0,'play',$$Crawling starts backwards$$,$$He'll push himself away from what he wants and be furious about it. Put the toy behind him sometimes so he wins.$$),
  (23,1,'sleep',$$Less day sleep means earlier bedtime$$,$$It feels backwards and it works. Overtired is what makes bedtime a fight.$$),
  (23,2,'care',$$Stair gates before he crawls, not after$$,$$Top and bottom. Fitting them around a mobile baby is a two-person job you'll resent.$$),
  (23,3,'you',$$Put a night out on the calendar$$,$$Months ahead is fine. Having it there does something for you now, whatever happens on the night.$$),
  (23,4,'feed',$$No honey until his first birthday$$,$$Not a taste, not in baking, not on a pacifier. Cheese and yogurt are fine; that one waits a year.$$),
  (23,5,'play',$$He's watching your face$$,$$Stick your tongue out, raise your eyebrows, exaggerate everything. Your face is the best toy in the room.$$),
  (23,6,'care',$$Put a rug where he plays$$,$$Hard floors and a wobbly new sitter don't mix. A cheap rug costs less than the bumps.$$),

  (24,0,'feed',$$Write the food questions down beforehand$$,$$You get ten minutes at the check-up and you'll forget the one that mattered.$$),
  (24,1,'sleep',$$Shorten the routine now$$,$$Bath, book, bed is enough. Long routines get harder to hold as he gets more interesting.$$),
  (24,2,'play',$$Put it six inches out of reach$$,$$Not cruelly far. Six inches is the gap between frustration and motivation.$$),
  (24,3,'you',$$Drop one thing that isn't helping$$,$$Half a year in, some of your routine is habit rather than help. You're allowed to stop it.$$),
  (24,4,'care',$$Wipe the first tooth once a day$$,$$A soft cloth or a tiny brush. No paste needed yet unless your dentist tells you otherwise.$$),
  (24,5,'feed',$$Eat sitting down with him$$,$$Chewing is learned by watching. If you're standing while he's sitting, he's missing the demonstration.$$),
  (24,6,'care',$$Sunscreen is allowed from six months$$,$$Face, hands, the back of the neck — whatever sticks out of the pram. Shade still does most of the work.$$),

  (25,0,'play',$$A ball, a cup, a spoon, a box$$,$$Four things cover months. The expensive plastic thing with buttons gets ten minutes.$$),
  (25,1,'sleep',$$Cool room, one layer, sack$$,$$Around 18-20°C is the usual advice. Overheated causes more trouble at this age than cold does.$$),
  (25,2,'you',$$Advice isn't an instruction$$,$$You'll get it from everyone this year. "That's interesting, thanks" is a complete sentence.$$),
  (25,3,'feed',$$Move past smooth while he's willing$$,$$Lumps at seven months are easier than lumps at ten. Texture is a skill with a window on it.$$),
  (25,4,'care',$$Label everything in one sitting$$,$$Before daycare. Bottles, sacks, hats, every sock — with a marker, in one go, not piece by piece.$$),
  (25,5,'play',$$Give him a drawer in the kitchen$$,$$Plastic bowls and wooden spoons, no lock on it. That's the twenty minutes it takes you to cook.$$),
  (25,6,'you',$$Ask daycare the boring questions$$,$$Who changes him, what happens when he won't nap, how they tell you about a bad day. The tour covers the rest.$$),

  (26,0,'feed',$$One or two meals a day is plenty now$$,$$Milk is still doing the heavy lifting at six months. Three meals is where you're heading, not where you start.$$),
  (26,1,'sleep',$$Bring the long nap home if you can$$,$$Pram naps stop working as well as he gets nosier. The other one can still happen anywhere.$$),
  (26,2,'play',$$Support him from behind, not the front$$,$$Sitting in front means he reaches for you and gets lifted. Behind means he practises the balance.$$),
  (26,3,'care',$$Less on the plate, topped up$$,$$Suction bowls buy you a few months and then he learns the trick. A small amount, refilled, survives longer.$$),
  (26,4,'you',$$Actually print one photo$$,$$The six-month one. Everything you have is on a phone, and phones get lost and broken.$$),
  (26,5,'feed',$$Milk first, food after — for now$$,$$So a half-eaten lunch doesn't cost him the calories that still matter most.$$),
  (26,6,'care',$$Use the high chair crotch strap$$,$$It's the one that stops him sliding down underneath. Every time, even for a two-minute snack.$$),

  (27,0,'play',$$He'll go straight for the one unsafe thing$$,$$Whatever you left out is the most interesting object in the room. It isn't defiance, it's novelty.$$),
  (27,1,'feed',$$Let him get filthy$$,$$Squashing it in his fists is how he learns what food is. Clean face, no learning.$$),
  (27,2,'sleep',$$Say the same thing every time you leave$$,$$He's starting to mind you going. Short, identical words and a reliable return beat sneaking out.$$),
  (27,3,'care',$$Check the seat limits, not his age$$,$$The next car seat goes by height and weight. The number is in the manual, not on the box.$$),
  (27,4,'you',$$Comparison starts about now$$,$$Someone's baby will crawl first, sleep better, eat more. Keep one person you can be honest with and let the rest go.$$),
  (27,5,'play',$$Hide a toy under a cloth$$,$$Half-covered first, then completely. He's learning that things exist when he can't see them.$$),
  (27,6,'feed',$$A boring snack in every bag$$,$$The meltdown is usually hunger and it gives no warning. Something dry that survives a week in a bag.$$),

  (28,0,'sleep',$$New skills show up at 2am first$$,$$Crawling and pulling up get practised in the night. Give him more floor time in the day and it passes faster.$$),
  (28,1,'care',$$Socks with grips on the bottom$$,$$Once he's moving on hard floors, ordinary socks turn the hallway into an ice rink.$$),
  (28,2,'you',$$Leave the house without him once$$,$$An hour, any reason. The first time is strange and after that it's just an hour.$$),
  (28,3,'feed',$$Something to hold, something on a spoon$$,$$Two textures on the tray. It keeps his hands busy and more of it goes in.$$),
  (28,4,'play',$$The same three songs, with actions$$,$$He'll do the clapping long before he can say any of the words.$$),
  (28,5,'care',$$Leave one cupboard unlocked$$,$$Fill it with plastic bowls and wooden spoons. He'll choose that one and leave the ones that matter.$$),
  (28,6,'sleep',$$Foil on the window for light mornings$$,$$Summer undoes good sleep fast. It looks terrible from the street and it works.$$),

  (29,0,'feed',$$Put the cup out even if he ignores it$$,$$Familiar now means he isn't learning a brand new thing later, when he actually needs it.$$),
  (29,1,'play',$$Build a course out of cushions$$,$$Boxes, pillows, a tunnel made of chairs. Crawling gets interesting when there's something to get over.$$),
  (29,2,'you',$$Do the admin in one evening$$,$$Forms, appointments, daycare paperwork. Spread across a week it feels like it never ends.$$),
  (29,3,'sleep',$$Daycare naps will look nothing like home$$,$$Shorter, noisier, on a mat, and he'll cope. Don't rebuild your evenings to match theirs.$$),
  (29,4,'care',$$Photograph the label of anything you love$$,$$The sack, the bottle, the sunscreen. In four months you'll want the identical thing, one size up.$$),
  (29,5,'feed',$$Serve two pieces at a time$$,$$A loaded plate goes on the floor. A nearly empty one that keeps getting refilled doesn't.$$),
  (29,6,'care',$$Restock the daycare bag on Sunday$$,$$Weekday mornings are not when you want to be hunting for a clean sleep sack.$$)
) AS v(wk, day, category, title, body)
WHERE t.locale = 'en' AND t.week_number = v.wk AND t.day_index = v.day;

-- ── weeks 30-39 · pulling up, first words, and the nine-month wobble ────────
UPDATE mom_tips t SET title = v.title, body = v.body, category = v.category, updated_at = now()
FROM (VALUES
  (30,0,'care',$$Crib to its lowest setting this week$$,$$He'll pull himself up in the crib before he does it in front of you. Don't wait to be shown.$$),
  (30,1,'feed',$$Strips he can hold in his fist$$,$$Softer than you think and longer than his hand. He'll manage far more than purée suggests.$$),
  (30,2,'sleep',$$Practise getting back DOWN$$,$$He'll pull up in the crib and get stuck standing. Ten minutes of practising sitting down, in daylight, ends the 2am crying.$$),
  (30,3,'play',$$He empties whatever you fill$$,$$Give him a basket that's allowed to be emptied and the bookshelf gets left alone.$$),
  (30,4,'you',$$The first daycare term is one cold after another$$,$$It's relentless and it's normal. Stock up, plan for the days off, and don't read it as a sign you chose wrong.$$),
  (30,5,'care',$$The rain cover lives in the pram$$,$$Not in the cupboard, where it stays perfectly dry and completely useless.$$),
  (30,6,'feed',$$Twenty minutes is a good meal$$,$$Ending while it's still going well beats squeezing in three more spoons and a meltdown.$$),

  (31,0,'play',$$Repeat it back, don't correct it$$,$$"Ba" counts as ball. Say the whole word cheerfully rather than telling him he got it wrong.$$),
  (31,1,'sleep',$$Standing, teeth and missing you, all at once$$,$$They land in the same month and sleep takes the hit. Keep the routine identical and it settles in a fortnight.$$),
  (31,2,'care',$$No shoes until he walks outside$$,$$Bare feet or soft soles are better for how his feet develop. Measure him when he's actually walking.$$),
  (31,3,'you',$$Two hours a week, booked and repeating$$,$$With someone else covering. Leftover time never happens; scheduled time does.$$),
  (31,4,'feed',$$Water with meals from here on$$,$$It gets him used to the cup and stops milk filling him up before the food.$$),
  (31,5,'play',$$Point at what he's looking at$$,$$Naming it while he's already looking is how words attach. He'll be pointing back within a couple of months.$$),
  (31,6,'care',$$One toy that lives only in the car$$,$$It stays interesting because it never comes inside. Swap it every few weeks.$$),

  (32,0,'sleep',$$Try a shorter awake window before dropping a nap$$,$$Overtired looks almost exactly like not tired. Most nap strikes are the first one.$$),
  (32,1,'feed',$$Yogurt is the best practice food$$,$$Sticky enough to survive the journey while he waves the spoon around. Progress without soup everywhere.$$),
  (32,2,'care',$$Lock the cleaning cupboard first$$,$$Everything else can wait a week. That one takes ten minutes and it's the one that matters.$$),
  (32,3,'play',$$If you laugh, he'll do it again$$,$$And again. Forty times. The repetition is the entire joke for him.$$),
  (32,4,'you',$$Put what you need to work in writing$$,$$Pumping breaks, pickup times, the days that can't move. Kindly, by email, before your first day back.$$),
  (32,5,'sleep',$$Change the habit in daylight, not at 3am$$,$$Rocking or feeding to sleep is fine if it works. If you'd rather not still be doing it in three months, change it on a Tuesday afternoon.$$),
  (32,6,'care',$$Scatter a few pacifiers in the crib$$,$$He can find one himself at 2am instead of calling you in to do it for him.$$),

  (33,0,'play',$$Buy board books and expect casualties$$,$$Flaps get torn off. Let one be sacrificial and keep the tape handy — that's the deal.$$),
  (33,1,'feed',$$Put the food you care about at breakfast$$,$$Appetite is front-loaded at this age. Dinner is the meal that gets refused.$$),
  (33,2,'sleep',$$Two naps, roughly mid-morning and after lunch$$,$$Most land near there. Treat it as a starting point and move it based on him, not the clock.$$),
  (33,3,'care',$$He can pick up a crumb this month$$,$$The pincer grip changes what counts as a hazard. Do another sweep at floor level.$$),
  (33,4,'you',$$Take the four-generations photo$$,$$Whoever is around. It's the picture nobody thinks to take until it can't be taken.$$),
  (33,5,'play',$$Stacking cups outlast everything$$,$$Stack, nest, fill, knock over, chew. Six dollars and four years of use.$$),
  (33,6,'feed',$$Don't chase him with the spoon$$,$$Turning his head away means done. Chasing turns eating into something to resist.$$),

  (34,0,'care',$$Corners matter now that he's cruising$$,$$He's holding on to furniture to move. The coffee table corner and the hearth are the two that catch people.$$),
  (34,1,'sleep',$$Keep bedtime inside a thirty-minute window$$,$$The exact time matters less than the range. Late once is fine; late at random is what unravels it.$$),
  (34,2,'you',$$Fix one thing that annoys you daily$$,$$The sticking drawer, the dead bulb. Small, cheap, and you'll notice it every single day.$$),
  (34,3,'feed',$$Let him drink from your cup$$,$$Water only. He'll want yours anyway, and it teaches sipping faster than any training cup.$$),
  (34,4,'play',$$Hand him something new at every change$$,$$A different object each time. Ten seconds of curiosity is the whole nappy change at this age.$$),
  (34,5,'care',$$Photograph the car seat straps set right$$,$$So whoever else buckles him has something to check against instead of guessing.$$),
  (34,6,'you',$$Book the birthday photos now if you want them$$,$$Good photographers are months out, and you'll want it near the day rather than after it.$$),

  (35,0,'play',$$Up, down, up, down, all day$$,$$It's a phase and it's short. A hip carrier gets your back through it.$$),
  (35,1,'feed',$$Three meals and milk, around now$$,$$Solids move to the middle over the next couple of months. Follow his appetite rather than a chart.$$),
  (35,2,'sleep',$$Sort nights first, naps second$$,$$Naps are harder and they often improve on their own once the nights are steady.$$),
  (35,3,'care',$$Squeeze the bath toys dry$$,$$The squirty ones grow mould inside where you can't see. When they go black, bin them.$$),
  (35,4,'you',$$Reset one room before bed$$,$$Ten minutes, one room. Waking up to one tidy space does more for you than it has any right to.$$),
  (35,5,'play',$$Copy him first$$,$$Bang when he bangs, babble what he babbles. Turn-taking is the root of conversation and it starts here.$$),
  (35,6,'care',$$A full spare set lives at daycare$$,$$Then a bad morning at home never becomes a problem at drop-off.$$),

  (36,0,'feed',$$Throwing food means finished$$,$$It's a signal, not misbehaviour. Take the tray rather than negotiating with someone who can't talk yet.$$),
  (36,1,'sleep',$$Lie him down once, then leave$$,$$If he stands and cries, do it silently and go. Turning it into a conversation at 1am is what makes it last an hour.$$),
  (36,2,'you',$$Automate one recurring annoyance$$,$$The bill you keep paying by hand, the order you keep re-placing. Take it off your plate for good.$$),
  (36,3,'play',$$The recycling beats anything with batteries$$,$$Cardboard tubes, egg boxes, a big box. Keep a bin of it and refresh it weekly.$$),
  (36,4,'care',$$First haircut at home, in the high chair$$,$$A snack and blunt scissors. The salon can wait until sitting still is something he chooses.$$),
  (36,5,'feed',$$Cow's milk in cooking, not in a cup$$,$$As an ingredient it's fine now; as a drink it waits for his birthday. Your pediatrician will confirm.$$),
  (36,6,'sleep',$$Move bedtime ten minutes a night$$,$$When the clocks change or the schedule shifts. An hour in one go costs you a week.$$),

  (37,0,'play',$$Let him push a dining chair around$$,$$Steadier than a push toy and it doesn't shoot away from him. Free, and already in the room.$$),
  (37,1,'care',$$Nails straight after the bath$$,$$They're soft and he's calm. Half the time it takes when he's fighting you.$$),
  (37,2,'you',$$Tell someone the real version$$,$$Once a month, to someone who won't try to fix it. Saying it out loud is the entire point.$$),
  (37,3,'feed',$$One meal a day at the family table$$,$$Even if it's just a snack while you eat. The habit is what you're building, not the calories.$$),
  (37,4,'sleep',$$The stalling starts before the talking does$$,$$Same order, same length, no negotiating. Bedtime resistance grows into whatever room you give it.$$),
  (37,5,'play',$$Roll a ball back and forth$$,$$He'll push it before he can throw it. It's the first game you genuinely play together.$$),
  (37,6,'care',$$Own two coats, not one$$,$$One is always wet or at daycare. It's the thing everybody owns exactly one of and regrets.$$),

  (38,0,'feed',$$Two snacks a day, at set times$$,$$Grazing all day is usually why dinner gets refused. Water in between.$$),
  (38,1,'sleep',$$A second wind at 7pm means late, not early$$,$$Suddenly hilarious and bouncing off the walls is overtired. Move bedtime earlier, not later.$$),
  (38,2,'care',$$Tighten the crib screws$$,$$A year of shaking loosens everything. Ten minutes with an allen key, twice a year.$$),
  (38,3,'you',$$Back the photos up this week$$,$$A year of pictures living on one phone is the most fragile thing you own.$$),
  (38,4,'play',$$He'll bring you things over and over$$,$$Handing you an object is him opening a conversation. Take it, name it, hand it back.$$),
  (38,5,'feed',$$Sit at his height while he eats$$,$$Standing over him ends meals early. Pull a chair up and the whole thing changes.$$),
  (38,6,'care',$$A hook by the door for the bag$$,$$Restocked, on the hook, always. Mornings that start with looking for it start badly.$$),

  (39,0,'sleep',$$Nine months is the same wobble as eight$$,$$Crawling, standing and missing you all peak together. Nothing has gone wrong and it is still passing.$$),
  (39,1,'play',$$He understands no before he obeys it$$,$$Say it once and then move him. Repeating it louder is what teaches him to ignore it.$$),
  (39,2,'you',$$Ask for the birthday help now$$,$$Whatever you want the day to be, tell people early. Easier than doing all of it at 11pm the night before.$$),
  (39,3,'feed',$$Put a loaded fork next to his hand$$,$$He won't use it properly for months. Starting now is exactly why it eventually happens.$$),
  (39,4,'care',$$Keep the bathroom door shut$$,$$The toilet and the toilet brush are what every crawler finds first. A door hook solves it.$$),
  (39,5,'sleep',$$Give 5am ten minutes before you go in$$,$$Grumbling often turns into another forty minutes. Walking in ends the night for both of you.$$),
  (39,6,'play',$$Name the parts during every change$$,$$Nose, toes, tummy, same order. It turns the struggle into a routine he starts to enjoy.$$)
) AS v(wk, day, category, title, body)
WHERE t.locale = 'en' AND t.week_number = v.wk AND t.day_index = v.day;

-- ── weeks 40-52 · cruising to walking, and the first birthday ───────────────
UPDATE mom_tips t SET title = v.title, body = v.body, category = v.category, updated_at = now()
FROM (VALUES
  (40,0,'care',$$Teach the stairs backwards, on purpose$$,$$He'll climb before you're ready for it. Coming down feet-first is a skill you can practise with him.$$),
  (40,1,'feed',$$Food first, milk after$$,$$Solids become the main event around now. Changing the order is usually all the transition needs.$$),
  (40,2,'sleep',$$Don't drop to one nap yet$$,$$That's usually somewhere between twelve and eighteen months. A bad week of fighting the second nap isn't the signal.$$),
  (40,3,'play',$$Put a big box on its side$$,$$Getting in and out of things is the whole game now. Nothing you can buy beats it.$$),
  (40,4,'you',$$Make the daycare goodbye boring$$,$$Same words, quick, cheerful, gone. Drawn-out goodbyes are harder on both of you, not kinder.$$),
  (40,5,'care',$$Bibs with sleeves for anything saucy$$,$$It's the difference between wiping his face and changing his entire outfit.$$),
  (40,6,'feed',$$Judge his eating across a week$$,$$Appetite swings hard at this age. One refused day tells you nothing at all.$$),

  (41,0,'play',$$Tell him what happens next$$,$$"Nappy, then shoes, then out." He understands far more than he can say, and it heads off half the resistance.$$),
  (41,1,'sleep',$$Change the story, not the sequence$$,$$Predictability is what's doing the work. The book can be different; the order shouldn't be.$$),
  (41,2,'care',$$Take the high chair tray off sometimes$$,$$Push him up to the table with everyone else. He copies the people he can see.$$),
  (41,3,'you',$$Alternate drop-off and pickup$$,$$If two of you can. One hard morning each beats one person doing five.$$),
  (41,4,'feed',$$Let him hold something in each hand$$,$$A spoon and a piece of food. Full hands stop him grabbing at yours.$$),
  (41,5,'play',$$Sing the same song forty times$$,$$The repetition is exactly what makes the words stick. Yours is not the ear that matters.$$),
  (41,6,'care',$$Layers, not one thick coat$$,$$Layers come off in the car and go back on outside. One big coat means roasting or freezing.$$),

  (42,0,'sleep',$$The back teeth are the hard ones$$,$$Nothing like the front ones. Cold things and patience, and ask your pediatrician before any medicine.$$),
  (42,1,'feed',$$Serve what you care about first$$,$$When he's hungriest. Vegetables at the start of a meal do far better than vegetables at the end.$$),
  (42,2,'you',$$Decide about the bottle on purpose$$,$$It gets harder to drop after a year. Pick your timing deliberately rather than arriving at two still doing it.$$),
  (42,3,'play',$$Stairs are a skill, not just a hazard$$,$$Supervised practice up and down beats a gate he eventually learns to climb. Do both.$$),
  (42,4,'care',$$Match the sack weight to the season$$,$$The same tog all year is either a sweaty baby or a cold one at 4am.$$),
  (42,5,'sleep',$$Keep the room boring$$,$$Nothing in the crib that lights up or plays. Being dull is the room's entire job.$$),
  (42,6,'you',$$Say yes to one invitation$$,$$You'll want to cancel. Go, leave early if you need to — the deciding is the hard part, not the going.$$),

  (43,0,'play',$$Don't hold his hands above his head$$,$$It changes how he balances. Let him hold furniture, or one low hand, and let go more than feels comfortable.$$),
  (43,1,'feed',$$One dinner, his portion cut down$$,$$Cooking twice is what makes this exhausting. Take his out before the salt goes in.$$),
  (43,2,'care',$$Hat and sunscreen live in the bag$$,$$He's outside and moving more now. Reapplying is the part everyone forgets.$$),
  (43,3,'sleep',$$One late night doesn't undo anything$$,$$A wedding, a flight, a party. Return to normal the next day and it sorts itself out.$$),
  (43,4,'you',$$Cancel what you're paying for and not using$$,$$Subscriptions, the class, the gym you haven't seen since March. Ten minutes, real money.$$),
  (43,5,'play',$$Holding it up means "look at this"$$,$$It isn't a request for anything. Looking, and saying what it is, is the entire response.$$),
  (43,6,'feed',$$A short rotation is fine$$,$$Variety matters across a month, not across a day. Repeating what he'll actually eat isn't failure.$$),

  (44,0,'sleep',$$If 5am arrives, shorten the morning nap$$,$$Too much early sleep can pull the wake-up earlier still. Try that before you change anything else.$$),
  (44,1,'care',$$Cut the fringe yourself$$,$$One straight line while he's eating. Out of his eyes matters more than tidy.$$),
  (44,2,'you',$$Plan the birthday small$$,$$He won't remember it and you'll enjoy it more. The pressure is coming entirely from other people.$$),
  (44,3,'feed',$$Let him refuse without a reaction$$,$$Your reaction is what turns food into a lever. Take it away calmly, offer it again in two days.$$),
  (44,4,'play',$$Ask, then wait five seconds$$,$$"Where's the dog?" and then silence. The pause is what turns a book into a conversation.$$),
  (44,5,'sleep',$$Keep weekend naps on the weekday rhythm$$,$$Daycare has him on a schedule. Matching it on Saturday costs nothing and saves your Monday.$$),
  (44,6,'care',$$Bags and coats go up high now$$,$$Medicine, vitamins and mints live in handbags, and he can reach a coat slung over a chair.$$),

  (45,0,'play',$$Sit a few metres apart and let him cross$$,$$First steps happen toward someone, not on their own. Motivation beats practice.$$),
  (45,1,'feed',$$Swap one milk feed at a time$$,$$If you're moving to a cup, change one, hold it a week, then the next. Bedtime goes last.$$),
  (45,2,'care',$$Shoes only for outside$$,$$Soft, flexible, measured rather than guessed. Indoors, bare feet still do it better.$$),
  (45,3,'sleep',$$Walking wakes them up at night$$,$$It's the same pattern as every other new skill, and it passes the same way. Don't rebuild anything.$$),
  (45,4,'you',$$Book the one-year check now$$,$$It's a longer appointment than the others. Bring your list, and ask the milk and bottle questions while you're in there.$$),
  (45,5,'play',$$Anything with a slot to post things into$$,$$In, out, in again. It will hold him longer than anything with a screen in it.$$),
  (45,6,'care',$$Tie up every cord he can reach$$,$$Curtain and blind cords especially. Tablecloths and cables come down with him attached.$$),

  (46,0,'feed',$$Hands do the work for months yet$$,$$Offer the spoon, don't insist on it. Cutlery is a slow skill and hunger isn't the time to teach it.$$),
  (46,1,'sleep',$$Awake stretches get longer now$$,$$Three to four hours between sleeps for most. If naps are a fight, that gap is usually the reason.$$),
  (46,2,'you',$$A day off isn't a day of chores$$,$$If you get one without him, half of it can go on the house. Not all of it.$$),
  (46,3,'care',$$Empty the newborn stuff out of the bag$$,$$You're still carrying size 1 diapers and a swaddle. Ten minutes and it halves in weight.$$),
  (46,4,'play',$$Give him the real version$$,$$A real brush, a real cup, a dead phone. Toy versions stopped fooling him a while ago.$$),
  (46,5,'feed',$$Grapes still get quartered$$,$$The rule doesn't expire at one. Round, firm and bite-sized stays the risky shape for years yet.$$),
  (46,6,'sleep',$$No rush to a toddler bed$$,$$The crib is safe and contained. There's no prize for moving early and a lot of 2am walking if you do.$$),

  (47,0,'play',$$He'll test the same rule ten times$$,$$Not to wind you up — to find out if it's real. The tenth answer has to match the first.$$),
  (47,1,'care',$$Buy the coat a size up, in the sales$$,$$His size sells out first every winter. Buy ahead and put it away.$$),
  (47,2,'you',$$Say the year out loud to someone$$,$$Whoever went through it with you. Naming what you actually did is part of finishing it.$$),
  (47,3,'feed',$$One new food a week, next to a safe one$$,$$Novelty beside something familiar works. A plate of unknowns doesn't.$$),
  (47,4,'sleep',$$Take the sack, the noise and the words travelling$$,$$Whatever else changes on a trip, those three shouldn't. They're what he's actually sleeping on.$$),
  (47,5,'play',$$Chunky crayons and taped-down paper$$,$$Ten supervised minutes in the high chair. First marks land somewhere around now.$$),
  (47,6,'care',$$Recheck the straps before winter$$,$$September's setting is too tight over a December jumper. Coats still go over the top, never underneath.$$),

  (48,0,'feed',$$Two spoonfuls in a bowl he can reach$$,$$Serving himself is messy and it's how portioning gets learned. Refill rather than filling.$$),
  (48,1,'sleep',$$Nothing after four in the afternoon$$,$$A late nap borrows straight from bedtime. Wake him and take the grumpy half hour.$$),
  (48,2,'you',$$Check the childcare terms before the year mark$$,$$Hours, costs and rooms all change around his birthday. Find out before the letter turns up.$$),
  (48,3,'play',$$Peekaboo becomes hide and seek$$,$$Behind the door, badly hidden, obviously findable. Same lesson, more running.$$),
  (48,4,'care',$$Wipes in the car door, not the boot$$,$$You need them where you're sitting, not where the shopping goes.$$),
  (48,5,'feed',$$Less milk and more food is the direction$$,$$It can look like a strike. It's usually just the handover happening on schedule.$$),
  (48,6,'sleep',$$Give the small noises a few minutes$$,$$By now most of them are him resettling on his own. Going in decides it for him.$$),

  (49,0,'play',$$Lean into the obsession$$,$$Wheels, doors, one particular spoon. Whatever he's fixated on this month is what he's learning through.$$),
  (49,1,'you',$$Order the cake$$,$$Unless baking is genuinely your fun part. Nobody at a first birthday is assessing the cake.$$),
  (49,2,'feed',$$Whole milk is a deliberate switch$$,$$Your pediatrician will tell you when and how much for him. Plan it rather than doing it overnight.$$),
  (49,3,'sleep',$$Spread the big changes out$$,$$Party, new bed, new milk, dropping the bottle. Across months, not across one week.$$),
  (49,4,'care',$$Photograph his hands and feet$$,$$Not just his face. They change the most and nobody thinks to take that picture.$$),
  (49,5,'play',$$Being near other kids is the practice$$,$$He won't play with them yet. Side by side is exactly what it should look like at one.$$),
  (49,6,'care',$$Small things go up before guests arrive$$,$$Other people's bags, coat pockets and gift ribbons all end up at his height.$$),

  (50,0,'you',$$Write the one thing you'd tell yourself$$,$$Whatever you know now that you didn't in week one. For next time, or for whoever asks you.$$),
  (50,1,'feed',$$Let him eat the cake with his hands$$,$$That's the photo. Put a sheet under the chair and let it be a mess.$$),
  (50,2,'sleep',$$Hold bedtime on the party day$$,$$Everything else can move. That one anchor is what rescues the evening.$$),
  (50,3,'play',$$The wrapping beats the present$$,$$Every time. Don't take it personally, and don't buy more than a couple of things.$$),
  (50,4,'care',$$Check the mattress height again$$,$$If he can stand and the rail is at his chest, it's time to drop it further.$$),
  (50,5,'you',$$Take the day off for the birthday$$,$$If you can. It's more your day than his, and you'll want to be in it rather than running it.$$),
  (50,6,'feed',$$Small piece, low expectations$$,$$Plenty of babies hate their first cake. It makes a better photo either way.$$),

  (51,0,'play',$$Give him a job$$,$$"Bring me the ball" lands before "no" does. Carrying something to someone is a genuine thrill at this age.$$),
  (51,1,'care',$$Sort the outgrown clothes into three piles$$,$$Keep, pass on, bin. Once a season stops the spare room becoming the project.$$),
  (51,2,'sleep',$$Two naps at one year is normal$$,$$The drop usually comes between twelve and eighteen months. Someone else's baby doing it isn't your signal.$$),
  (51,3,'feed',$$Eat the thing he's refusing, in front of him$$,$$Calmly, without comment. It does more than any amount of encouragement.$$),
  (51,4,'you',$$Book the check-up you've moved twice$$,$$Do it now, while you're organised enough to be reading this.$$),
  (51,5,'play',$$Give him a bag with a handle$$,$$Fill it, carry it, tip it out, repeat. Portable containers are this month's entire obsession.$$),
  (51,6,'care',$$The gates stay up past the birthday$$,$$He can climb sooner than you think. Stairs are the last thing to relax about.$$),

  (52,0,'you',$$You got through the first year$$,$$However it looked from the inside. Sit with that for a minute before you start planning the next one.$$),
  (52,1,'play',$$He'll do things to make you laugh$$,$$Deliberately, then repeatedly. That's a completely new kind of relationship starting.$$),
  (52,2,'feed',$$Move to family meals properly$$,$$One dinner, everyone at the table, his portion cut small. Less work than what you've been doing.$$),
  (52,3,'sleep',$$The wobbles start spacing out$$,$$Not perfect nights — just a longer gap between the disruptions. That's what changes after the first year.$$),
  (52,4,'care',$$First dental visit around now$$,$$The guidance is by the first birthday or when the first tooth arrives. It's short, and it's mostly for you.$$),
  (52,5,'play',$$Start a box for the year$$,$$The hospital bracelet, the first shoes, a card. One box, added to all year, and you'll be glad it exists.$$),
  (52,6,'you',$$Same chair, twelfth photo$$,$$The one you started in week four. Twelve of them side by side is the best thing you made this year.$$)
) AS v(wk, day, category, title, body)
WHERE t.locale = 'en' AND t.week_number = v.wk AND t.day_index = v.day;

-- ── assert the whole set landed ─────────────────────────────────────────────
-- All five UPDATEs share one transaction, so every rewritten row carries the
-- identical now(). A partial match means a (week, day) pair in the VALUES
-- lists didn't exist in the table — fail the migration rather than shipping a
-- half-rewritten screen where some tips are the friend and some are the book.
DO $verify$
DECLARE n INT;
BEGIN
  SELECT count(*) INTO n FROM mom_tips WHERE locale = 'en' AND updated_at = now();
  IF n <> 371 THEN
    RAISE EXCEPTION 'mom tips rewrite touched % rows, expected 371', n;
  END IF;
END
$verify$;
