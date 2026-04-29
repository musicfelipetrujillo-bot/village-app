# Editorial System — Tokens & Rules

The pinned design system for The Village App's editorial surfaces. Reference
this doc before any visual work — its purpose is to keep typography, spacing,
and decoration consistent so the screen-by-screen polish sweep doesn't drift.

Source: audit of `MilkConnectHomeScreen` (most current pattern), `ExpertsHomeScreen`,
`HomeScreen` v4/G7 redesign, and the moodboard reference at
`/Users/gp/Desktop/The Village/The Village - UI Design Ref.png`.

Generated 2026-04-28 during the **beauty master plan — Phase 0**.

---

## 1. Type scale

### Page title (Playfair Display Italic)
**Canonical:** `fontSize: 32, lineHeight: 38, fontFamily: FONTS.headerItalic, fontStyle: 'italic', color: COLORS.brownDeep`

Used on the page-header eyebrow → title stack. Drops to **26pt** on dense list
screens (Experts) where the title is competing with chips + cards within the
first fold.

| Surface | Size used today | Action |
|---|---|---|
| MilkConnectHome `headerTitle` | 38 / 44 | ⬇ to 32 / 38 |
| ExpertsHome `pageTitle` | 26 | ✅ keep (dense list exception) |
| HomeScreen `greetingName` | 36 / 42 (headerBold + italic accent) | ✅ keep (greeting is its own pattern) |
| HomeScreen `statementTitle` | 32 / 38 (headerBold + italic accent) | ✅ keep (matches canonical) |

### Section title (Playfair Display **Bold**, non-italic)
**Canonical:** `fontSize: 24, lineHeight: 30, fontFamily: FONTS.headerBold, color: COLORS.brownDeep, marginBottom: 6`

Used on every Discover-spread section row title (the line under the eyebrow).

**Rule:** italic is reserved for the **page lead** (the one editorial title at
the top of a screen). Section titles below it are bold-serif so the
eyebrow → title → body stack reads as a declarative magazine subhead, not a
soft pull quote. Two italic Playfair titles competing in the same fold reads
as decorative noise.

### Eyebrow row — three elements

The "01 — FIND A DONOR" pattern. Three elements in one row, all with
`lineHeight: 22`, `includeFontPadding: false`, `textAlignVertical: 'center'`
so they share an optical baseline.

**Chip wrapper — clear, no bg.** When the eyebrow row sits inside a paper-
bubble section, the bubble itself supplies the visual backing — no inner
cream chip. Keep the row as a flex container only (`alignSelf:'flex-start'`
so it hugs its content, no `backgroundColor`/`borderRadius`/`padding`).
Tinted chips inside an already-elevated bubble read as visual double-duty.

```ts
eyebrowChip:  { flexDirection: 'row', alignItems: 'center',
                alignSelf: 'flex-start', marginBottom: 8 }
eyebrowNum:   { fontSize: 20, fontFamily: headerItalic, italic, color: rust, marginRight: 10 }
eyebrowDash:  { fontSize: 14, fontFamily: body,         color: textMid, marginRight: 10 }
eyebrow:      { fontSize: 11, fontFamily: bodySemiBold, color: rust, letterSpacing: 1.6, uppercase }
```

Solo eyebrow (no numeral, no dash) **same** values as `eyebrow` above.

| Drift seen today | Resolution |
|---|---|
| 4 different eyebrow sizes (10 / 10 / 11 / 11) | Pin to **11** |
| 4 different letter-spacings (1.4 / 1.5 / 1.6 / 2) | Pin to **1.6** |
| 5 different colors (rust / rustDark / olive / textMid / diner) | Default **rust**; olive only on always-here / preventive cards (e.g. early-postpartum crisis card); never textMid |

### Body
**Canonical:** `fontSize: 14, lineHeight: 20, fontFamily: FONTS.body, color: COLORS.textMid`

Already consistent across surfaces — leave alone.

### Compact body (cards, secondary copy)
**Canonical:** `fontSize: 13, lineHeight: 18-19, color: textMid`

### Small caps label / metadata
**Canonical:** `fontSize: 11, letterSpacing: 0.5, textTransform: uppercase, fontFamily: bodyMedium, color: textLight`

### Italic accent / quote
Use Playfair Display Italic (`FONTS.headerItalic`) at the body size of its
container — never bump size for emphasis. Italic itself is the emphasis.

---

## 2. Spacing scale

### Header (page top)
- `paddingTop: 56` (status bar + breathing room)
- `paddingHorizontal: 20`
- `paddingBottom: 0` (the hairline closes the block)

