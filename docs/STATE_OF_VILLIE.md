# State of Villie — Canonical Operating Doc

**The single source of truth for the founder AND every parallel Claude Code session.**
Read this first. Update it last. When sessions collide (duplicate migration numbers, duplicate
feature builds, stepping on shared files), the fix is: everyone coordinates *here*.

- **Last updated:** 2026-08-15 (security & privacy review CLOSED OUT · 5 PRs merged · migrations 127+129+130+131 applied · see §0 RELEASE LOG)
- **`main` head:** `7c8d285` — all security/privacy work is merged AND applied to prod.
- **Authoritative for:** in-flight work, migration numbers, deploy queue, launch sequence.
- **NOT authoritative for:** per-phase build history (`CLAUDE.md`), env/key setup (`docs/OPS_RUNBOOK.md`), product intent (`docs/source/*`). This doc points at those; it doesn't replace them.

> 🟢 **§0 · RELEASE LOG — 2026-08-15 (newest; read this first).**
> **The 2026-08-14/15 security & privacy review is CLOSED OUT.** Every engineering item is shipped, applied to prod, and verified against the DEPLOYED artifact rather than the source tree. Five PRs merged: **#6** (auth hardening), **#7** (donor location, migration 127), **#8** (counsel retention ask), **#9** (migration 129), **#10** (migrations 130+131). Supabase security advisor **63 → 61**; every remaining lint is on CLAUDE.md's documented accepted list.
> **The finding that mattered:** `specialist-invite-create` was deployed `verify_jwt:false` **and** its only auth gate base64-decoded the caller's JWT and trusted `payload.role === 'service_role'` **without verifying the signature**. Anyone could send `Bearer x.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x` and be treated as an admin — mint an invite token, then redeem it via `specialist-invite-accept` to insert themselves into the provider directory as `admin_approved:true, accepting_patients:true`. Fixed (constant-time compare vs the real key + `verify_jwt` on), **re-fired the exploit at prod to confirm: 401**. Exposure audit clean — all 7 invites are the founder's own address or smoke tests, all 11 specialists accounted for.
> ⚠️ **Root cause worth internalising:** the three-service-role-key drift (`docs/OPS_RUNBOOK.md` §9) is *why* that hole existed — someone hit "strict equality breaks the crons after a rotation" and deleted the auth check instead of reconciling the keys. **Rotating the key fixes both problems at once** and is the last open engineering item (founder/dashboard).
> 🚨 **Two traps this session, both now written down.** (1) **Verify edge-function findings against the DEPLOYED artifact** (`mcp__supabase__get_edge_function`), never the source tree — the Calendly fail-open fix sat on `main` unshipped for five weeks while prod ran the vulnerable version. *(Now deployed — v23, hardened, confirmed 2026-08-15.)* (2) **`REVOKE … FROM anon` is a silent no-op when the grant is to PUBLIC** (ACL shows a leading `=X/` — empty grantee means PUBLIC). Migration 052 revoked FROM PUBLIC and was a no-op; migration 130 revoked FROM anon and was a no-op. **Always revoke from BOTH, then verify against `pg_proc.proacl`** — the migration succeeding proves nothing.
> **Privacy:** donor pinpoint coordinates were readable by any signed-in user, and had gone from 0 rows in July to **4 real donors** — coarsened to ~1.1 km via migration 127. Retention is now a written proposal for counsel (Appendix D of the counsel package) rather than an open question; the founder decided the two-party-messaging rule (keep the thread, mark the account deleted). Migration **129 is the first retention job this database has ever had** — nothing was ever deleted before it.
> ⬜ **Left open, neither of them code:** rotate the service-role key (founder, dashboard, ~15 min, procedure in OPS_RUNBOOK §9) and counsel's retention answer. Plus a spawned task: **8 pg_cron jobs fail on every run** (jobid 1 alone: 288 failures/3 days) because they call `net.http_post` with a GUC the Free tier locks. All 8 are already covered by `.github/workflows/supabase-crons.yml`, so nothing is broken — but the failure log is pure noise, so a *real* failure would go unnoticed. `room-weekly-summaries-sunday` is the same shape with **no** GH replacement (Connect tab is dark, so not urgent).
>
> 🟢 **§0 · RELEASE LOG — 2026-08-12 (newest; read this first).**
> **`feat/billy-capability-coverage` is MERGED into `main` and pushed** (merge `e9d1515`, parents `91e07d3` + `1903489`). It had grown to **62 commits ahead / 5 behind**, and **44 of those had never been pushed anywhere** — the raspberry rebrand, the roo icon + iOS modular-headers fix, the week-anchor Home, the Manual vertical-card story, global search, the Insights/Log rework, and all of Billy waves 1+2 existed on one unpushed local branch. **Migrations 113/114/115 lived only there, and 113 was already APPLIED TO PROD** — so prod schema was not reproducible from `main` until this merge. It is now. Migrations on disk: **115**, no duplicate numbers, **next free = 117** (116 is on `chore/mig-116-reviewer-roles`).
> Two add/add conflicts, both resolved deliberately: **migration `112`** — both sides wrote the same file with identical SQL; kept the branch copy for its fuller provenance note. **`events-harvest/index.ts`** — kept `main`'s 429-line version (it carries `b51a667` + `91e07d3`, the probe/render fixes that took Villie Plans from 0→6 live events on 2026-08-12) and verified it already contained the branch's `auto_publish_threshold: 1.0` fix verbatim, so nothing was lost. Merged tree typechecks clean.
> **Billy scoreboard: 30 yes / 0 code / 122 no.** Waves 1+2 verified on device 2026-08-02; `app-help-chat` **v36** is live. That eval run fixed five prod bugs — hidden-tab deep-links rendering blank (native-driver fade racing a cold lazy mount), a `JSON.parse` failure that was impersonating a "call 911" crisis reply, a deep-link step racing the tab crossfade, pills promising screens they don't open, and Billy asking a mom for a uuid (tool results don't survive between turns — he must re-run the search). **Standing rule: an eval is green only when the pill was TAPPED and the destination rendered** — 9 of those 11 produced a perfect reply + pill and still failed. Next Billy work = **Wave 3 read tranche**, `docs/BILLY_WAVE3_PLAN.md` (44 caps → 12 tools, 0 migrations, 3 founder calls open).
> ⚠️ **Still-open drift of the same kind:** `supabase/functions/events-harvest/index.ts` and `gear-moderation-daily-digest/index.ts` have **uncommitted edits in the shared checkout while the deployed `events-harvest` is v4 (deployed 2026-08-12)** — prod is again running code that is not committed. Left alone because another session is mid-edit; whoever owns it should commit. Deploying from a dirty tree is how the daycare two-keyword fix went live-but-uncommitted for 11 days (`93c499a`).
>
> 🟢 **§0 · RELEASE LOG — 2026-07-30 (superseded by the entry above, still accurate for its own contents).**
> **Three OTAs shipped to the `production` channel today**, all runtime `1.0.0` (reaches every current store build), all from `main`:
> | Update group | Contents |
> |---|---|
> | `d968fa36-27e1-400c-953e-36284d575c72` | Milk Vault · Billy Wave 1 client · The Buzz surface · milk C-1 PII fix |
> | `93fa0db6-acbb-4993-9652-8f2b25bb719e` | mamas-corner MomHub · week nudges + dormant winback · Billy context brain + CTA pills · Pro scaffolding (dark) |
> | `72df799c-a5f1-49af-a021-2bdad1fe9c05` | editorial mastheads on destination screens |
>
> **Live feature state:** The Buzz is **PUBLISHED** — issue `c3cc6efb…` "this week in the parent group chat", 4 medical items approved by the clinical reviewer. Migration **112** archived the leaked `SMOKE TEST — delete me` issue (it was reaching users via `list_trending_archive()` → BuzzArchiveScreen); archive now returns 1 row. **Villie Boxes is intentionally DARK** (`EXPO_PUBLIC_VILLIE_BOXES_ENABLED=0`) — Stripe publishable key + `STRIPE_WEBHOOK_SECRET` unset and `boxes-create-payment-intent` undeployed; see `docs/BOXES_GOLIVE_CHECKLIST.md`. **villie Pro is triple-dark** (dynamic native import + env flag unset + DB `pro_video_gate` OFF) — real purchases need native **Build 14**.
> **Reviewer flags** live on `fele_trujillo@hotmail.com` (primary Apple login), not `felitrujillo95@…` — migrations 106–108.
> **OTA env:** publish from a gitignored `apps/mobile/.env.production` (the dev `.env` sets `APP_ENV=development` + `INTERNAL_AGENTS_ENABLED=1` and would poison a prod bundle). Rollback is `eas update:rollback` — no store review.
>
> 🔶 **CONCURRENCY WARNING (learned the hard way, 2026-07-30).** Two Claude sessions wrote to this repo simultaneously today and collided twice: (1) a session claimed and applied migrations **106–110** hours after this doc declared "next free = 106"; (2) a session moved the shared checkout to `feat/billy-capability-coverage` mid-task, so another session's commit landed on the wrong branch and had to be cherry-picked back. **Protocol:** before claiming a migration number, run `list_migrations` against hosted — never trust this doc alone. Before committing, run `git branch --show-current` — never assume you are on `main`. If another session is active, **work in a git worktree** (`git worktree add .worktrees/<name> main`) instead of switching branches out from under it.
>
> 🔴 **2026-07-29 CORRECTION — much of §2–§4 below (dated 2026-07-10) is STALE.** Verified against live hosted Supabase (`albyndcruwopulazvpjs`) via read-only MCP: **ALL migrations `001`→`105` are applied on prod** (not "highest applied 100 / 098+099 unapplied" as the old text says) and **every edge function is ACTIVE** — Billy Wave 1 (`app-help-chat` v25), The Buzz trio, `milk-vault-scan` v2, etc. **The backend deploy queue is EMPTY. Next free migration = 113** (see §0 + §3). The git drift is also resolved: `feat/billy-capability-coverage` + `feat/villie-boxes-home-polish` are reconciled and `main` now contains both (head `7ccd612`, typecheck-clean). **The only remaining "ship it" step is the OTA JS bundle** (`eas update --channel production` from `main`/`integration/ota-2026-07-29`). Trust this banner + memory `project_deploy_state_2026_07` over the older per-line claims below until those lines are individually rewritten.

