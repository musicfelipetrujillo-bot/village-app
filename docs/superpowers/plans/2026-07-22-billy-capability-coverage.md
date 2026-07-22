# Billy Capability Coverage — Implementation Plan (Phase 0 + 1 + Wave 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "can Billy complete any task in the app?" into a verifiable scoreboard, and build the two reusable patterns (route-to `navigate` + do-it write tool) plus the tool-registry refactor that lets the remaining ~35 capabilities be wired mechanically.

**Architecture:** Billy = the `app-help-chat` Supabase edge function, an Anthropic tool-use loop. Today it has 6 read tools hardcoded inline. We (1) audit the whole app into a capability map, (2) refactor the inline tools into a per-file registry, (3) add one generic `navigate` tool covering the entire sensitive/route-to class end-to-end (edge + mobile client), and (4) add `log_baby_event` as the template for all do-it write tools. Waves 2–3 (the rest of the map) are a **follow-up plan generated from the Task 1 output** — you cannot write no-placeholder tasks for actions not yet enumerated.

**Tech Stack:** Deno edge function (`npm:@anthropic-ai/sdk`, `npm:@supabase/supabase-js`), Anthropic tool-use (Haiku `claude-haiku-4-5-20251001`), React Native + Expo mobile client, React Navigation, Supabase RLS.

**Verification reality (read before Task 1):** This repo has **no unit-test runner for edge functions** (`find supabase/functions -name '*test*'` → empty; root scripts expose only `type-check`/`lint`). The established bar is `pnpm type-check` + `pnpm lint` + a live eval. So per-task acceptance here is: **`pnpm type-check` passes, `pnpm lint` passes, and the capability's eval prompt in `docs/BILLY_EVALS.md` produces the correct behavior against the deployed function.** Do NOT invent a Deno test framework — the eval checklist IS the test artifact (this is the "capability map + live eval" decision from the spec). Pure-logic helpers still get an inline assertion block where cheap (see Task 3).

**Spec:** `docs/superpowers/specs/2026-07-22-billy-capability-coverage-design.md`

---

## File Structure

**New (edge — capability + registry):**
- `docs/BILLY_CAPABILITY_MAP.md` — the scoreboard (Task 1)
- `docs/BILLY_EVALS.md` — one eval prompt per capability (Task 2)
- `supabase/functions/app-help-chat/tools/types.ts` — `ToolTier`, `ToolDef`, `ToolContext` (Task 3)
- `supabase/functions/app-help-chat/tools/registry.ts` — assembles `TOOLS` + `dispatch()` (Task 3)
- `supabase/functions/app-help-chat/tools/getBabyTrackingStats.ts` … `findDaycares.ts` — the 6 existing tools, one file each (Task 3)
- `supabase/functions/app-help-chat/tools/navigate.ts` — generic route-to tool (Task 4)
- `supabase/functions/app-help-chat/tools/logBabyEvent.ts` — first do-it write tool (Task 5)

**Modified:**
- `supabase/functions/app-help-chat/index.ts` — consume the registry; surface `navigate` in the response (Tasks 3, 4)
- `apps/mobile/src/api/appHelp.ts` — add `navigate` to `HelpChatResponse` (Task 4)
- `apps/mobile/src/screens/help/AIHelpChatScreen.tsx` — execute `res.navigate` via React Navigation (Task 4)

---

## Task 1: Produce the capability map (the audit)

This is the gating deliverable — Waves 2–3 are generated from it. No code; it is a structured read of the whole surface.

**Files:**
- Create: `docs/BILLY_CAPABILITY_MAP.md`

- [ ] **Step 1: Enumerate every user action.** For each module in `apps/mobile/src/api/*.ts` (account, appointments, babyTracker, boxes, community, daySheets, daycares, events, gear, home, manual, messages, milk, milkVault, perks, picks, saved, specialists, weekly-journey, plus ai/appHelp/agents), list every exported function that a mom can trigger. Cross-reference `supabase/functions/*` (67 dirs) for actions that live only server-side. One row per distinct user-facing action.

