# Mama's Corner — Reset & Recharge

**Status:** proposal · not built · 2026-08-12
**Surface:** `apps/mobile/src/screens/home/MomHubScreen.tsx`

---

## The premise

Mama's Corner is the mom's home base — the one place in villie that is about **her**,
not the baby.

Everything in it earns its place by **cutting mental load, never adding to it.** That is
the test each feature has to pass: after she uses it, is there *less* in her head than
before? A tool that asks her to log, rate, maintain a streak, or keep something up to date
is adding load and does not belong here — which is exactly why mom-tracking and
mood-correlation were killed. Reset & Recharge has to clear the same bar.

Practically, that means three rules for this section:

1. **Nothing to set up.** No profile, no preferences, no "first, tell us about yourself."
2. **Nothing to maintain.** No streaks, no history, no progress she can fall behind on.
3. **One tap to relief.** The thing she came for happens on the first tap, not the third.

---

## The foundation — what's already here

| Feature | State | What it does for her |
|---|---|---|
| **Plan my day** | ✅ live (`DayPlanScreen`) | Naps and pumps arranged around her actual day, so she isn't holding the schedule in her head. |
| **Day Sheet handoff** | ✅ live (mig 102 + `day-sheet-page`) | Hands a caregiver a real sheet — PDF or live QR page, revocable — instead of her reciting the routine at the door. |
| **Calendar** | 🟡 partial | Read-only busy blocks via `utils/calendar` (`getCalendarPermission` / `getTodayBusyBlocks`). Villie already avoids those windows when planning. The two-way "sync" is not built. |
| **Mom hacks** | ❌ not built | Currently a `soon` row wired to `comingSoon` in `MomHubScreen`. |

> **Two corrections to the brief, so the plan is built on what's real:**
> **Calendar sync** is *read-only busy blocks*, not sync — she can't create or move events from
> villie, and nothing writes back to her calendar. **Mom hacks** isn't a current feature at all;
> it's a placeholder row. Reset & Recharge would ship *before* a feature that's already
> advertised in the UI, which is worth deciding on deliberately rather than by accident.

---

## New section — Reset & Recharge

The rest of Mama's Corner is logistics: plan the day, hand off the baby, remember the trick.
Reset & Recharge is the first part that is purely **for her nervous system**. It's the
section she opens at 3am, one-handed, with a baby on her.

### 1 · Short audio meditations, sorted by how she feels

Not a library she has to browse — **three or four doors, each named for a state she's
actually in**: *calm the anxiety* · *quick reset* · *gratitude* · *can't sleep*.

She picks the door, it plays. 3–5 minutes.

> ⚠️ **Mood here is a doorway, not a metric.** She taps "anxious" to *get to the right
> track* — villie must never store it, trend it, or reflect it back ("you've felt anxious
> 4 days this week"). That is the mood-correlation feature that was already killed, and it
> would walk straight back in through this door if we let the selection get logged.
> Stateless choice, every time.

### 2 · One-minute breathing

A single visual — expanding circle, in for 4, hold, out for 6 — with no narration required
so it works muted at 3am next to a sleeping baby. One minute, because that's what she has.
No count of how many she's done.

### 3 · One-tap comfort sounds

Shushing · white noise · rain. **One tap, plays immediately, keeps playing.**

This is the piece with real engineering weight (see below) — it has to survive the screen
locking and the app going to the background, because the entire use case is "put the phone
down and get the baby to sleep." A sleep timer (15/30/60/off) so it doesn't run all night.

### 4 · The extras

- **"I need a minute"** — the always-there button. One tap → breathing starts immediately,
  no menu. See the safety note below on why it is *not* called an emergency button.
- **A single line of company** — a short, warm, non-actionable line ("this hour is hard and
  it will pass"). No advice, no task.
- **Pick up where she left off** — if she was 40 seconds into something when the baby woke,
  resume it. Convenience only; not history she can see or fall behind on.

---

## Three things to decide before this gets built

### 1. Do NOT call it an emergency button

villie already has two emergency surfaces: the **"in an emergency" Quick Reference hub**
(root modal — fever, breathing, childproofing) and the **crisis sheet** (988 · 911 · PSI ·
Crisis Text Line).

If a third thing says *emergency* and delivers a breathing exercise, a mother in genuine
crisis can tap it and get a calming circle instead of a hotline. That is a real harm, and
it is the kind of thing that only shows up when it matters most.

**Recommendation:** name it for what it does — *"I need a minute"* / *"Breathe with me"*.
Keep the word emergency exclusively on the surfaces that route to humans. And put one
quiet, non-alarming line at the bottom of Reset & Recharge that reaches the crisis sheet,
so a mom who opened the wrong door still finds the right one in a tap.

### 2. Audio needs a native build — it cannot ship over the air

The app currently has **no audio library at all** (no `expo-av`, no `expo-audio`, no
track-player) and **no `UIBackgroundModes`** in `app.json`. Comfort sounds that keep
playing with the screen off require both — which means `expo prebuild` + an EAS build, not
an OTA.

**Recommendation:** ride along with **Build 14** (already queued for the Pro IAP native
work) rather than triggering a build of its own. Everything non-audio — the breathing
visual, the section, the copy, the "I need a minute" entry — is pure JS and can ship OTA
ahead of it, so the shell can land early and the audio light up when Build 14 does.

Also: **bundle or cache the audio locally, don't stream.** The 3am use case is bad wifi and
one hand.

### 3. The audio itself is a content and licensing problem, not a code problem

Meditations and comfort sounds are copyrighted works. This is the same shape as the Manual's
expert videos — the build is the easy half.

- **Comfort sounds** are the cheap start: white noise, shushing and rain can be generated or
  sourced CC0 cleanly. Ship these first.
- **Meditations** need either a licensed library or a commissioned voice — and that voice
  becomes part of the brand the way the Manual's on-camera expert is. A casting decision,
  not a procurement one.
- **Clinical framing:** postpartum anxiety is a clinical condition. This is *wellness*, and
  the copy must never imply it treats PPA or PPD. Clinical advisor sign-off is already a
  launch gate; this belongs in that review.

---

## Suggested build order

| Phase | Contents | Ships via |
|---|---|---|
| **1** | Section shell in Mama's Corner + one-minute breathing + "I need a minute" + the crisis line | **OTA** — pure JS, no new deps |
| **2** | One-tap comfort sounds (3 sounds, sleep timer, background playback) | **Native (Build 14)** |
| **3** | Meditations by mood, once a voice exists | OTA, once audio infra from Phase 2 is in |

Phase 1 is genuinely useful on its own — a breathing exercise and one warm line is more
than she has now — and it lets the section prove itself before anyone commissions a voice.

---

## What I'd push back on

The brief listed **mom hacks** as foundation, but it's an unbuilt placeholder that's already
visible in the UI as "soon." Adding a whole new section above it widens the gap between what
Mama's Corner promises and what it does. Worth deciding explicitly: build mom hacks first,
or quietly drop the row until it's real.
