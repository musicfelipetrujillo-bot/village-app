# V9 Brand Kit Rollout — Living Plan

**Status anchor for every v9 / brand polish session.** Read this top-to-bottom before touching any design code. Update the checklists below as work completes so the next session starts from the actual state, not from re-asking the user.

---

## How to use this doc (mandatory)

1. **Start every brand/v9 session by reading this file.** Don't ask the user "where did we leave off" — the file says.
2. **As you complete an item, move it from `Pending` → `Done`** in the same commit that lands the code. The doc is the source of truth for what's shipped.
3. **Never invent a new design pattern out of band.** If the work needs a recipe that isn't already in the Canonical V9 Recipes section, propose it explicitly before applying it.
4. **Visual references** live in `/tmp/`:
   - `home-v9.html` — HomeScreen mockup
   - `manual-home-v9.html` — Manual Home compact rows mockup
   - `chapter-colors-v9.html` — Chapter color palette mockup
   - `manual-recipe-v9-context.html` — Chapter screen (Mom/Baby × Feel/Heal/etc) mockup
   - `v9-glass-annotations.html` — iOS 26 Liquid Glass treatment notes
5. **Brand kit canonical**: `memory/project_brand_kit_v2.md` is authoritative for palette + typography. v1 token names in `apps/mobile/src/utils/constants.ts` are rerouted to v2 hex values (since 2026-05-15).

---

## Background

V9 = villie brand kit v2 (May 2026) realized as a runtime design system. Two-day rollout history:

- **Day 1 (2026-05-15)** — HomeScreen v9 port (Week hero / Daily check-in strip / Manual block / WCAG AA contrast pass / iOS Glass sheens / chapter-color theming on ManualCategoryScreen).
- **Day 2 (2026-05-16)** — System-wide application: shared `V9PageBackdrop` component, paper U-shape wash applied to 56 screens, ManualHome compact rows ported, deep-screen card lift recipe on 7 high-visibility detail screens.

---

## Canonical V9 Recipes

Every reusable v9 pattern. Reference these instead of re-deriving them per screen.

### Page wash — every screen

```tsx
import { V9PageBackdrop } from '@components/shared/V9PageBackdrop';

return (
  <View style={{ flex: 1 }}>
    <V9PageBackdrop />
    {/* ...rest of screen */}
  </View>
);
```

- 7-stop U-shape gradient: paper-white middle, warm pink wash top + bottom
- Stops: `#FDF1EB → #FDF8F4 → #FCFCFB → #FCFCFB → #FCF6EF → #F9E9DD → #F5DFD3`
- Locations: `[0, 0.12, 0.30, 0.62, 0.76, 0.90, 1]`
- File: `apps/mobile/src/components/shared/V9PageBackdrop.tsx`
- Container backgroundColor on the parent View becomes `'transparent'`.

### Paper card lift — every card surface

```tsx
{
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: 'rgba(150, 80, 50, 0.18)',
  shadowColor: '#6B2E0E',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.18,
  shadowRadius: 18,
  elevation: 5,
}
```

Use this exact recipe for every `paper` card across the app. Don't drift.

### Primary CTA — every "do the thing" button

```tsx
{
  backgroundColor: '#945A41',          // action-deep
  borderRadius: 999,                   // pill — or 14 for rounded-rect when paired with rect inputs
  paddingVertical: 15,
  alignItems: 'center',
  shadowColor: '#7A4530',              // cocoa-shadow tint
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.24,
  shadowRadius: 10,
  elevation: 3,
}
// Text on top:
{ color: '#FDFAF5', fontSize: 15, fontFamily: FONTS.bodySemiBold, letterSpacing: 0.3 }
```

- **`#945A41`** is WCAG AA at 5.56:1 vs paper white text. Use it not `#C07840` cinnamon (3.5:1, fails AA at normal text).
- One primary CTA per screen — the "one spark" rule from the brand kit.
- Outline / ghost / secondary buttons keep their existing variants — they're not the spark.
- Disabled state: `opacity: 0.45`.

### Accent colors

| Role | Hex | Used for |
|---|---|---|
| Rust-deep | `#9A4A2B` | Eyebrow bars, eyebrow text, italic accents, section titles |
| Action-deep | `#945A41` | Primary CTA bg, arrow disc bg, toggle active fill |
| Cocoa | `#6B2E0E` | Shadow tint (NOT a fill color) |
| Paper | `#FDFAF5` | Card / text on dark bg |
| Bark | `#3D1F0D` | Body text |
| Bark-soft | `#5C3F26` | Secondary text |

### Chapter color families (5 families)

| Family | Light bg | Deep accent | Used for |
|---|---|---|---|
| Feel / Grow | `#F4DDD5` | `#A55248` terracotta | Mom Feel chapter · Baby Grow chapter |
| Heal / Care | `#E6EAD0` | `#606E46` moss | Mom Heal · Baby Care |
| Nourish / Feed | `#F2E7C9` | `#8C6D1E` amber | Mom Nourish · Baby Feed |
| Rest / Sleep | `#DEE3EC` | `#5B6A82` slate | Mom Rest · Baby Sleep |
| Tips / Tips | `#F2DCC5` | `#9F5F30` cinnamon | Mom Tips · Baby Tips |

All accents WCAG AA verified against `#FDFAF5` paper text. Light bg tints stay above 14:1 against `#3D1F0D` bark.

Source of truth in code:
- `ManualHomeScreen.tsx` — `TILE_FAMILY` constant
- `ManualCategoryScreen.tsx` — `CHAPTER_THEME` constant
- `HomeScreen.tsx` — `MANUAL_PILL_COLORS` constant