> ⚠️ **Before you create a migration, claim its number in §3.** Before you start building a feature, check §2 that no other session already owns it. At the end of your session, update §2, §3, §4.

---

## 1. Snapshot

Villie is a **pre-launch** maternal-health platform (React Native + Expo + Supabase), built across four verticals plus Home: **V1 Specialists** (live/production-grade), **V2 Milk Connect** (code-complete, cash-only/connector-only), **V3 Community** (~57%, tab intentionally hidden — do not re-enable), **V4 Gear + Home** (code-complete, legal-gated), plus **V5 Grow-With-You / Playbook / Manual** and new commerce (**Villie Boxes**) and **V6 Milk Vault** (now merged). Primary GTM is **hospital-discharge distribution** (postpartum 0–6 weeks is the core journey; copy is clinician-handoff-grade, EN+ES). A **$1.5M seed raise is in progress** — deck is built and ~80% ready; the reviewed gaps are team slide, cash-only revenue reframe, and a real demand signal (see §5). Security/privacy hardening (C-1 milk PII leak + bloodwork-URL + data-minimization) is **DONE and applied to prod**.

**What moved since last refresh:** the two open PRs both landed — **PR #1 (retire Milk Stripe, migration 098)** and **PR #3 (V6 Milk Vault, migration 099)** are **merged to `origin/main`**, plus **PR #4 (Milk Hub unification plan doc)** and now **PR #5 (waitlist migration 100)** — committed on its own branch, merged, AND **applied to prod** (already has 1 real signup row). **There are now zero open PRs.** 098 + 099 are still merged-but-**unapplied** — top of the apply queue. What stands between here and launch is still almost entirely **attorney sign-off, Felipe-only deploys, and founder-input items** — not more code.

