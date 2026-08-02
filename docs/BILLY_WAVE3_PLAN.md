# Billy Wave 3 — the read tranche

**Goal:** take Billy from 30 → 74 green by building the unbuilt `read` half of
`docs/BILLY_CAPABILITY_MAP.md`. Wave 1 taught Billy to *act*, Wave 2 taught him to *route*.
Wave 3 teaches him to **know what's already in her account** — today's logs, her saved
things, her inbox, her listings, her perks, her week.

**Shape:** 44 capability rows → **12 new tools**. **Zero migrations.** Every backing RPC
and table already exists on prod and was verified before this plan was written.

Why 12 and not 44: Billy runs on **Haiku**. He has 12 tools today; one-tool-per-capability
would take him to 64 schemas per request. Tool-selection accuracy degrades badly at that
count and every schema is re-sent on every turn. 12 consolidated tools (24 total) keeps
selection sharp and the request cheap. Consolidation is by **how a mom asks**, not by table.

---

## Three calls I need from you

**1. Mood check-in history — build it or leave it out?**
Two rows (`E-read-today-checkin`, `E-read-recent-checkins`) are in the read set. Reading
*today's* check-in ("did I do mine yet?") is benign. But "how has my mood been this week?"
is Billy summarizing her emotional history back to her — which is close to the
mood-correlation/streaks roadmap you killed ("check-in = support/vent + crisis net only,
resolve things, tools to back her up"). Same feature, different surface.

**Default if you say nothing: I build today's-check-in only and leave mood history out.**

**2. `get_detail` reads other people's rows — confirm the field allowlist.**
To answer "tell me about this donor," Billy reads `milk_donor_profiles`. That table is
where the C-1 PII leak lived (mig 095). RLS protects him, but I'm going to hard-code an
explicit per-kind field allowlist — exactly the fields the public card already shows,
never `select *` — so a future column can't silently ride into a chat reply. Flagging so
you know it's deliberate, not paranoia.

**3. `ai_assist` nests an AI call inside an AI turn.**
`ai-match`, `milk-donor-qa`, `ai-profile-qa`, `ai-followup-questions` are edge functions
that call a model. Billy calling them means model → edge fn → model → back, inside one
chat turn. Real latency cost on Haiku, and `ai-profile-qa` / `ai-followup-questions` are
medical-adjacent. The deterministic crisis/medical path still wins regardless. If the
latency isn't worth it, **this is the one tool to cut** — it's Tranche C, last, so cutting
it costs nothing already built.

---

## The 12 tools

| # | Tool | Covers | Backing (all verified live) |
|---|------|--------|------------------------------|
| 1 | `get_my_day` | today's feeds/naps/diapers · is a timer running | `baby_sleep_logs`, `baby_feed_logs`, `baby_diaper_logs` |
| 2 | `get_my_week` | current milestone · any week's milestones · weekly journey | `get_my_current_milestone()`, `get_milestones_for_week(p_week)`, `get_weekly_journey(p_week,p_locale)` |
| 3 | `read_manual` | this week · video library · pieces · week intro · her saved | `list_this_week_manual`, `list_manual_videos`, `list_manual_pieces`, `get_manual_week_intro`, `list_my_saved_manual` |
| 4 | `get_my_home` | home feed · notifications · Villie Picks | `get_home_feed()`, `user_notifications_feed`, `villie_picks` |
| 5 | `get_saved` | the unified Saved dashboard (specialists, donors, gear, events) | `get_saved_dashboard(p_locale)` |
| 6 | `get_my_inbox` | specialist · milk · gear threads | `messages`, `list_my_milk_threads(p_user_id)`, `list_my_gear_threads()` |
| 7 | `get_my_things` | her gear listings · vault listings · day sheets · box orders | `list_my_gear_listings()`, `milk_vault_listings`, `day_sheets`, `villie_box_orders` |
| 8 | `get_milk_vault` | freezer settings · bags · transaction history | `milk_vault_settings`, `milk_vault_bags`, `milk_vault_transactions` |
| 9 | `get_perks` | browse for her stage · one perk · her claims | `list_perks(...)`, `brand_deals`, `list_my_claims()` |
| 10 | `get_my_bookings` | appointments · event RSVPs | `appointments`, `list_my_rsvps(p_past)` |
| 11 | `get_detail` | one specialist (+reviews) · donor · donor listing · gear listing · event | `specialists`, `reviews`, `milk_donor_profiles`, `milk_listings`, `get_gear_listing(p_id)`, `events` |
| 12 | `ai_assist` | match specialists/donors · ask about one · appointment questions | `ai-match`, `milk-match-donors`, `ai-profile-qa`, `milk-donor-qa`, `ai-followup-questions` |

Each takes a small enum param (`scope`, `kind`) rather than splitting into more tools —
e.g. `read_manual{scope:'videos'}`, `get_detail{kind:'donor', id}`.

### Build order

| Tranche | Tools | Rows | Why first |
|---------|-------|------|-----------|
| **A** | 1–5 | 18 | What she asks daily. `get_my_day` is the single highest-value gap — Billy knows her *patterns* today but not her *right now*. |
| **B** | 6–10 | 14 | Her own marketplace + account state. Pure self-serve; no other-user data. |
| **C** | 11–12 | 12 | Detail lookups + nested AI. Highest risk, lowest frequency, cut-able. |

Each tranche is one deploy + one eval batch, so the scoreboard moves three times instead
of once.

---

## Deliberately NOT in Wave 3

- **The 6 Connect-room rows** (`list_rooms_for_discovery`, room messages, room match, anon
  identities, weekly summary). Connect tab is hidden by standing rule — no reachable
  surface, so no eval can be green. They stay `no` on purpose, not by oversight.
- **Mood history** — pending your call above.
- **All 57 `do` and 9 `route` rows.** Wave 3 is reads only. Reads can't corrupt her data,
  can't spend her money, and can't post anything public — which is why the whole tranche
  needs zero migrations and zero new safety review.

---

## Two corrections to the capability map

Found while verifying every RPC against prod. The map is currently wrong on both:

| Map says | Reality |
|----------|---------|
| `rpc:get_week_intro_video` | No such function. Real name is **`get_manual_week_intro(p_audience, p_week, p_locale)`**. |
| `rpc:get_perk (getPerk)` | Not an RPC at all — `perksApi.getPerk` is a **client select on `brand_deals`**. |

Also missing and genuinely absent: `get_room_by_slug`, `list_pinned_resources` (both
Connect-room, both skipped anyway). I'll fix these map rows as part of Tranche A.

---

## Things already handled (no action needed)

- **Pro video gating is safe.** The lock lives *inside* `list_manual_videos` and
  `get_manual_week_intro` — they null `mux_playback_id` and return `is_locked=true` for
  non-Pro callers. Billy uses the user-scoped (RLS) client like every other tool, so he
  inherits the gate automatically and cannot leak a paid video. His only job is *copy*:
  when `is_locked`, say it's in villie pro and offer the paywall pill — never pretend it's
  playable. Still inert until `pro_video_gate` flips ON.
- **Every read is RLS-scoped.** All 22 tables confirmed `rowsecurity=true` with policies.
  Billy physically cannot read another mom's rows.
- **Small refactor bundled in Tranche A:** add `userId` to `ToolContext`, resolved once in
  `index.ts`. Today each tool that needs it calls `supabase.auth.getUser()` separately —
  that's an extra round-trip per tool call, and Wave 3 roughly triples how often it
  happens.

---

*Verified 2026-08-02 against prod `albyndcruwopulazvpjs`: 24 of 28 named RPCs exist (2
misnamed in the map, 2 Connect-only), all 22 tables exist with RLS enabled. Scoreboard at
time of writing: 19 live / 11 in founder eval / 122 unbuilt.*