### Editorial masthead — every screen with a title

Every screen with a title block should follow the HomeScreen / Manual Home pattern. Plain navbar titles ("Edit Profile") are not enough. The masthead is the screen's first beat.

```tsx
<View style={styles.greetingBlock}>
  {/* Eyebrow row — 22×2 rust-deep bar + uppercase eyebrow text */}
  <View style={styles.eyebrowRow}>
    <View style={styles.eyebrowBar} />
    <Text style={styles.eyebrow}>SECTION LABEL</Text>
  </View>
  {/* Title — Playfair Bold roman with ONE italic accent on the key noun.
      One italic per screen — never on every page header. */}
  <Text style={styles.greetingName}>
    Edit your <Text style={styles.greetingItalic}>profile.</Text>
  </Text>
  {/* Hairline rule — short 48px wide */}
  <View style={styles.greetingRule} />
</View>
```

Style values (the canonical set, lifted from HomeScreen):

```tsx
greetingBlock: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
eyebrowRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
eyebrowBar: { width: 22, height: 2, backgroundColor: '#9A4A2B', marginRight: 10, borderRadius: 1 },
eyebrow: { fontSize: 10, fontFamily: FONTS.bodySemiBold, color: '#9A4A2B', letterSpacing: 1.8, textTransform: 'uppercase' },
greetingName: { fontSize: 32, fontFamily: FONTS.headerBold, color: COLORS.bark, lineHeight: 38, letterSpacing: -0.5, marginBottom: 8 },
greetingItalic: { fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: '#9A4A2B' },
greetingRule: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(61,31,13,0.18)', marginTop: 14, width: 48 },
```

### One italic per screen rule

Every screen has **exactly one** Playfair italic phrase — on the key noun, user's name, or wordmark dot. Never on body sentences, links, multi-line paragraphs, or every section header. If the eyebrow is in italic, the title is roman. If the title's accent is in italic, body stays sans-serif.

### iOS-26 Liquid Glass sheen — for hero / masthead cards

```tsx
// Top white sheen (~16px tall)
<LinearGradient
  pointerEvents="none"
  colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
  style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 16 }}
/>
// Hairline ridge at top
<View
  pointerEvents="none"
  style={{
    position: 'absolute', top: 0, left: 0, right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.7)',
  }}
/>
```

Use on Week hero, Daily check-in strip, Manual block, Help card, Explore card, MeScreen masthead, Manual Home masthead, chapter row arrow discs.

### Typography (v2 brand kit)

- **Wordmark**: `assets/brand/villie-wordmark-v2.png` (hand-drawn). Fallback: Caprasimo 400.
- **Display**: Playfair Display Bold 700 (roman). Italic flourish: Playfair Display SemiBold Italic 600 — **one per screen** on key noun / user's name.
- **Body / UI**: Plus Jakarta Sans 400/500/600.
- **Eyebrows / metadata**: JetBrains Mono 500, letterSpacing `2.2`, uppercase, color rust-deep `#9A4A2B`.

Italic per screen ≤ 1 phrase. Cinnamon per screen = 1 spark.

### Editorial title format (chapter rows / hero copy)

Format: `<prefix> <em>italicWord.</em>`

Examples:
- "Time to *feel.*" / "Time to *heal.*" / "Time to *nourish.*" / "Time to *rest.*"
- "Real-world *tips.*"
- "How they *feed.*" / "How they *sleep.*" / "How they *grow.*"
- "How to *care.*"
- "Tiny *wins.*"

The italic word + period takes the chapter accent color. The prefix stays bark.

---

## Done — Foundation (Day 1 + Day 2 morning)

- [x] Brand kit v2 wired into `apps/mobile/src/utils/constants.ts` (v1 token names rerouted to v2 hex)
- [x] HomeScreen.tsx full v9 port (Week hero, Daily check-in strip, Manual block, Welcome card, Help + Explore cards, iOS Glass sheens, cocoa-drop card lifts, WCAG AA contrast pass)
- [x] WarmGlowBackdrop.tsx updated to v9 U-shape gradient (pink-white-pink)
- [x] ManualCategoryScreen — pixel-faithful v9 port + chapter color theming via `CHAPTER_THEME` map keyed on `${audience}/${category}`
- [x] ManualHomeScreen — compact horizontal-row layout (5 chapter rows w/ spine + Roman numeral + editorial title + folio + glass arrow). Old 2-col tile grid + `ManualTileArt` retired.
- [x] Shared `V9PageBackdrop` component created (`apps/mobile/src/components/shared/V9PageBackdrop.tsx`)
- [x] V9 page wash applied to **56 screens** across Auth · Home · Manual · Me · Experts · Milk · Gear · Inbox · Village · Events · Perks
- [x] Stale `#F2E9C4 / #EADBA8 / #E8C4B6` golden→blush gradients retinted to cream-paper across Milk hub dashboard, Gear card body, WeeklyJourney hero, Inbox, Village

## Done — Card lift recipe applied

- [x] HomeScreen "How can we help today?" routing retune (2026-05-16) — see Notes & Decisions
- [x] HomeScreen — all v9 cards (Week hero, Daily check-in strip, Manual block, Help, Explore)
- [x] MeScreen — masthead + section cards
- [x] ManualHomeScreen — chapter row cards
- [x] ManualCategoryScreen — Week hero, Manual book, Ask Specialist, Quick Watches, Mom Hacks
- [x] SpecialistProfileScreen — `tabContent` + section title rust-deep
- [x] DonorProfileScreen — info `card`
- [x] GearListingDetailScreen — `metaGrid` + `section` + `sellerBlock`
- [x] MilestoneDetailScreen — `card`
- [x] EventDetailScreen — `section`
- [x] MyRsvpsScreen — `card`
- [x] PerkDetailScreen — `metaBlock`
- [x] MyClaimsScreen — `card`

