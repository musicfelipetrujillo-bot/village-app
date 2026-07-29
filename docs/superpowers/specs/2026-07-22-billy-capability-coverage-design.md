# Billy Capability Coverage — Design

**Date:** 2026-07-22
**Status:** Approved (design), pending implementation plan
**Owner:** Felipe
**Related:** `docs/STATE_OF_VILLIE.md`, AI-native direction (Villie = "the AI operating system for motherhood")

## Problem

The app has pivoted so that **Billy** (the in-app AI assistant, the `app-help-chat` edge function)
is the front door — he is meant to manage everything the app can do. Today he cannot.

**Current state:** Billy has exactly **6 tools, all read/search only** —
`get_baby_tracking_stats`, `find_specialists`, `search_gear`, `find_donors`, `find_events`,
`find_daycares` — plus deterministic crisis resources.

**The app itself** exposes ~24 feature API modules (`apps/mobile/src/api/*`) and 67 edge functions:
logging feeds/naps/diapers, saving items, generating day sheets, milk vault, gear listings,
appointment booking, boxes/commerce, day plans, perks, and more.

So Billy can *find* about six things but cannot *do* anything — he can't log a feed, create a
listing, book, generate a day sheet, or save an item. "Can Billy do everything?" is currently an
unanswerable, vague worry.

## Goal

Make "can Billy complete any task in the app?" a **verifiable, closeable scoreboard**, and drive
it to 100% — with the right thing done directly and the risky thing handed off safely.

## Decisions (locked)

1. **Behavior = Hybrid by risk.** Billy performs safe/reversible actions himself; routes
   sensitive/irreversible ones to native UI with a confirm; never automates crisis/account-security.
2. **Verification = capability map (source of truth) + live eval checklist (proof it works).**
3. **Build strategy = map-first, then wire in value-ordered waves** (Approach A). Rejected:
   two universal meta-tools (B, worse tool selection), big-bang (C, unshippable/unsafe).

## Design

### 1. Capability map — `docs/BILLY_CAPABILITY_MAP.md`

The source of truth. One row per real user action, produced by auditing every
`apps/mobile/src/api/*` module and every `supabase/functions/*` edge function.

Columns:

| action | tier | backing RPC / edge fn | confirmation required? | wired? | eval prompt |
|--------|------|-----------------------|------------------------|--------|-------------|

"Can Billy do everything?" becomes "is every row `wired = yes` and its eval green?"

### 2. Risk tiers (drives the hybrid behavior)

- **do-it** — reversible, low-stakes. Billy calls the tool and confirms back.
  *Examples:* log feed / nap / diaper, save / unsave, draft a day sheet, ask stats, all searches.
- **route-to** — sensitive/irreversible. Billy pre-fills and deep-links; she taps confirm in
  native UI. *Examples:* any payment (boxes, boost), any public post (gear listing, donor profile),
  medical/clinical, appointment booking, deletes.
- **blocked** — never automate. Crisis stays deterministic (already is); account/security changes.

The tier is a property of each capability-map row, so the map *is* the risk policy.

### 3. Tool-layer refactor

Billy's tools are currently hardcoded inline in `supabase/functions/app-help-chat/index.ts`.
Adding ~40 more inline is unmaintainable. Introduce:

- A small **tool registry** — one module per tool exporting `{ schema, tier, handler }`; the edge
  function assembles the `TOOLS` array + dispatch table from the registry.
- One generic **`navigate` tool** covering the entire **route-to** class (screen + params to
  deep-link + pre-fill), so sensitive capabilities don't each need a bespoke tool.

Result: "add a capability" becomes a one-file change; the edge function stays readable.

### 4. Wiring waves (ship + eval after each)

- **Wave 1 — daily-use `do-it` writes + top routes:** log feed / nap / diaper, save/unsave,
  draft day sheet, plus the ~10 highest-traffic `navigate` deep-links.
- **Wave 2 — commerce / listing / booking `route-to`** with the confirmation UX
  (gear listing create, box checkout, boost, appointment booking, donor profile).
- **Wave 3 — the long tail** — remaining rows until the map is fully green.

### 5. Eval checklist — `docs/BILLY_EVALS.md`

One real prompt per capability ("log a 20-min nap", "find me a stroller under $50",
"make a day sheet for tomorrow"), run against Billy and checked off. Re-run each wave to catch
regressions and to prove the model actually selects the right tool at the right moment — not just
that the wiring compiles.

## Out of scope (YAGNI)

- Rebuilding the chat UI / assistant surface (separate open question in the AI-native note).
- Changing crisis/medical determinism.
- New features — this wires Billy to what already exists; it does not add app functionality.

## Success criteria

- `docs/BILLY_CAPABILITY_MAP.md` exists and covers every user action across all API modules + edge fns.
- Every `do-it` and `route-to` row is `wired = yes`.
- Every row has a green eval in `docs/BILLY_EVALS.md`.
- Sensitive/irreversible actions never execute without a native-UI confirm.
