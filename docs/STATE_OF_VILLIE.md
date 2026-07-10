# State of Villie — Canonical Operating Doc

**The single source of truth for the founder AND every parallel Claude Code session.**
Read this first. Update it last. When sessions collide (duplicate migration numbers, duplicate
feature builds, stepping on shared files), the fix is: everyone coordinates *here*.

- **Last updated:** 2026-07-10
- **Authoritative for:** in-flight work, migration numbers, deploy queue, launch sequence.
- **NOT authoritative for:** per-phase build history (`CLAUDE.md`), env/key setup (`docs/OPS_RUNBOOK.md`), product intent (`docs/source/*`). This doc points at those; it doesn't replace them.

> ⚠️ **Before you create a migration, claim its number in §3.** Before you start building a feature, check §2 that no other session already owns it. At the end of your session, update §2, §3, §4.

---

## 1. Snapshot

Villie is a **pre-launch** maternal-health platform (React Native + Expo + Supabase), built across four verticals plus Home: **V1 Specialists** (live/production-grade), **V2 Milk Connect** (code-complete, cash-only/connector-only), **V3 Community** (~57%, tab intentionally hidden — do not re-enable), **V4 Gear + Home** (code-complete, legal-gated), plus **V5 Grow-With-You / Playbook / Manual** and new commerce (**Villie Boxes**) and **V6 Milk Vault** in flight. Primary GTM is **hospital-discharge distribution** (postpartum 0–6 weeks is the core journey; copy is clinician-handoff-grade, EN+ES). A **$1.5M seed raise is in progress** — deck is built and ~80% ready; the reviewed gaps are team slide, cash-only revenue reframe, and a real demand signal (see §5). Security/privacy hardening (C-1 milk PII leak + bloodwork-URL + data-minimization) is **DONE and applied to prod**. What stands between here and launch is almost entirely **attorney sign-off, Felipe-only deploys, and founder-input items** — not more code.

---

## 2. In-flight right now

### 2a. Open PRs

| PR | Branch | What it does | Migration | To land it |
|---|---|---|---|---|
| **#3** | `feat/milk-vault-v6` | **V6 Milk Vault** — personal freezer-stash tracker + optional cash-only sell/donate *planning*. 8 screens under Milk tab, `milk_vault_*` tables, `milk-vault-scan` edge fn (Claude vision). Typecheck+lint clean. Rescued off a tangled WIP branch. | **099** `099_v6_milk_vault.sql` | Review → merge to main → **apply 099** (Felipe) → **deploy `milk-vault-scan`** (Felipe). Migration+fn NOT deployed. |
| **#1** | `chore/retire-milk-stripe-connect-098` | **Retire Milk Stripe Connect** — drops `stripe_account_id`/`stripe_onboarding_complete`, dead purchase/dispute/shipping tables + 5 dead edge fns. Hygiene, not a security fix. ~12 files; touches milk review flow + account-delete retention refs. | **098** `098_retire_milk_stripe_connect.sql` | Review carefully (careless drop = regression in review flow / account deletion). Merge → apply 098 → Felipe **deletes** 5 edge fns. |
| — | (closed) PR #2 `feat/milk-vault-phase1` | Superseded duplicate of Milk Vault — **ignore.** | — | Closed. |

**Open PR count: 2.**

### 2b. Active workstreams / sessions (coordinate before touching)