---

## Done — Editorial masthead pattern + V9 hub gradient alignment 2026-05-16

**V9 paper-leaning masthead gradient + iOS Glass sheen on remaining hubs**
- [x] VillageHomeScreen — header gradient swapped from olive/sand (`#DCDBA0 → #C2BCAE`) to cream→blush (`#FCF6EF → #F2DDD0`) + glass sheen. Sage eyebrow bar preserved as Village identity per product intent.
- [x] InboxHomeScreen — header gradient swapped from golden (`#E8D8A0 → #D2B8B0`) to cream→blush + glass sheen.

(ManualHome / MeScreen had this already; Experts / Milk / Gear hubs use WarmGlowBackdrop which is paper-leaning.)

**Editorial masthead — 7 screens unified to one pattern**

Pattern: rust-deep 22×2 eyebrow bar + uppercase eyebrow text + Playfair Bold roman lead + Playfair italic accent word + hairline rule (48px wide).

- [x] **ChangePasswordScreen** — "Change your *password.*" · eyebrow "ACCOUNT & SECURITY"
- [x] **ChangeEmailScreen** — "Change your *email.*" · same eyebrow
- [x] **DeleteAccountScreen** — "Delete your *account.*" · same eyebrow
- [x] **NotificationPreferencesScreen** — "How we *nudge you.*" · eyebrow "PREFERENCES"
- [x] **RadiusPreferenceScreen** — "How far we *look.*" · same eyebrow
- [x] **BookingScreen** — "Book your *visit.*" · eyebrow "APPOINTMENT" · provider name kept beneath
- [x] **PaymentScreen** — "Confirm and *pay.*" · eyebrow "APPOINTMENT"
- [x] **BabyProfileSetupScreen** — per-step eyebrow already had stepLabel format ("Step 1 of 4"); bumped eyebrow color rust-deep + title to Playfair Bold roman from Plus Jakarta SemiBold.
- [x] **OnboardingProfileScreen** — was already on Playfair v2_display + caramel italic accent. Caramel `#D4A880` → rust-deep `#9A4A2B` for canonical alignment with HomeScreen + all other v9 italic accents. (Brand-kit token says caramel; HomeScreen wins as canonical.)

**Detail-screen hero hairlines** — closing rule below the hero block, mirroring HomeScreen.greetingRule. Italic accent on the hero name/title remains the screen's italic flourish.

- [x] **SpecialistProfileScreen** — `heroRule` (48px @ bark/18%) added below badges row, alignSelf:center to match the centered hero composition.
- [x] **DonorProfileScreen** — `heroRule` added below the heroContent block, aligned to heroInfo column.
- [x] **GearListingDetailScreen** — `categoryBadge` color bumped from `COLORS.sage` to rust-deep `#9A4A2B` (was the only sage eyebrow text outside Village); `heroRule` added below price.

**Last sweep — celebration screens + Playfair title bumps**
- [x] **ForgotPasswordScreen** — full editorial masthead pattern ("Let's get you *back in.*" eyebrow "FORGOT PASSWORD")
- [x] **BecomeDonorIntroScreen** — per-step title: Plus Jakarta SemiBold → Playfair Bold roman; `earningsNum` (big number): Plus Jakarta → Playfair Bold 40pt per brand kit "Big numbers: Playfair 800" rule.
- [x] **OnboardingCompleteScreen** (donor) — title: Plus Jakarta → Playfair Bold; doneBtn: stale `COLORS.coco` → v9 canonical CTA (`#945A41` + cocoa shadow).
- [x] **Title font sweep** — 8 screens swapped large-size `bodySemiBold` titles to `headerBold` Playfair Bold: TrustBadgeBuilder · MilkShippingLabel · MilkDisputeOpen · CreateListing (milk) · EventDetail · PerkDetail · GearListing `price` · CommunityHome `headerTitle` (deferred — Community tab hidden).
- [x] **RsvpConfirmScreen + MilkOrderConfirmScreen** — titles: Plus Jakarta → Playfair Bold.

**v9 typography rule canonized**: all large display titles (≥24pt) MUST use `FONTS.headerBold` (Playfair Display Bold roman). Large numeric values (≥30pt) MUST use `FONTS.headerBold` too. Plus Jakarta is for body, ≤18pt headings, and UI labels — never for display titles.

## Done — Phase 1 + Phase 3 (chapter palette) — Brand kit canon alignment 2026-05-16

After auditing the canonical brand kit (`/Users/gp/Desktop/the-village-ig/project/The Village - Brand Kit.html`), executed Phase 1 + chapter repaint. See `docs/V9_BRAND_KIT_GAP_ANALYSIS.md` for the full audit.

**Phase 1 — Color hierarchy split** (rust-deep `#9A4A2B` was collapsing 3 distinct kit roles):

- **Eyebrows / captions / labels / top-bar dashes** → amber `#A77349` (kit canon: "the quietest voice"). Multi-pass sweep over ~150 rust-deep instances; amber for any: name contains "eyebrow", `textTransform: 'uppercase'`, `letterSpacing >= 1.5`, name contains "Label / TopBar / *Num / pricingValue / ratingLabel / etc."
- **Italic flourishes (greeting names, title accents, hero italics)** → cinnamon `#C07840` (kit canon: "the most-used italic in the product"). Python multi-line aware sweep over all `FONTS.headerItalic` style blocks.
- **Links / back text / CTA text / readMore / "All chapters →"** → cinnamon `#C07840` (kit canon: "every link, every active tab"). Sweep over named link styles + back text.
- **ActivityIndicator** → cinnamon `#C07840` (loading is an "action moment").
- **Crisis sheet 911 accent** → cinnamon (kit canon for emergency/action).