### Section block
- `paddingHorizontal: 20`
- `paddingTop: 18` (was 28 pre-compactness pass — Milk Hub set the standard)
- Section-to-section: `sectionDivider` hairline w/ `marginTop: 22`

### Card
- `borderRadius: 16` for content cards (matchCard, sectionThumb, dashboard rows)
- `borderRadius: 18` for hero/statement cards (heroCard, statementCard, dashboardCard)
- `padding: 16` interior (content), `padding: 18` interior (hero)
- Border: `rgba(0,0,0,0.05)` on white-bg cards; `COLORS.ceramicDeep` on `COLORS.paper`-bg cards. **Pick one per surface, never mix within the same screen.**

### Editorial hero banner
Vertical hubs (Milk, Experts, Gear, Home) get one full-bleed photo banner at
the top of the page after the header. Photo carries the imagery for the
whole surface so per-section thumbnails can be dropped — the page reads as
one editorial spread instead of three competing crops. Eyebrow + Playfair
italic split-line lead + body sit overlaid bottom-left in cream-on-photo.
A warm `rgba(44,26,14,0.28)` scrim under the copy keeps contrast on bright
crops.

```ts
heroBanner: {
  marginHorizontal: 20, marginTop: 18,
  height: 220, borderRadius: 18, overflow: 'hidden',
  position: 'relative',
  shadowColor: brownDeep, shadowOpacity: 0.10, shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 }, elevation: 4,
}
heroBannerScrim:   { ...absoluteFill, backgroundColor: 'rgba(44,26,14,0.28)' }
heroBannerOverlay: { position: 'absolute', left: 20, right: 20, bottom: 18 }
heroBannerEyebrow: { 11pt, letterSpacing 1.6, cream, uppercase, opacity 0.92 }
heroBannerLead:    { 28/32, headerItalic, white }
heroBannerSub:     { 13/18, body, cream, opacity 0.88, maxWidth 320 }
```

When a hero banner is present, drop per-section thumbs and center section
text (`sectionTextCenter` + `sectionTitleCenter` + `sectionBodyCenter`) so
the eyebrow → title → body stack reads as a centered editorial column
under the banner image.

