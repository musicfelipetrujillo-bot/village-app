# Villie Boxes — Go-Live Checklist (ready-to-run)

**Created:** 2026-07-29 · **Owner:** Felipe · **Canonical detail:** `docs/OPS_RUNBOOK.md` §3.8

Boxes shipped **dark** in the 2026-07-29 OTA (`EXPO_PUBLIC_VILLIE_BOXES_ENABLED=0`) because its Stripe
config is incomplete. This is the exact remaining path to light it up. State below is **verified against
the live hosted project (`albyndcruwopulazvpjs`) on 2026-07-29** via read-only MCP — trust it over prose.

> 🔴 **2026-09-08 correction — `stripe-webhook` is a STUB in production.** Table A below said
> "✅ deployed … action: none". It *is* deployed and ACTIVE, but the deployed build is `v22` from
> **2026-04-27**, which predates commit `4527820` — the commit that replaced
> `Deno.serve(() => new Response('TODO', { status: 501 }))` with the real 130-line Boxes order
> handler. So the live function is still the placeholder. **Verified by running this checklist's own
> step-3b smoke test against prod on 2026-09-08: it returned `HTTP 501` with body `TODO`, not the
> documented `400`.** Nothing in the Boxes order lifecycle is being reconciled server-side today, and
> nothing ever has been. Step 2 is corrected below: redeploying `stripe-webhook` is **required**, not
> optional. Row corrected in place.
>
> It was deliberately left undeployed during the 2026-09-08 dependency-pin pass, because shipping it
> is a Boxes launch decision — not a supply-chain change — and it belongs to this checklist.

---

## A. Verified current state

| Item | State | Action |
|---|---|---|
| migration `092_villie_boxes_orders.sql` (order tables + RLS) | ✅ **applied** (all ≤105 applied) | none |
| `stripe-webhook` edge fn | ⚠️ **deployed but is the `501 TODO` STUB** (v22 from 2026-04-27, ACTIVE, `verify_jwt=false`) — re-verified 2026-09-08 | **redeploy it** (step 2), then set the secret (step 3) |
| `boxes-create-payment-intent` edge fn | ❌ **NOT deployed** (source in repo only) | **deploy it** (step 2) |
| `STRIPE_SECRET_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (Supabase Edge secrets) | ❓ can't read via MCP — set for V1 booking per §3.8 | confirm present |
| `STRIPE_WEBHOOK_SECRET` (Supabase Edge secret) | ❌ not confirmed set | **set it** (step 3) |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` (client) | ❌ **absent** from `apps/mobile/.env` + `.env.production` + EAS env | **add it** (step 4) |
| `EXPO_PUBLIC_VILLIE_BOXES_ENABLED` | `0` (dark) in `.env.production` | flip to `1` at OTA time (step 5) |

## B. Non-ops gates that must clear BEFORE real customers (from memory `project_villie_boxes.md`)

These are **product/legal**, not deploy steps — do not sell to real users until they're closed:
- [ ] **Real retail prices + product photos** — catalog tiles are currently gradient swatches with placeholder prices. Update `apps/mobile/src/api/boxes.ts` `CATALOG` **and** the mirrored `CATALOG` in `supabase/functions/boxes-create-payment-intent/index.ts` (keep them in sync).
- [ ] **FL sales-tax** obligation on physical goods (shipping/tax are $0 at launch, baked into pricing — confirm that's acceptable).
- [ ] **Risk & Compliance review pass** — first first-party physical-goods sale; not covered by the existing Risk doc.

---

## C. Ordered runbook (all commands from `apps/mobile` unless noted)

```bash
# --- 1. Order tables: already applied (092). Nothing to do. ---

# --- 2. Deploy BOTH functions. Neither is live today. ---
#     Run from repo root. Uses the authenticated Supabase CLI (MCP token is read-only).
#     stripe-webhook is NOT optional: what is deployed is the 501 TODO stub (see the
#     2026-09-08 correction at the top). Without this the whole order lifecycle is a no-op.
cd "/Users/gp/Villie App/village-app"
supabase functions deploy boxes-create-payment-intent stripe-webhook

# --- 3. Secrets (Supabase Dashboard → Edge Functions → Manage Secrets) ---
#     Confirm STRIPE_SECRET_KEY + SUPABASE_SERVICE_ROLE_KEY exist (V1 booking already uses them).
#     Then register the webhook + set its signing secret:
#       Stripe → Developers → Webhooks → Add endpoint
#       URL:    https://albyndcruwopulazvpjs.supabase.co/functions/v1/stripe-webhook
#       Events: payment_intent.succeeded, payment_intent.payment_failed, charge.refunded
#       Copy the endpoint Signing secret (whsec_…) → Supabase secret STRIPE_WEBHOOK_SECRET

# --- 3b. Smoke-test the webhook is wired (before trusting a real order) ---
curl -i -X POST \
  "https://albyndcruwopulazvpjs.supabase.co/functions/v1/stripe-webhook" \
  -H 'Content-Type: application/json' \
  -d '{"type":"payment_intent.succeeded","data":{"object":{}}}'
# Expect HTTP 400 "Missing signature or secret" — a 400 here is GOOD (fn live, rejecting unsigned).
#   HTTP 501 body "TODO"  → you are still on the stub. Step 2 did not run, or did not take. Redeploy.
#   HTTP 401              → verify_jwt got flipped on; Stripe cannot send a JWT, so this must stay false.

# --- 4. Add the client publishable key ---
#     Put pk_live_… (or pk_test_… for a staging pass) into BOTH:
#       apps/mobile/.env                 (local dev)
#       apps/mobile/.env.production      (the OTA bundle — created 2026-07-29)
#     Add the same key to the EAS build env too, so the NEXT native build embeds it:
#       cd apps/mobile && eas env:create --environment production \
#         --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_… --visibility plaintext

# --- 5. Flip the flag ON and re-OTA (JS-only; runtime 1.0.0 reaches current builds) ---
cd "/Users/gp/Villie App/village-app/apps/mobile"
#   edit .env.production: EXPO_PUBLIC_VILLIE_BOXES_ENABLED=1
NODE_ENV=production \
EXPO_PUBLIC_APP_ENV=production \
EXPO_PUBLIC_INTERNAL_AGENTS_ENABLED=0 \
EXPO_PUBLIC_VILLIE_BOXES_ENABLED=1 \
EXPO_PUBLIC_MANUAL_VIDEO_ORIGIN=https://villieapp.com \
npx eas-cli update --channel production --message "Enable Villie Boxes (Stripe checkout live)" --non-interactive

# --- 6. Verify (test mode) ---
#     Checkout in-app with Stripe test card 4242 4242 4242 4242 →
#     Stripe Dashboard → Webhooks shows payment_intent.succeeded delivery = 200 →
#     Supabase villie_box_orders row flips pending_payment → paid → "My orders" shows Paid pill.
```

## D. Rollback
If anything misbehaves, re-hide Boxes with a one-line OTA: set `EXPO_PUBLIC_VILLIE_BOXES_ENABLED=0`
and re-run step 5, or `eas update:rollback`. Reversible, no store review.