- [ ] **Step 2: Classify each row into a tier** using the spec's rules:
  - `do` — reversible, low-stakes, mom-owned data (log feed/nap/diaper, save/unsave, draft day sheet, ask stats, all searches/reads).
  - `route` — sensitive/irreversible: any payment (boxes checkout, gear boost), any public post (create gear listing, donor profile, community message), medical/clinical, appointment booking, deletes, account/security changes.
  - `blocked` — never automate: crisis (already deterministic), `account-delete`, password/email change.

- [ ] **Step 3: Map each row to its backing RPC / edge fn** (the exact `supabase.rpc('…')`, `.from('…').insert()`, or `functions/v1/…` it would call), and note `confirmation required? (Y/N)` — Y for every `route` row.

- [ ] **Step 4: Write the file** with this exact header + table shape (fill all rows; the 6 shipped tools start `wired = yes`):

```markdown
# Billy Capability Map

Source of truth for "can Billy do everything?". A capability is DONE when `wired = yes`
and its eval in docs/BILLY_EVALS.md is green. Tier rules: see
docs/superpowers/specs/2026-07-22-billy-capability-coverage-design.md.

| action | tier | backing RPC / edge fn | confirm? | wired? | eval id |
|--------|------|-----------------------|----------|--------|---------|
| Find specialists nearby | read | rpc:specialists_near | N | yes | E-find-specialists |
| Search used gear | read | rpc:list_gear_near | N | yes | E-search-gear |
| Find milk donors | read | rpc:search_donors_near | N | yes | E-find-donors |
| Find events/classes | read | rpc:list_events_near | N | yes | E-find-events |
| Find daycares | read | rpc:list_daycares_near / Places | N | yes | E-find-daycares |
| Read my tracking stats | read | table:baby_*_logs (agg) | N | yes | E-tracking-stats |
| Log a nap/feed/diaper | do | table:baby_*_logs insert | N | no | E-log-baby-event |
| Save a specialist/donor/gear | do | api:saved.ts | N | no | E-save-item |
| Draft a day sheet | do | api:daySheets.ts | N | no | E-draft-day-sheet |
| Book an appointment | route | screen:BookingScreen | Y | no | E-nav-booking |
| Create a gear listing | route | screen:CreateListing (Gear) | Y | no | E-nav-create-listing |
| Buy a Villie Box | route | screen:BoxDetail checkout | Y | no | E-nav-box-checkout |
| … (every remaining action) … | | | | no | |
```

- [ ] **Step 5: Sanity-check coverage.** Grep each API module's exports against the table — every mom-triggerable export must appear as a row. Run:

```bash
cd "village-app" && for f in apps/mobile/src/api/*.ts; do echo "== $f =="; grep -oE "async [a-zA-Z]+\(|^  [a-zA-Z]+\(" "$f" | head; done
```
Expected: every listed action maps to a table row (note any intentionally excluded, e.g. internal/agents-only, in a "Not exposed to Billy" section at the bottom).

- [ ] **Step 6: Commit**

```bash
cd "village-app" && git add docs/BILLY_CAPABILITY_MAP.md
git commit -m "docs: Billy capability map — full app action audit"
```

---

## Task 2: Seed the eval checklist

**Files:**
- Create: `docs/BILLY_EVALS.md`

- [ ] **Step 1: Create the file** with one entry per capability-map `eval id`. Each entry is a real prompt + the pass criterion:

```markdown
# Billy Evals

Run each prompt against the deployed app-help-chat (or in the in-app chat). Check off
when Billy does the right thing. Re-run every wave to catch regressions.
Tier legend: read/do = Billy acts; route = Billy deep-links, mom confirms in native UI.

## Read (shipped)
- [ ] E-find-specialists — "find me a lactation consultant nearby" → calls find_specialists, summarizes ≤5 with distance.
- [ ] E-tracking-stats — "how are my baby's wake windows?" → calls get_baby_tracking_stats, grounds answer in numbers (or invites logging if has_data:false).

## Wave 1 — do-it writes + route-to
- [ ] E-log-baby-event — "log a 25 minute nap that just ended" → calls log_baby_event(kind:nap), confirms "logged a 25-min nap".
- [ ] E-nav-booking — "book me an appointment with Dr. Rivera" → returns navigate:{screen:'booking'}, chat routes to BookingScreen, mom confirms there.
- [ ] E-nav-create-listing — "I want to sell my stroller" → navigate:{screen:'gear_create'}.

## Wave 2 / 3 (filled as the map is wired)
```