### Editorial section bubble
The discover-spread sections (find-a-donor / share-what-you-have, plus their
analogs across other verticals) sit in their own `paper` (#FDFAF5) bubble
lifted off the cream page with a warm brownDeep-tinted shadow. Everything in
the section — eyebrow chip, italic title, body, photo thumb, CTAs — lives
inside the bubble, so the section reads as one discrete card rather than
three pieces of typography on raw cream.

```ts
section: {
  backgroundColor: paper,                 // warm — never grey
  borderRadius: 18,
  paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16,
  marginHorizontal: 20,
  shadowColor: brownDeep,                 // warm shadow, not pure black
  shadowOpacity: 0.10,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 4,                           // Android parity
}
```

Bubbles separate themselves visually — drop hairline `sectionDivider`s
between adjacent bubbles. Use a 14pt vertical spacer instead so the eye
gets breathing room without an extra rule line competing with the rounded
edges.

### Photo thumbnail
- `width: 84, height: 84, borderRadius: 14`
- `backgroundColor: '#EFE6D8'` (cream-tone fallback while remote loads)
- `overflow: 'hidden'` so the rounded corner clips the image

### Hairline divider
- `height: 1, backgroundColor: 'rgba(44,26,14,0.08)'`
- `marginHorizontal: -20` for full-bleed (header bottom)
- `marginHorizontal: 20` for inline (between sections)

---

## 3. Decoration rule

**Photos are the primary decoration. Abstract marks are reserved for the page
header chrome only.** This is a global rule, derived from the moodboard
reference and confirmed via Milk Hub feedback ("scattered marks felt too
present").

### Where abstract marks belong
- **Page header titleBlock** — one `YolkCircle` + one `LeafSprig` (or one of
  each kind, max 2 marks). Sits behind the eyebrow → title stack.
- **HomeScreen statementCard** (the editorial hero) — moodboard uses a heavier
  mark cluster here. This is the one cross-screen exception. Keep ≤ 4 marks.
- **HomeScreen heroCard** — single `YolkCircle` accent + optional
  `ScribbleMark`. No more.
- **HomeScreen helpTile** quartet — one mark per tile, 1:1 with the tile.

### Where abstract marks DO NOT belong
- Section rows (Discover-spread) — let the photo carry it.
- AI Match card, dashboard card, donor card, specialist card, gear card, event
  card, perk card.
- Empty states, modals, sticky action bars, tab bars.

### Banned marks
- **`SparkleMark`** — per saved feedback. Currently used in `HomeScreen.statementCard`
  bottom-right. **Drift to fix.** Replace with `DotCluster` or remove entirely.

### Per-card rule
- **One rust accent per card.** If a card has a rust title, it doesn't get a
  rust CTA pill — use the diner pill instead. If a card has a rust mark, the
  CTA goes outline. Two rusts compete; one focuses.

---

## 4. Color usage

### Yolk (`COLORS.yolkLight`)
- **Primary CTA pill** — moodboard pattern (manual "Continue Week N",
  home hero CTA, milk Browse Nearby). `brownDeep` text on yolk, pill
  shape (`borderRadius: 999`). Reads as warm and editorial rather than
  the rust-on-cream "system button" look that competed with the rust
  accent typography.
- Help-tile background tint (Home `helpEmotional` tile)
- DecorativeMarks tint on header chrome (`YolkCircle` behind titleBlock)

### Rust (`COLORS.rust` / `rustDark`)
- Eyebrow text on standard sections (default)
- Active state on chips
- Secondary CTA outline pill (`borderColor: rust` + rust text, transparent fill)
- "Reactive" accents — crisis verdict on check-in, recall block, urgent

### Olive (`COLORS.olive`)
- "Preventive / always-here" accents — early-postpartum crisis card, NPI
  badge, accepting-patients status, weekly summary digest
- Quiet hours pill

### Diner (`COLORS.diner`)
- Editorial accents on the home statement hero (per moodboard v3)
- Section accent bars on Home
- Help-tile #4 (Ask Village)

### Brown deep (`COLORS.brownDeep`)
- All Playfair italic titles (page + section)
- Bold body emphasis

### Text mid / light
- `textMid`: body copy
- `textLight`: small-caps metadata, eyebrows that are *not* eyebrows-of-section
  (e.g. "saved" labels, footer notes)

---

## 5. Drift findings to fix during the screen sweep

These will be picked up as we move through Phase 1 and 2:

| # | Surface | Drift | Fix in phase |
|---|---|---|---|
| D1 | HomeScreen `statementCard` | Uses `SparkleMark` — banned per memory | Phase 1 task 3 |
| D2 | HomeScreen `sectionEyebrow` family | 5 size/spacing/color variants | Phase 1 task 3 |
| D3 | HomeScreen accent-bar pattern vs Milk hairline pattern | Two divergent section-break patterns | Phase 1 task 3 — pick hairline globally; keep accent-bar only on Home `sectionHeadingRow` (it's a sub-pattern, not a divider) |
| D4 | MilkConnectHome `headerTitle` | 38pt is one step above canonical | Already-shipped, optional adjust to 32 if it reads outsized in the simulator |
| D5 | ExpertsHomeScreen | No editorial header eyebrow + no decoration | Phase 1 task 4 — add eyebrow + one mark per the rule |
| D6 | GearBrowseScreen | List-heavy, no editorial header | Phase 1 task 5 |
| D7 | Card border colors | Mix of `rgba(0,0,0,0.05)` (Milk) and `ceramicDeep` (Home) within the app | Phase 3 task 9 — establish one per palette path |
| D8 | Card borderRadius | 12, 14, 16, 18 all in use | Phase 3 task 9 — use 16 for content, 18 for hero |

---

## 6. Quick-reference snippet

For new editorial section rows (Discover-spread pattern), copy this:

```tsx
<View style={styles.section}>
  <View style={styles.sectionRow}>
    <View style={styles.sectionText}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrowNum}>01</Text>
        <Text style={styles.eyebrowDash}>—</Text>
        <Text style={styles.eyebrow}>{t('section.eyebrow')}</Text>
      </View>
      <Text style={styles.sectionTitle}>{t('section.title')}</Text>
      <Text style={styles.sectionBody}>{t('section.body')}</Text>
    </View>
    <View style={styles.sectionThumb}>
      <Image source={{ uri: PHOTO_URL }} style={styles.sectionThumbImage} accessibilityIgnoresInvertColors />
    </View>
  </View>
  {/* CTAs sit BELOW the row, never crowd it */}
</View>
```

Style block lives in `MilkConnectHomeScreen.tsx` lines 298–467 — promote to a
shared module (`apps/mobile/src/components/shared/EditorialSection.tsx`) once a
second screen needs it (Phase 1 task 3 will trigger this).
