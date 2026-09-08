# Supabase API Key Migration — legacy `anon`/`service_role` → publishable/secret

**Created:** 2026-09-08 · **Owner:** Felipe · **Prior art:** `docs/audits/security-2026-09-04.md` (open item 1)

Supabase is **deprecating the legacy `anon` and `service_role` keys at the end of 2026**. This
project is already half-migrated — the new keys exist and JWT signing keys were moved to ES256
five months ago — but no code uses them yet. This is the path from here to switched-over.

> **Why this doc exists rather than "rotate the key."** The 2026-09-04 audit's open item 1 says
> "rotate the service_role key in the dashboard." **There is no rotate button.** Verified in the
> dashboard on 2026-09-08: the Legacy tab offers only Reveal, Copy, and *Disable JWT-based API
> keys*. Supabase's answer to "rotate" is this migration. That is the whole reason item 1 sat open.

---

## A. Verified current state (2026-09-08)

| Item | State |
|---|---|
| JWT signing key | ✅ **ES256 / ECC (P-256)**, `777547FA-…`. Confirmed independently against the project's public JWKS endpoint. |
| Previous signing key | `6E89E971-…` **Legacy HS256 (shared secret)**, rotated ~5 months ago, retained to verify unexpired tokens |
| `sb_publishable_…` key | ✅ exists, named `default` |
| `sb_secret_…` key | ✅ exists, named `default` |
| Legacy `anon` / `service_role` | ✅ still active — **everything in production uses these** |
| Sessions | Signed by the **ES256** key, *not* the legacy secret |

**The consequence of that last row:** user sessions do **not** depend on the legacy keys, so
migrating them does **not** sign anyone out. That was the main fear and it does not apply here.

### A2. Step 0 result (2026-09-08) — the edge runtime is ALREADY on the new keys

Measured in the deployed runtime with a throwaway gated function reporting variable *names* and
*shapes* only (never values), then deleted:

| Variable | Present | Shape | Finding |
|---|---|---|---|
| `SUPABASE_SECRET_KEYS` | ✅ | json-dict, keys `["default"]` | new dict is injected |
| `SUPABASE_PUBLISHABLE_KEYS` | ✅ | json-dict, keys `["default"]` | new dict is injected |
| `SUPABASE_SECRET_KEY` / `SUPABASE_PUBLISHABLE_KEY` | ❌ | — | local-CLI only, as documented |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | string, **len 41, prefix `sb_`** | 🔴 **this is the NEW secret key** |
| `SUPABASE_ANON_KEY` | ✅ | string, **len 46, prefix `sb_`** | 🔴 **this is the NEW publishable key** |

**This contradicts the official docs**, which state the legacy variables "still exist in the runtime,
but they carry the legacy keys." In this project they do not — Supabase has aliased both legacy
variable names to the new keys. For comparison, the real legacy values are 219 chars (`service_role`)
and 208 chars (`anon`), both prefixed `eyJ`.

**So all 64 edge functions are already using the new keys.** The 76-call-site rewrite scoped in §D is
**not needed**. Verified rather than inferred, which is the only reason it was caught: the plan would
otherwise have rewritten 76 call sites to achieve nothing.

### A3. What this means for the service-role gate

`_shared/service-role.ts` compares the bearer against `SUPABASE_SERVICE_ROLE_KEY` — now the *new*
`sb_secret_…`. GitHub Actions crons still send the **legacy** `service_role` JWT, so that exact-match
branch **never matches for them**; they are admitted by the second branch, the verified
`service_role` claim. Confirmed live: calling the diagnostic with the legacy key returned 200.

This finally explains the note in `_shared/service-role.ts` about "MORE THAN ONE valid service-role
key in circulation… not byte-identical." It was never two rotations. It is the legacy JWT in CI
versus the new `sb_secret_` injected into the runtime. **The two-mode gate is currently the only
reason the nightly crons authenticate at all.**

## B. Variable reference (⚠️ see §A2 — the legacy names are aliased to new keys HERE)

| Variable | Type | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | plain string | legacy. **Still injected and still returns the legacy key** |
| `SUPABASE_ANON_KEY` | plain string | legacy, same |
| `SUPABASE_SECRET_KEYS` | **JSON dict keyed by key name** | new, hosted |
| `SUPABASE_PUBLISHABLE_KEYS` | **JSON dict keyed by key name** | new, hosted |
| `SUPABASE_SECRET_KEY` / `SUPABASE_PUBLISHABLE_KEY` | plain string | new, **local CLI only** |