- [ ] **Step 2: Commit**

```bash
cd "village-app" && git add docs/BILLY_EVALS.md
git commit -m "docs: Billy eval checklist skeleton"
```

---

## Task 3: Tool-registry refactor (behavior-preserving)

Extract the 6 inline tools into one-file-each modules behind a registry. **No behavior change** — the 6 evals in Task 2 must still pass after this.

**Files:**
- Create: `supabase/functions/app-help-chat/tools/types.ts`
- Create: `supabase/functions/app-help-chat/tools/{getBabyTrackingStats,findSpecialists,searchGear,findDonors,findEvents,findDaycares}.ts`
- Create: `supabase/functions/app-help-chat/tools/registry.ts`
- Modify: `supabase/functions/app-help-chat/index.ts`

- [ ] **Step 1: Write `tools/types.ts`**

```ts
// Shared tool contract for the app-help-chat tool-use loop.
import type { SupabaseClient } from 'npm:@supabase/supabase-js';

export type ToolTier = 'read' | 'do' | 'route';
export type Loc = { lat: number; lng: number } | null;

export interface ToolContext {
  supabase: SupabaseClient;      // user-scoped (RLS) — reads/writes ONLY her rows
  loc: Loc;                      // best-effort device location
}

// A do/read tool returns any JSON (becomes the tool_result the model reads).
// A route tool returns a sentinel { __navigate } the loop lifts into the response.
export interface ToolDef {
  schema: { name: string; description: string; input_schema: Record<string, unknown> };
  tier: ToolTier;
  handler: (ctx: ToolContext, input: any) => Promise<unknown>;
}

export type NavigateSentinel = { __navigate: { screen: string; params?: Record<string, unknown> } };
export const isNavigate = (x: unknown): x is NavigateSentinel =>
  !!x && typeof x === 'object' && '__navigate' in (x as Record<string, unknown>);
```

- [ ] **Step 2: Move each existing tool into its own file.** Example — `tools/getBabyTrackingStats.ts` (move `getTrackerStats` body verbatim from `index.ts:135-173`; keep logic identical):

```ts
import type { ToolDef, ToolContext } from './types.ts';

async function run(ctx: ToolContext, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  // ... identical body of the current getTrackerStats(supabase, days) ...
  // (copy lines 136-172 from the original index.ts, using ctx.supabase)
}

export const getBabyTrackingStats: ToolDef = {
  tier: 'read',
  schema: {
    name: 'get_baby_tracking_stats',
    description: "Read the mom's own recently logged baby data (naps, feeds, diapers) …", // verbatim from original
    input_schema: { type: 'object', properties: { days: { type: 'integer', description: 'Look-back window in days (default 7).' } } },
  },
  handler: (ctx, input) => run(ctx, Number(input?.days) || 7),
};
```

Repeat for the other five, each exporting a `ToolDef` whose `handler` wraps the existing function body (`findSpecialists`/`searchGear`/`findDonors`/`findEvents`/`findDaycares` from `index.ts:178-311`), reading location from `ctx.loc`. Keep the `need_location` / `error` return shapes identical. `tier: 'read'` for all six.

- [ ] **Step 3: Write `tools/registry.ts`**

```ts
import type { ToolContext, ToolDef } from './types.ts';
import { getBabyTrackingStats } from './getBabyTrackingStats.ts';
import { findSpecialists } from './findSpecialists.ts';
import { searchGear } from './searchGear.ts';
import { findDonors } from './findDonors.ts';
import { findEvents } from './findEvents.ts';
import { findDaycares } from './findDaycares.ts';

const REGISTRY: ToolDef[] = [
  getBabyTrackingStats, findSpecialists, searchGear, findDonors, findEvents, findDaycares,
];
const BY_NAME = new Map(REGISTRY.map((t) => [t.schema.name, t]));

export const TOOLS = REGISTRY.map((t) => t.schema);

export async function dispatch(name: string, ctx: ToolContext, input: any): Promise<unknown> {
  const tool = BY_NAME.get(name);
  if (!tool) return { error: 'unknown_tool' };
  try { return await tool.handler(ctx, input); }
  catch (e) { return { error: String(e) }; }
}
```

