# OTA Release Handoff — ship the live backends to users

**Created:** 2026-07-29 · **For:** a fresh, dedicated deploy session · **Owner:** Felipe

> Drop this whole file into the new session as the first message. It is self-contained.

---

## 0. TL;DR

The **backend is already fully deployed** (all migrations →105, every edge function ACTIVE, Billy Wave 1 live). Nothing to deploy on Supabase. What's missing is the **mobile JS bundle** — an `eas update` on the `production` channel so users actually get Milk Vault, the Billy assistant UI, and the milk PII fix. **Do NOT run the update until the git reconciliation in §2 is done** — the feature work is split across two unmerged branches and the wrong bundle would ship a client that doesn't match the deployed backend.

---

## 1. Verified current state (2026-07-29)

**Hosted Supabase (`albyndcruwopulazvpjs`) — confirmed via read-only MCP:**
- Migrations `001`→`105` ALL applied (incl. 098 retire-Stripe, 099 Milk Vault, 104 RLS backfill, 105 The Buzz). Next free = **106**.
- Edge functions all ACTIVE: `app-help-chat` v25 (**contains full Billy Wave 1** — 8 tools + registry), `milk-vault-scan` v2, `playbook-parse-note` v2, `appointment-reminder` v21 (push-only), `calendly-webhook` v21, `day-sheet-page` v4, `daycares-nearby` v4, `resend-webhook`, The Buzz trio (`trending-ingest`/`trending-compliance-pass`/`trending-publish-notify`).
- 5 dead milk-Stripe functions already deleted.

**EAS / app config (`apps/mobile`):**
- `slug` the-village-app · `version` 1.0.0 · **`runtimeVersion` "1.0.0"** (fixed string) · owner `villagepeople` · EAS projectId `4b786f88-d387-4aba-a420-dfae6db88671`.
- Production channel = **`production`** (both `eas.json` and `app.json` → `expo-channel-name`).
- Because runtimeVersion is a fixed `"1.0.0"`, an OTA on `production` reaches all current store builds. ✅

**Git (the problem):**
- Current branch `feat/villie-boxes-home-polish` — **75 commits ahead of `main`, 0 behind**; dirty tree (`docs/OPS_RUNBOOK.md` modified, untracked `docs/audits/buzz-discovery-2026-07-29.md`).
- `feat/billy-capability-coverage` — **deployed to prod but NEVER merged to `main`** (head `5344a57`).
- **Billy's client + tool code is ABSENT from the boxes branch.** So neither long-lived branch alone contains everything that's live on the backend.

---

## 2. The crux — reconcile git BEFORE any OTA

The deployed backend (`app-help-chat` v25) returns `navigate`, `quick_replies`, and tool results that the **Billy client screen** (`AIHelpChatScreen` + navigate target mapping) must handle. That client code is on `feat/billy-capability-coverage` only. The boxes branch has 75 commits of other work but not Billy. **You must produce one branch that contains both**, then OTA from it.

Do this carefully (in the new session, with a human confirming each merge):
1. `git fetch && git status` — confirm what's uncommitted; commit or stash the loose OPS_RUNBOOK/audit changes deliberately.
2. Decide the integration branch. Likely: bring `feat/billy-capability-coverage` **into `main`** first (it's already live on the backend — main should reflect reality), then rebase/merge `feat/villie-boxes-home-polish` on top.
3. **Resolve conflicts with eyes open** — 75 commits of Boxes work + Billy + the retired-Stripe changes (098) all touch overlapping areas (`api/milk.ts`, milk screens). Confirm the retired milk-Stripe client code is NOT reintroduced.
4. Typecheck clean: `pnpm typecheck` (or the repo's script) before proceeding.
5. Confirm the resulting bundle contains: Milk Vault screens, Billy `AIHelpChatScreen` w/ navigate handling, and the `api/milk.ts` `DONOR_SELECT_COLUMNS` column-scoped read (the C-1 fix — `select('*')` 403s under the grant).

---

## 3. Config secrets — confirm set on hosted (dashboard)

Can't be verified via read-only MCP. Confirm each exists in Supabase → Edge Functions → Secrets:
- [ ] `TRENDING_INGEST_SECRET` (The Buzz ingest)
- [ ] `RESEND_WEBHOOK_SECRET` (newsletter open/click) + the webhook endpoint added in the Resend dashboard
- [ ] `CALENDLY_WEBHOOK_SECRET` (already set per prior notes — reconfirm)

---

## 4. Ship the OTA

From the reconciled branch, in `apps/mobile`:
```
# sanity
git branch --show-current            # the reconciled integration branch
git status -s                        # clean
pnpm typecheck

# publish the JS bundle to the production channel
eas update --channel production --message "Milk Vault + Billy assistant + milk PII fix"
```
Notes:
- `appVersionSource` is `local` and runtimeVersion is fixed `"1.0.0"` — no native rebuild needed for these JS-only features.
- If any feature is behind an `EXPO_PUBLIC_*` flag (e.g. Milk Vault), verify the flag is ON in the `production` env block of `eas.json` before publishing. Milk Vault also needs **founder go-ahead** to go live — confirm that's a yes.

---

## 5. Post-update verification

- [ ] `eas update:list --channel production` shows the new update at the top, runtime 1.0.0.
- [ ] On a device on the production build: force-close/reopen twice to pull the update. Confirm:
  - [ ] Milk Vault screens load (scan → add bag → dashboard).
  - [ ] Billy answers, and a "find a doula near me" style ask returns real results + a working `navigate` deep-link.
  - [ ] Donor profiles load with no PII 403s (C-1 fix in bundle).
- [ ] Sentry (org `villie-app`, project `mobile`) shows no new crash spike post-release.

---

## 6. Rollback

OTA is reversible: `eas update:rollback` (or republish the prior update to `production`). Because runtimeVersion is unchanged, rollback reaches the same builds. No store review needed.

---

## 7. Explicitly NOT in this release (separate tracks)

- **Native builds** — Playbook iOS Lock-Screen widget; Gear Boost (RevenueCat, Build 14). Need EAS Build + store submit, not OTA.
- **Legal/clinical-gated** — Gear Terms Addendum, Emergency CPR video/review. Do not ship.
- **The Buzz go-live** — backend deployed, but set `users.is_clinical_reviewer=TRUE` for Felipe to clear the review queue first; mobile surface can OTA once reviewed.
- **Fix `STATE_OF_VILLIE.md`** — it's stale (says migrations at 100/103). Update it on `main` as part of §2 so the canonical doc matches reality.

---

*State verified against live hosted project + EAS/app config on 2026-07-29. See memory `project_deploy_state_2026_07`.*
