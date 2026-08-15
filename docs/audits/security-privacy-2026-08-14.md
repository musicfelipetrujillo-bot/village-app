# Villie — Security & Privacy Review

**Date:** 2026-08-14
**Type:** Review, then remediation. The findings below were written from a read-only review; the fixes described in **Remediation log** were applied and deployed afterwards, in the same session.
**Scope:** Full app posture, with emphasis on the ~25 surfaces built since the last AppSec review (2026-07-07) — Milk Vault, Day Sheets, The Buzz, villie Pro / RevenueCat, Mom Tips, week nudges, Billy, events agent — plus verification that the previous audit's findings actually landed.
**Method:** Static review of 76 edge functions + 124 migrations, cross-checked against the **live hosted project** (edge-function `verify_jwt` flags, RLS policies, column grants, row counts, Supabase security advisors).

**Prior art:** `docs/audits/appsec-2026-07-07.md` · `docs/audits/privacy-minimization-2026-07-09.md`

---

## Remediation log (2026-08-14, commit `ef1205c`)

| Finding | Status |
|---|---|
| **C-1** `specialist-invite-create` forgeable admin auth | ✅ Fixed + deployed + re-tested in prod |
| **H-1** same gate in 5 more functions; `verify_jwt` unpinned | ✅ Gate centralised in `_shared/service-role.ts`; `verify_jwt` pinned per function in `supabase/config.toml` |
| **H-1(b)** `calendly-webhook` fix never deployed | ✅ Deployed |
| **M-1** invite claimed non-atomically | ✅ Single conditional `UPDATE`, released on failure |
| **M-2** client-supplied charge amount | ✅ Priced from `specialist_services` server-side |
| **M-3** undocumented RLS-no-policy tables | ⬜ Doc-only, open |
| **P-1** donor precise location | ⬜ Open — needs a migration |
| **P-2** retention policy | ⬜ Open — gated on counsel |

### ⚠️ What the fix taught us: there is more than one valid service-role key

The obvious fix — compare the bearer against `SUPABASE_SERVICE_ROLE_KEY` — **broke the gear-moderation crons**, and the way it broke is worth recording.