---

## 2. In-flight right now

### 2a. Open PRs

**Open PR count: 1 (stale — see below).** The five security/privacy PRs all merged 2026-08-15:

| PR | Branch | Outcome |
|---|---|---|
| **#6** | `sec/edge-auth-hardening` | ✅ **MERGED** — real auth on the admin edge functions (the Critical). |
| **#7** | `privacy/coarsen-donor-location` | ✅ **MERGED** — migration **127**, donor coords → ~1.1 km. |
| **#8** | `legal/app-wide-retention-ask` | ✅ **MERGED** — Appendix D, app-wide retention proposal for counsel. |
| **#9** | `chore/home-feed-cache-purge` | ✅ **MERGED** — migration **129**, first retention/purge job. |
| **#10** | `sec/advisor-closeout` | ⚠️ **Shows OPEN, but its commits (`88250e6`, `e0a4f5b`) are already on `main` and byte-identical.** Migrations 130+131 are on main and applied. **This PR is stale — close it, don't re-merge or rebase it.** |

*(Historical, for reference:)*

| PR | Branch | Outcome | Follow-through owed |
|---|---|---|---|
| **#1** | `chore/retire-milk-stripe-connect-098` | ✅ **MERGED** (2026-07-09) — retires Milk Stripe Connect, migration **098**. | Apply 098 (`db push`); Felipe **deletes** 5 dead milk-Stripe edge fns (§4). |
| **#3** | `feat/milk-vault-v6` | ✅ **MERGED** (2026-07-10) — V6 Milk Vault, migration **099**, `milk-vault-scan` edge fn. | Apply 099 (`db push`); Felipe **deploys** `milk-vault-scan`; then Milk Vault OTA (§4). |
| **#4** | `docs/milk-hub-unification` | ✅ **MERGED** (2026-07-10) — `docs/MILK_HUB_UNIFICATION.md` (Vault + Connect → one ecosystem). **Planning doc only, no code/migration.** | Read before the next Milk-tab structural change. |
| **#5** | `feat/waitlist-migration` | ✅ **MERGED** (2026-07-10) — migration **100**, `public.waitlist` table. **Applied to prod same day** — table live, RLS on, 1 row already. | None — fully shipped. |
| #2 | `feat/milk-vault-phase1` | ❌ CLOSED — superseded duplicate of Milk Vault. Ignore. | — |

