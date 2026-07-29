# Billy Wave 1 — Deploy & Eval Checklist (for Felipe)

Branch: `feat/billy-capability-coverage`. This lights up Billy's first write tool
(`log_baby_event`) + the generic `navigate` route-to tool. Everything is code-complete;
this is deploy + verify. ~10 min.

## 0. Preconditions
- On branch `feat/billy-capability-coverage` (or after it merges to your working branch).
- Edge secrets already set (unchanged from the last app-help-chat deploy): `ANTHROPIC_API_KEY`,
  `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_MAPS_API_KEY`.
- No migration needed — the write tool reuses existing `baby_*_logs` tables.

## 1. Deploy (this is the edge code's FIRST real compile — deno isn't installed locally)
```bash
cd "village-app"
supabase functions deploy app-help-chat
```
Watch the output. If it fails to bundle, it's almost certainly a Deno/TS issue in one of
`supabase/functions/app-help-chat/tools/*.ts` — paste the error back and it gets fixed fast.
A clean deploy = the registry refactor + both new tools compiled.

## 2. Run the 9 Wave-1 evals (in the in-app Villie chat, signed in as a test mom)
A test account with a **baby profile set up** is required for the three log evals (the tool
returns `no_baby_profile` otherwise — which is itself correct behavior, just not the pass case).

**Do-it writes — Billy performs it and confirms:**
1. `E-start-sleep` — type: *"Start a nap timer, she just went down."*
   PASS = he confirms a nap/sleep timer started. Check a new `baby_sleep_logs` row exists with `source='note'`, `ended_at` null.
2. `E-log-bottle` — *"Log a 4 oz bottle."*
   PASS = confirms the bottle feed. Check `baby_feed_logs` row, `method='bottle'`, `amount_oz=4`, `source='note'`.
3. `E-log-diaper` — *"Log a wet diaper."*
   PASS = confirms the diaper. Check `baby_diaper_logs` row, `kind='wet'`, `source='note'`.
   → Then ask *"how were his naps / feeds today?"* — the read tool should now reflect what you just logged.

**Route-to — Billy deep-links, does NOT perform it himself:**
4. `E-book-appointment` — *"Book me a lactation appointment for Tuesday."* → app routes to the Booking screen; he says she'll confirm there.
5. `E-create-gear-listing` — *"List my old bouncer for $30."* → routes to the gear create-listing screen.
6. `E-buy-box` — *"Buy the newborn essentials Villie Box."* → routes to the Boxes hub; he says she'll confirm payment there.
7. `E-gear-boost` — *"Boost my stroller listing to the top."* → routes to My Listings (pick + boost).
8. `E-create-donor-profile` — *"Sign me up as a milk donor."* → routes to the become-a-donor flow.
9. `E-update-donor-profile` — *"Update my donor profile pickup city."* → routes to the donor profile edit screen.

For 4–9, the PASS condition is: he replies "taking you there…"-style AND the app actually
navigates to the named screen. If it replies correctly but doesn't navigate, the `NAV_ROUTES`
screen name is wrong for that route — note which one and it's a one-line fix.

## 3. Record results
For each eval that passes, in `docs/BILLY_EVALS.md` change `- [ ]` → `- [x]`, and in
`docs/BILLY_CAPABILITY_MAP.md` change that row's `wired?` from `code` → `yes`.
Anything that fails: leave it `code`, jot the symptom, send it back.

## 4. On all-green
Wave 1 is live. That unblocks **Track B** of the Wave 2 plan
(`docs/superpowers/plans/2026-07-22-billy-wave-2.md`) — the next write tools. Track A
(more route deep-links) can start regardless.

## Rollback
`app-help-chat` is a single edge function. If anything misbehaves in production, redeploy the
previous version from `main`/the last-known-good commit:
```bash
git checkout <last-good-sha> -- supabase/functions/app-help-chat
supabase functions deploy app-help-chat
```
No DB changes were made, so there is nothing to migrate back.