| Workstream | State | Owner surface (don't collide) | Next step |
|---|---|---|---|
| **Milk Vault V6** | PR #3 open, awaiting merge+deploy | `src/screens/milkVault/*`, `api/milkVault.ts`, `store/milkVault.ts`, `milk-vault-scan` fn, migration 099 | Merge PR #3, deploy (§4) |
| **Retire Milk Stripe Connect** | PR #1 open | milk donor interface, `DONOR_SELECT_COLUMNS`, Stripe screens/nav, 5 edge fns, migration 098 | Merge PR #1 on a clean tree, delete edge fns (§4) |
| **`feat/villie-boxes-home-polish`** (current working branch) | **Dirty WIP, ~29 files** — Villie Boxes commerce (gated off) + home polish + checkpoint of tracker/manual/safety work | `screens/home/*`, Villie Boxes catalog/store, migration 092 | Reconcile with main (it's BEHIND on the 096 api change — `getTransactionAddress` still calls the dropped RPC). Rebase/merge main IN before committing. |
| **The Buzz (trending)** | Spec approved + committed (`8dc5d69`), **not built** | `docs/THE_BUZZ_TRENDING.md`; will add `TheBuzzScreen`, edge fns, review-queue | Write implementation plan (phases B1–B5); B2 installs `last30days` skill. Awaiting green-light. |
| **Playbook baby tracker** | Phases 1–3 **LIVE** (migration 093 applied, `playbook-parse-note` deployed) | `src/screens/playbook/*`, tracker tables | Only Phase 4 (native iOS Lock-Screen widget) pending — needs a **native build**, not OTA. |
| **Manual content (52 wks)** | Weeks 0–4 authored, 5–52 pending | `manualWeekContent.ts` (story/checklist/info) | Claude authors story/checklist/info; Felipe does specialist articles+videos. |
| **Deck fixes (seed raise)** | Review done (`DECK_REVIEW_2026-07-10.md`) | `~/Downloads/villie-pitch-updated/project/villie-pitch.html` (editable master) | Top-5 fixes in §5. Team slide + revenue reframe are founder-input. |

---

## 3. Migration registry (collision-prevention)

**This is the section that stops sessions from stepping on each other. Claim your number HERE before you create the file.**

- **Highest APPLIED on prod:** **097** (`097_security_milk_bloodwork_url_scope.sql`, applied 2026-07-09). Also applied ahead of history: 095, 096. Note 092/093/094 were unapplied for a while; 093 is now applied (Playbook). A `supabase db push` re-runs 095–097 idempotently.
- **Highest ON DISK (main / working tree):** **097.**
- **Highest CLAIMED anywhere (incl. open branches):** **099.**

| # | Name | What | Status |
|---|---|---|---|
| 092 | `092_villie_boxes_orders.sql` | Villie Boxes commerce orders | On `feat/villie-boxes-home-polish` (committed-not-applied). |
| 093 | `093_v5_baby_tracker.sql` | Playbook tracker | ✅ **APPLIED to prod** (2026-07-10). |
| 094 | `094_v5_manual_week_intro.sql` | Manual week intro | Committed. Apply status: unconfirmed — verify before relying on it. |
| 095 | `095_security_milk_donor_pii_column_revoke.sql` | C-1 donor PII column grant | ✅ **APPLIED to prod** (2026-07-08, manually via SQL editor — not in migration history; db push re-runs idempotently). On main. |
| 096 | `096_privacy_drop_milk_donor_pii.sql` | Drop donor address/phone + RPC | ✅ **APPLIED to prod** (2026-07-09). On main (`eefba41`). |
| 097 | `097_security_milk_bloodwork_url_scope.sql` | Scope bloodwork URL (health data) | ✅ **APPLIED to prod** (2026-07-09). On main (`30e5577`). |
| **098** | `098_retire_milk_stripe_connect.sql` | Retire Milk Stripe Connect | **OPEN — PR #1** (`chore/retire-milk-stripe-connect-098`). Not merged, not applied. |
| **099** | `099_v6_milk_vault.sql` | V6 Milk Vault tables | **OPEN — PR #3** (`feat/milk-vault-v6`). Not merged, not applied. |

### ➡️ NEXT FREE MIGRATION NUMBER: **100**

**Rule (enforced):**
1. Before creating any migration, add a row to the table above with your number, name, and "CLAIMED — <branch>".
2. Use the **next free number** (currently **100**). Never reuse 098 or 099 — they are taken by open PRs even though not yet on main.
3. Filenames are **numeric-prefix only** (`100_...sql`) — the CLI silently skips `100b`.
4. After your PR merges + the migration applies, update the row to ✅ APPLIED.

---

## 4. Deploy / apply queue (committed-but-not-live)

MCP Supabase access is **read-only** — **only Felipe** can apply migrations, deploy/delete edge functions, or ship native builds. Claude writes the exact commands; Felipe runs them.

### 4a. Migrations to apply (after their PR merges)
| Migration | Trigger | Command |
|---|---|---|
| 098 (retire Stripe) | PR #1 merged | `supabase db push` (or run 098 in SQL editor) |
| 099 (Milk Vault) | PR #3 merged | `supabase db push` |
| 094 (manual week intro) | verify not-yet-applied | `supabase db push` catches it up |

### 4b. Edge functions Felipe must deploy / delete
| Function | Action | Why |
|---|---|---|
| `milk-vault-scan` | **DEPLOY** | Milk Vault AI scanner; feature dead until deployed (after PR #3). |
| `calendly-webhook` | **DEPLOY** (`--project-ref albyndcruwopulazvpjs`) | Prod still runs the **old fail-open** version; hardened fail-closed code is on main only. `CALENDLY_WEBHOOK_SECRET` already set. Pre-launch Calendly checklist in `project_appsec_c1_fix_pending.md`. |
| `appointment-reminder` | **DEPLOY** | SMS leg removed (Twilio A2P dropping texts → push-only decided 2026-07-09). Repo change not yet deployed. |
| milk-stripe-connect, milk-purchase-intent, milk-purchase-confirmed, milk-dispute-open, milk-shippo-label | **DELETE** (5 fns) | Dead after PR #1 (retire Stripe) merges. |

### 4c. OTA / bundle ships
| Item | Why |
|---|---|
| **`api/milk.ts` `DONOR_SELECT_COLUMNS` change** | Confirm the C-1 column-scoped read (4 reads switched off `select('*')`) is in the **live bundle**. `select('*')` 403s under the grant. Ship OTA *with* the grant. |
| Milk Vault OTA | After PR #3 merges + 099 applies + fn deploys. |

### 4d. Config Felipe must set (pre-launch, per OPS_RUNBOOK / memories)
- `RESEND_WEBHOOK_SECRET` + Resend dashboard webhook endpoint (newsletter open/click tracking — no signals until set).
- Calendly webhook subscription created via API (needs Calendly PAT + org URI) once fn deployed.
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
| **CPSC Prohibited-Items Policy** (P2, ~$500–1K) | DRAFT for counsel; most is already code-enforced (allowlist + year guards + recall hard-block). | `docs/GEAR_CPSC_PROHIBITED_ITEMS_POLICY.md` |
| **Gear 24hr takedown SLA** | Founder is sole named moderator — defensible only pre-launch. **HARD trigger to add a 2nd moderator: hospital pilot live OR >25 listings OR first real report OR founder absence >12h.** | `docs/V4_GEAR_TAKEDOWN_SOP.md` |
| **FDUTPA review of Gear in-app copy** | Pending. | — |
| **Marketplace GL + E&O insurance** | Pending confirm of coverage. | — |
| **Milk Risk & Compliance review** | Read `docs/source/Village_Risk_and_Compliance.md` before ANY milk/gear change. Milk social-links = new public PII surface → must be in Privacy Policy + Risk review. | source doc |
| **FinCEN / FL money-transmitter** | 🟢 **Resolved via cash-only MVP** — milk + gear are connector-only, no take-rate, deliberate legal moat. (Do NOT reintroduce fees without re-opening this.) | — |
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
3. **Demand signal** — put one real signal on the deck (signed/verbal pilot, LOI, or 50–100 mother-interview findings w/ willingness-to-pay). *(Depends on Gate 5 + founder interviews.)*
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
- Milk Risk & Compliance review (incl. donor social-links PII surface).
- Privacy Policy + ToS published (blocks App Store + account-delete cascade + A2.c).
- A2.c account-delete retention policy (which tables are PII-scrubbed vs row-deleted).

### 6b. Felipe-only (MCP is read-only)
- **Deploy:** `milk-vault-scan`, `calendly-webhook` (fail-closed), `appointment-reminder` (push-only).
- **Delete:** 5 dead milk-Stripe edge fns (after PR #1).
- **Apply migrations:** 098, 099, verify 094 (after their PRs merge).
- **Native builds (not OTA):** Playbook Phase 4 iOS widget; Gear Boost (RevenueCat IAP, Build 14, behind `EXPO_PUBLIC_GEAR_BOOST_ENABLED`).
- **Config/secrets:** `RESEND_WEBHOOK_SECRET` + Resend endpoint; Calendly webhook subscription; add co-founder UUID to `GEAR_MODERATOR_EXTERNAL_IDS` when the 2nd-moderator trigger fires.
- **Rotation reminder:** Apple Sign-In client-secret JWT expires **~2026-11-16** — set a late-Oct reminder.

### 6c. Founder-input-needed
- **Team-slide names + bios** (CEO/CTO/Clinical & Safety Lead + advisors) — deck is all `[placeholders]`.
- **Named clinical advisor** — blocks both clinical sign-off and the deck.
- **Mother interviews (50–100)** — the missing demand signal for the raise.
- **Hospital pilot LOI / named target** — the missing distribution proof.
- **Deck ask numbers** ($1.5M / 25k moms / 45-35-20 are benchmarked *recommendations* — founder confirms).
- **Milk Vault go-ahead** — confirm merge/apply/deploy of PR #3.

---

## 7. Operating rules (the discipline that prevents today's chaos)

1. **One session per code area at a time.** Check §2b before starting. If another session owns `milkVault/*`, the deck, or the boxes branch — don't touch it. Collisions this week: duplicate migration 098/099, duplicate Milk Vault builds (PR #2 vs #3), the dirty 29-file boxes branch drifting behind main.
2. **Claim your migration number in §3 before you create the file.** Next free is **100**. Never reuse a number that's live on an open PR (098, 099).
3. **Pull `main` IN before committing on a long-lived branch.** `feat/villie-boxes-home-polish` is behind main on the 096 change — reconcile so retired code (`getTransactionAddress` → dropped RPC) isn't reintroduced. Land isolated fixes via git worktrees off main, not on the dirty tree.
4. **Update this doc at the end of each session** — §2 (what moved), §3 (migrations claimed/applied), §4 (what's now deployed). A stale State-of-Villie causes the exact collisions it exists to prevent.
5. **Don't re-enable the Connect tab** or flip any feature flag (`EXPO_PUBLIC_*`: Gear Boost, Milk Stripe, Delete-Account, Villie Boxes) on your own — every flag is a product/legal call, not a build-completion signal.
6. **MCP Supabase is read-only.** Never assume a migration is applied or a function is deployed because it's committed — check §3/§4 and route the action to Felipe.
7. **Milk & Gear changes → read `Village_Risk_and_Compliance.md` first** (both verticals, not just Gear). Cash-only is a deliberate legal moat — don't add fees/payments without re-opening the FinCEN gate.
8. **Discharge surfaces are clinician-handoff-grade, EN+ES.** ES on discharge copy must be clinical-quality; add i18n keys to both dicts.

---

*Sources: `MEMORY.md` + `project_*`/`feedback_*` files · `CLAUDE.md` build tables + open gates · live git/gh/migrations state (2026-07-10) · `docs/PRE_LAUNCH_RUNBOOK.md`, `STATUS.md`, gear compliance skeletons · `DECK_REVIEW_2026-07-10.md`. This doc is uncommitted — founder reviews/commits.*
