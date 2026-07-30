# "Baby's week" retention pushes

Milestone-anticipating push notifications that bring mothers back each week,
plus a dormant winback. Shipped 2026-07-30.

**The hook**, per Felipe's brief: *"has your baby started solids yet?"*,
*"has your baby shown signs of walking yet? here are some tips!"* — an open
question opens a loop the app can close. A statement ("week 26 is here")
does not.

## Decisions (Felipe, 2026-07-30)

| | |
|---|---|
| Cadence | On **her baby's own rollover day**, 10am **local** — not a global blast |
| Copy | AI-generated once per week, cached in `week_nudges`, editable |
| Scope | Weekly nudge + dormant winback + drain the stale check-in queue |
| Opt-out | Its own `notif_prefs.baby_week` toggle, **ON** by default |

## ⚠️ The anxiety constraint — read before editing any copy

These go to postpartum women, many with PPA/PPD. A milestone notification
becomes harmful the moment it implies a deadline. Three layers enforce this:

1. **The generator prompt** bans "should", "by now", "on track", "most
   babies", comparisons, statistics, and fear/guilt hooks; it requires
   invitation framing ("some babies start around now") so the *"not yet"*
   answer feels as normal as the *"yes"*.
2. **A regex in the edge function** rejects a generation that slips through
   and retries once with an explicit correction.
3. **`week_nudges_copy_safe`** — a DB CHECK constraint, so a prompt
   regression or a hand edit fails loudly instead of shipping.

**The baby's gender is unknown** — one row serves every family, so gendered
language ("is she rolling yet?", "algunas bebés") is a correctness bug, not a
style nit. A second regex blocks it in EN and ES.

## Pieces

| Piece | Where |
|---|---|
| Content + ledger + RPCs | `supabase/migrations/111_week_nudge_push.sql` |
| Copy generator | `supabase/functions/ai-week-nudge-generate` |
| Sender | `supabase/functions/week-nudge-notify` |
| Deep-link router | `apps/mobile/src/lib/deeplink.ts` |
| Opt-out toggle | `NotificationPreferencesScreen` (first row) |
| Schedule | `.github/workflows/supabase-crons.yml` — `0 * * * *` |

### Why the cron is hourly

The nudge fires at 10am in **her** timezone (read from her quiet-hours tz,
defaulting to `America/New_York`). The job therefore wakes every hour and lets
`list_week_nudge_recipients` pick whoever is currently at 10am local *and*
crossing into a new baby-week today (an exact multiple of 7 days since
corrected birth date).

Safe to run 24×/day because `push_sends` has
`UNIQUE(user_id, kind, dedupe_key)` and the sender **claims the ledger row
before calling push-notify**. A crash mid-send can at worst drop a nudge,
never duplicate one — for this audience a missed nudge is a non-event and a
duplicate is an unsubscribe.

### Content state

52 weeks × EN/ES = **104 rows generated and live**. Regenerate or extend:

```bash
# fill anything missing (idempotent)
curl -X POST "$URL/functions/v1/ai-week-nudge-generate" -H "Authorization: Bearer $SRK" \
     -d '{"mode":"missing","limit":20}'
# preview without writing
curl ... -d '{"mode":"all","weeks":[26],"locales":["en"],"dry_run":true}'
```
Rows are plain DB rows — edit `title`/`body` in Studio to override the AI, or
set `is_active=false` to mute a week.

## Two pre-existing bugs this work fixed

1. **Every push in the app was failing with a 500.** `push-notify` hardcoded
   `android_channel_id: 'village-general'`, which is not a real OneSignal
   channel UUID; OneSignal rejected the whole request — iOS recipients
   included. So appointment reminders, gear moderation pages, and the
   trending digest were all silently dead. It's now opt-in via
   `ONESIGNAL_ANDROID_CHANNEL_ID` (leave unset while iOS-only).
2. **Notification taps went nowhere.** There was no `expo.scheme` and the
   OneSignal click handler was a `console.log`, so every `village://` link
   four edge functions emitted was dead on both ends. Now: scheme `villie`
   registered, taps routed through `navigationRef`, and the in-app
   Notifications list uses the same parser so a row and its push land on the
   same screen.

Also drained: **362** `daily_checkin` feed rows that had been accumulating
unsent since 2026-04-27 (the G7 cron wrote them; nothing ever sent them). The
drain pushes only rows from the last 36h and silently retires the backlog —
back-blasting three months of reminders would be the worst possible first
impression.

## Verified 2026-07-30

Live run of all three modes: 2 winbacks sent, 2 check-in reminders delivered,
360 backlog rows retired, 0 failures. `tsc` clean. The weekly path returned 0
eligible because no test baby was on a rollover day — the projection itself
was verified separately against real profiles (week 41, baby first name
resolved, tz correct).

## Open

- [ ] **Nobody receives these yet in practice** — the test accounts have no
      registered devices, so OneSignal accepts and delivers to 0. Confirm on a
      real device with a TestFlight build before judging open rates.
- [ ] Felipe: skim the 104 generated rows in Studio (`week_nudges`) and edit
      any that miss the voice. A few ES rows still read slightly translated.
- [ ] Weeks 53–104 have no copy (and no `milestone_library` rows) — the RPC
      caps at week 52, so second-year babies get nothing. Decide whether year
      two matters before launch.
- [ ] Deep-link routes are mapped from the route names that exist today; if a
      navigator is renamed, update `apps/mobile/src/lib/deeplink.ts`.