A regression test against the real GitHub Actions key returned `401`. Investigation showed the request *passed the gateway* (so the key is correctly signed by the project's JWT secret) and then failed the byte-equality check. Three distinct, all-validly-signed service-role keys are in circulation:

- the one injected into the **edge runtime** as `SUPABASE_SERVICE_ROLE_KEY`,
- the one in **GitHub Actions secrets** (used by every cron),
- the one in **`apps/mobile/.env`** (used by `pnpm specialist:invite`) — issued 2026-04-19.

This is consistent with a Supabase API-key rotation that kept the same signing secret: old keys stay signature-valid, but only one string matches the env var. **This is precisely why the original author abandoned strict equality** ("brittle to key rotation") — and then, instead of reconciling the keys, deleted authentication altogether.

So the gate is deliberately two-mode (see `_shared/service-role.ts`): exact key match always wins; a `service_role` *claim* is trusted **only** where the gateway has already verified the signature, and each caller must declare which regime it is in — checkable against `config.toml` in review.

**Honest characterisation of the result:** for the five `verify_jwt: true` functions this is close to the original design, but with the unstated assumption now explicit, enforced by a committed config, and verified live. The substantive fix is that `specialist-invite-create` no longer runs with `verify_jwt: false`, which is what made it exploitable.

**Follow-up for ops (not code):** reconcile the three keys — update `apps/mobile/.env` and the GitHub secret to the current key. Until then `admin-compliance-events` and `admin-approve-specialist`, which still use strict equality and were not touched, will reject the `.env` key.

### Production verification

| Probe | Result |
|---|---|
| Forged `service_role` JWT → all 6 functions | **401** (gateway) |
| Validly-signed `role=anon` JWT | **401 / 403** (rejected in code — mode 2 is not "accept anything the gateway allows") |
| Real GitHub Actions cron key → `gear-moderation-pager` | **200** `{"ok":true,"paged":0,"total_overdue":0}` |

---

## Summary

The security posture has genuinely improved since July. **The previous Critical (C-1, donor home addresses) is properly fixed** — verified in the live database, not just the diff. The newest surfaces are, on the whole, well built: the Day Sheet public page is token-gated with 122 bits of entropy and HTML-escapes everything; the RevenueCat webhook fails closed on a missing secret; the client bundle carries no privileged secrets.

A theme runs through what follows, and it matters more than any single bug: **the repository is not a reliable description of what is running.** The Calendly webhook fix has sat on `main` unshipped for five weeks while production runs the vulnerable version. `verify_jwt` is set by a CLI flag that exists in no file. `functions deploy` bundles the working tree rather than `HEAD`. Every finding below was therefore verified against the deployed artifact or the live database — and two of them would have been scored wrongly from source alone.

But one finding is worse than anything in the July report, and it is live right now.

**`specialist-invite-create` is publicly callable and its authentication can be forged with a text editor.** The function is deployed with `verify_jwt: false` (confirmed against the live API), and its only auth gate base64-decodes the caller's JWT and trusts a `role` field inside it *without ever checking the signature*. Anyone on the internet can paste `{"role":"service_role"}` into a fake token and be treated as an administrator. Chained with `specialist-invite-accept`, this lets an unauthenticated attacker create a **live, `admin_approved = true`, accepting-patients provider account in the maternal-health specialist directory** — with no human in the loop, because the invite *is* the trust signal and the invite gate is the thing that's broken.

The same forgeable auth pattern exists in five more functions. Those are currently protected — but only by a deploy-time flag that lives nowhere in the repo, so a routine redeploy can silently expose them.

On privacy, the top item from the July privacy audit is now a **live exposure rather than a theoretical one**: donor precise coordinates were readable-but-unpopulated in July (0 rows); today there are **4 active donor profiles** whose ~1cm-precision home coordinates and neighborhood any signed-in user can read with a single query.

**Findings:** Critical 1 · High 2 (one of them a five-week-old undeployed fix) · Medium 3 · Privacy 2 · Verified-fixed 1

---

## Verified fixed since 2026-07-07

Confirmed against the live database — not assumed from commit messages.

| Prior finding | Status | Evidence |
|---|---|---|
| **C-1** — donor home address + phone readable by any authenticated user | ✅ **FIXED** | Migration 096 dropped the columns. Live `information_schema` confirms `address_line` and `phone` no longer exist on `milk_donor_profiles`. |

### ⚠️ Not fixed in production: **H-1** (`calendly-webhook`)

The July fix is real, well-written, and **has never been deployed.** I pulled the deployed source from the live project; it is still:

```ts
function verifySignature(payload: string, sigHeader: string): boolean {
  if (!WEBHOOK_SECRET) return true; // Skip in local dev   ← fail OPEN
  const expected = createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return sigHeader === `sha256=${expected}`;
}
```

Whether this is currently exploitable depends on a value I cannot read: if `CALENDLY_WEBHOOK_SECRET` is set (project memory says it was, on 2026-07-09), the endpoint rejects unsigned posts and is **not** exploitable today. If that secret is ever cleared or rotated to empty, the endpoint immediately accepts any unsigned POST and performs service-role writes to `appointments` — including injecting attacker-controlled `telehealth_link` URLs that are later shown to users as a legitimate call link.

Note also that the deployed version implements the **wrong signature scheme** (`sha256=<hex>` over the body; Calendly actually sends `t=<ts>,v1=<hmac>` over `${t}.${body}`). So with the secret set, real Calendly webhooks would also be rejected. Calendly is not live yet, so this hasn't surfaced as a bug.

**Fix:** `supabase functions deploy calendly-webhook`. The correct code is already on `main`; this is purely a deploy gap.

**This is the same class of problem as H-1 below** — the repo says one thing and production runs another, with nothing reconciling them. It is why every finding in this review was checked against the deployed artifact rather than the source tree.

---

## Critical

### C-1 — `specialist-invite-create`: forgeable admin auth → unauthenticated attacker self-onboards an approved specialist

> ## ✅ FIXED AND DEPLOYED — 2026-08-14 (v23)
>
> The gate now does a constant-time comparison against `SUPABASE_SERVICE_ROLE_KEY` and fails closed on a missing secret; the function was redeployed **without** `--no-verify-jwt` (live `verify_jwt: true`, confirmed via the Management API).
>
> **Verified against production by firing the actual exploit:**
>
> | Probe | Before | After |
> |---|---|---|
> | Forged `service_role` JWT (`x.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.x`) | working invite token returned | **401** `UNAUTHORIZED_INVALID_JWT_FORMAT` |
> | No auth header | 403 | **401** `UNAUTHORIZED_NO_AUTH_HEADER` |
> | Valid, correctly-signed JWT with `role=anon` | 403 | **403** `Forbidden` |
>
> The third probe matters most: it is signature-valid, so it passes the gateway and is rejected by the *in-code* check. Both layers are independently doing work.
>
> **Exposure audit — no evidence of exploitation.** All 7 `specialist_invites` rows are the founder's own address or labelled smoke tests, the newest dated 2026-05-24, and only one was ever redeemed (his own `+keyrotation` test). All 11 `specialists` rows are accounted for: 6 seeded 2026-04-27 (predating the vulnerable window), the founder's own test, and 4 Care-vertical extra-hands rows from 2026-07-11.
>
> **Still outstanding:** rotate the service-role key as assume-breach hygiene (dashboard action — requires updating the key in Supabase secrets, GitHub Actions, and `apps/mobile/.env`). Given the clean audit above this is precautionary, not urgent.

* **Severity:** Critical
* **Category:** `authentication_bypass` / `privilege_escalation`
* **Confidence:** Very high — **verified against the deployed artifact.** Both the `verify_jwt: false` flag and the vulnerable gate below were read back from the live function source via the Management API, so this is not a source-tree inference. Resend is wired (`RESEND_API_KEY` path active), and the response body returns the usable invite token.
* **Where:** `supabase/functions/specialist-invite-create/index.ts:284-299` (gate), `:305` (enforcement) → chains into `supabase/functions/specialist-invite-accept/index.ts:165-190`

**What's wrong.** The function's only authentication is:

```ts
function isServiceRoleRequest(req: Request): boolean {
  const token = auth.match(/^Bearer\s+(.+)$/i)[1].trim();
  const payload = JSON.parse(atob(padded));   // ← decode only
  return payload?.role === 'service_role';    // ← never verifies the signature
}
```

The in-code comment argues this is safe:

> `verify_jwt:false` means the platform doesn't validate the JWT signature, but that's OK — anyone with a service_role-claim JWT **signed by the project's JWT secret** can already do anything, and they wouldn't have gotten such a JWT without service-role access.

That reasoning assumes something is checking the signature. **Nothing is.** The gateway isn't (`verify_jwt: false`, confirmed live) and the function isn't (it only calls `atob`). A JWT is just three base64 segments joined by dots; the signature segment is never read, so it can be any garbage.

**Exploit.** No account, no key, no prior access:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.anything
POST https://<project-ref>.supabase.co/functions/v1/specialist-invite-create
{"email":"attacker@example.com","full_name":"Dr. Jane Doe","specialty":"ob_gyn"}
```

The response returns the invite URL. Then `specialist-invite-accept` (also `verify_jwt: false` — by design, the token *is* the auth) is called with that token, and at `:165-190` it creates an `auth.users` row and inserts a `specialists` row with:

```ts
admin_approved:     true,
admin_approved_at:  new Date().toISOString(),
accepting_patients: true,
```

**Impact.**
1. **A stranger appears in the provider directory as an approved, bookable maternal-health specialist.** The comment at that insert — *"the invite is the trust signal, so we go live on completion"* — is the whole safety model, and this bypass mints the trust signal. Mothers book appointments with, and message, whoever this is. (`npi_verified` stays `false`, so there is no NPI badge — that is the only thing limiting it.)
2. **Unlimited Villie-branded email to arbitrary addresses** via the Resend integration, from Villie's own sending domain, each carrying a genuine working invite link. That is a turnkey phishing capability against Villie's reputation and domain deliverability.
3. Unbounded writes to `specialist_invites`.

**Fix.** Two changes, both small:

1. Replace the decode-and-trust gate with a direct constant-time comparison against the actual key — the pattern `admin-compliance-events:94` and `admin-approve-specialist:27` already use:
   ```ts
   const ok = timingSafeEqualStr(token, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
   ```
   The comment says strict equality was abandoned because it was "brittle to key rotation + whitespace." `.trim()` on both sides solves whitespace; key rotation is a deliberate ops event, not a reason to stop authenticating.
2. Redeploy **without** `--no-verify-jwt` so the platform validates signatures as defence in depth.

Then rotate the service-role key and audit `specialist_invites` + `specialists` for rows you did not create.

---

## High

### H-1 — The same forgeable pattern in five more functions, held shut only by an undocumented deploy flag

* **Severity:** High (currently not exploitable; one deploy from Critical)
* **Category:** `authentication_bypass`
* **Where:** `gear-moderation-pager:71` · `gear-moderation-auto-withdraw:28` · `gear-moderation-daily-digest:287` · `gear-takedown-template-dispatch:135` · `villie-weekly-digest:62`

All five use the identical `isServiceRoleRequest()` decode-and-trust gate. All five are currently deployed with `verify_jwt: true`, which means the gateway rejects a forged signature before the function runs — so **they are not exploitable today**, and each file's comment correctly notes it is relying on the gateway.

The problem is what that reliance rests on:

* **There is no `supabase/config.toml` in this repo.** `verify_jwt` is set per-deploy by CLI flag. It is invisible to code review, absent from version control, and not asserted by any test.
* **`--no-verify-jwt` is an established habit here** — it is documented as the norm for `manual-og`, `gear-moderation-*`, `specialist-invite-create`, `trending-ingest`, `resend-webhook`, and `revenuecat-webhook`. One plan doc explicitly recommends it for a new function by pointing at `gear-moderation-*` as precedent.
* C-1 above is exactly this failure mode having already happened once.

So a single redeploy with a copy-pasted flag turns any of these five into C-1: forged-admin access to withdraw arbitrary gear listings, page moderators, and send branded takedown/digest email to arbitrary addresses.

**Fix.**
1. Commit a `supabase/config.toml` pinning `verify_jwt = true` for every function that is not intentionally public, and `false` only for the six that genuinely are (webhooks + `manual-og` + `day-sheet-page` + the invite pages). This puts the setting under review and makes drift a diff.
2. Replace all six `isServiceRoleRequest()` implementations with the constant-time key comparison. Signature-verifying gateway *and* in-code secret check — neither alone.

---

## Medium

### M-1 — `specialist-invite-accept` still claims the invite non-atomically (token replay)

* **Category:** `race_condition` · **Where:** `specialist-invite-accept/index.ts:118-129` (validate) → `:223` (mark used)
* Reported as **H-3** on 2026-07-07; **not fixed.** The invite is validated with a `SELECT ... used_at IS NULL`, then all the work happens (`auth.admin.createUser`, `specialists` insert), and only at `:223` is `used_at` set — and that update is non-fatal, so a failure there leaves a live, reusable invite.
* Concurrent requests with one token can both pass the initial check. Only an email collision inside `createUser` reliably stops the second, and that ordering isn't guaranteed.
* **Fix** (unchanged from July): claim atomically *before* doing any work —
  ```sql
  UPDATE specialist_invites SET used_at = now()
  WHERE token = $1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at > now()
  RETURNING id;
  ```
  Proceed only if a row came back; otherwise 409. This also materially reduces C-1's blast radius.

### M-2 — `create-payment-intent` still trusts the client-supplied charge amount

* **Category:** `business_logic` · **Where:** `create-payment-intent/index.ts:46-53, 62-79`
* Reported as **F-M1** in July; **not fixed.** `amount_cents` comes from the request body and is validated only as `>= 50`; the specialist's real price is never looked up server-side.
* This is the one live Stripe flow. `boxes-create-payment-intent` already does this correctly — it recomputes every cent from a catalog. Port that approach.

### M-3 — Undocumented RLS-without-policy tables

* **Category:** `hardening` · Advisor: `rls_enabled_no_policy`
* `pro_subscription_events`, `pro_launch_targets`, and `push_sends` have RLS enabled with no policies — which correctly denies all client access (service-role only). This is the same intentional pattern as `events_partner_feeds` and `specialist_invites`.
* The issue is only that they are **not** in CLAUDE.md's "accepted advisor warnings" register, unlike their two siblings. Add them, so the next reviewer doesn't have to re-derive that they're deliberate — and so a genuinely-missing policy stands out.

---

## Privacy

### P-1 — Donor precise home coordinates are now genuinely exposed (was theoretical in July)

* **Severity:** High (privacy / physical safety)
* **Where:** `milk_donor_profiles.lat` / `lng` / `neighborhood`, policy `milk_donor_profiles_select_active`

This is **QW-1**, the top finding of the 2026-07-09 privacy audit. It is still open, and its status has materially changed. Verified live:

```
policy milk_donor_profiles_select_active → TO authenticated USING (is_active = true)
has_column_privilege(authenticated, lat|neighborhood, SELECT) → true
count(active donor rows) → 4
```

In July this was a real access-control hole with **zero rows behind it** — nothing was actually exposed. **There are now 4 active donor profiles.** Any signed-in user can run one query and get every active donor's `lat`/`lng` (schema is `DECIMAL(10,7)` — roughly centimetre precision) plus `neighborhood` and `social_links`.

The population is new mothers, and the product's purpose is to arrange an in-person handoff at that location. Precise home coordinates plus real-world social identity, broadcast to any stranger who can create an account, is a physical-safety exposure, not just a data-minimisation one. The volume is small enough that this is cheap to fix now and gets more expensive with every donor who signs up.

**Fix** (per the privacy audit's proposed migration 099): return ZIP/neighborhood-centroid coordinates rounded to 2–3 decimals on the public read; keep precise `lat`/`lng` owner- and service-role-only for the `search_donors_near` distance math, which already runs server-side. Migration 117 (`zip_centroids`) appears to have landed the centroid data this needs.

### P-2 — Still no retention or deletion policy anywhere (systemic)

* Unchanged from the July privacy audit, and it remains the biggest structural gap. `account-delete` sets `deleted_at` and nothing else; the cascade is attorney-gated and unbuilt.
* Accumulating indefinitely with no TTL: `daily_checkins` (mood scores + free-text health narrative + AI reply), `crisis_flags`, `ai_conversations`, baby tracker logs and notes, `milk_/gear_legal_acceptances` (IP address + user-agent), `*_analytics_events`, `home_feed_cache` (has `expires_at`, no purge job).
* This is mental-health and infant-health data. The blocker is a legal decision (what is row-deleted vs. PII-scrubbed vs. retained), not an engineering one — which is why it keeps not moving. **`home_feed_cache` needs no sign-off at all**: it already has `expires_at` and just needs a cron delete. Worth landing that now as a down payment.

---

## Reviewed and clean

Notable good work, verified rather than assumed:

* **Day Sheets** (`day-sheet-page`, migration 102) — the newest public surface, and it's well built. `share_token` is a stripped UUIDv4 (122 bits — unguessable), revocable (`revoked_at` → 410), expiry-aware, read via service role against an owner-RLS'd table, every interpolated value passed through `esc()`, `noindex, nofollow`, `cache-control: no-store`. This is how a public token surface should look.
* **`revenuecat-webhook`** (new, in the current branch) — fails closed on an empty secret, validates `app_user_id` against a UUID regex before use, idempotent via a `UNIQUE` event id, and deliberately returns 200 on unknown users to avoid an unwinnable retry loop. The `TRANSFER`-event handling that revokes the losing account is a genuinely subtle entitlement bug caught and fixed.
* **Webhook signature verification generally** — `resend-webhook` (full Svix HMAC, constant-time, 5-min replay guard), `perks-redemption-webhook` (per-network HMAC / IP allowlist), `stripe-webhook` (`constructEventAsync` over the raw body, fails closed) are all model implementations.
* **Client bundle** — swept every `EXPO_PUBLIC_*` reference in `apps/mobile/src`. All 22 are public-by-design (Supabase anon key, Stripe *publishable* key, RevenueCat public SDK key, Sentry DSN, OneSignal app id, Google client ids, feature flags). **No service-role key, no Anthropic key, no Stripe secret key reaches the client.**
* **Crisis / anonymity tables** — `crisis_flags` and `user_anonymous_identities` remain `USING(FALSE)`, so the de-anonymisation key and the mental-health flags are unreadable by any client path regardless of session. Correct, and worth keeping that way.

---

## Recommended sequence

| # | Action | Effort | Why now |
|---|---|---|---|
| 1 | Fix the `specialist-invite-create` auth gate + redeploy with `verify_jwt` on | ~30 min | Live, unauthenticated, no prerequisites to exploit |
| 2 | Rotate the service-role key; audit `specialist_invites` + `specialists` for unexpected rows | ~30 min | Assume-breach hygiene after #1 |
| 2b | `supabase functions deploy calendly-webhook` | ~2 min | The fix has existed since July and was never shipped |
| 3 | Commit `supabase/config.toml` pinning `verify_jwt` per function | ~1 hr | Stops the next C-1 from being one flag away |
| 4 | Replace the remaining five `isServiceRoleRequest()` gates | ~1 hr | Removes the pattern rather than the instance |
| 5 | Coarsen the public donor location read (P-1) | ~half day | 4 real donors exposed today; cost grows with signups |
| 6 | Atomic invite claim (M-1) + server-side price recompute (M-2) | ~half day | Both carried over from July |
| 7 | `home_feed_cache` purge cron; then the attorney retention decision (P-2) | ~1 hr / then legal | The one piece of P-2 needing no sign-off |

**Not reviewed:** runtime/DAST against the live API; mobile client-side beyond the secret surface (deep-link handling, secure storage, cert pinning); third-party dependency CVEs; Storage object-level policies; the AI safety/crisis-routing logic (a clinical review domain, not an appsec one).

*The findings above are code- and config-level. Nothing in this review is a legal opinion; P-2 in particular is gated on counsel, not engineering.*