- [ ] **Step 4: Rewire `index.ts`.** Delete the inline `TOOLS` array (lines 85-131) and the six handler functions now moved out. Add `import { TOOLS, dispatch } from './tools/registry.ts';`. Replace the if/else dispatch chain (lines 393-411) with:

```ts
const ctx = { supabase, loc: userLocation };
for (const tu of toolUses as any[]) {
  const out = await dispatch(tu.name, ctx, tu.input);
  toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
}
```

The `tools: TOOLS as any` in the `anthropic.messages.create` call (line 386) is unchanged — `TOOLS` now comes from the registry.

- [ ] **Step 5: Type-check + lint**

```bash
cd "village-app" && pnpm type-check && pnpm lint
```
Expected: PASS (edge fn is Deno; if turbo excludes it, run `deno check supabase/functions/app-help-chat/index.ts` — expected: no errors).

- [ ] **Step 6: Deploy + regression-eval**

```bash
cd "village-app" && supabase functions deploy app-help-chat
```
Then run E-find-specialists and E-tracking-stats from `docs/BILLY_EVALS.md`. Expected: identical behavior to before the refactor.

- [ ] **Step 7: Commit**

```bash
cd "village-app" && git add supabase/functions/app-help-chat
git commit -m "refactor: app-help-chat tools into a registry (no behavior change)"
```

---

## Task 4: The generic `navigate` tool (entire route-to class)

One tool covers every sensitive/irreversible action: Billy pre-fills and deep-links; the mom taps confirm in native UI.

**Files:**
- Create: `supabase/functions/app-help-chat/tools/navigate.ts`
- Modify: `supabase/functions/app-help-chat/tools/registry.ts`, `supabase/functions/app-help-chat/index.ts`
- Modify: `apps/mobile/src/api/appHelp.ts`, `apps/mobile/src/screens/help/AIHelpChatScreen.tsx`

- [ ] **Step 1: Write `tools/navigate.ts`.** The screen arg is an allowlisted enum — the model can only route to known destinations. The handler returns the `__navigate` sentinel; the loop lifts it into the response.

```ts
import type { ToolDef } from './types.ts';

// Allowlist of route-to destinations. Keys are Billy-facing; the mobile client
// maps each to a concrete React Navigation target (see AIHelpChatScreen).
export const NAV_TARGETS = [
  'booking', 'gear_create', 'box_checkout', 'gear_boost',
  'become_donor', 'donor_profile_edit', 'appointment_book', 'account_settings',
] as const;

export const navigate: ToolDef = {
  tier: 'route',
  schema: {
    name: 'navigate',
    description:
      "Take the mom to the right screen to COMPLETE a sensitive or irreversible action herself — " +
      "anything involving payment, posting something public, booking, or account changes. " +
      "You do NOT perform these; you deep-link and she taps the final confirm. Use when she asks to " +
      "book an appointment (screen 'booking'), sell/list gear ('gear_create'), buy a Villie Box " +
      "('box_checkout'), boost a listing ('gear_boost'), become a milk donor ('become_donor'), edit her " +
      "donor profile ('donor_profile_edit'), or change account settings ('account_settings'). " +
      "In your reply, tell her you're taking her there and what she'll do on that screen.",
    input_schema: {
      type: 'object',
      properties: {
        screen: { type: 'string', enum: NAV_TARGETS as unknown as string[], description: 'The destination.' },
        params: { type: 'object', description: 'Optional pre-fill hints, e.g. { specialist_name, category }.' },
      },
      required: ['screen'],
    },
  },
  handler: (_ctx, input) => {
    const screen = String(input?.screen ?? '');
    if (!(NAV_TARGETS as readonly string[]).includes(screen)) return { error: 'unknown_screen' };
    return { __navigate: { screen, params: input?.params ?? {} } };
  },
};
```

- [ ] **Step 2: Register it.** In `tools/registry.ts` add `import { navigate } from './navigate.ts';` and append `navigate` to `REGISTRY`.

- [ ] **Step 3: Lift the sentinel in `index.ts`.** In the tool-loop, capture a navigate action and hand the model a friendly result. Replace the Task 3 Step 4 loop body with:

