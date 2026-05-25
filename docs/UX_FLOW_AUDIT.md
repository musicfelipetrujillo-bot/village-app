# UX Workflow Audit

Generated 2026-05-25 · End-to-end walkthrough of every tab's primary CTAs, button labels, and pathway intent. Complements `docs/NAV_AUDIT.md` (which catches dead nav targets at the route level) with a layer above — "does the button do what its label promises?"

## Method

1. Read each tab's landing screen + key inner screens
2. Trace every visible CTA → destination
3. Flag mismatches between user intent (label/visual affordance) and actual destination
4. Cross-check sister actions across verticals for consistency
5. Run `apps/mobile/scripts/nav-audit.mjs` for technical confirmation

## Findings — fixed in this commit

### 🔴 Home · Manual hero TOC rows weren't deep-linkable
**Surface**: `HomeScreenV3` → `ManualHeroCard`
**Symptom**: The hero card shows a 5-row chapter table of contents (Sleep / Feed / Grow / Care / Wins) each with a sub-line and a duration. Visually they look like 5 separate destinations. Tapping ANY row — or the card body — routed to the same place: `Manual` tab, generic landing (no chapter pre-selected).
**Impact**: User taps "Sleep · Separation anxiety wakings" expecting that chapter; lands on Manual home, has to manually re-select Sleep. Friction on the most common cross-tab journey.
**Fix**:
- `ManualScrollV3` now accepts route params `{ audience?: 'mom' | 'baby'; chapter?: string }` and initializes its chapter state from them.
- `ManualHeroCard` gets a new `onChapterPress(chapter)` prop. Each TOC row is now its own `TouchableOpacity` with `accessibilityRole="button"` + a label naming the chapter + its weekly sub-copy.
- Home wires up `goManualChapter(chapter)` that calls `navigation.navigate('Manual', { screen: 'ManualHome', params: { audience: 'baby', chapter } })`.
- "Open Manual →" link + tap-on-card-background still route to generic Manual (no chapter forced).

### 🔴 Village hub had 2 dead-handler buttons + 3 non-tappable plan rows
**Surface**: `VillageHomeScreenV3`
**Findings**:
1. Map-pin icon in the top-right of the masthead had `accessibilityRole="button"` and `accessibilityLabel="Map"` but no `onPress` — screen-reader-announced as tappable, no behavior. Now routes to `Milk › DonorMap` (the only map surface in the app today).
2. "All plans →" link in the calendar section had no `onPress`. Now routes to `EventsList` within the Village stack.
3. The 3 calendar plan rows rendered as `<View>`, not `<TouchableOpacity>`. Visible event listings the user couldn't drill into. Now each row is tappable: live events drill to `EventDetail` with the event id; placeholder rows fall back to `EventsList` (no id to drill into).

## Findings — accepted, documented

### 🟡 `CreateListing` name collision between Milk + Gear
Both navigators register `Stack.Screen name="CreateListing"`. Different components (milk donor onboarding vs gear seller intake), different param shapes. Each isolated to its own stack so React Navigation resolves correctly; no runtime bug. Worth renaming someday (`MilkCreateListing` / `GearCreateListing`) for grep-ability, but not urgent.

### 🟡 12 duplicate screen registrations (Home + Manual, Home + Village)
- `MilestoneDetail`, `MilestoneTimeline`, `WeeklyJourney` × 2 (Home + Manual)
- 8 event/perk screens × 2 (Home + Village)

Each duplicated screen mounts twice but renders one user-visible instance per stack. Back-stack lineage varies based on entry point (tap from Home → back returns to Home; tap from Village → back returns to Village). This is the *intended* React Navigation pattern for cross-tab shared screens.

### 🟢 Sister-action labels are consistent
Spot-checked Save/Unsave (gear, donor, manual video), Share (manual share-URL, gear, milk-handoff), Report (gear listing, future milk donor) — all use the same iconography + label across verticals.

## Findings — clean

| Audit dimension | Status |
|---|---|
| Static nav targets resolving to a registered screen | ✅ 128 / 128 |
| "Coming soon" placeholder alerts | ✅ 0 |
| `onPress={() => {}}` no-op handlers | ✅ 0 |
| Touchables with `role=button/link` missing `onPress` | ✅ 0 (was 2 — fixed) |
| Cross-tab self-references / loops | ✅ 0 |
| Auth-gated screens reachable from public surfaces | ✅ all gated |

## How to re-run

```bash
node apps/mobile/scripts/nav-audit.mjs
```

Script catches the technical layer (dead routes, missing handlers, no-ops). This document is the UX-judgment layer — re-walk it whenever a new tab/screen ships or a major flow changes.