The table above is what the docs promise. **§A2 measured something different in this project** —
both legacy variable names return the new `sb_` keys. Trust §A2 over this table and over the docs;
re-measure before relying on either.

## C. What actually still uses the legacy keys

After §A2, the edge functions are **out of scope**. What remains:

| Consumer | Legacy key it uses | Breaks on "Disable"? |
|---|---|---|
| Mobile app — `.env`, `.env.production`, EAS env | legacy `anon` (`eyJ…`, 208) | 🔴 yes — every shipped build |
| `village-website` `m/index.html` (**hardcoded**) | legacy `anon` | 🔴 yes — all video share links |
| `village-website` `onboard/index.html` | legacy `anon` | 🔴 yes — specialist onboarding |
| GitHub Actions secret `SUPABASE_SERVICE_ROLE_KEY` | legacy `service_role` (`eyJ…`, 219) | 🔴 yes — every nightly cron |
| `supabase/.env.local` (local admin scripts) | legacy `service_role` | 🟡 yes, but local-only |
| **Edge functions (all 64)** | — already on `sb_` keys | ✅ **no** |

## E. Design

### E1. No shared helper is needed
The `_shared/keys.ts` fallback-chain design in the original scope solved a problem that does not
exist here: the runtime already hands the new keys to the existing variable names.

### E2. Optional hardening — read the dictionary explicitly
Relying on the aliasing found in §A2 means depending on **undocumented behaviour that contradicts
Supabase's own docs**. If Supabase "corrects" it to match the documentation, `SUPABASE_SERVICE_ROLE_KEY`
reverts to the legacy value — and *after* step 3 that key is disabled, so every function fails closed
at once. Reading `SUPABASE_SECRET_KEYS['default']` with a fallback to the legacy variable is immune to
the change in both directions. Recommended, not required, and safe to do at any time.

## F. Ordered steps

- [x] **0. Verify the runtime.** ✅ Done 2026-09-08 — see §A2. Result cancelled the largest work item.
- [~] **1. Server-side callers → the `sb_secret_…` key.** ⏳ **local half DONE 2026-09-08**;
      GitHub Actions secret still outstanding (founder — see §F1).
- [~] **2. Clients → the `sb_publishable_…` key.** ⏳ **all code done 2026-09-08**; website deploy
      + OTA outstanding (founder — see §F2).
- [ ] **3. Dashboard → Settings → API Keys → Legacy tab → "Disable JWT-based API keys".** Reversible.
- [ ] **4. Optional:** §E2 hardening.

> **Order matters.** Step 3 before steps 1–2 takes down the app, the website and every cron at once.

### F1. Step 1 results (2026-09-08)

**Done:** `supabase/.env.local`'s `SUPABASE_SERVICE_ROLE_KEY` now holds the **`sb_secret_default`**
key (41 chars) instead of the legacy JWT (219 chars). The local admin scripts read it from there and
both resolve.

**Outstanding (founder):** the GitHub Actions repo secret `SUPABASE_SERVICE_ROLE_KEY` still holds the
legacy JWT. Settings → Secrets and variables → Actions. Until then the crons authenticate via the
gate's *claim* branch (§A3), which stops working at step 3.

**Verified BEFORE switching — the question that could have killed every cron:**

The crons send `Authorization: Bearer <key>` with **no `apikey` header**, against functions pinned
`verify_jwt = true`. An `sb_secret_` key is **not a JWT**, so it was genuinely unclear whether the
gateway would accept it. It does:

| Test | New `sb_secret_` | Legacy JWT | Anon |
|---|---|---|---|
| `twilio-sms` + empty body | **400** `to and body required` | 400 | 401 |
| `GET /rest/v1/users?limit=1` | **200, 1 row** | 200, 1 row | 200, **0 rows** |

A **400** is the validation error at `twilio-sms:48`, reached only *after* the gate at line 38 — so
the key authenticated, cleared the service-role gate, and no SMS was sent. The `users` read proves
full RLS bypass, which anon correctly does not get. Both properties the crons and admin scripts need.

The 7-function anon smoke test still returns 401 across the board after the swap.

### F2. Step 2 results (2026-09-08)

