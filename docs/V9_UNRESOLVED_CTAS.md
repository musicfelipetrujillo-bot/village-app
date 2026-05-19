# V9 Unresolved CTAs — punch list

Inventory of CTAs/links that *look* tappable in the UI but have no `onPress` handler / no destination wired. These are visual placeholders waiting on either (a) navigation targets that don't exist yet, or (b) features that aren't built. Each entry includes the file location, the surface it appears on, and a suggested destination/behavior.

> Updated 2026-05-16 after the V9 craft pass. Re-scan with: `grep -rn "→" src --include="*.tsx" | grep "<Text" | grep -vE "internal/|community/Room"` then verify each is wrapped in a `TouchableOpacity` with an `onPress`.

---

## 🔴 Confirmed dead ends (no `onPress`, plain `<Text>`)

### 1. `Explore the manual →` — Chapter pages
- **File:** `apps/mobile/src/screens/manual/ManualCategoryScreen.tsx:353`
- **Surface:** "The manual · what to actually know." book card on every chapter page (10 instances visually: mom/feel, mom/heal, ..., baby/tips)
- **Current behavior:** None. Renders as a styled text label that looks tappable.
- **Suggested destination:** Drill into a longer-form chapter reader — same chapter, expanded bullets, more context. Could be a new `ManualChapterReader` screen that takes `audience` + `category` + `week` and renders the deeper manual content.
- **Suggested behavior (lighter scope):** Wrap in `TouchableOpacity` and just scroll to the bottom of the current screen, or surface a sheet listing related videos + hacks.

### 2. `Save & explore →` — Chapter pages
- **File:** `apps/mobile/src/screens/manual/ManualCategoryScreen.tsx:407`
- **Surface:** "Ask your specialist · bring these three." clinical chart card. Same 10 chapter pages.
- **Current behavior:** None. Plain text.
- **Suggested destination:** Save the 3 questions to a user "My questions for next appointment" list — could be persisted to Supabase (`user_saved_questions` table), surfaced in MeScreen, and exportable to PDF/SMS for the actual visit. Ties into the V1 Specialist booking flow (could pre-fill messaging thread on booking).
- **Suggested behavior (lighter scope):** Long-press on individual Q rows to copy/share each one via the native share sheet. The card-level "Save & explore" becomes a "View all saved questions →" link to a `SavedQuestionsScreen`.

### 3. `Watch the row →` — Chapter pages
- **File:** `apps/mobile/src/screens/manual/ManualCategoryScreen.tsx:478`
- **Surface:** "Quick watches · two minutes, exactly." video strip card. Same 10 chapter pages.
- **Current behavior:** None. The 3 video thumbs above ARE tappable (lead to `ManualVideo`) but the card-level CTA is dead.
- **Suggested destination:** Navigate to a `ManualVideosScreen` filtered to `audience+category` showing the full list (could be 5–50 videos per chapter). The 3 thumbs above are a curated preview; this CTA opens the library view.
- **Lighter scope:** Auto-play row through the 3 thumbs sequentially (chained `navigation.navigate('ManualVideo', ...)` with onNext handler in ManualVideo).

### 4. `More hacks →` — Chapter pages
- **File:** `apps/mobile/src/screens/manual/ManualCategoryScreen.tsx:511`
- **Surface:** "Mom hacks & tips · try one tonight." sage card. Same 10 chapter pages.
- **Current behavior:** None. Plain text.
- **Suggested destination:** A `ManualHacksScreen` filtered to `audience+category` showing the longer hacks library. Same pattern as Quick Watches above.
- **Lighter scope:** Expand the existing card in place to show 2–3 more hack rows below the current ones.

---

## 🟢 Confirmed alive (verified during this audit)