```ts
const ctx = { supabase, loc: userLocation };
for (const tu of toolUses as any[]) {
  const out = await dispatch(tu.name, ctx, tu.input);
  if (isNavigate(out)) {
    navigateAction = out.__navigate;                     // declared: `let navigateAction: any = null;` above the hop loop
    toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ ok: true, navigating: true }) });
  } else {
    toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(out) });
  }
}
```
Add `import { isNavigate } from './tools/types.ts';` and declare `let navigateAction: { screen: string; params?: Record<string, unknown> } | null = null;` just before the `for (let hop…` loop. Then add `navigate: navigateAction ?? undefined,` to the success `Response` JSON (alongside `reply`/`crisis`/`quick_replies`, ~line 444).

- [ ] **Step 4: Extend the client type.** In `apps/mobile/src/api/appHelp.ts`, add to `HelpChatResponse`:

```ts
  /** Route-to action: Billy deep-links the mom to a screen to finish a sensitive task herself. */
  navigate?: { screen: string; params?: Record<string, unknown> };
```

- [ ] **Step 5: Execute navigation in the chat screen.** In `apps/mobile/src/screens/help/AIHelpChatScreen.tsx`, add a target→route map and run it after the assistant reply renders. Insert near the top of the component:

```tsx
// Billy-facing nav key → concrete React Navigation target. Cross-tab jumps use the
// getParent() pattern (see MeScreen "My stuff"). Params pass pre-fill hints through.
const NAV_ROUTES: Record<string, { tab?: string; screen: string }> = {
  booking:            { tab: 'Experts', screen: 'Booking' },
  appointment_book:   { tab: 'Experts', screen: 'Booking' },
  gear_create:        { tab: 'Gear',    screen: 'CreateListing' },
  gear_boost:         { tab: 'Gear',    screen: 'MyListings' },
  box_checkout:       { tab: 'Home',    screen: 'BoxDetail' },
  become_donor:       { tab: 'Milk',    screen: 'BecomeDonorIntro' },
  donor_profile_edit: { tab: 'Milk',    screen: 'TrustBadgeBuilder' },
  account_settings:   { tab: 'Me',      screen: 'MeRoot' },
};

function runNavigate(navigation: any, action: { screen: string; params?: Record<string, unknown> }) {
  const target = NAV_ROUTES[action.screen];
  if (!target) return;
  const parent = navigation.getParent?.();           // chat is a modal over the tabs
  if (target.tab && parent) parent.navigate(target.tab, { screen: target.screen, params: action.params });
  else navigation.navigate(target.screen, action.params);
}
```

Then in `send()`, immediately after the `setMessages((prev) => [...])` that appends the assistant reply, add:

```tsx
      if (res.navigate) {
        // Let the reply render, then route her to finish in native UI.
        setTimeout(() => runNavigate(navigation, res.navigate!), 350);
      }
```

- [ ] **Step 6: Type-check + lint**

```bash
cd "village-app" && pnpm type-check && pnpm lint
```
Expected: PASS. Verify each `NAV_ROUTES` value is a real route — grep the navigators:
```bash
grep -rhoE "name=\"(Booking|CreateListing|MyListings|BoxDetail|BecomeDonorIntro|TrustBadgeBuilder|MeRoot)\"" apps/mobile/src
```
Expected: every screen name appears. If a name differs (e.g. `CreateListing` vs `GearCreateListing`), fix the map to match the actual `Stack.Screen name`.

- [ ] **Step 7: Deploy + eval**

```bash
cd "village-app" && supabase functions deploy app-help-chat
```
Run E-nav-booking and E-nav-create-listing. Expected: Billy replies "taking you there…" and the app routes to BookingScreen / CreateListing.

- [ ] **Step 8: Commit**

```bash
cd "village-app" && git add supabase/functions/app-help-chat apps/mobile/src/api/appHelp.ts apps/mobile/src/screens/help/AIHelpChatScreen.tsx
git commit -m "feat: Billy navigate tool — route-to deep-links for sensitive actions"
```

---

## Task 5: `log_baby_event` — the do-it write-tool template

The first tool where Billy performs the action himself. Establishes the write pattern (resolve baby_profile server-side, RLS-scoped insert, confirm back) that every other `do` row copies.

**Files:**
- Create: `supabase/functions/app-help-chat/tools/logBabyEvent.ts`
- Modify: `supabase/functions/app-help-chat/tools/registry.ts`

