# Villie Boxes — Go-Live Checklist (ready-to-run)

**Created:** 2026-07-29 · **Owner:** Felipe · **Canonical detail:** `docs/OPS_RUNBOOK.md` §3.8

Boxes shipped **dark** in the 2026-07-29 OTA (`EXPO_PUBLIC_VILLIE_BOXES_ENABLED=0`) because its Stripe
config is incomplete. This is the exact remaining path to light it up. State below is **verified against
the live hosted project (`albyndcruwopulazvpjs`) on 2026-07-29** via read-only MCP — trust it over prose.

---

## A. Verified current state

| Item | State | Action |
|---|---|---|
| migration `092_villie_boxes_orders.sql` (order tables + RLS) | ✅ **applied** (all ≤105 applied) | none |
| `stripe-webhook` edge fn | ✅ **deployed** (v22, ACTIVE, `verify_jwt=false`) | none — but needs the secret (step 3) |
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

# --- 2. Deploy the missing payment-intent fn (stripe-webhook is already live) ---
#     Run from repo root. Uses the authenticated Supabase CLI (MCP token is read-only).
cd "/Users/gp/The Village App/village-app"
supabase functions deploy boxes-create-payment-intent
# (optional re-deploy to be safe:)  supabase functions deploy stripe-webhook

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

# --- 4. Add the client publishable key ---
#     Put pk_live_… (or pk_test_… for a staging pass) into BOTH:
#       apps/mobile/.env                 (local dev)
#       apps/mobile/.env.production      (the OTA bundle — created 2026-07-29)
#     Add the same key to the EAS build env too, so the NEXT native build embeds it:
#       cd apps/mobile && eas env:create --environment production \
#         --name EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY --value pk_live_… --visibility plaintext

# --- 5. Flip the flag ON and re-OTA (JS-only; runtime 1.0.0 reaches current builds) ---
cd "/Users/gp/The Village App/village-app/apps/mobile"
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