**Phase 3 — Chapter palette repaint to kit canon** (user decision: keep 10 chapters, match colors to brand and topic):

The kit's brand-palette phone mockup (page 06 UI) shows the canonical 5-pill set using main brand colors. 10 app chapters mapped by semantic match:

**5 families across 10 chapters** — within mom (5 chapters) colors never repeat; same for baby. Paired chapters (mom/rest ↔ baby/sleep) intentionally wear the same family so the sister concept reads as the same room.

| App chapter | Kit family | Hex | Text |
|---|---|---|---|
| mom/feel + baby/grow | Salmon | `#EDA8A0` | cocoa `#3D1F0E` |
| mom/heal + baby/care | Moss | `#606E46` | card `#FEFAF6` |
| mom/nourish + baby/feed | Butter | `#FAD080` | cocoa |
| mom/rest + baby/sleep | Sage | `#D8CEB0` | cocoa |
| mom/tips + baby/tips | Marigold | `#F2C130` | cocoa |

*(History 2026-05-16 — tried two variants this session. First attempt: 5 families × 2 (paired), which read as duplicate pills. Second attempt: 10 fully-distinct colors (added blush/sage-deep/caramel/parchment-deep/walnut for baby). User feedback: only within-group repeats matter — mom shouldn't repeat with mom, baby shouldn't repeat with baby, but mom↔baby pairs sharing a family is intentional. Final: back to 5 families across 10 paired chapters. Cinnamon stays reserved for CTAs per kit's "one spark per screen" rule.)*

Updated:
- `HomeScreen.tsx` → `MANUAL_PILL_COLORS` constant (5 pills on Home Manual block)
- `ManualHomeScreen.tsx` → `TILE_FAMILY` (10 tile mappings; light bg + family accent for ManualHome tile grid)
- `ManualCategoryScreen.tsx` → `CHAPTER_THEME` (10 chapter pages with kit-family accent + bg tint + yolk)

**Result**: chapter pills on Home now read as a tour of the brand palette (salmon→moss→butter→caramel→cinnamon), with mixed text colors per the kit's WCAG-aware pairing (cocoa on light pills, paper on dark). Manual Home tiles + chapter pages share the same family logic.

**Still pending (user-approval gates):**
- ~~Phase 2 — CTA color swap~~ ✅ Done 2026-05-16 (see next section).
- ~~Phase 4 — Paper hex correction~~ ✅ Done 2026-05-16 (see next section). Wordmark asset path renames remain deferred per "no structural changes" directive.

## Done — Phase 2 + Phase 4 + drift sweep 2026-05-16

Executed under user constraint *"no cambies nada estructuralmente"* — color/token swaps only, no layout/structure changes.

**Phase 2 — CTA color swap to cinnamon:**
- 31 `backgroundColor: '#945A41'` → `'#C07840'` cinnamon. CTA fills across 22 buttons (auth, home, experts, milk, gear, events, perks, me). WCAG Large Text 3:1 passes at 15-16pt SemiBold/Bold (the actual button text sizes in use).
- 27 `shadowColor: '#7A4530'` → `'#945A41'` action-deep. Tonal shadow under the cinnamon fill keeps depth without going muddy.

**Phase 4 — Paper hex canonicalization:**
- 131 instances of `'#FDFAF5'` → `'#FDFBF6'` kit canon (1 hex off in green channel — invisible difference but technically drift).

**Follow-up drift sweep (same session):**
- HomeScreen `welcomeEyebrow` + `checkinStripEyebrow` text color `#945A41` → amber `#A77349`. Per kit rule, eyebrows are amber, not action-deep — `#945A41` is the shadow color, not a text role.
- `ManualCategoryScreen.tsx` `V9.rust` token `#B85C38` → cinnamon `#C07840`; `V9.rustDeep` `#9A4A2B` → action-deep `#945A41`. Token names kept for grep compatibility across ~60 refs in the chapter masthead / week hero / tile SVG.
- `ManualTileArt.tsx` `C.rust` / `C.rustDeep` same swap. 50+ SVG `Path` / `Circle` / `Ellipse` fills in the illustrated tile art now warm slightly into cinnamon's hue.

**Verification:** `npx tsc --noEmit` clean. Zero remaining `'#9A4A2B'` or `'#B85C38'` literals in `apps/mobile/src` (kit-retired tokens fully gone).

**Deferred (still requires explicit approval):**
- Wordmark asset path renames (`villie-wordmark-v2.png` → kit canonical names). Structural; outside scope of "no estructural" constraint.

## Done — HomeScreen Manual block goal line 2026-05-16

Added a one-line description below the eyebrow row and above the chapter pills, framing what the Manual is for:

- **EN**: "Short chapters for the first weeks home."
- **ES**: "Capítulos breves para las primeras semanas en casa."

Style: `FONTS.body` 12pt / lineHeight 16, bark-soft `#5C3F26`. No italic — the italic flourish on this surface stays on the masthead, not in helper copy. Per the "italic per screen ≤ 1 phrase" rule.

Also moved the previously-hardcoded `"The manual"` / `"All chapters →"` strings to i18n (`home.manualBlockEyebrow` / `home.manualBlockAllChapters`) so they translate alongside the new lead key (`home.manualBlockLead`). Wired `useT()` into the `ManualBlockHome` sub-component.

Why the copy works for discharge-handoff:
- **Short chapters** — sets time budget (postpartum mom = no time / one hand on phone)
- **first weeks home** — names the moment + the place (just discharged from hospital)
- Lower-case, factual, no marketing voice — clinician-handoff appropriate
- Bridges the "what does this section do" gap so the 5 chapter pills feel like "doors into something" rather than random tabs.

## Done — Inconsistency / Redundancy Audit Sweep 2026-05-16

User asked for a deeper audit of "inconsistencies, redundancies, and loose ends." Findings + fixes:

### Color drift unified
- **ActivityIndicator color**: 51 instances of `COLORS.coco` (caramel — too pale) + 13 `"#FFF"` + 6 `"white"` swept to canonical:
  - User-facing spinners: `#9A4A2B` rust-deep (52 instances).
  - Spinners inside dark CTAs (loading button): `#FDFAF5` paper white (20 instances).
  - Admin `internal/*` screens kept on COLORS.coco (intentional).
- **`color: '#FFF'` / `'white'` text colors**: 55 swept to `#FDFAF5` paper white per brand kit "no pure white" rule.
- **`color: COLORS.cream` text usage**: 18 swept to `#FDFAF5`. Cream is a BG token — using it as text color was drift.
- **Active-state backgrounds**: 4 spots using `COLORS.coco` for "active button / chip / checkbox" state swapped to v9 action-deep `#945A41` (matching the global CTA recipe): DailyCheckin moodChip · MilestoneTimeline weekBtn · WeeklyJourney checkbox · HomeScreen emptyCta. Same fill, same shadow, same paper text — full v9 affordance unification.
- **Old gray back text**: 6 Milk donor screens had `backText: { color: '#9A8070' }` (hardcoded grey) → swapped to rust-deep `#9A4A2B` matching every other back link.

### Process notes — perl pitfalls (so future sweeps don't trip)
- **`$1{"..."}` in perl replacement parses as `$1` hash lookup.** First attempt to sweep ActivityIndicator color produced empty replacements that wiped out the entire JSX tag. 30 files showed `< />` corruption. Fixed via two-pass repair:
  1. `s|< />|<ActivityIndicator color="#9A4A2B" />|g` for bare broken tags
  2. `s|< style=|<ActivityIndicator color="#9A4A2B" style=|g` (+ size variant) for inline-attr broken tags
- **Shell-quoting `(?:size=|style=)` mangles**: zsh treats `|` inside parens as alternation. Workaround: split into two `s|||g` statements in a `.pl` file invoked via `perl scriptfile.pl <files>` rather than `-pe` from CLI.
- Pre-commit verification: always run `grep -rE '< />' <root>` AND `npx tsc --noEmit` after any JSX-mutating sweep.

### Loose ends inventoried (not fixed — track in this section)
- 1 `TODO:` in `hooks/useAnalytics.ts:140` ("Replace with your analytics provider in production") — fine as-is until shipping; production already has Sentry breadcrumbs.
- Back-button arrow character drift: `←` (most common), `‹` (some screens), arrow embedded in i18n string vs JSX inline. Functional but visually inconsistent. Future polish: unify on `←` arrow + put it inline in JSX, never in i18n string.
- Per-screen `back` i18n keys (`donorProfile.back`, `gearDetail.back`, etc.) when `common.back` exists. Redundant but harmless. Future: collapse to `common.back` across all screens.
- Stale i18n keys: `pwTitle`, `emTitle`, `delTitle` retained for fallback but unused after the editorial-masthead pattern landed. Safe to prune in a later cleanup.
- Shadow opacity drift: 10+ distinct opacity values across cards. v9 canonical = 0.18 (card lift), 0.24 (CTA). Future sweep: normalize the outliers (0.05, 0.06, 0.10, 0.20, 0.30, 0.42).

i18n keys added EN+ES for every screen (`headerEyebrow` / `titleLead` / `titleEm` or screen-specific equivalents).

**Side-effect ban cleanup**: removed `fontStyle: 'italic'` applied to `FONTS.headerBold` on the 3 Me edit screens. That combo forces synthetic italic on a roman Playfair font — a v9 ban (typography should never synthesize a style the font already provides). Italic now only on the accent word via `FONTS.headerItalic` (PlayfairDisplay_600SemiBold_Italic). Audit confirmed no remaining Playfair synthetic-italic violations across screens.

**v9 ban audit results (clean)**:
- `borderLeft/Right > 1px` colored accent on cards — only DeleteAccount card had it; replaced with full hairline border earlier.
- Playfair Bold + fontStyle: italic — 3 screens had it; all fixed in this pass.
- All "italic per screen ≤ 1 phrase" preserved on the touched screens.

## Pending — V9 Craft Pass (deep screens)

### Booking + Payment flow (V1) — DONE 2026-05-16
- [x] BookingScreen — `serviceCard` lifted (paper + cocoa drop + rust hairline)
- [x] PaymentScreen — `summaryCard` lifted
- [x] BookingConfirmScreen — `card` lifted

### Messaging (V1 + V2 + V4) — SKIPPED 2026-05-16
Thread inboxes are list-row UI (full-width rows + hairline separators), not card grids. Chat detail screens are bubble-based, not card-based. Card lift recipe is inappropriate here. Page wash already applied via `V9PageBackdrop`. Future polish: bubble shadow on own/peer bubbles, composer hairline tint — not card lift.

### Milk depth (V2) — high-visibility lifted 2026-05-16
- [x] MilkPurchaseScreen — order summary `card`
- [x] MilkOrderConfirmScreen — `summaryCard`
- [x] MilkMatchScreen — preference `card`
- [x] MilkOrdersScreen — order row `card`
- [x] DonorCard component — v9 lift (paper + cocoa drop + rust hairline) + amber eyebrow + cinnamon italic accent on surname + cinnamon saved-heart. Touches `DonorSearchListScreen`, `SavedDonorsScreen`, `MilkMatchScreen`, `MilkConnectHomeScreen` simultaneously. 2026-05-16.
- [x] MilkReviewSubmitScreen — body input lifted with rust hairline + soft cocoa drop. 2026-05-16.
- [x] SavedDonorsScreen — empty-state "Browse" CTA swapped to cinnamon. 2026-05-16.
- [x] CreateListingScreen (milk donor) — fee-note side-stripe BAN replaced with full hairline; toggle rows lifted. 2026-05-16.
- [x] DonorQuestionnaireScreen — option cards lifted, coachCard side-stripe BAN replaced with full hairline + cocoa drop, nextBtn swapped to cinnamon CTA. 2026-05-16.
- [x] TrustBadgeBuilderScreen — badgeCard + checklistCard lifted, flag chips swapped to cinnamon active state. 2026-05-16.
- [x] MilkShippingLabelScreen — address card lifted. 2026-05-16.
- [x] MilkDisputeOpenScreen — option cards lifted, active radio swapped to cinnamon, textarea lifted. 2026-05-16.
- [x] DonorProfileScreen — narrativeCard + qaAnswer side-stripe BANs replaced with full cinnamon hairlines. 2026-05-16.

### Gear depth (V4) — lifted 2026-05-16
- [x] MyListingsScreen — listing row `card`
- [x] SavedGearScreen — saved row `card`
- [x] GearBrowseScreen card — paper bg (moved off saturated tan #F2E9C4) + v9 lift recipe + amber category eyebrow + cinnamon FAB. 2026-05-16.
- [x] CreateListingScreen (gear) — chip active state swapped to cinnamon, priceRow lifted, upload progress bar swapped to cinnamon. 2026-05-16.

### Me depth — partially lifted 2026-05-16
- [x] NotificationPreferencesScreen — `list` card lifted (wraps switch rows)
- [x] DeleteAccountScreen — `card` lift + `cardMuted` (data-retention card) side-stripe BAN replaced with full sand-tinted hairline. 2026-05-16.
- [x] EditProfileScreen — stage chip active swapped to cinnamon, retry CTA swapped to cinnamon, avatar edit-badge swapped to cinnamon, error border swapped to red (was caramel — confusing). 2026-05-16.
- [x] RadiusPreferenceScreen — chip active swapped to cinnamon. 2026-05-16.
- [x] MeScreen — `crisisCallout` side-stripe BAN replaced with full cinnamon hairline (still pinkSoft bg). 2026-05-16.
- [ ] ChangeEmailScreen / ChangePasswordScreen — input-only forms, no card surface (intentionally skipped)

### Notes from this pass
- **Side-stripe borders are a v9 absolute ban** (per `impeccable` skill). Encountered in DeleteAccountScreen warning card — replaced with full rust-deep hairline. If you see `borderLeftWidth/borderRightWidth > 1` as a colored accent on any card during future work, rewrite per the v9 recipe: full hairline border in the warning color OR background tint OR leading icon — never the stripe.

### Auth depth — DONE 2026-05-16
- [x] OnboardingProfileScreen — stage cards lifted with v9 recipe (rust hairline + soft cocoa drop); active state swapped from 2px cinnamon border to hairline + warm parchment fill + heavier shadow.
- [x] ForgotPasswordScreen — success state wrapped in v9 card lift so "check your inbox" reads as a confirmed moment rather than floating text.

### Home depth — partially lifted 2026-05-16
- [x] CheckinResponseScreen — `crisisCard` (rewrote banned 2px borderColor stroke → v9 hairline + paper lift) + `replyCard`
- [x] BabyProfileSetupScreen — `reviewCard`
- [x] DiscoverHomeScreen — `tile` (6-tile router grid, bg moved off pure #FFF to COLORS.paper + lift)
- [x] NotificationsScreen — `retryPill` swapped to cinnamon CTA, `unreadDot` swapped to cinnamon (action affordance). 2026-05-16.
- [x] WeeklyJourneyScreen — `supportCard` side-stripe BAN replaced with full sage hairline. 2026-05-16.
- [ ] DailyCheckinScreen — mood/energy picker chips (not card-shaped; lift less applicable. Already canonical per earlier color drift sweep.)

### Shared components — DONE 2026-05-16
- [x] CrisisResourcesSheet (`components/community/`) — per-resource card `borderLeftWidth: 4` side-stripe BAN replaced with full 1.5px border in the same per-resource accent color (988=coco, Crisis Text=sage-deep, PSI=butter, 911=cinnamon). Inline `borderLeftColor: r.accent` → `borderColor: r.accent`.

### Eyebrow / accent unification — DONE 2026-05-16

**Back-button text color sweep** — 32 files. Pattern matched: `^\s+(back|backText|headerBack): \{[^}]*color: COLORS\.coco,` → swapped `COLORS.coco` to `'#9A4A2B'`. Files touched span every Auth/Home/Me/Experts/Milk/Gear/Events/Perks deep screen. Sed couldn't handle the nested groups so used `perl -i -pe` in a loop.

**Text/label color sweep** — every user-facing `color: COLORS.coco,` and `color: COLORS.cocoDeep,` swapped to `'#9A4A2B'` rust-deep across:
- Home depth: NotificationsScreen, MilestoneDetail, WeeklyJourney, CheckinResponse
- Milk depth: TrustBadge, BecomeDonor, MilkShippingLabel, DonorSearchList, DonorProfile, DonorMap, MilkReviewSubmit, DonorQuestionnaire, MilkOrderConfirm, MilkDisputeOpen
- Gear depth: MyListings headerLink, SavedGear, GearMessageDetail listingCta, GearListingDetail price, GearBrowse
- Hubs: Experts/Milk/Gear/Inbox `eyebrowBar` + `eyebrow`

**Skipped** — `screens/internal/*` (admin tools, not in v9 polish scope). VillageHome `eyebrowBar` kept sage — V3 identity per product intent.

**Visual outcome**: every back link, eyebrow text, narrative label, price/value accent, link CTA now reads in the same rust-deep voice across all four verticals. No more drift between `COLORS.coco` (now caramel `#D4A880` — too pale) and the intended brand accent.

### Visual refinement — Primary CTA recipe unified 2026-05-16

Before this pass, the app had 3 different CTA styles:
- **Sand pill** (`COLORS.sandSoft` bg + bark text) — pale, low-emphasis
- **Coco coffee** (`COLORS.coco` bg + white text + radius 14) — stale token (`COLORS.coco` reroutes to caramel `#D4A880`)
- **v2 cinnamon** (`COLORS.v2_cinnamon` bg + cinnamon shadow) — closest to brand kit but `#C07840` fails WCAG AA on normal-size white text (3.5:1)

All unified to the canonical recipe (see Canonical V9 Recipes → Primary CTA). Files touched:

- [x] **Auth (5)**: LoginScreen, SignUpScreen, ForgotPasswordScreen, OnboardingScreen, OnboardingProfileScreen
- [x] **Home depth (2)**: DailyCheckinScreen submit, BabyProfileSetupScreen primaryBtn
- [x] **Experts (1)**: ReviewSubmitScreen submitBtn
- [x] **Milk (7)**: MilkConnectHome primaryBtn, MilkReviewSubmit submitBtn, TrustBadgeBuilder continueBtn, MilkOrderConfirm primaryBtn, MilkShippingLabel cta (+ secondary outline variant), MilkDisputeOpen cta, CreateListing (milk) saveBtn
- [x] **Gear (1)**: CreateListing (gear) submitBtn
- [x] **Events / Perks (3)**: EventDetail primaryBtn, PerkDetail cta, PerkClaim primaryBtn
- [x] **Me (2)**: ChangeEmail btn, ChangePassword btn

Total: 21 CTAs unified. All use `#945A41` bg + `#7A4530` shadow + `#FDFAF5` paper-white text. Disabled state opacity 0.45.

### Empty state pass — already shipped 2026-04-24
Per earlier session work (see CLAUDE.md memory "empty-state pass 2026-04-24"): MyListings · SavedGear · MyClaims · MyRsvps · MilkOrders all have v9-aligned empty states with emoji + bold title + body + rust pill CTA. No additional work needed.

### Hero glass sheens — DONE 2026-05-16
- Extracted `GlassHighlight` from HomeScreen (was a private inline component) to `components/shared/GlassHighlight.tsx`. Two-stop top sheen + 1px hairline cap, parametrized by `radius` + `height`. Render as the first child of a lifted card.
- Wired onto the most premium card per detail screen:
  - **DonorProfileScreen** — AI narrative card (the "in their voice" highlight, the most curated beat above trust/diet/reviews)
  - **GearListingDetailScreen** — `metaGrid` (first lifted card under the image carousel = "substance starts here")
  - **SpecialistProfileScreen** — `tabContent` (the about/services/reviews tab body, the lifted "you're now in detail" surface)
- HomeScreen still uses its private GlassHighlight; kept as-is to avoid breaking 7 in-file usages. Future cleanup can collapse onto the shared module.

### Curated audit sweep — DONE 2026-05-16

Static design-consistency audit script (`apps/mobile/scripts/v9-audit.mjs`) generates `docs/V9_AUDIT.md` listing every kit violation across the codebase. First baseline: 205 violations. After curated sweep: **0 / 0 / 0** (bans/drift/nits).

**Strategy:** "curated" not "literalist." Cinnamon `#C07840` only fires on unambiguous primary actions (one spark per screen, per kit). Soft active states keep caramel for warmth essence.

**Swap breakdown (kit canon):**
- 35 primary CTAs `COLORS.coco` → cinnamon `#C07840` across 25 files. Includes payBtn (Milk Purchase), applyBtn (Filter Drawer), bookBtn (Specialist Card), all empty-state browse CTAs, all confirm/retry/send buttons, the FloatingHelpButton FAB, Booking flow CTAs, Perk claim CTAs.
- 4 chat-bubble "mine" backgrounds `COLORS.coco` → walnut `#7A4A28` (kit token, WCAG 7.4:1 with paper text). Text color also swapped to paper `#FDFBF6`. Covers Messaging (V1), MilkMessageDetail (V2), GearMessageDetail (V4), AIHelpChat.
- 1 segmented toggle (ManualHome "For mom / For baby") → parchment fill + cinnamon hairline border + cocoa text. Soft active that doesn't compete with chapter pills or the page italic-accent.
- 36 files pure-cosmetic sweep: pure-white literals → paper `#FDFBF6`, generic `rgba(0,0,0,X)` card borders → rust hairline `rgba(150,80,50,0.18)`, cold `shadowColor: '#000'` → cocoa-tinted `#6B2E0E`.

**Kept by design (exempted in audit):**
- Filter chip active states (Experts / Gear / Events) — scoping ≠ action; soft caramel preserves warmth
- Form checkboxes / progress dots / progress fills — informational, not actions
- Notification badge bgs (unread counts) — identity marker
- Hero card bgs (MilestoneDetail, MilestoneTimeline) — full-bleed art surfaces
- Avatar fallback backgrounds — decorative
- Decorative accent bars (greetingDateBar, sectionAccentBar, matchAccent) — chrome
- Destructive `dangerBtn` (DeleteAccount) — caramel is softer than alarming red; kit has no destructive red
- Onboarding success circle — decorative celebration
- Action-deep `#945A41` as button border around cinnamon fill — canonical CTA recipe (same family, darker rim)
- Action-deep on secondary outline CTAs (`ctaSecondary`, `ctaLabelSecondary`) — would compete with primary if cinnamon

**Reusable component** — `apps/mobile/src/components/shared/PrimaryCTA.tsx`. Bakes in cinnamon fill + action-deep tonal shadow (opacity 0.18) + iOS-26 wet-glass top sheen + `overflow:hidden` clip + `textAlign:center` + `justifyContent:center` + paper-white SemiBold label + loading/disabled states + a11y. Three top-impact CTAs migrated 2026-05-16: `MilkPurchaseScreen` payBtn, `PaymentScreen` payBtn (V1 specialist), `FilterDrawerModal` applyBtn. Remaining 22 CTAs keep the canonical inline recipe (visually identical without the glass sheen — fine for now, can migrate incrementally).

**Dead-end CTAs wired** 2026-05-16 — see `docs/V9_UNRESOLVED_CTAS.md` for full inventory. The 4 chapter-page CTAs (`Explore the manual →`, `Save & explore →` → renamed `Share these →`, `Watch the row →`, `More hacks →`) are now tappable with lite destinations (chapter selector, native Share sheet, first-video, chapter selector respectively). Proper deep destinations recommended in the doc but no longer urgent.

**Audit script** (`scripts/v9-audit.mjs`):
- Run: `node scripts/v9-audit.mjs > docs/V9_AUDIT.md`
- Filter: `node scripts/v9-audit.mjs --severity=BAN` (or DRIFT, NIT)
- Idempotent. Re-run after any design change. Failing on BAN count >0 would make a good CI gate.

### Wordmark canon — DONE 2026-05-16
- SplashScreen was using `villie-wordmark.png` (the OG v1 design, different SHA from v2). Switched to `villie-wordmark-v2.png` so the first-pixel-on-the-app is on-brand.
- Login / SignUp / Home were using `villie-wordmark-sm.png`, which is byte-identical to `villie-wordmark-v2.png` (verified via shasum). Renamed all 3 refs to `-v2` so the import path matches the kit canon name. No visual change.
- `villie-wordmark.png` (OG) and `villie-wordmark-sm.png` left in `assets/brand/` as historical artifacts but no longer referenced. Safe to delete in a future cleanup.

---

## Pending — Non-design queue

These are tracked here so they don't get lost between sessions, but they're separate from v9 craft work.

- [ ] Send a real test invite to a non-self specialist (verify the Resend pipeline end-to-end)
- [ ] Build admin UI in mobile app for issuing specialist invites
- [ ] Pre-launch: final `RESEND_API_KEY` rotation from terminal
- [ ] Decide canonical URL direction (apex vs www) and align Vercel + Supabase config
- [ ] eBay API: waiting on Developers account approval (~1 day from 2026-05-15). Once approved → add App ID + Cert ID to Supabase Secrets, build `gear-price-suggest` Edge Function.
- [ ] Supabase security migrations 051–054 — written on disk, not yet applied to hosted (see `CLAUDE.md` V4 Open Gates → "Migrations 051–053 — security advisor sweep" for details).

---

## Notes & Decisions

- **Home "How can we help today?" routing** (2026-05-16) — previous wiring sent "Feeding help" to the full Experts directory (too broad) and "Find moms" to the Milk hub (donor marketplace, not community → dead-end since Connect tab is hidden). Retuned to prioritize "give me the answer right now":
  - Feeding help → Manual · Baby · Feed (latch, supply, bottles)
  - Hard day? → Daily check-in (unchanged)
  - **Body & recovery** → Manual · Mom · Heal (lochia, stitches, C-section) — replaces "Find moms" tile
  - Ask villie → AI chat (unchanged)
  - i18n keys `helpFindMoms*` retained for now but unused; `helpRecovery*` added EN+ES. Can prune old keys once we confirm the new wiring sticks.
- **Chapter palette is canon across 3 surfaces**: HomeScreen Manual pills (deep accent for white text), ManualHomeScreen tiles (light bg + deep markTint), ManualCategoryScreen pages (light bg tints + deep accent for eyebrows/italics/CTAs). Tile → page transition is a true color match in the same family.
- **Italic typography on `weekHeroNum`**: Uses `FONTS.headerItalic` (PlayfairDisplay_600SemiBold_Italic). The `_500Medium_Italic` weight is NOT loaded — using that string falls back to system serif silently. Always reference via `FONTS.headerItalic` token.
- **Manual pill text is uniformly paper white (`#FDFAF5`)** across all 5 chapters. To support white text at WCAG AA, the lighter Feel/Nourish/Rest variants were shifted to deeper terracotta/amber/slate.
- **Don't add gradient text** or side-stripe borders or glassmorphism as defaults. See `memory/project_brand_kit_v2.md` and the `impeccable` skill for absolute bans.
- **Per-screen italic rule**: one Playfair italic phrase per screen, on user's name OR a key noun OR the wordmark dot. Never on body sentences or links.