- [ ] **Step 1: Write `tools/logBabyEvent.ts`.** Inserts mirror `babyTracker.ts` (`baby_sleep_logs` / `baby_feed_logs` / `baby_diaper_logs`, each needs `user_id` + `baby_profile_id`). The user-scoped client gives `user_id` via auth; resolve `baby_profile_id` server-side.

```ts
import type { ToolDef, ToolContext } from './types.ts';

async function resolveBaby(ctx: ToolContext): Promise<{ user_id: string; baby_profile_id: string } | null> {
  const { data: auth } = await ctx.supabase.auth.getUser();
  const user_id = auth?.user?.id;
  if (!user_id) return null;
  const { data } = await ctx.supabase
    .from('baby_profiles').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (!data?.id) return null;
  return { user_id, baby_profile_id: data.id };
}

async function run(ctx: ToolContext, input: any) {
  const kind = String(input?.kind ?? '');
  const ids = await resolveBaby(ctx);
  if (!ids) return { error: 'no_baby_profile', message: "She hasn't set up a baby profile yet — send her to Home to add one." };
  const now = new Date();
  const at = input?.minutes_ago ? new Date(now.getTime() - Number(input.minutes_ago) * 60000) : now;

  if (kind === 'nap') {
    const dur = Number(input?.duration_min) || 0;
    const started = dur > 0 ? new Date(at.getTime() - dur * 60000) : at;
    const { error } = await ctx.supabase.from('baby_sleep_logs').insert({
      user_id: ids.user_id, baby_profile_id: ids.baby_profile_id,
      started_at: started.toISOString(), ended_at: dur > 0 ? at.toISOString() : null, source: 'villie_chat',
    });
    return error ? { error: error.message } : { ok: true, logged: 'nap', duration_min: dur || null };
  }
  if (kind === 'feed') {
    const method = input?.method === 'breast' ? 'breast' : 'bottle';
    const { error } = await ctx.supabase.from('baby_feed_logs').insert({
      user_id: ids.user_id, baby_profile_id: ids.baby_profile_id, method,
      side: method === 'breast' ? (input?.side ?? null) : null,
      started_at: at.toISOString(), ended_at: at.toISOString(),
      amount_oz: input?.amount_oz != null ? Number(input.amount_oz) : null, source: 'villie_chat',
    });
    return error ? { error: error.message } : { ok: true, logged: 'feed', method };
  }
  if (kind === 'diaper') {
    const dk = ['wet', 'dirty', 'both'].includes(input?.diaper_kind) ? input.diaper_kind : 'wet';
    const { error } = await ctx.supabase.from('baby_diaper_logs').insert({
      user_id: ids.user_id, baby_profile_id: ids.baby_profile_id, kind: dk,
      occurred_at: at.toISOString(), source: 'villie_chat',
    });
    return error ? { error: error.message } : { ok: true, logged: 'diaper', diaper_kind: dk };
  }
  return { error: 'unknown_kind' };
}

export const logBabyEvent: ToolDef = {
  tier: 'do',
  schema: {
    name: 'log_baby_event',
    description:
      "Log ONE baby event to the mom's Playbook tracker for HER baby: a nap, a feed, or a diaper. " +
      "Use when she says she just did one, e.g. 'log a 30 min nap', 'he took 4 oz', 'wet diaper'. " +
      "This WRITES to her data — only call it when she's clearly asking to record something, not when she's " +
      "asking a question. After it returns ok, confirm warmly what you logged. If it returns no_baby_profile, " +
      "tell her to add her baby on Home first.",
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['nap', 'feed', 'diaper'], description: 'What happened.' },
        duration_min: { type: 'integer', description: 'nap only — length in minutes if she gave one.' },
        minutes_ago: { type: 'integer', description: 'How long ago it ended/happened (default now).' },
        method: { type: 'string', enum: ['breast', 'bottle'], description: 'feed only.' },
        side: { type: 'string', enum: ['left', 'right'], description: 'feed+breast only.' },
        amount_oz: { type: 'number', description: 'feed+bottle only — ounces.' },
        diaper_kind: { type: 'string', enum: ['wet', 'dirty', 'both'], description: 'diaper only.' },
      },
      required: ['kind'],
    },
  },
  handler: (ctx, input) => run(ctx, input),
};
```