For the record — these LOOKED suspicious but are wired:
- `Read more →` (HomeScreen combined milestone card) — wraps in TouchableOpacity, `onPress={onWeekPress}`
- `Full guide →` (HomeScreen combined footer) — wraps in TouchableOpacity, `onPress={onManualPress}`
- `See your weekly guide →` arrow (HomeScreen Week hero) — wraps in TouchableOpacity, navigates to WeeklyJourney
- `All chapters →` (HomeScreen Manual block) — wraps in TouchableOpacity, navigates to ManualHome
- `→` arrow per VillageHome card — wraps in TouchableOpacity, `onPress={card.target}`
- `→` arrows per ManualHome chapter tile rows — tile-level onPress navigates to ManualCategoryScreen
- "Inbox empty CTA →" — wraps in TouchableOpacity, navigates to relevant browse surface
- "Browse..." empty-state CTAs across Milk / Gear / Events / Perks — all wired

---

## 🟡 Worth a manual visual check (not script-confirmable)

These passed the regex but rely on dynamic content. Verify by tapping in the sim:
- `vs.cta_label →` in `WeeklyJourneyScreen.tsx:328` — supportCtaText comes from data; verify each row has a real target
- `matchArrow →` in `MilkConnectHomeScreen.tsx:183` — verify the row wrapper has onPress
- `EventsListScreen.tsx:233` `arrow →` — likely fine (FlashList row wrap) but worth confirming
- `PerksListScreen.tsx:179` `arrow →` — same

---

## Process for adding a new entry

When you spot an unresolved CTA in the sim or during dev:

1. Find the line in code (`grep -n "the cta text" src/...`)
2. Confirm it's NOT wrapped in `TouchableOpacity` with a real `onPress`
3. Add a section under "Confirmed dead ends" with file:line + suggested destination
4. When you implement the wiring, move it to a `## 🟢 Resolved (date)` section at the bottom (or delete it)

---

## ✅ Resolved 2026-05-16

All 4 chapter-page dead-ends wired with lite destinations. None block the user; "proper" deep destinations (chapter reader, saved-questions screen, video library per chapter, hacks library per chapter) still recommended but no longer urgent.

| Was | Now | File |
|---|---|---|
| `Explore the manual →` (plain text) | `TouchableOpacity` → navigates to `ManualHome` (chapter selector). Invites exploration of other chapters. | `apps/mobile/src/screens/manual/ManualCategoryScreen.tsx:357` |
| `Save & explore →` (plain text) | Renamed to **`Share these →`** + `TouchableOpacity` → opens native Share sheet with the 3 questions formatted as: `"Questions for my next visit — Time to feel (week 30)\n\n1. ...\n\n2. ...\n\n3. ...\n\n— from villie"`. Direct utility: user can text/email to herself, save to notes, or hand the formatted list to her provider. No new screen needed. | `apps/mobile/src/screens/manual/ManualCategoryScreen.tsx:421` |
| `Watch the row →` (plain text) | `TouchableOpacity` → plays the first available video in the chapter row (`onCardPress(videos[0])`). Falls back to `ManualHome` if videos haven't loaded. Accessibility label dynamically describes which video will play. | `apps/mobile/src/screens/manual/ManualCategoryScreen.tsx:494` |
| `More hacks →` (plain text) | `TouchableOpacity` → navigates to `ManualHome`. Same destination as Explore — invites browsing other chapters for additional hacks. | `apps/mobile/src/screens/manual/ManualCategoryScreen.tsx:524` |

**Implementation notes:**
- All 4 use `hitSlop` of `{top:8, bottom:8, left:8, right:8}` so the tap target meets WCAG 2.5.5 without growing the visible text.
- `accessibilityRole` distinguishes `'link'` (navigation) from `'button'` (action).
- Share handler swallows the cancel error silently — no error UI for "user changed their mind."
- Two CTAs share `goToChapterList` (Explore + More hacks) since both invite "browse other chapters." Acceptable duplicate now; consider differentiating destinations when a real `ManualChapterReader` ships.

**Next-step recommendations (if/when deeper UX desired):**
- Build `ManualChapterReaderScreen` taking `audience+category+week` — long-form chapter reader for `Explore the manual →` and `More hacks →` to navigate to instead of the chapter selector.
- Build `SavedQuestionsScreen` w/ persistent storage (`user_saved_questions` table) so questions can accumulate across chapters into one printable list for the actual appointment. Replace Share-only with Save+Share.
- Build `ChapterVideosScreen` filtered by `audience+category` for full video library instead of just the first video.