Publishable key: `sb_publishable_zBiBB7U-7BGuAcfMfivMcQ_IRuYo4yj` (46 chars). Public by design —
Supabase labels it "safe to share publicly" — so it is written here deliberately.

| Location | Before | After |
|---|---|---|
| `apps/mobile/.env` (local dev, gitignored) | legacy `eyJ…` 208 | ✅ changed |
| `apps/mobile/.env.production` (OTA bundle) | — | ✅ **already publishable** |
| `apps/mobile/eas.json` → `production` profile | — | ✅ **already publishable** |
| `apps/mobile/eas.json` → `preview` profile | — | ✅ local CLI key, `127.0.0.1:54321`, correct as-is |
| `village-website/m/index.html` (hardcoded) | legacy | ✅ changed, **uncommitted** |
| `village-website/onboard/index.html` (hardcoded) | legacy | ✅ changed, **uncommitted** |
| GitHub secret `SUPABASE_ANON_KEY` | updated 18:28Z by someone else | ✅ valid — probe green |

**Verified against production with the publishable key, not assumed:**

- `rpc/get_manual_video_share_meta` (the exact call `m/index.html` makes) → **200, 1 row**, same as legacy
- `functions/v1/specialist-invite-accept` (the call `onboard/index.html` makes) → **400 `token is required`**, i.e. past the gateway and into validation, not 401
- `GET /rest/v1/users?limit=1` → **200, 0 rows** — RLS still blocks it, exactly like the legacy anon key
- `auth/v1/settings` → **200** — accepted as a client key
- `prod-smoke-probe` workflow → **success**; its exit code 2 is reserved for "key not valid", so a pass proves the CI anon secret is good

**✅ Website DEPLOYED 2026-09-08** (`village-website` e2e9384, live on Vercel). Verified live:

- `/m/?v=…` and `/onboard/` both serve the publishable key; **zero** legacy literals remain
- OG share path still healthy — **200 `text/html`**, 4 `og:` tags
- The six security headers from `a64cfd7` are intact on the final 200. (They are absent from the
  apex response only because `villieapp.com` 307-redirects to `www.villieapp.com` and Vercel does
  not apply header rules to redirects — checked, not a regression.)

Committed **key lines only**: both files also carried an unrelated, unfinished font/typography sweep
(part of a change across 8 files). Since this repo auto-deploys from `main`, committing them together
would have shipped someone else's in-progress design work. The sweep remains uncommitted.

**Outstanding (founder):** **OTA the mobile app** so existing installs carry the publishable key.
`.env.production` already held it, so whether the *currently live* bundle does depends on when the
last OTA was cut — publish one to be certain before step 3.

### F3. Unrelated finding — per-video OG cards are generic

`m/index.html` fetches video metadata client-side, and crawlers do not run JS, so every shared video
link renders the **same** static card ("villie · The Manual" / "Short videos for tired parents").
The `manual-og` edge function exists to serve per-video OG HTML, but Supabase forces `text/plain` +
`nosniff` on its responses (confirmed 2026-09-08; `day-sheet-page` behaves identically and predates
any change), so crawlers will not parse it. Pre-existing, unrelated to this migration, and worth its
own look — per-video share cards currently do not work by either route.

## G. Rollback

Step 3 is **reversible** — legacy keys can be re-activated from the same screen if a client was
missed, which is the recovery path if something was overlooked. Steps 1–2 are ordinary config/code
changes: put the old value back. Both key types work simultaneously, so a partial migration is a
valid resting state and this can be paused at any step.

## H. Verification (after each step)

```bash
cd "/Users/gp/Villie App/village-app" && for fn in twilio-sms push-notify geocode-zip daycares-nearby home-feed-curator events-harvest ai-translate; do printf "%-22s %s\n" "$fn" "$(curl -s -o /dev/null -w '%{http_code}' -X POST "https://albyndcruwopulazvpjs.supabase.co/functions/v1/$fn" -H "Content-Type: application/json" -d '{}')"; done
```

All seven must return **401**. Also fetch `https://villieapp.com/m/?v=<a real video id>` with a
crawler UA and confirm **200 `text/html`** with `og:` tags, and trigger one GH Actions cron manually.

## I. References

- [API keys](https://supabase.com/docs/guides/api/api-keys)
- [Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Edge Function environment variables](https://supabase.com/docs/guides/functions/secrets)
- [supabase#37648 — edge env vars not refreshed after migration](https://github.com/supabase/supabase/issues/37648)
