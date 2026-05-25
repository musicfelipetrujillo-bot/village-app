# Nav Pathway Audit

Generated 2026-05-25 · Run with `node apps/mobile/scripts/nav-audit.mjs`

## Summary

| Category | Count | Status |
|---|---|---|
| Static nav targets | 128 | — |
| Dynamic nav targets | 5 | reviewed (safe) |
| Registered screen names | 91 | — |
| **DEAD targets** | **0** | ✅ green |
| **Placeholder "coming soon" alerts** | **0** | ✅ green |
| **No-op onPress handlers** | **0** | ✅ green |
| Duplicate screen registrations | 12 | accepted (see below) |

## Findings

### 🟢 0 dead nav targets

Every `navigation.navigate('X')` call resolves to a registered `Stack.Screen` somewhere in the app, post the `TAB_KEY_MAP` fix below. Cross-tab nav (`getParent()?.navigate(tabName)`) also resolves to a real tab.

### 🟢 0 "coming soon" placeholder alerts

No `Alert.alert(..., 'Coming soon')` land mines.

### 🟢 0 no-op onPress handlers

No tappable surface with `onPress={() => {}}` / `onPress={undefined}`.

### 🟡 1 fixed bug — `TAB_KEY_MAP` in WeeklyJourneyScreen

The AI-generated weekly journey emits CTA targets like `community:RoomChat:postpartum-0-6mo`. `WeeklyJourneyScreen.tsx` translates the tab token via `TAB_KEY_MAP`, then calls `tabNav.navigate(tabName, …)`. Pre-audit values:

```ts
const TAB_KEY_MAP = {
  home:      'Home',
  milk:      'Milk',
  experts:   'Experts',
  community: 'Connect',    // ❌ tab doesn't exist (Connect tab hidden)
  gear:      'Gear',
  me:        'Me',         // ❌ actual tab name is 'Profile'
};
```

Two dead values + three missing entries (Manual, Village, Inbox). Fixed in commit (see below).

### 🟡 12 duplicate `Stack.Screen` registrations — accepted

Same screen-name registered in multiple navigators. Each instance lives in its parent stack, so React Navigation resolves correctly per call site. Not a bug, but worth knowing:

| Screen | Registered in |
|---|---|
| `CreateListing` | GearNavigator, MilkNavigator |
| `MilestoneDetail`, `MilestoneTimeline`, `WeeklyJourney` | HomeNavigator, ManualNavigator |
| `EventsList`, `EventDetail`, `RsvpConfirm`, `MyRsvps`, `PerksList`, `PerkDetail`, `PerkClaim`, `MyClaims` | HomeNavigator, VillageNavigator |

**`CreateListing`** is the only ambiguous one — Milk's is the donor onboarding flow (`{ donorProfileId }`), Gear's is the seller intake form (`undefined`). They're different components, but the shared name makes greps confusing. Could rename to `MilkCreateListing` / `GearCreateListing` someday; not urgent.

**Milestone + WeeklyJourney duplicates** keep Home and Manual interactions self-contained — tapping a milestone from Home pushes onto the Home stack, tapping from Manual pushes onto the Manual stack. Two separate back-stacks, both reach the same render. Acceptable.

**Events + Perks duplicates** are pre-Village holdovers. Home was their original home; Village now hosts them too. Same screens, two registrations. Acceptable for now — consolidation could move them to Village-only and have Home use cross-tab nav (`getParent()?.navigate('Village', { screen: 'EventsList' })`) if the back-stack ambiguity ever matters.

### 🟢 No loops detected

Cross-tab `getParent()?.navigate('Village')` from other hubs (Inbox / Milk / Experts / Gear) — "← Back to Village" links. No self-references.

`HomeScreenV3` + `VillageHomeScreenV3` cross-tab via `route` variable from a static `VERTICALS` / `VILLAGE_PILLARS` array. Was bugged (`MilkConnect` / `GearHome` → non-existent tabs) — fixed in commit `f662bd7` 2026-05-24.

## How to re-run

```bash
cd apps/mobile && node scripts/nav-audit.mjs
```

Script lives at `apps/mobile/scripts/nav-audit.mjs`. Output is markdown to stdout — pipe to file or screen as needed.