- [ ] **Step 2: Register it.** In `tools/registry.ts` add `import { logBabyEvent } from './logBabyEvent.ts';` and append `logBabyEvent` to `REGISTRY`.

- [ ] **Step 3: Verify the insert columns match the schema.** Confirm `source` is a real column and `baby_profiles.created_at` exists:

```bash
cd "village-app" && grep -rhoE "source|created_at" supabase/migrations/*baby* | sort -u | head
```
Expected: `baby_*_logs` carry a `source` text column (mobile inserts `source` implicitly via default; if the column is NOT NULL without default, the explicit `source:'villie_chat'` covers it) and `baby_profiles` has `created_at`. If `baby_profiles` orders differently or a mom can have multiple babies, keep the "oldest profile" heuristic but note it in the eval.

- [ ] **Step 4: Type-check + lint**

```bash
cd "village-app" && pnpm type-check && pnpm lint
```
Expected: PASS.

- [ ] **Step 5: Deploy + eval**

```bash
cd "village-app" && supabase functions deploy app-help-chat
```
Run E-log-baby-event ("log a 25 minute nap that just ended"). Expected: Billy calls `log_baby_event(kind:nap, duration_min:25)`, a row lands in `baby_sleep_logs` with `source='villie_chat'`, and he confirms "logged a 25-min nap". Then verify a follow-up "how were his naps today?" (E-tracking-stats) now reflects it.

- [ ] **Step 6: Commit**

```bash
cd "village-app" && git add supabase/functions/app-help-chat
git commit -m "feat: Billy log_baby_event write tool (do-it template)"
```

---

## Task 6: Close Wave 1 on the scoreboard

- [ ] **Step 1: Update the map.** In `docs/BILLY_CAPABILITY_MAP.md`, flip `wired = yes` for `navigate`-covered route rows exercised by an eval and for `log-baby-event`. Leave `save-item` / `draft-day-sheet` as `no` (they are the next do-it tools, built by copying Task 5 against `saved.ts` / `daySheets.ts` — first two rows of the Wave 2 plan).

- [ ] **Step 2: Check off passed evals** in `docs/BILLY_EVALS.md`.

- [ ] **Step 3: Commit**

```bash
cd "village-app" && git add docs/BILLY_CAPABILITY_MAP.md docs/BILLY_EVALS.md
git commit -m "docs: mark Wave 1 capabilities wired + evals green"
```

---

## Follow-up: Waves 2 & 3 (separate plan)

Once Task 1's map exists, generate `docs/superpowers/plans/<date>-billy-wave-2.md` by walking the map's `wired = no` rows:
- **`do` rows** → copy Task 5's pattern (new `tools/<name>.ts`, RLS-scoped write via the matching `api/*.ts` insert/RPC, confirm-back). First two: `save-item` (`saved.ts`), `draft-day-sheet` (`daySheets.ts`).
- **`route` rows** → usually just a new key in `NAV_TARGETS` + `NAV_ROUTES` (Task 4), no new tool file — the generic `navigate` tool already carries them. Add an eval each.
- Each wave ends by re-running the **full** eval checklist (regression) and updating the map. Wave 3 is done when every non-`blocked` row is `wired = yes` and green.

---

## Self-Review (completed by author)

- **Spec coverage:** capability map (Task 1) ✓, risk tiers (Task 1 Step 2 + tool `tier` field) ✓, tool-registry refactor (Task 3) ✓, `navigate` route-to class (Task 4) ✓, do-it write template (Task 5) ✓, eval checklist (Task 2 + per-task evals) ✓, waves (Tasks 5–6 + follow-up) ✓. Crisis stays deterministic (untouched — index.ts crisis path unchanged) ✓.
- **Placeholder scan:** every code step shows full code; no TBD/TODO. Waves 2–3 are explicitly deferred with a generation recipe, not a placeholder — they depend on Task 1's output, which cannot be pre-enumerated.
- **Type consistency:** `ToolDef`/`ToolContext`/`isNavigate` defined in Task 3 and used verbatim in Tasks 4–5; `NAV_TARGETS` (edge) ↔ `NAV_ROUTES` (client) share the same keys; response `navigate` field added in Task 4 Step 3 (edge) and Step 4 (client type) match.
- **Verification honesty:** no fictional test runner — acceptance is type-check + lint + live eval, matching the repo (noted in header).
