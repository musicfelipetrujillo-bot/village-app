# villie pro — video launch runbook

Everything that has to be true before `pro_video_gate` turns on, and the exact
steps to get there once the videos exist.

**Status:** infrastructure ready, content pending. `pro_video_gate` is OFF and
the database will refuse to turn it on until the checks below pass.

---

## Why this document exists

On 2026-07-30 a full read of the paywall copy found it advertising:

- *"every week's specialist video — all 52 weeks"* → `manual_week_intro` had **0 rows**
- *"captions in english + español"* → **0 of 22** videos had captions in either language
- *"new videos every week"* → 22 videos total, no weekly pipeline

None of it had shipped (the gate was off), but nothing would have stopped it.
The copy has since been made inventory-safe, and the checks below now make the
failure structurally impossible rather than a thing someone has to remember.

---

## The readiness check

One source of truth. Run it any time:

```sql
SELECT * FROM pro_launch_readiness();
```

| Check | Passes when | Why it blocks a paid launch |
|---|---|---|
| `week_intro_coverage` | every audience+locale has 52 published weeks with a playback id | the paywall's headline benefit is per-week video; the weakest combination decides, so a full EN set can't hide an empty ES one |
| `videos_per_bucket` | every (audience, category) has ≥2 approved videos | a paying user must never open an empty category |
| `captions_both_locales` | 100% of playable videos captioned EN **and** ES | we advertise captions; a paid accessibility claim has to be true |
| `clinical_review` | 100% of playable videos have `clinical_advisor_reviewed` | charging for un-reviewed health video is a materially different liability posture than giving it away |

Targets are tunable without a migration — e.g. to soft-launch at 12 weeks:

```sql
UPDATE pro_launch_targets SET target = 12 WHERE key = 'week_intro_weeks';
```

Set `is_blocking = FALSE` on a row to downgrade it to advisory.

### The guard

A `BEFORE UPDATE` trigger on `feature_flags` refuses to set `pro_video_gate`
to true while any blocking check fails, naming what's missing. Turning it
**off** is never blocked — a kill-switch must always work.

Deliberate override (soft launch, knowing the copy is honest about it):

```sql
BEGIN;
SET LOCAL app.pro_launch_override = 'on';
UPDATE feature_flags SET enabled = TRUE WHERE key = 'pro_video_gate';
COMMIT;
```

Migration `115` self-tests the guard on every `db reset`, so a later refactor
that drops the trigger breaks the migration chain instead of silently
re-opening the door.

---

## Loading the videos

### 1. Week-intro videos

Export a sheet with these columns and run:

```bash
node apps/mobile/scripts/import-week-intros.mjs weeks.csv --dry-run
```

```
week_number,audience,locale,title,expert_name,expert_role,mux_playback_id,duration_seconds,poster_url,is_published
1,baby,en,"Week 1: the first days home",Dr. Ana Ruiz,Pediatrician,abc123,95,,true
```

- `audience` = `mom` | `baby`; `locale` = `en` | `es`; `is_published` defaults true
- Full set = 52 weeks × 2 audiences × 2 locales = **208 rows**
- Validates everything before writing: week range, enums, missing playback ids,
  duplicate (audience, week, locale) within the sheet. Any problem → nothing is written.
- Idempotent (upserts on the unique key), so re-running a corrected sheet fixes
  rows rather than duplicating them.

Drop `--dry-run` and set `SUPABASE_SERVICE_ROLE_KEY` to write. It prints the
readiness report afterwards.

### 2. Captions

Captions live on the **Mux asset** — upload the track there, then record it:

```sql
SELECT mark_week_intro_captioned('<video-uuid>', 'es', 'https://…/es.vtt');
```

The function refuses a caption flag without a URL, because a flag set by hand
in Studio with no track behind it is exactly the bug that started this.

The player is already wired: `muxPlayerUrl` passes `default-subtitle-lang` so
the mother's app language is the default track. **No client release needed** —
captions light up the moment the tracks are attached.

### 3. Clinical review

```sql
UPDATE manual_videos
   SET clinical_advisor_reviewed = TRUE, reviewed_at = now(), reviewed_by = '<advisor-uuid>'
 WHERE id = '<video-uuid>';
```

---

## Restoring the strong copy

The paywall bullets were softened to match reality. Once readiness passes, the
stronger claims become true and should go back in — they convert better and
they are what the product actually is.

`apps/mobile/src/i18n/{en,es}.json` → `paywall`:

| Key | Now (inventory-safe) | Restore to, once the matching check passes |
|---|---|---|
| `b1` | specialist-led videos for you and your baby | every week's specialist video — all 52 weeks *(needs `week_intro_coverage`)* |
| `b3` | every video under two minutes | captions in english + español *(needs `captions_both_locales`)* |
| `b4` | the library keeps growing | only promise a cadence you can actually hold — a recurring-delivery claim is a commitment, not a tagline |

Spanish mirrors the same keys. **Do not restore a bullet whose check is still
failing** — that is precisely the state this runbook exists to prevent.

---

## Open decision — written manual: free or gated?

Two surfaces still disagree about the free tier, and one of them has to change:

- **The spec** (`docs/superpowers/specs/2026-07-29-villie-pro-video-paywall-design.md`)
  says the 52-week written content stays free forever.
- **`ManualWeekIndexScreen`** locks every *future* week's written content behind
  Pro (`locked = !pro && week > currentWeek`).

`paywall.freeNote` currently describes the **code's** behaviour ("this week and
every week you've reached"), so nothing contradicts on screen today. But the
spec and the app still describe different products. Pick one before launch.

---

## Launch sequence

1. Load week-intro rows (§1) → `week_intro_coverage` passes
2. Fill thin categories → `videos_per_bucket` passes
3. Attach + record captions (§2) → `captions_both_locales` passes
4. Clinical sign-off (§3) → `clinical_review` passes
5. `SELECT * FROM pro_launch_readiness();` — all PASS
6. Restore the strong paywall copy, ship the OTA bundle
7. App Store Connect: create `villie_pro_monthly` / `villie_pro_annual`, 7-day
   intro offer, submit Build 14 (see `docs/BUILD_14_RUNBOOK.md`)
8. After Build 14 is live and approved: `UPDATE feature_flags SET enabled = TRUE
   WHERE key = 'pro_video_gate';` — the guard will now allow it
9. Verify a free account sees locked teasers and a Pro account plays video
