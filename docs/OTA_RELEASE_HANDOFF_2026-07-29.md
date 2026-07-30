# OTA Release — 2026-07-29 (SHIPPED)

**Status:** ✅ **Released.** What started as a handoff checklist was executed the same day. This is now the post-release record. **Read §0 + §6 for what's still open.**

> Verified against the live hosted project + git on 2026-07-29. Canonical deploy state lives in memory `project_deploy_state_2026_07`.

---

## 0. TL;DR

The backend was already fully live (all migrations →105, every edge function ACTIVE, Billy Wave 1 deployed). The remaining work was the **mobile JS bundle**, and it shipped:

- **Git reconciled** onto `integration/ota-2026-07-29` (head `7ccd612`); local `main` fast-forwarded to it. **Not pushed to `origin`** — that publish is left to the founder.
- **OTA published** to the `production` channel — update group **`d968fa36-27e1-400c-953e-36284d575c72`** (runtime 1.0.0, iOS + Android).
- Ships **Milk Vault**, the **Billy assistant client**, **The Buzz** surface (empty until items are approved), and the **milk C-1 PII fix**.
- **Villie Boxes intentionally left DARK** this release (Stripe config incomplete).

**Still open:** light up Boxes, publish The Buzz's first issue, confirm config secrets, native builds, and the `origin` push decision. See §6.

---

## 1. What the release contained

**Milk Vault** — 8 screens present in the bundle, `milk-vault-scan` v2 backend live.
**Billy assistant** — client footprint was just 2 files (`api/appHelp.ts` + `screens/help/AIHelpChatScreen.tsx`); the 8 tools are server-side in `app-help-chat` v25, already deployed. The 3-way merge kept both Billy's `navigate`/`quick_replies` route-to logic **and** the bold-rose `#E84B79` rebrand color in the chat screen.
**The Buzz** — mobile surface shipped but shows empty until the 4 `in_review` items on issue `c3cc6efb…` are approved (auto-publishes on approval → Home "the buzz is here" card lights up).
**Milk C-1 PII fix** — `DONOR_SELECT_COLUMNS` column-scoped read confirmed present on every branch incl. `main`; no `select('*')` 403 risk in the shipped bundle.

---

## 2. Git reconciliation (DONE)

Branch shape was `main 97f63f4 → shared a2e38a6 → { billy 5344a57, boxes bfff7af }`.

- Committed loose docs (this handoff, the Buzz audit, OPS runbook edits) onto the boxes branch first.
- Merged `feat/billy-capability-coverage` into a boxes-derived branch → **auto-resolved, zero conflicts** (billy's mobile footprint was only the 2 files above).
- Result: **`integration/ota-2026-07-29`** head `7ccd612` — the one branch the OTA came from.
- Verified on HEAD: 8 Milk Vault screens, C-1 fix intact, **no milk-Stripe client code reintroduced**, `pnpm --filter mobile type-check` clean.
- Safety tags exist: `backup/{main,billy,boxes}-pre-recon-20260729`.
- Local `main` fast-forwarded to `7ccd612` (now **89 commits ahead of `origin/main`** `c289456`). `STATE_OF_VILLIE.md` corrected on main in commit `b2376eb` (dated banner + migration numbers → highest applied 105 / next free 106). Typecheck clean on main.
- ⚠️ **`main` ≠ live.** Main now carries the not-yet-approved Buzz surface; the OTA channel + the review-queue gate go-live, not the branch.

---

## 3. Config / env handling

- Env resolved via a **new gitignored `apps/mobile/.env.production`** (`APP_ENV=production`, `INTERNAL_AGENTS=0`, `VILLIE_BOXES_ENABLED=0`). This was necessary — the dev `.env` alone would have poisoned the bundle (`APP_ENV=development`, `INTERNAL_AGENTS=1`).
- Secrets to (re)confirm in the Supabase dashboard — not verifiable via read-only MCP:
  - [ ] `TRENDING_INGEST_SECRET` · [ ] `RESEND_WEBHOOK_SECRET` (+ Resend endpoint) · [ ] `CALENDLY_WEBHOOK_SECRET`
  - [ ] `STRIPE_WEBHOOK_SECRET` (needed before Boxes can go live)

---

## 4. The OTA command that shipped

```
eas update --channel production --message "Milk Vault + Billy assistant + The Buzz + milk PII fix"
# → update group d968fa36-27e1-400c-953e-36284d575c72 (runtime 1.0.0, iOS+Android)
```
`appVersionSource` is `local`, runtimeVersion fixed `"1.0.0"` → JS-only, no native rebuild, reaches all current store builds.

---

## 5. Post-release verification

- [ ] `eas update:list --channel production` shows group `d968fa36…` at top, runtime 1.0.0.
- [ ] On a production-build device (force-close/reopen twice to pull): Milk Vault loads; Billy answers + a "find a doula near me" ask returns results with a working `navigate` deep-link; donor profiles load with no PII 403s.
- [ ] Sentry (org `villie-app`, project `mobile`) — no new crash spike post-release.

---

## 6. Still open (post-release)

1. **Light up Villie Boxes** — set `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (in `.env.production`/EAS env) + `STRIPE_WEBHOOK_SECRET` on Supabase, flip `EXPO_PUBLIC_VILLIE_BOXES_ENABLED=1`, re-OTA. See OPS_RUNBOOK §2.1/§3.8. (Left dark because checkout would ship broken without the Stripe keys.)
2. **Publish The Buzz's first issue** — founder (already `is_clinical_reviewer`) approves the 4 `in_review` items on issue `c3cc6efb…` in ClinicalReviewScreen → auto-publishes. Push-on-publish no-ops on Free tier (GUC lock), but the Home card works.
3. **`origin` push decision (founder)** — push `integration/ota-2026-07-29`? push the fast-forwarded `main` (89 ahead of origin)? Delete the `backup/*-pre-recon-20260729` tags once satisfied.
4. **Native builds (separate track)** — Playbook iOS Lock-Screen widget; Gear Boost (RevenueCat, Build 14). EAS Build + store submit, not OTA.

## 7. Explicitly NOT shipped

- Native builds (above). Legal/clinical-gated features (Gear Terms Addendum, Emergency CPR). Milk Vault sell/donate remains cash-only.

---

## 8. Rollback

OTA is reversible: `eas update:rollback --channel production`, or republish the prior update. runtimeVersion unchanged → reaches the same builds, no store review.

---

*Executed 2026-07-29. Deploy state of record: memory `project_deploy_state_2026_07`.*
