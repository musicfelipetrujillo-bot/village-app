# State of Villie — Canonical Operating Doc

**The single source of truth for the founder AND every parallel Claude Code session.**
Read this first. Update it last. When sessions collide (duplicate migration numbers, duplicate
feature builds, stepping on shared files), the fix is: everyone coordinates *here*.

- **Last updated:** 2026-07-10 (waitlist migration 100 committed, merged, and applied to prod)
- **`origin/main` head:** `c289456` (waitlist migration, #5). Local main was fast-forwarded to match — no drift.
- **Authoritative for:** in-flight work, migration numbers, deploy queue, launch sequence.
- **NOT authoritative for:** per-phase build history (`CLAUDE.md`), env/key setup (`docs/OPS_RUNBOOK.md`), product intent (`docs/source/*`). This doc points at those; it doesn't replace them.

> ⚠️ **Before you create a migration, claim its number in §3.** Before you start building a feature, check §2 that no other session already owns it. At the end of your session, update §2, §3, §4.

---

## 1. Snapshot

Villie is a **pre-launch** maternal-health platform (React Native + Expo + Supabase), built across four verticals plus Home: **V1 Specialists** (live/production-grade), **V2 Milk Connect** (code-complete, cash-only/connector-only), **V3 Community** (~57%, tab intentionally hidden — do not re-enable), **V4 Gear + Home** (code-complete, legal-gated), plus **V5 Grow-With-You / Playbook / Manual** and new commerce (**Villie Boxes**) and **V6 Milk Vault** (now merged). Primary GTM is **hospital-discharge distribution** (postpartum 0–6 weeks is the core journey; copy is clinician-handoff-grade, EN+ES). A **$1.5M seed raise is in progress** — deck is built and ~80% ready; the reviewed gaps are team slide, cash-only revenue reframe, and a real demand signal (see §5). Security/privacy hardening (C-1 milk PII leak + bloodwork-URL + data-minimization) is **DONE and applied to prod**.

**What moved since last refresh:** the two open PRs both landed — **PR #1 (retire Milk Stripe, migration 098)** and **PR #3 (V6 Milk Vault, migration 099)** are **merged to `origin/main`**, plus **PR #4 (Milk Hub unification plan doc)** and now **PR #5 (waitlist migration 100)** — committed on its own branch, merged, AND **applied to prod** (already has 1 real signup row). **There are now zero open PRs.** 098 + 099 are still merged-but-**unapplied** — top of the apply queue. What stands between here and launch is still almost entirely **attorney sign-off, Felipe-only deploys, and founder-input items** — not more code.

---

## 2. In-flight right now

### 2a. Open PRs

**Open PR count: 0.** All three prior in-flight PRs have resolved:

| PR | Branch | Outcome | Follow-through owed |
|---|---|---|---|
| **#1** | `chore/retire-milk-stripe-connect-098` | ✅ **MERGED** (2026-07-09) — retires Milk Stripe Connect, migration **098**. | Apply 098 (`db push`); Felipe **deletes** 5 dead milk-Stripe edge fns (§4). |
| **#3** | `feat/milk-vault-v6` | ✅ **MERGED** (2026-07-10) — V6 Milk Vault, migration **099**, `milk-vault-scan` edge fn. | Apply 099 (`db push`); Felipe **deploys** `milk-vault-scan`; then Milk Vault OTA (§4). |
| **#4** | `docs/milk-hub-unification` | ✅ **MERGED** (2026-07-10) — `docs/MILK_HUB_UNIFICATION.md` (Vault + Connect → one ecosystem). **Planning doc only, no code/migration.** | Read before the next Milk-tab structural change. |
| **#5** | `feat/waitlist-migration` | ✅ **MERGED** (2026-07-10) — migration **100**, `public.waitlist` table. **Applied to prod same day** — table live, RLS on, 1 row already. | None — fully shipped. |
| #2 | `feat/milk-vault-phase1` | ❌ CLOSED — superseded duplicate of Milk Vault. Ignore. | — |

> **No PR is currently open.** New work starts from a fresh branch off (fetched) `origin/main`.

### 2b. Active workstreams / sessions (coordinate before touching)

| Workstream | State | Owner surface (don't collide) | Next step |
|---|---|---|---|
| **Waitlist migration (100)** | ✅ **DONE** — committed on `feat/waitlist-migration`, merged (PR #5), applied to prod | `supabase/migrations/100_waitlist.sql` | Fully shipped, no follow-up. |
| **`feat/villie-boxes-home-polish`** (current working branch) | 15 ahead / behind `origin/main` (100_waitlist.sql duplicate removed — it now lives only on main history) | `screens/home/*`, Villie Boxes catalog/store, migration **092** | **Rebase/merge origin/main IN** — it's still behind on the 096/098/099 changes. |
| **Milk Vault V6** | ✅ Merged (PR #3). Not deployed. | `src/screens/milkVault/*`, `api/milkVault.ts`, `store/milkVault.ts`, `milk-vault-scan` fn, migration 099 | Apply 099 + deploy `milk-vault-scan` + OTA (§4). Founder go-ahead to ship still open. |
| **Milk Hub unification** | ✅ Plan doc merged (PR #4). Not built. | `docs/MILK_HUB_UNIFICATION.md` | Read before restructuring the Milk tab (Vault + Connect → one ecosystem). |
| **The Buzz (trending)** | Spec approved + committed, **not built** | `docs/THE_BUZZ_TRENDING.md`; will add `TheBuzzScreen`, edge fns, review-queue | Write implementation plan (phases B1–B5); B2 installs `last30days` skill. Editorial (not clinical), two-tier review gate. Awaiting green-light. |
| **Playbook baby tracker** | Phases 1–3 **LIVE** (migration 093 applied, `playbook-parse-note` deployed) | `src/screens/playbook/*`, tracker tables | Only Phase 4 (native iOS Lock-Screen widget) pending — needs a **native build**, not OTA. |
| **Manual content (52 wks)** | Weeks 0–4 authored, 5–52 pending | `manualWeekContent.ts` (story/checklist/info) | Claude authors story/checklist/info; Felipe does specialist articles+videos. Fallback reads nearest earlier seeded week. |
| **Deck fixes (seed raise)** | Review done (`DECK_REVIEW_2026-07-10.md`) | `~/Downloads/villie-pitch-updated/project/villie-pitch.html` (editable master) | Top-5 fixes in §5. Team slide + revenue reframe are founder-input. |

---

## 3. Migration registry (collision-prevention)

**This is the section that stops sessions from stepping on each other. Claim your number HERE before you create the file.**

- **Highest APPLIED on prod:** **100** (`100_waitlist.sql`, applied 2026-07-10 via SQL editor — `public.waitlist` live, RLS on, already has a real signup). Also applied: 097, 096, 095, 093. **098 + 099 are merged but NOT yet applied** — gap in the sequence, top of the apply queue (§4). A `supabase db push` catches up 098/099 (095–097/100 re-run idempotently).
- **Highest ON DISK (`origin/main`):** **100.**
- **Highest CLAIMED:** **100.**

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
| **100** | `100_waitlist.sql` | Marketing-site waitlist (anon INSERT only, no anon SELECT) | ✅ **MERGED (PR #5) + APPLIED to prod** (2026-07-10). Fully shipped. |

### ➡️ NEXT FREE MIGRATION NUMBER: **101**

**Rule (enforced):**
1. Before creating any migration, add a row to the table above with your number, name, and "CLAIMED — <branch>".
2. Use the **next free number** (currently **101**). Never reuse 098/099/100 — 098/099 are merged-but-unapplied, 100 is an uncommitted file already on disk.
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
| `calendly-webhook` | **DEPLOY** (`--project-ref albyndcruwopulazvpjs`) | Prod still runs the **old fail-open** version; hardened fail-closed code is on main only. `CALENDLY_WEBHOOK_SECRET` already set. Pre-launch checklist in `project_appsec_c1_fix_pending.md`. |
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

### Gate 0 — Security & privacy — ✅ DONE
C-1 milk donor PII leak (095/096), bloodwork-URL health-data scope (097), data-minimization — **all applied to prod, zero exposure (pre-launch)**. Remaining tail: confirm `api/milk.ts` change in live bundle (§4c); one still-open High = `specialist-invite-accept` non-atomic claim race (not launch-blocking).

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