> **No PR is currently open.** New work starts from a fresh branch off (fetched) `origin/main`.

### 2b. Active workstreams / sessions (coordinate before touching)

**Re-surveyed 2026-08-15 from `git worktree list` + per-branch ahead/behind.** Only **one** branch is genuinely active; the other four are spent worktrees whose work is already on `main`. Left mounted, they read like live sessions and invite exactly the collisions this doc exists to prevent.

#### 🔴 LIVE — do not touch

| Branch | State | Owns (don't collide) |
|---|---|---|
| **`feat/billy-capability-coverage`** | **This is the shared checkout at the repo root.** Last commit **~20 min ago**, **12 uncommitted files**, ahead 3 / **behind 104** of `main`, pushed. | `supabase/functions/app-help-chat/**`, `supabase/functions/_shared/service-role.ts`, `supabase/functions/specialist-invite-create/index.ts`, `docs/THE_BUZZ_TRENDING.md`, `docs/audits/buzz-discovery-*` |
| **`feat/pro-locale-gate`** | Sibling worktree at `../village-app-pro-gate` — **not** under `.worktrees/`, so it is easy to miss. **1 ahead** / 2 behind, clean, last commit ~10h ago. Genuinely pending. | villie Pro launch-gate locale handling |

**Do not `git switch` the root checkout — use a worktree.** Two live warnings on it:

1. ⚠️ **Behind 104 with uncommitted work.** That is the same shape as the 62-commit drift incident in §0, where 44 commits existed only locally and prod schema wasn't reproducible from `main`. Merge `main` in soon.
2. ⚠️ **It holds an uncommitted rewrite of `specialist-invite-create` + a new `_shared/service-role.ts`.** This is a **genuine improvement** on the 2026-08-15 Critical fix — a shared two-mode gate that solves the multi-key problem the strict-equality fix can't (`gatewayVerifiesJwt:false` → exact key only; `true` → exact key **or** a gateway-verified `service_role` claim, which tolerates key rotation). ✅ **Committed 2026-08-15 as `4e61ac9`** — no longer one working-tree deploy from being lost.
   🚨 **Unfinished dependency:** the helper's comment says *"the flag is not a guess: `supabase/config.toml` pins `verify_jwt` for every function."* **That is not true yet** — `config.toml` exists but contains only local-dev ports/auth, with **no `[functions.*]` sections and no `verify_jwt` anywhere.** `gatewayVerifiesJwt:true` is *currently* correct only because `specialist-invite-create` was deployed with `verify_jwt` on (verified live). Nothing durable enforces that. **Land the `config.toml` pins in the same change**, or a future `--no-verify-jwt` deploy silently turns the flag into a lie and restores the Critical. Only 1 of the 6 functions has been migrated so far (the other 5 are `verify_jwt:true`, so not exploitable meanwhile). **As of `4e61ac9` the `config.toml` pins are still absent** — that commit carried only the helper plus the one call site.

#### ✅ SPENT — DELETED 2026-08-15

All four were local-only (never pushed), 0 commits ahead of `main`, with each tip verified as an ancestor of `origin/main` — nothing was lost. **Worktrees unmounted and branches deleted.** Recorded so the next session knows they're gone deliberately, not missing.

| Branch | Was | Outcome |
|---|---|---|
| `fix/auth-guard-sweep` | 0 ahead / 25 behind | Deleted — sweep already on main. |
| `feat/log-editing` | 0 ahead / 96 behind | Deleted. Migration 125 applied. Its 2 stray files were `pod install` output (Podfile.lock + pbxproj) — regenerable, discarded. |
| `release/mamas-corner-ota` | 0 ahead / 26 behind | Deleted — OTA shipped. |
| `feat/plans-per-event-attributes` | 0 ahead / **156 behind** | Deleted — **this was the one that mattered.** A never-merge trap: merging it would have reverted ~1,900 lines while its real work was already on `main` by another route. Deleting turns "remember not to do this" into "cannot happen." |

> ⚠️ **`git branch -d` compares against the CURRENT checkout, not `main`.** It refused three of these as "not fully merged" purely because the root checkout sits on `feat/billy-capability-coverage`, 104 behind `main`. The correct check is `git merge-base --is-ancestor <branch> origin/main`. Confirm that way before reaching for `-D` — a safety net that cries wolf is one people learn to bypass.

> **Convention that held up this session:** every change went through its own worktree off a freshly-fetched `origin/main`, and the shared checkout was never switched. That is why five PRs landed alongside an active Billy session without a single conflict.

---

## 3. Migration registry (collision-prevention)

**This is the section that stops sessions from stepping on each other. Claim your number HERE before you create the file.**

- **Highest APPLIED on prod:** **131** (re-verified 2026-08-15 via `list_migrations`). ⚠️ **126 and 128 were claimed by a concurrent session mid-work this session** — the re-check-before-writing rule caught it twice. Re-run `list_migrations` immediately before you create the file, not at planning time. **ALL of `001`→`131` are applied** — including 098/099 (retire milk Stripe, Milk Vault), 101–105 (Care/day sheets/daycares/RLS backfill/The Buzz), 106–108 (reviewer flags), 109–116, 117 (`zip_centroids`), 120–124 (Mom Tips), 125–126, 128 (Mom Tips ES), and this session's **127** (donor location), **129** (first purge job), **130+131** (advisor closeout). The apply queue is **empty**.
- **Highest ON DISK (`main`):** **131.**
- **Highest CLAIMED:** **131. → NEXT FREE = 132.**
- ⚠️ **MCP is read-only** — `apply_migration` fails. Apply with the authenticated CLI: `supabase db push` from the repo root.
- ⚠️ **106–110 were claimed + applied by a parallel session on 2026-07-29/30** while another session was mid-OTA. Re-run `list_migrations` before claiming a number — this doc can lag by hours when sessions run concurrently.

| # | Name | What | Status |
|---|---|---|---|
| 092 | `092_villie_boxes_orders.sql` | Villie Boxes commerce orders | On `feat/villie-boxes-home-polish` only (committed-not-applied, not on main). |
| 093 | `093_v5_baby_tracker.sql` | Playbook tracker | ✅ **APPLIED to prod** (2026-07-10). |
| 094 | `094_v5_manual_week_intro.sql` | Manual week intro | On main. Apply status: unconfirmed — verify before relying on it. |
| 095 | `095_security_milk_donor_pii_column_revoke.sql` | C-1 donor PII column grant | ✅ **APPLIED to prod** (2026-07-08, manually via SQL editor; db push re-runs idempotently). On main. |
| 096 | `096_privacy_drop_milk_donor_pii.sql` | Drop donor address/phone + RPC | ✅ **APPLIED to prod** (2026-07-09). On main. |
| 097 | `097_security_milk_bloodwork_url_scope.sql` | Scope bloodwork URL (health data) | ✅ **APPLIED to prod** (2026-07-09). On main. |
| **098** | `098_retire_milk_stripe_connect.sql` | Retire Milk Stripe Connect | ✅ **MERGED to origin/main** (PR #1). ⚠️ **NOT yet applied** — top of §4 queue. |
| **099** | `099_v6_milk_vault.sql` | V6 Milk Vault tables | ✅ **MERGED to origin/main** (PR #3). ⚠️ **NOT yet applied** — §4 queue. |
| **127** | `127_privacy_coarsen_donor_location.sql` | Donor lat/lng → ~1.1 km (public read) | ✅ **MERGED (PR #7) + APPLIED to prod** (2026-08-15). |
| **129** | `129_retention_purge_home_feed_cache.sql` | First retention job — ages out expired home-feed cache (7-day grace) | ✅ **MERGED (PR #9) + APPLIED to prod** (2026-08-15). pg_cron `home-feed-cache-purge`, 20 8 * * *. |
| **130** | `130_security_trending_rpc_hardening.sql` | Pin `search_path` on the last 2 flagged fns | ✅ **APPLIED to prod** (2026-08-15). ⚠️ Its anon REVOKE was a **no-op** — see 131. |
| **131** | `131_security_trending_revoke_public.sql` | Fixes 130 — revokes the **PUBLIC** grant anon inherited | ✅ **APPLIED to prod** (2026-08-15). |
| **100** | `100_waitlist.sql` | Marketing-site waitlist (anon INSERT only, no anon SELECT) | ✅ **MERGED (PR #5) + APPLIED to prod** (2026-07-10). Fully shipped. |

### ➡️ NEXT FREE MIGRATION NUMBER: **132**

**Rule (enforced):**
1. Before creating any migration, add a row to the table above with your number, name, and "CLAIMED — <branch>".
2. Use the **next free number** (currently **132**). Never reuse 001–131 — all are on disk in `main` and applied to prod. **Verify with `list_migrations` first** — a concurrent session may have claimed numbers since this doc was written.
3. Filenames are **numeric-prefix only** (`101_...sql`) — the CLI silently skips `101b`.
4. After your PR merges + the migration applies, update the row to ✅ APPLIED.

---

## 4. Deploy / apply queue (committed-but-not-live)

MCP Supabase access is **read-only** — **only Felipe** can apply migrations, deploy/delete edge functions, or ship native builds. Claude writes the exact commands; Felipe runs them.

### 4a. Migrations to apply
| Migration | Trigger | Command |
|---|---|---|
| **098** (retire Stripe) | ✅ merged — apply now | `supabase db push` (or run 098 in SQL editor) |
| **099** (Milk Vault) | ✅ merged — apply now | `supabase db push` |
| ~~100 (waitlist)~~ | ✅ **applied 2026-07-10** — done | — |
| 094 (manual week intro) | verify not-yet-applied | `supabase db push` catches it up |

### 4b. Edge functions Felipe must deploy / delete
| Function | Action | Why |
|---|---|---|
| `milk-vault-scan` | **DEPLOY** | Milk Vault AI scanner; feature dead until deployed (PR #3 merged, fn still not live). |
| milk-stripe-connect, milk-purchase-intent, milk-purchase-confirmed, milk-dispute-open, milk-shippo-label | **DELETE** (5 fns) | Dead now that PR #1 (retire Stripe) is merged. |
| ~~`calendly-webhook`~~ | ✅ **DONE 2026-08-15** | Prod ran the **old fail-open** version for five weeks after the fix landed on `main`. Now **v23, hardened, fail-closed + replay guard** — verified against the deployed artifact. This is the canonical example of why you check what's deployed, not what's committed. |
| `appointment-reminder` | **DEPLOY** | SMS leg removed (Twilio A2P dropping texts → push-only decided 2026-07-09). Repo change not yet deployed. |

### 4c. OTA / bundle ships
| Item | Why |
|---|---|
| **`api/milk.ts` `DONOR_SELECT_COLUMNS` change** | Confirm the C-1 column-scoped read (4 reads switched off `select('*')`) is in the **live bundle**. `select('*')` 403s under the grant. Ship OTA *with* the grant. |
| Milk Vault OTA | After 099 applies + `milk-vault-scan` deploys + founder go-ahead. |

### 4d. Config Felipe must set (pre-launch, per OPS_RUNBOOK / memories)
- `RESEND_WEBHOOK_SECRET` + Resend dashboard webhook endpoint (newsletter open/click tracking — no signals until set).
- Calendly webhook subscription created via API (needs Calendly PAT + org URI) once fn deployed.
- Waitlist: `public.waitlist` is live on prod (migration 100 applied). Confirm the villieapp.com landing page posts with the **publishable/anon** key (grants anon INSERT only; read the list from the dashboard/service role).
- Storage: `gear-listings` + `avatars` buckets already exist on hosted (confirmed).

---

## 5. Path to launch (sequenced gates)

Ordered by dependency. A gate can't clear until the ones it depends on clear.

### Gate 0 — Security & privacy — ✅ DONE (re-audited + re-closed 2026-08-15)
C-1 milk donor PII (095/096), bloodwork-URL scope (097), data-minimization — applied to prod. **Full re-audit 2026-08-15** (`docs/audits/security-privacy-2026-08-14.md`) found and fixed a **Critical**: `specialist-invite-create` accepted a forged, unsigned `service_role` JWT, letting an unauthenticated attacker insert themselves into the provider directory as an approved, bookable specialist. Fixed, redeployed with `verify_jwt` on, exploit re-fired at prod → 401, exposure audit clean. Also fixed: the 5 sibling functions sharing that gate, the invite replay race (the old open High — now closed), client-supplied pricing, donor pinpoint location (migration 127), and the last 2 advisor lints. Advisor **63 → 61**, all remaining accepted + documented.
⬜ **Tail, not launch-blocking:** rotate the service-role key (founder/dashboard — also fixes the 3-key drift, OPS_RUNBOOK §9); 8 dead pg_cron jobs making the failure log unreadable (spawned task; nothing actually broken — GH Actions covers all 8).

### Gate 1 — Compliance / attorney sign-off — ⚪ BLOCKING (biggest launch blocker)
None of these are code problems; all need counsel. **These block the hospital pilot / real users.**
| Item | Status | Doc |
|---|---|---|
| **Gear Terms Addendum** (P1) | DRAFT skeleton — `[COUNSEL]` markers throughout. **Every `gear_legal_acceptances` row is legally hollow until final text lands.** Fix = counsel writes text → swap body + bump `GEAR_LEGAL_DOC_VERSION` in one atomic commit. | `docs/GEAR_TERMS_ADDENDUM_SKELETON.md` |
| **CPSC Prohibited-Items Policy** (P2, ~$500–1K) | DRAFT for counsel; most already code-enforced (allowlist + year guards + recall hard-block). | `docs/GEAR_CPSC_PROHIBITED_ITEMS_POLICY.md` |
| **Gear 24hr takedown SLA** | Founder is sole named moderator — defensible only pre-launch. **HARD trigger to add a 2nd moderator: hospital pilot live OR >25 listings OR first real report OR founder absence >12h.** | `docs/V4_GEAR_TAKEDOWN_SOP.md` |
| **FDUTPA review of Gear in-app copy** | Pending. | — |
| **Marketplace GL + E&O insurance** | Pending confirm of coverage. | — |
| **Milk Risk & Compliance review** | Read `docs/source/Village_Risk_and_Compliance.md` before ANY milk/gear change. Milk social-links = new public PII surface → must be in Privacy Policy + Risk review. | source doc + `docs/MILK_SOCIAL_LINKS_PRIVACY_RISK.md` |
| **FinCEN / FL money-transmitter** | 🟢 **Resolved via cash-only MVP** — milk + gear are connector-only, no take-rate, deliberate legal moat. (Do NOT reintroduce fees without re-opening this — incl. Milk Vault's optional sell/donate, which stays cash-only.) | — |
| **Privacy Policy + Terms of Service** (published URLs) | Pending — blocks App Store + A2.c account-delete cascade. | — |

### Gate 2 — Clinical sign-off — ⚪ BLOCKING (health credibility)
- **Clinical advisor sign-off** on Manual content + Weekly Journey + Emergency Quick-Reference (CPR video still needs licensing). Blocks the safety/trust story AND the deck team slide (no named clinical advisor undercuts the whole moat).
- Emergency Quick-Reference hub gated on licensed CPR video + clinical/legal review.

### Gate 3 — Connect tab decision — ⏸ PRODUCT CALL (not a launch blocker)
V3 Connect tab is **hidden by design.** Do not re-enable. Community is low-priority; C3/C6/C7 stay stub. Re-enabling is a product call, not a build-completion signal — and would re-open crisis-detection GUC + moderator + crisis-drill gates.

### Gate 4 — Deck + fundraise — ⚪ IN PROGRESS (parallel to launch)
Per `DECK_REVIEW_2026-07-10.md`, top-5 fixes before next investor meeting:
1. **Team slide** — fill real names/credentials + name ≥1 credentialed clinical advisor (highest impact; caps the raise while empty). *(Founder input — depends on Gate 2.)*
2. **Cash-only revenue reframe** — stop presenting gear/milk "fees" as revenue; split "live today" (Pro sub, Specialist rev-share, Boxes margin, Picks affiliate) from "cash-only by design = moat."
3. **Demand signal** — put one real signal on the deck (signed/verbal pilot, LOI, or 50–100 mother-interview findings w/ willingness-to-pay). *(Depends on Gate 5 + founder interviews.)* The **waitlist capture** (migration 100, now live on prod) is the first mechanism generating this — already has its first real signup.
4. **Rebuild TAM/SAM/SOM bottom-up** on real monetization (kill the $58.5B baby-products anchor); reconcile funnel → unit-econ → roadmap to one assumption set.
5. **Reframe the raise around distribution risk** (product is built) — add runway + reconsider the 45/35/20 split toward GTM.

### Gate 5 — Hospital pilot (LOI) — ⚪ BLOCKING the GTM thesis
The load-bearing channel has **no signed pilot, no LOI, no named target.** Get *something* real: a signed LOI, a discharge-coordinator verbal, or a named target system + date. This unblocks both the deck demand-signal (Gate 4.3) and the near-zero-CAC claim. **Depends on Gate 1 (compliance) + Gate 2 (clinical)** — a hospital won't bundle an unreviewed postpartum-guidance product into discharge.

**Critical path to launch:** Gate 1 (attorney) + Gate 2 (clinical) → Gate 5 (pilot LOI) → go-live. Gate 4 (fundraise) runs in parallel but its two hardest items (team slide, demand signal) depend on Gate 2 and Gate 5.

---

## 6. Blockers & owners

### 6a. Attorney-gated (external counsel)
- Gear Terms Addendum final text (P1) — legally-hollow acceptances until it lands.
- CPSC Prohibited-Items Policy (P2, ~$500–1K).
- FDUTPA review of Gear copy.
- GL + E&O marketplace insurance confirm.
- Milk Risk & Compliance review (incl. donor social-links PII surface + Milk Vault sell/donate).
- Privacy Policy + ToS published (blocks App Store + account-delete cascade + A2.c).
- A2.c account-delete retention policy (which tables are PII-scrubbed vs row-deleted).

### 6b. Felipe-only (MCP is read-only)
- **Apply migrations:** **098 + 099 (both merged, unapplied)**, verify 094. (~~100~~ done — applied 2026-07-10.)
- **Deploy:** `milk-vault-scan`, `calendly-webhook` (fail-closed), `appointment-reminder` (push-only).
- **Delete:** 5 dead milk-Stripe edge fns (PR #1 now merged).
- **Native builds (not OTA):** Playbook Phase 4 iOS widget; Gear Boost (RevenueCat IAP, Build 14, behind `EXPO_PUBLIC_GEAR_BOOST_ENABLED`).
- **Config/secrets:** `RESEND_WEBHOOK_SECRET` + Resend endpoint; Calendly webhook subscription; add co-founder UUID to `GEAR_MODERATOR_EXTERNAL_IDS` when the 2nd-moderator trigger fires.
- **Rotation reminder:** Apple Sign-In client-secret JWT expires **~2026-11-16** — set a late-Oct reminder.

### 6c. Founder-input-needed
- **Team-slide names + bios** (CEO/CTO/Clinical & Safety Lead + advisors) — deck is all `[placeholders]`.
- **Named clinical advisor** — blocks both clinical sign-off and the deck.
- **Mother interviews (50–100)** — the missing demand signal for the raise (waitlist now seeds this).
- **Hospital pilot LOI / named target** — the missing distribution proof.
- **Deck ask numbers** ($1.5M / 25k moms / 45-35-20 are benchmarked *recommendations* — founder confirms).
- **Milk Vault go-ahead** — PR #3 is merged; confirm apply/deploy/OTA to actually ship it.

---

## 7. Operating rules (the discipline that prevents today's chaos)

1. **One session per code area at a time.** Check §2b before starting. If another session owns `milkVault/*`, the deck, or the boxes branch — don't touch it.
2. **Claim your migration number in §3 before you create the file.** Next free is **101**. Never reuse 098/099 (merged, unapplied) or 100 (merged + applied).
3. **`git fetch && git pull` before branching.** Verify local `main` matches `origin/main` (`c289456`) before branching off it.
4. **Pull `origin/main` IN before committing on a long-lived branch.** `feat/villie-boxes-home-polish` is still behind origin/main — reconcile so retired code (dropped Stripe RPCs / `getTransactionAddress`) isn't reintroduced.
5. **Update this doc at the end of each session** — §2 (what moved), §3 (migrations claimed/applied), §4 (what's now deployed). A stale State-of-Villie causes the exact collisions it exists to prevent.
6. **Don't re-enable the Connect tab** or flip any feature flag (`EXPO_PUBLIC_*`: Gear Boost, Milk Stripe, Delete-Account, Villie Boxes) on your own — every flag is a product/legal call, not a build-completion signal.
7. **MCP Supabase is read-only.** Never assume a migration is applied or a function is deployed because it's committed/merged — 098+099 are merged but still unapplied. Check §3/§4 and route the action to Felipe.
8. **Milk & Gear changes → read `Village_Risk_and_Compliance.md` first** (both verticals). Cash-only is a deliberate legal moat — don't add fees/payments (incl. Milk Vault sell/donate) without re-opening the FinCEN gate.
9. **Discharge surfaces are clinician-handoff-grade, EN+ES.** ES on discharge copy must be clinical-quality; add i18n keys to both dicts.

---

*Sources: `MEMORY.md` + `project_*`/`feedback_*` files · `CLAUDE.md` build tables + open gates · live git/gh/migrations state (2026-07-10: `origin/main` `c289456`, 0 open PRs, migrations 001–100 on disk, 100 applied to prod) · `DECK_REVIEW_2026-07-10.md` · `docs/MILK_HUB_UNIFICATION.md`.*
